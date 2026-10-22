"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/shared/Icon";
import { useAppDialog } from "@/components/shared/AppDialog";
import { cn } from "@/lib/utils";
import {
  CHARGE_AMOUNT_STEPS,
  CHARGE_METHOD_LABEL,
  CHARGE_STATUS_LABEL,
  VOUCHER_TYPES,
  pendingLabel,
  voucherTypeLabel,
  type VoucherTypeKey,
  type WalletChargeDTO,
  type WalletSummaryDTO,
} from "@/lib/walletShared";

type MainTab = "vbank" | "voucher";
type VoucherMode = "purchase" | "pin";
type HistoryTab = "payments" | "vouchers";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** ISO → "2026-10-22 14:32" (한국 시간) */
function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

interface Props {
  initial: WalletSummaryDTO;
  merchantName: string;
  dbReady: boolean;
  defaultDepositor: string;
  autoApprovePurchase: boolean;
}

export default function WalletChargeClient({
  initial,
  merchantName,
  dbReady,
  defaultDepositor,
  autoApprovePurchase,
}: Props) {
  const [summary, setSummary] = useState<WalletSummaryDTO>(initial);
  const [tab, setTab] = useState<MainTab>("vbank");
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [issuedSnapshot, setIssued] = useState<WalletChargeDTO | null>(null);
  // 발급 패널은 최신 목록 기준으로 표시한다 (관리자 승인·기한 만료 후 낡은 "발급됨" 화면이 남지 않도록)
  const issued = issuedSnapshot
    ? (summary.charges.find((c) => c.id === issuedSnapshot.id) ??
      issuedSnapshot)
    : null;
  // 취소 요청 중인 항목 (중복 클릭 방지)
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<HistoryTab>("payments");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSummary({ balance: data.balance, charges: data.charges });
      }
    } catch {
      /* 목록 갱신 실패는 무시 (다음 동작 때 다시 시도) */
    }
  }, []);

  /** 충전 요청 공통 호출 */
  const submitCharge = useCallback(
    async (
      payload: Record<string, unknown>,
    ): Promise<WalletChargeDTO | null> => {
      setNotice(null);
      try {
        const res = await fetch("/api/wallet/charges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setNotice({
            type: "error",
            text: data.error || "요청을 처리하지 못했습니다.",
          });
          return null;
        }
        await refresh();
        return data.charge as WalletChargeDTO;
      } catch {
        setNotice({
          type: "error",
          text: "네트워크 오류가 발생했습니다. 다시 시도해 주세요.",
        });
        return null;
      }
    },
    [refresh],
  );

  const { appConfirm } = useAppDialog();
  // 확인창이 떠 있는 동안 다시 누르면 무시 (연속 탭으로 확인창이 겹치지 않도록)
  const confirmingRef = useRef(false);

  const cancelCharge = useCallback(
    async (id: string) => {
      if (cancellingId || confirmingRef.current) return;
      confirmingRef.current = true;
      let ok = false;
      try {
        ok = await appConfirm({
          title: "충전 요청 취소",
          message:
            "이 충전 요청을 취소할까요?\n취소한 요청은 되돌릴 수 없습니다.",
          type: "warning",
          confirmText: "네, 취소합니다",
          cancelText: "아니요",
        });
      } finally {
        confirmingRef.current = false;
      }
      if (!ok) return;
      setCancellingId(id);
      setNotice(null);
      try {
        const res = await fetch(
          `/api/wallet/charges/${encodeURIComponent(id)}/cancel`,
          { method: "POST" },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setNotice({
            type: "error",
            text: data.error || "취소하지 못했습니다.",
          });
          // 그 사이 승인·만료 등으로 상태가 바뀌었을 수 있으므로 목록을 다시 불러온다
          await refresh();
          return;
        }
        setSummary({ balance: data.balance, charges: data.charges });
        setIssued((cur) => (cur?.id === id ? null : cur));
        setNotice({ type: "success", text: "충전 요청을 취소했습니다." });
      } catch {
        setNotice({
          type: "error",
          text: "네트워크 오류가 발생했습니다. 다시 시도해 주세요.",
        });
      } finally {
        setCancellingId(null);
      }
    },
    [appConfirm, cancellingId, refresh],
  );

  const paymentRows = summary.charges.filter((c) => c.method !== "VOUCHER_PIN");
  const voucherRows = summary.charges.filter((c) => c.method === "VOUCHER_PIN");

  return (
    <div className="animate-fade-in pb-8" data-testid="wallet-page">
      {/* 상단 바 */}
      <div className="sticky top-12 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/my"
            className="text-gray-500 hover:text-gray-900"
            aria-label="마이페이지로"
          >
            <Icon
              name="ArrowRight"
              size={20}
              strokeWidth={1.5}
              className="rotate-180"
            />
          </Link>
          <h1 className="text-base font-bold text-gray-900">결제</h1>
        </div>
      </div>

      {/* 판매처 + 잔액 */}
      <div className="mx-4 mt-4 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[15px] font-extrabold tracking-wide text-gray-900">
              VANILLAFORM
            </p>
            <p
              className="mt-0.5 text-[11px] text-gray-500"
              data-testid="wallet-merchant"
            >
              {merchantName} · 충전 결제
            </p>
          </div>
          <Icon name="Wallet" size={20} className="opacity-70" />
        </div>
        <div className="mt-3 flex items-end justify-between border-t border-gray-100 pt-3">
          <span className="text-xs text-gray-500">현재 잔액</span>
          <span
            className="text-xl font-bold text-gray-900"
            data-testid="wallet-balance"
          >
            {won(summary.balance)}
          </span>
        </div>
      </div>

      {/* 목업 안내 */}
      <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
        <Icon
          name="Warning"
          size={16}
          className="mt-0.5 h-4 w-4 flex-shrink-0"
        />
        <p className="text-[11px] leading-relaxed text-amber-900">
          <b>목업(테스트) 화면입니다.</b> 실제 결제·입금이 이루어지지 않습니다.
          화면에 표시되는 가상계좌로 송금하지 마세요.{" "}
          {autoApprovePurchase
            ? "가상계좌·보유 상품권은 관리자 확인 후, 상품권 구매는 즉시(개발 모드) 잔액에 반영됩니다."
            : "충전은 관리자 확인 후 잔액에 반영됩니다."}
        </p>
      </div>

      {!dbReady && (
        <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] text-red-700">
          충전 결제 DB가 아직 준비되지 않아 충전을 진행할 수 없습니다.
          관리자에게 문의해 주세요.
        </div>
      )}

      <div className="px-4 mt-5">
        <h2 className="text-base font-bold text-gray-900">충전 결제</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          원하시는 충전 금액과 결제 수단을 선택해 주세요.
        </p>

        {/* 결제 방식 탭 */}
        <div
          className="mt-3 grid grid-cols-2 gap-2"
          role="tablist"
          aria-label="결제 방식"
        >
          <MainTabButton
            active={tab === "vbank"}
            onClick={() => {
              setTab("vbank");
              setNotice(null);
            }}
            icon="CreditCard"
            title="가상계좌 입금"
            desc="계좌로 입금하여 충전"
            testId="tab-vbank"
          />
          <MainTabButton
            active={tab === "voucher"}
            onClick={() => {
              setTab("voucher");
              setNotice(null);
            }}
            icon="Gift"
            title="상품권 충전"
            desc="구매하거나 PIN 등록"
            testId="tab-voucher"
          />
        </div>

        {notice && (
          <div
            role="status"
            data-testid="wallet-notice"
            className={cn(
              "mt-3 rounded-xl px-3 py-2.5 text-xs",
              notice.type === "success"
                ? "border border-brand-200 bg-brand-50 text-brand-800"
                : "border border-red-200 bg-red-50 text-red-700",
            )}
          >
            {notice.text}
          </div>
        )}

        <div
          className="mt-4"
          role="tabpanel"
          id="wallet-panel"
          aria-labelledby={tab === "vbank" ? "tab-vbank" : "tab-voucher"}
        >
          {tab === "vbank" ? (
            <VirtualAccountPanel
              disabled={!dbReady}
              defaultDepositor={defaultDepositor}
              issued={issued}
              onIssue={async (amount, depositorName) => {
                const charge = await submitCharge({
                  method: "VIRTUAL_ACCOUNT",
                  amount,
                  depositorName,
                });
                if (charge) {
                  setIssued(charge);
                  setNotice({
                    type: "success",
                    text: "가상계좌가 발급되었습니다. 관리자가 입금을 확인하면 잔액에 반영됩니다.",
                  });
                }
                return !!charge;
              }}
              onCancel={cancelCharge}
              cancellingId={cancellingId}
              onClearIssued={() => setIssued(null)}
            />
          ) : (
            <VoucherPanel
              disabled={!dbReady}
              autoApprovePurchase={autoApprovePurchase}
              onPurchase={async (voucherType, amount) => {
                const charge = await submitCharge({
                  method: "VOUCHER_PURCHASE",
                  voucherType,
                  amount,
                });
                if (charge) {
                  setHistoryTab("payments");
                  setNotice({
                    type: "success",
                    text:
                      charge.status === "COMPLETED"
                        ? `${voucherTypeLabel(voucherType)} ${won(amount)} 구매가 완료되어 잔액에 충전되었습니다.`
                        : `${voucherTypeLabel(voucherType)} ${won(amount)} 구매 요청이 접수되었습니다. 결제 확인 후 잔액에 반영됩니다.`,
                  });
                }
                return !!charge;
              }}
              onRegisterPin={async (voucherType, pin) => {
                const charge = await submitCharge({
                  method: "VOUCHER_PIN",
                  voucherType,
                  pin,
                });
                if (charge) {
                  setHistoryTab("vouchers");
                  setNotice({
                    type: "success",
                    text: "상품권이 등록되었습니다. 발행사 검증(관리자 확인) 후 사용 가능 금액이 잔액에 충전됩니다.",
                  });
                }
                return !!charge;
              }}
            />
          )}
        </div>

        <p className="mt-4 flex items-center justify-center gap-1 text-[11px] text-gray-500">
          <Icon name="Certified" size={12} />
          결제·상품권 검증 후 회원 잔액에 반영됩니다
        </p>
      </div>

      {/* 내역 */}
      <div className="px-4 mt-6">
        <div
          className="flex border-b border-gray-200"
          role="tablist"
          aria-label="충전 내역"
        >
          <HistoryTabButton
            active={historyTab === "payments"}
            onClick={() => setHistoryTab("payments")}
            label={`결제 내역 (${paymentRows.length})`}
            testId="history-payments"
          />
          <HistoryTabButton
            active={historyTab === "vouchers"}
            onClick={() => setHistoryTab("vouchers")}
            label={`상품권 등록 내역 (${voucherRows.length})`}
            testId="history-vouchers"
          />
        </div>
        <HistoryList
          rows={historyTab === "payments" ? paymentRows : voucherRows}
          emptyText={
            historyTab === "payments"
              ? "결제 내역이 없습니다."
              : "등록한 상품권이 없습니다."
          }
          onCancel={cancelCharge}
          cancellingId={cancellingId}
        />
      </div>
    </div>
  );
}

// ── 공통 UI ───────────────────────────────────────────────────────

function MainTabButton({
  active,
  onClick,
  icon,
  title,
  desc,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  desc: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={testId}
      aria-selected={active}
      aria-controls="wallet-panel"
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition-colors",
        active
          ? "border-brand-900 bg-brand-900 text-white"
          : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
      )}
    >
      <span
        className={cn(
          // 아주 좁은 화면(360px 미만)에서는 아이콘을 숨겨 글자가 중간에서 끊기지 않게 한다
          "hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg min-[360px]:flex",
          active ? "bg-white" : "bg-gray-100",
        )}
      >
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0">
        <span className="block break-keep text-[13px] font-bold">{title}</span>
        <span
          className={cn(
            "block break-keep text-[10px] leading-snug",
            active ? "text-white/70" : "text-gray-500",
          )}
        >
          {desc}
        </span>
      </span>
    </button>
  );
}

function HistoryTabButton({
  active,
  onClick,
  label,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "-mb-px flex-1 border-b-2 py-2.5 text-xs font-semibold transition-colors",
        active
          ? "border-brand-900 text-gray-900"
          : "border-transparent text-gray-500 hover:text-gray-700",
      )}
    >
      {label}
    </button>
  );
}

/** 금액 버튼 (누를 때마다 합산) + 합계 + 초기화 */
function AmountPicker({
  total,
  onChange,
  label,
  totalLabel,
  disabled,
}: {
  total: number;
  onChange: (v: number) => void;
  label: string;
  totalLabel: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-bold text-gray-900">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {CHARGE_AMOUNT_STEPS.map((step) => (
          <button
            key={step}
            type="button"
            disabled={disabled}
            onClick={() => onChange(total + step)}
            data-testid={`amount-${step}`}
            className="rounded-full border border-gray-200 bg-white py-2.5 text-[13px] font-medium text-gray-800 transition-colors hover:border-brand-400 hover:bg-brand-50 active:scale-[0.98] disabled:opacity-50"
          >
            + {step.toLocaleString("ko-KR")}원
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-gray-500">
        금액 버튼을 두 번 누르면 해당 금액이 두 번 합산됩니다.
      </p>
      <div className="mt-3 rounded-xl bg-gray-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">{totalLabel}</span>
          <button
            type="button"
            onClick={() => onChange(0)}
            disabled={disabled || total === 0}
            data-testid="amount-reset"
            className="-my-2 -mr-2 flex items-center gap-1 rounded-md px-2 py-2 text-[11px] text-gray-500 hover:text-gray-800 disabled:opacity-40"
          >
            <Icon name="ResetFilter" size={12} />
            초기화
          </button>
        </div>
        <p
          className="mt-1 text-right text-xl font-bold text-gray-900"
          data-testid="amount-total"
        >
          {won(total)}
        </p>
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      data-testid={testId}
      className="mt-3 w-full rounded-full bg-brand-600 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
    >
      {loading ? "처리 중..." : children}
    </button>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ── 가상계좌 입금 ─────────────────────────────────────────────────

function VirtualAccountPanel({
  disabled,
  defaultDepositor,
  issued,
  onIssue,
  onCancel,
  cancellingId,
  onClearIssued,
}: {
  disabled: boolean;
  defaultDepositor: string;
  issued: WalletChargeDTO | null;
  onIssue: (amount: number, depositorName: string) => Promise<boolean>;
  onCancel: (id: string) => Promise<void>;
  cancellingId: string | null;
  onClearIssued: () => void;
}) {
  const [total, setTotal] = useState(0);
  const [depositor, setDepositor] = useState(defaultDepositor);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (issued && issued.status === "PENDING") {
    return (
      <div
        className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4"
        data-testid="vbank-issued"
      >
        <p className="text-sm font-bold text-gray-900">
          가상계좌가 발급되었습니다
        </p>
        <p className="mt-0.5 text-[11px] text-gray-500">
          아래 계좌로 입금기한 내에 입금해 주세요. (목업 계좌)
        </p>
        <dl className="mt-3 space-y-2 rounded-xl bg-white p-3 text-xs">
          <Row label="은행" value={issued.vbankName ?? "-"} />
          <div className="flex items-center justify-between gap-2">
            <dt className="text-gray-500">계좌번호</dt>
            <dd className="flex items-center gap-1.5 font-semibold text-gray-900">
              <span data-testid="vbank-account">{issued.vbankAccount}</span>
              <button
                type="button"
                onClick={async () => {
                  if (
                    issued.vbankAccount &&
                    (await copyText(issued.vbankAccount))
                  ) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }
                }}
                className="rounded-md border border-gray-200 px-2 py-1.5 text-[10px] text-gray-600 hover:bg-gray-50"
              >
                {copied ? "복사됨" : "복사"}
              </button>
            </dd>
          </div>
          <Row label="예금주" value={issued.vbankHolder ?? "-"} />
          <Row label="입금자명" value={issued.depositorName ?? "-"} />
          <Row label="입금 금액" value={won(issued.amount)} strong />
          <Row label="입금기한" value={formatDateTime(issued.vbankDueAt)} />
        </dl>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onCancel(issued.id)}
            disabled={!!cancellingId}
            data-testid="vbank-cancel"
            className="rounded-full border border-gray-300 bg-white py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {cancellingId === issued.id ? "취소 중..." : "발급 취소"}
          </button>
          <button
            type="button"
            onClick={() => {
              onClearIssued();
              setTotal(0);
            }}
            data-testid="vbank-new"
            className="rounded-full bg-gray-900 py-2.5 text-xs font-semibold text-white hover:bg-gray-800"
          >
            새로 충전하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AmountPicker
        total={total}
        onChange={setTotal}
        label="충전 금액 선택"
        totalLabel="총 결제 금액"
        disabled={disabled || loading}
      />
      <label className="mt-3 block">
        <span className="text-xs font-semibold text-gray-700">입금자명</span>
        <input
          type="text"
          value={depositor}
          maxLength={30}
          onChange={(e) => setDepositor(e.target.value)}
          placeholder="입금하실 분의 이름"
          data-testid="vbank-depositor"
          className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </label>
      <PrimaryButton
        testId="vbank-issue"
        disabled={disabled || total === 0}
        loading={loading}
        onClick={async () => {
          setLoading(true);
          const ok = await onIssue(total, depositor);
          setLoading(false);
          if (ok) setTotal(0);
        }}
      >
        가상계좌 발급하기 →
      </PrimaryButton>
      <p className="mt-2 text-center text-[11px] text-gray-500">
        결제 완료 후 충전 내역은 아래 결제 내역에서 확인할 수 있습니다.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd
        className={cn(
          "text-right",
          strong ? "font-bold text-brand-700" : "font-medium text-gray-900",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

// ── 상품권 충전 ───────────────────────────────────────────────────

function VoucherPanel({
  disabled,
  autoApprovePurchase,
  onPurchase,
  onRegisterPin,
}: {
  disabled: boolean;
  autoApprovePurchase: boolean;
  onPurchase: (voucherType: VoucherTypeKey, amount: number) => Promise<boolean>;
  onRegisterPin: (voucherType: VoucherTypeKey, pin: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<VoucherMode>("purchase");
  const [voucherType, setVoucherType] = useState<VoucherTypeKey>("LOTTE");
  const [total, setTotal] = useState(0);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <p className="text-sm font-bold text-gray-900">상품권 충전 방법</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <ModeCard
          active={mode === "purchase"}
          onClick={() => setMode("purchase")}
          icon="Gift"
          title="상품권 구매"
          desc="구매 후 충전"
          testId="voucher-mode-purchase"
        />
        <ModeCard
          active={mode === "pin"}
          onClick={() => setMode("pin")}
          icon="Coupon"
          title="보유 상품권"
          desc="PIN 등록 충전"
          testId="voucher-mode-pin"
        />
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <p className="text-sm font-bold text-gray-900">상품권 종류 선택</p>
        <div className="mt-2 space-y-2" role="radiogroup">
          {VOUCHER_TYPES.map((v) => (
            <label
              key={v.key}
              className="flex cursor-pointer items-center gap-2.5 text-[13px] text-gray-800"
            >
              <input
                type="radio"
                name="voucherType"
                value={v.key}
                checked={voucherType === v.key}
                onChange={() => setVoucherType(v.key)}
                data-testid={`voucher-type-${v.key}`}
                className="h-4 w-4 accent-brand-700"
              />
              {v.label}
            </label>
          ))}
        </div>
      </div>

      {mode === "purchase" ? (
        <div className="mt-4">
          <AmountPicker
            total={total}
            onChange={setTotal}
            label="상품권 구매 금액"
            totalLabel="총 구매 금액"
            disabled={disabled || loading}
          />
          <PrimaryButton
            testId="voucher-purchase"
            disabled={disabled || total === 0}
            loading={loading}
            onClick={async () => {
              setLoading(true);
              const ok = await onPurchase(voucherType, total);
              setLoading(false);
              if (ok) setTotal(0);
            }}
          >
            상품권 구매하기 →
          </PrimaryButton>
          <p className="mt-2 text-center text-[11px] text-gray-500">
            {autoApprovePurchase
              ? "개발 모드: 구매 즉시 잔액에 충전됩니다 (목업)"
              : "결제 확인 후 잔액에 반영됩니다 (목업)"}
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <label className="block">
            <span className="text-sm font-bold text-gray-900">
              보유 상품권 PIN 번호
            </span>
            <input
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              placeholder="상품권 PIN 번호 입력 (예: XXXX-XXXX-XXXX-XXXX)"
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              data-testid="voucher-pin"
              className="mt-2 w-full rounded-full border border-gray-200 px-4 py-2.5 text-sm tracking-wide focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <ul className="mt-2 space-y-0.5 rounded-xl bg-gray-50 px-3 py-2.5 text-[11px] text-gray-500">
            <li>
              • 상품권 발행사의 유효성 검증 후 사용 가능 금액이 충전됩니다.
            </li>
            <li>• PIN 번호는 대소문자를 구분하지 않습니다.</li>
            <li>• 이미 등록·사용된 상품권은 다시 사용할 수 없습니다.</li>
          </ul>
          <PrimaryButton
            testId="voucher-pin-submit"
            disabled={disabled || pin.replace(/[\s-]/g, "").length === 0}
            loading={loading}
            onClick={async () => {
              setLoading(true);
              const ok = await onRegisterPin(voucherType, pin);
              setLoading(false);
              if (ok) setPin("");
            }}
          >
            상품권 사용하기 →
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  desc,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  desc: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors",
        active
          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
          : "border-gray-200 bg-white hover:bg-gray-50",
      )}
    >
      <Icon name={icon} size={18} />
      <span className="text-[13px] font-semibold text-gray-900">{title}</span>
      <span className="text-[10px] text-gray-500">{desc}</span>
    </button>
  );
}

// ── 내역 ──────────────────────────────────────────────────────────

function statusBadge(c: WalletChargeDTO) {
  const label =
    c.status === "PENDING"
      ? pendingLabel(c.method)
      : CHARGE_STATUS_LABEL[c.status];
  const cls =
    c.status === "COMPLETED"
      ? "bg-emerald-50 text-emerald-700"
      : c.status === "PENDING"
        ? "bg-amber-50 text-amber-700"
        : "bg-gray-100 text-gray-600";
  return (
    <span
      className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cls)}
    >
      {label}
    </span>
  );
}

function HistoryList({
  rows,
  emptyText,
  onCancel,
  cancellingId,
}: {
  rows: WalletChargeDTO[];
  emptyText: string;
  onCancel: (id: string) => Promise<void>;
  cancellingId: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p
        className="py-10 text-center text-xs text-gray-500"
        data-testid="history-empty"
      >
        {emptyText}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-gray-100" data-testid="history-list">
      {rows.map((c) => (
        <li
          key={c.id}
          className="py-3"
          data-testid="history-item"
          data-status={c.status}
          data-method={c.method}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-500">
              {formatDateTime(c.createdAt)}
            </span>
            {statusBadge(c)}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                  c.method === "VIRTUAL_ACCOUNT"
                    ? "bg-sky-50 text-sky-700"
                    : "bg-violet-50 text-violet-700",
                )}
              >
                {CHARGE_METHOD_LABEL[c.method]}
              </span>
              <span className="text-[13px] text-gray-800">
                {c.method === "VIRTUAL_ACCOUNT"
                  ? "잔액 충전"
                  : voucherTypeLabel(c.voucherType)}
              </span>
            </span>
            <span className="text-sm font-bold text-gray-900">
              {c.method === "VOUCHER_PIN" && c.status === "PENDING"
                ? "금액 확인 중"
                : c.method === "VOUCHER_PIN" && c.status !== "COMPLETED"
                  ? "-"
                  : won(c.amount)}
            </span>
          </div>
          {c.method === "VIRTUAL_ACCOUNT" && c.vbankAccount && (
            <p className="mt-1 text-[11px] text-gray-500">
              {c.vbankName} {c.vbankAccount}
              {c.status === "PENDING" && c.vbankDueAt
                ? ` · ${formatDateTime(c.vbankDueAt)}까지`
                : ""}
            </p>
          )}
          {c.voucherPinMasked && (
            <p className="mt-1 text-[11px] text-gray-500">
              PIN {c.voucherPinMasked}
            </p>
          )}
          {c.status === "REJECTED" && c.adminMemo && (
            <p className="mt-1 text-[11px] text-red-600">
              반려 사유: {c.adminMemo}
            </p>
          )}
          {c.status === "PENDING" && (
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => onCancel(c.id)}
                disabled={!!cancellingId}
                data-testid="history-cancel"
                className="rounded-full border border-gray-200 px-3.5 py-2 text-[11px] text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {cancellingId === c.id ? "취소 중..." : "요청 취소"}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
