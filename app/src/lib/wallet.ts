// 충전 결제(목업) — 서버 전용 로직.
//
// 현재 단계에서는 실제 PG(가상계좌)·상품권 검증 API 없이 모의 동작한다.
//  - 가상계좌: 가짜 계좌번호를 발급하고, 관리자가 "입금 확인"하면 잔액에 반영한다.
//  - 보유 상품권(PIN): 형식만 검사하고, 관리자가 검증 후 금액을 입력해 승인하면 반영한다.
//  - 상품권 구매: 개발 모드(또는 WALLET_MOCK_AUTO_APPROVE=true)에서는 즉시 충전,
//    그 외(실서버)에서는 관리자 "결제 확인" 후 반영한다. (무료 잔액 생성 방지)
// 실연동 시에는 issueVirtualAccount / verifyVoucher 에 해당하는 부분만 교체하면 된다.
//
// 잔액 변경은 모두 creditCharge 한 곳을 거치며, 트랜잭션 안에서
// "대기 → 완료" 상태 전이(조건부 update)와 잔액 증가·원장 기록을 함께 처리해 중복 반영을 막는다.

import { createHmac, randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { isMissingDbColumnError } from "@/lib/prismaErrors";
import {
  BRANCH_SELLER_SLUG,
  CHARGE_MAX_AMOUNT,
  CHARGE_MIN_AMOUNT,
  DEFAULT_MERCHANT_NAME,
  MAX_PENDING_CHARGES,
  VBANK_DUE_HOURS,
  VOUCHER_PIN_MAX_LENGTH,
  VOUCHER_PIN_MIN_LENGTH,
  VOUCHER_TYPES,
  type VoucherTypeKey,
  type WalletChargeDTO,
  type WalletChargeMethodKey,
  type WalletSummaryDTO,
} from "@/lib/walletShared";

export class WalletError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** 상품권 구매를 승인 없이 즉시 충전할지 (개발 모드 기본 on, 실서버 기본 off) */
export function isWalletAutoApproveEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.WALLET_MOCK_AUTO_APPROVE === "true";
}

// ── 금액 / 상품권 검증 ────────────────────────────────────────────

export function assertChargeAmount(value: unknown, min = CHARGE_MIN_AMOUNT): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n)) {
    throw new WalletError("충전 금액이 올바르지 않습니다.");
  }
  if (n < min) throw new WalletError(`충전 금액은 ${min.toLocaleString("ko-KR")}원 이상이어야 합니다.`);
  if (n > CHARGE_MAX_AMOUNT) {
    throw new WalletError(`1회 충전 한도는 ${CHARGE_MAX_AMOUNT.toLocaleString("ko-KR")}원입니다.`);
  }
  if (n % 1000 !== 0) throw new WalletError("충전 금액은 1,000원 단위여야 합니다.");
  return n;
}

export function assertVoucherType(value: unknown): VoucherTypeKey {
  const found = VOUCHER_TYPES.find((v) => v.key === value);
  if (!found) throw new WalletError("상품권 종류를 선택해 주세요.");
  return found.key;
}

/** PIN 정규화: 공백·하이픈 제거 + 대문자 (대소문자 구분 없음) */
export function normalizeVoucherPin(raw: unknown): string {
  if (typeof raw !== "string") throw new WalletError("상품권 PIN 번호를 입력해 주세요.");
  const pin = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!pin) throw new WalletError("상품권 PIN 번호를 입력해 주세요.");
  if (!/^[A-Z0-9]+$/.test(pin)) throw new WalletError("PIN 번호는 영문과 숫자만 입력할 수 있습니다.");
  if (pin.length < VOUCHER_PIN_MIN_LENGTH || pin.length > VOUCHER_PIN_MAX_LENGTH) {
    throw new WalletError(
      `PIN 번호는 ${VOUCHER_PIN_MIN_LENGTH}~${VOUCHER_PIN_MAX_LENGTH}자리여야 합니다.`,
    );
  }
  return pin;
}

/** 표시용 마스킹: 앞 4자리 + XXXX + 뒤 4자리 */
export function maskVoucherPin(pin: string): string {
  return `${pin.slice(0, 4)}-XXXX-${pin.slice(-4)}`;
}

/** 중복 등록 방지용 해시. 원문 PIN 은 어디에도 저장하지 않는다 */
export function hashVoucherPin(type: VoucherTypeKey, pin: string): string {
  const secret = process.env.WALLET_PIN_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new WalletError("서버 설정이 완료되지 않아 상품권을 등록할 수 없습니다.", 503);
  return createHmac("sha256", secret).update(`${type}:${pin}`).digest("hex");
}

// ── 모의 가상계좌 ─────────────────────────────────────────────────

/** 목업 가상계좌. 실제 은행 계좌가 아니며, 은행명에 "목업"을 명시한다 */
function issueMockVirtualAccount() {
  const mid = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const tail = String(randomInt(0, 100)).padStart(2, "0");
  const last = String(randomInt(0, 1000)).padStart(3, "0");
  return {
    vbankName: "목업은행 (테스트)",
    vbankAccount: `999-${mid}-${tail}-${last}`,
    vbankHolder: "바닐라폼(목업)",
    vbankDueAt: new Date(Date.now() + VBANK_DUE_HOURS * 60 * 60 * 1000),
  };
}

// ── 조회 ──────────────────────────────────────────────────────────

/** 결제창 머리글의 판매처 이름 (테스트 셀러 "바닐라폼 지점") */
export async function getBranchMerchantName(): Promise<string> {
  try {
    const branch = await prisma.sellerProfile.findUnique({
      where: { slug: BRANCH_SELLER_SLUG },
      select: { shopName: true, isApproved: true },
    });
    return branch?.isApproved && branch.shopName ? branch.shopName : DEFAULT_MERCHANT_NAME;
  } catch {
    return DEFAULT_MERCHANT_NAME;
  }
}

/** 입금기한이 지난 가상계좌 대기 건을 만료 처리 (조회 시점에 지연 처리) */
export async function expireOverdueCharges(userId?: string): Promise<void> {
  await prisma.walletCharge.updateMany({
    where: {
      ...(userId ? { userId } : {}),
      method: "VIRTUAL_ACCOUNT",
      status: "PENDING",
      vbankDueAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });
}

type ChargeRow = {
  id: string;
  method: string;
  status: string;
  amount: number;
  merchantName: string | null;
  vbankName: string | null;
  vbankAccount: string | null;
  vbankHolder: string | null;
  vbankDueAt: Date | null;
  depositorName: string | null;
  voucherType: string | null;
  voucherPinMasked: string | null;
  adminMemo: string | null;
  processedAt: Date | null;
  createdAt: Date;
};

export function toChargeDTO(row: ChargeRow): WalletChargeDTO {
  return {
    id: row.id,
    method: row.method as WalletChargeDTO["method"],
    status: row.status as WalletChargeDTO["status"],
    amount: row.amount,
    merchantName: row.merchantName,
    vbankName: row.vbankName,
    vbankAccount: row.vbankAccount,
    vbankHolder: row.vbankHolder,
    vbankDueAt: row.vbankDueAt ? row.vbankDueAt.toISOString() : null,
    depositorName: row.depositorName,
    voucherType: row.voucherType,
    voucherPinMasked: row.voucherPinMasked,
    adminMemo: row.adminMemo,
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export const CHARGE_DTO_SELECT = {
  id: true,
  method: true,
  status: true,
  amount: true,
  merchantName: true,
  vbankName: true,
  vbankAccount: true,
  vbankHolder: true,
  vbankDueAt: true,
  depositorName: true,
  voucherType: true,
  voucherPinMasked: true,
  adminMemo: true,
  processedAt: true,
  createdAt: true,
} as const;

export async function getWalletSummary(userId: string, take = 50): Promise<WalletSummaryDTO> {
  await expireOverdueCharges(userId);
  const [wallet, charges] = await Promise.all([
    prisma.userWallet.findUnique({ where: { userId }, select: { balance: true } }),
    prisma.walletCharge.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: CHARGE_DTO_SELECT,
    }),
  ]);
  return { balance: wallet?.balance ?? 0, charges: charges.map(toChargeDTO) };
}

/**
 * 마이페이지 등 다른 화면에서 쓰는 잔액 조회.
 * 새 테이블이 아직 DB 에 반영되지 않았거나(배포 직후 db push 전) 오류가 나도
 * 화면 전체가 깨지지 않도록 null 을 돌려준다.
 */
export async function getWalletBalanceSafe(userId: string): Promise<number | null> {
  try {
    const wallet = await prisma.userWallet.findUnique({ where: { userId }, select: { balance: true } });
    return wallet?.balance ?? 0;
  } catch (e) {
    if (!isMissingDbColumnError(e)) console.error("[wallet] 잔액 조회 실패:", e);
    return null;
  }
}

// ── 충전 요청 생성 ────────────────────────────────────────────────

export interface CreateChargeInput {
  method: unknown;
  amount?: unknown;
  voucherType?: unknown;
  pin?: unknown;
  depositorName?: unknown;
}

export async function createCharge(
  userId: string,
  userName: string | null | undefined,
  input: CreateChargeInput,
): Promise<{ charge: WalletChargeDTO; balance: number; autoApproved: boolean }> {
  const method = input.method as WalletChargeMethodKey;
  if (method !== "VIRTUAL_ACCOUNT" && method !== "VOUCHER_PURCHASE" && method !== "VOUCHER_PIN") {
    throw new WalletError("결제 방식을 선택해 주세요.");
  }

  await expireOverdueCharges(userId);
  const pendingCount = await prisma.walletCharge.count({ where: { userId, status: "PENDING" } });
  if (pendingCount >= MAX_PENDING_CHARGES) {
    throw new WalletError(
      `처리 대기 중인 충전 요청이 ${MAX_PENDING_CHARGES}건 있습니다. 기존 요청이 처리되거나 취소한 뒤 다시 시도해 주세요.`,
      429,
    );
  }

  const merchantName = await getBranchMerchantName();

  if (method === "VIRTUAL_ACCOUNT") {
    const amount = assertChargeAmount(input.amount);
    const depositorRaw = typeof input.depositorName === "string" ? input.depositorName.trim() : "";
    const depositorName = (depositorRaw || userName || "").slice(0, 30) || null;
    const va = issueMockVirtualAccount();
    const row = await prisma.walletCharge.create({
      data: { userId, method, amount, merchantName, depositorName, ...va, isMock: true },
      select: CHARGE_DTO_SELECT,
    });
    const balance = await currentBalance(userId);
    return { charge: toChargeDTO(row), balance, autoApproved: false };
  }

  if (method === "VOUCHER_PURCHASE") {
    const voucherType = assertVoucherType(input.voucherType);
    const amount = assertChargeAmount(input.amount);
    const row = await prisma.walletCharge.create({
      data: { userId, method, amount, merchantName, voucherType, isMock: true },
      select: { id: true },
    });
    if (isWalletAutoApproveEnabled()) {
      await creditCharge(row.id, null, { memo: "개발 모드 자동 승인 (목업)" });
    }
    const fresh = await prisma.walletCharge.findUniqueOrThrow({ where: { id: row.id }, select: CHARGE_DTO_SELECT });
    const balance = await currentBalance(userId);
    return { charge: toChargeDTO(fresh), balance, autoApproved: fresh.status === "COMPLETED" };
  }

  // VOUCHER_PIN
  const voucherType = assertVoucherType(input.voucherType);
  const pin = normalizeVoucherPin(input.pin);
  const voucherPinHash = hashVoucherPin(voucherType, pin);
  try {
    const row = await prisma.walletCharge.create({
      data: {
        userId,
        method,
        amount: 0, // 검증(승인) 시 확정
        merchantName,
        voucherType,
        voucherPinMasked: maskVoucherPin(pin),
        voucherPinHash,
        isMock: true,
      },
      select: CHARGE_DTO_SELECT,
    });
    const balance = await currentBalance(userId);
    return { charge: toChargeDTO(row), balance, autoApproved: false };
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      throw new WalletError("이미 등록되었거나 사용된 상품권입니다.", 409);
    }
    throw e;
  }
}

async function currentBalance(userId: string): Promise<number> {
  const w = await prisma.userWallet.findUnique({ where: { userId }, select: { balance: true } });
  return w?.balance ?? 0;
}

/** 지갑 행을 미리 만들어 둔다 (동시 생성 충돌은 무시) */
async function ensureWallet(userId: string): Promise<void> {
  try {
    await prisma.userWallet.upsert({ where: { userId }, create: { userId }, update: {} });
  } catch (e) {
    if ((e as { code?: string })?.code !== "P2002") throw e;
  }
}

// ── 처리 (승인 / 반려 / 취소) ─────────────────────────────────────

/**
 * 충전 승인 → 잔액 반영. 잔액이 바뀌는 유일한 경로.
 * - 대기(PENDING) 상태일 때만 완료로 바꾸며, 조건부 update 로 중복 승인을 막는다.
 * - 보유 상품권(PIN)은 검증된 금액(amount)을 관리자가 입력해야 한다.
 */
export async function creditCharge(
  chargeId: string,
  processedById: string | null,
  opts: { amount?: unknown; memo?: string | null } = {},
): Promise<{ balance: number; amount: number }> {
  const charge = await prisma.walletCharge.findUnique({
    where: { id: chargeId },
    select: { id: true, userId: true, method: true, status: true, amount: true, vbankDueAt: true },
  });
  if (!charge) throw new WalletError("충전 요청을 찾을 수 없습니다.", 404);
  if (charge.status !== "PENDING") throw new WalletError("이미 처리된 요청입니다.", 409);
  if (charge.method === "VIRTUAL_ACCOUNT" && charge.vbankDueAt && charge.vbankDueAt < new Date()) {
    await expireOverdueCharges(charge.userId);
    throw new WalletError("입금기한이 지난 가상계좌입니다.", 409);
  }

  const amount =
    charge.method === "VOUCHER_PIN" ? assertChargeAmount(opts.amount, 1000) : charge.amount;
  if (amount <= 0) throw new WalletError("충전 금액이 올바르지 않습니다.");
  const memo = opts.memo ? String(opts.memo).slice(0, 500) : null;

  await ensureWallet(charge.userId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.walletCharge.updateMany({
      where: { id: chargeId, status: "PENDING" },
      data: {
        status: "COMPLETED",
        amount,
        processedAt: new Date(),
        processedById,
        ...(memo ? { adminMemo: memo } : {}),
      },
    });
    if (updated.count !== 1) throw new WalletError("이미 처리된 요청입니다.", 409);

    const wallet = await tx.userWallet.update({
      where: { userId: charge.userId },
      data: { balance: { increment: amount } },
      select: { balance: true },
    });
    await tx.walletLedger.create({
      data: {
        userId: charge.userId,
        chargeId,
        type: "CHARGE",
        amount,
        balanceAfter: wallet.balance,
        memo,
      },
    });
    return { balance: wallet.balance, amount };
  });
}

export async function rejectCharge(chargeId: string, processedById: string, memo?: string | null): Promise<void> {
  const updated = await prisma.walletCharge.updateMany({
    where: { id: chargeId, status: "PENDING" },
    data: {
      status: "REJECTED",
      voucherPinHash: null, // 반려된 PIN 은 다시 등록할 수 있게 풀어준다
      processedAt: new Date(),
      processedById,
      adminMemo: memo ? String(memo).slice(0, 500) : null,
    },
  });
  if (updated.count !== 1) {
    const exists = await prisma.walletCharge.count({ where: { id: chargeId } });
    throw new WalletError(exists ? "이미 처리된 요청입니다." : "충전 요청을 찾을 수 없습니다.", exists ? 409 : 404);
  }
}

/** 회원 본인의 대기 중 요청 취소 */
export async function cancelChargeByUser(chargeId: string, userId: string): Promise<void> {
  const updated = await prisma.walletCharge.updateMany({
    where: { id: chargeId, userId, status: "PENDING" },
    data: { status: "CANCELLED", voucherPinHash: null, processedAt: new Date() },
  });
  if (updated.count !== 1) {
    const mine = await prisma.walletCharge.count({ where: { id: chargeId, userId } });
    throw new WalletError(mine ? "이미 처리된 요청은 취소할 수 없습니다." : "충전 요청을 찾을 수 없습니다.", mine ? 409 : 404);
  }
}

// ── API 공통 ──────────────────────────────────────────────────────

/** API 라우트 공통 오류 응답 */
export function walletErrorResponse(e: unknown): Response {
  if (e instanceof WalletError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  if (isMissingDbColumnError(e)) {
    return Response.json(
      { error: "충전 결제 기능의 DB가 아직 준비되지 않았습니다. 관리자에게 문의해 주세요." },
      { status: 503 },
    );
  }
  console.error("[wallet] 처리 오류:", e);
  return Response.json({ error: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
}
