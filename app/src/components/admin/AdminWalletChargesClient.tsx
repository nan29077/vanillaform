"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/shared/Icon";
import { cn } from "@/lib/utils";
import {
  CHARGE_METHOD_LABEL,
  CHARGE_STATUS_LABEL,
  voucherTypeLabel,
  type WalletChargeDTO,
} from "@/lib/walletShared";

type StatusFilter = "PENDING" | "COMPLETED" | "CLOSED" | "ALL";

interface AdminChargeRow extends WalletChargeDTO {
  user: { id: string; name: string; email: string };
}

interface ListResponse {
  items: AdminChargeRow[];
  total: number;
  page: number;
  pageSize: number;
  pending: { count: number; amount: number };
}

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "PENDING", label: "처리 대기" },
  { key: "COMPLETED", label: "충전 완료" },
  { key: "CLOSED", label: "반려·취소·만료" },
  { key: "ALL", label: "전체" },
];

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function AdminWalletChargesClient() {
  const [filter, setFilter] = useState<StatusFilter>("PENDING");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/wallet-charges?status=${filter}&page=${page}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "목록을 불러오지 못했습니다.");
        setData(null);
      } else {
        setData(json as ListResponse);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(
    async (id: string, body: { action: "approve" | "reject"; amount?: number; memo?: string }) => {
      setError("");
      setMessage("");
      const res = await fetch(`/api/admin/wallet-charges/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "처리하지 못했습니다.");
        await load();
        return false;
      }
      setMessage(
        body.action === "approve"
          ? `승인 완료 — ${won(json.amount)} 충전 (회원 잔액 ${won(json.balance)})`
          : "반려 처리했습니다.",
      );
      await load();
      return true;
    },
    [load],
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4" data-testid="admin-wallet-page">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Icon name="CreditCard" size={20} />
          충전 관리 <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">목업</span>
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          회원의 가상계좌 입금·상품권 충전 요청을 확인해 승인하면 회원 잔액에 반영됩니다. 실제 PG·상품권 검증 API가
          연동되기 전까지는 이 화면에서 수동으로 확인합니다.
        </p>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[11px] text-amber-800">처리 대기</p>
            <p className="text-lg font-bold text-amber-900" data-testid="admin-pending-count">
              {data.pending.count}건
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-[11px] text-gray-500">대기 금액 (확정분)</p>
            <p className="text-lg font-bold text-gray-900">{won(data.pending.amount)}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setFilter(f.key);
              setPage(1);
            }}
            data-testid={`admin-filter-${f.key}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium",
              filter === f.key ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600",
            )}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={load}
          className="ml-auto rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600"
        >
          새로고침
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" data-testid="admin-message">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" data-testid="admin-error">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">요청일시</th>
              <th className="px-3 py-2.5 font-medium">회원</th>
              <th className="px-3 py-2.5 font-medium">방식</th>
              <th className="px-3 py-2.5 font-medium">상세</th>
              <th className="px-3 py-2.5 text-right font-medium">금액</th>
              <th className="px-3 py-2.5 font-medium">상태</th>
              <th className="px-3 py-2.5 font-medium">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-gray-400">
                  불러오는 중...
                </td>
              </tr>
            )}
            {!loading && data && data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-gray-400" data-testid="admin-empty">
                  해당하는 충전 요청이 없습니다.
                </td>
              </tr>
            )}
            {!loading &&
              data?.items.map((row) => <ChargeRow key={row.id} row={row} onAct={act} />)}
          </tbody>
        </table>
      </div>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-gray-200 px-2 py-1 disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-gray-200 px-2 py-1 disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

function ChargeRow({
  row,
  onAct,
}: {
  row: AdminChargeRow;
  onAct: (id: string, body: { action: "approve" | "reject"; amount?: number; memo?: string }) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [pinAmount, setPinAmount] = useState("");
  const [memo, setMemo] = useState("");
  const isPin = row.method === "VOUCHER_PIN";
  const pending = row.status === "PENDING";

  const approveLabel =
    row.method === "VIRTUAL_ACCOUNT" ? "입금 확인" : row.method === "VOUCHER_PURCHASE" ? "결제 확인" : "검증 승인";

  return (
    <tr className="align-top" data-testid="admin-row" data-status={row.status} data-method={row.method}>
      <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">{formatDateTime(row.createdAt)}</td>
      <td className="px-3 py-2.5">
        <p className="font-medium text-gray-900">{row.user.name}</p>
        <p className="text-[10px] text-gray-400">{row.user.email}</p>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold",
            row.method === "VIRTUAL_ACCOUNT" ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700",
          )}
        >
          {CHARGE_METHOD_LABEL[row.method]}
        </span>
      </td>
      <td className="px-3 py-2.5 text-gray-600">
        {row.method === "VIRTUAL_ACCOUNT" ? (
          <>
            <p>입금자명: {row.depositorName ?? "-"}</p>
            <p className="text-[10px] text-gray-400">
              {row.vbankName} {row.vbankAccount} · 기한 {formatDateTime(row.vbankDueAt)}
            </p>
          </>
        ) : (
          <>
            <p>{voucherTypeLabel(row.voucherType)}</p>
            {row.voucherPinMasked && <p className="text-[10px] text-gray-400">PIN {row.voucherPinMasked}</p>}
          </>
        )}
        {row.adminMemo && <p className="mt-0.5 text-[10px] text-gray-400">메모: {row.adminMemo}</p>}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-gray-900">
        {isPin && row.status !== "COMPLETED" ? "검증 후 확정" : won(row.amount)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            row.status === "COMPLETED"
              ? "bg-emerald-50 text-emerald-700"
              : row.status === "PENDING"
              ? "bg-amber-50 text-amber-700"
              : "bg-gray-100 text-gray-500",
          )}
        >
          {CHARGE_STATUS_LABEL[row.status]}
        </span>
        {row.processedAt && <p className="mt-0.5 text-[10px] text-gray-400">{formatDateTime(row.processedAt)}</p>}
      </td>
      <td className="px-3 py-2.5">
        {!pending ? (
          <span className="text-[10px] text-gray-300">-</span>
        ) : mode === "reject" ? (
          <div className="flex w-48 flex-col gap-1.5">
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="반려 사유 (회원에게 표시)"
              maxLength={200}
              data-testid="admin-reject-memo"
              className="rounded border border-gray-200 px-2 py-1 text-xs"
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={busy}
                data-testid="admin-reject-confirm"
                onClick={async () => {
                  setBusy(true);
                  await onAct(row.id, { action: "reject", memo });
                  setBusy(false);
                }}
                className="flex-1 rounded bg-red-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                반려 확정
              </button>
              <button
                type="button"
                onClick={() => setMode("idle")}
                className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-600"
              >
                닫기
              </button>
            </div>
          </div>
        ) : (
          <div className="flex w-48 flex-col gap-1.5">
            {isPin && (
              <input
                inputMode="numeric"
                value={pinAmount}
                onChange={(e) => setPinAmount(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="검증된 금액 (원)"
                data-testid="admin-pin-amount"
                className="rounded border border-gray-200 px-2 py-1 text-xs"
              />
            )}
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={busy || (isPin && !pinAmount)}
                data-testid="admin-approve"
                onClick={async () => {
                  setBusy(true);
                  await onAct(row.id, { action: "approve", ...(isPin ? { amount: Number(pinAmount) } : {}) });
                  setBusy(false);
                }}
                className="flex-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {approveLabel}
              </button>
              <button
                type="button"
                disabled={busy}
                data-testid="admin-reject"
                onClick={() => setMode("reject")}
                className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-600"
              >
                반려
              </button>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}
