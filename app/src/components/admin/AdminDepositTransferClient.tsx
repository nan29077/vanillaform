"use client";

import { Icon } from '@/components/shared/Icon';
import { useCallback, useEffect, useState } from "react";
import {Banknote, CheckCircle2, XCircle, Clock, HelpCircle, X} from 'lucide-react';
import { BANK_CODES, bankName } from "@/lib/bankCodes";

interface PgSettings {
  secrKeyMasked: string;
  trtInstCd: string;
  bankCd: string;
  wdrwAcctNo: string;
  isProduction: boolean;
  configured: boolean;
}

interface Balance {
  balAmt: string;
  wdrwCanAmt: string;
  wdrwCannotAmt: string;
}

interface TransferRow {
  id: string;
  trscSeqNo: string;
  reqDate: string;
  rcvBnkCd: string;
  rcvAcctNo: string;
  rcvAcctNm: string | null;
  amount: number;
  wdrwAcctNm: string | null;
  status: string;
  respCd: string | null;
  respMsg: string | null;
  balAmt: string | null;
  memo: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: any }> = {
  SUCCESS: { label: "이체완료", cls: "bg-green-50 text-green-700", Icon: CheckCircle2 },
  FAILED: { label: "실패", cls: "bg-red-50 text-red-600", Icon: XCircle },
  PROCESSING: { label: "처리중", cls: "bg-blue-50 text-blue-600", Icon: Clock },
  UNKNOWN: { label: "결과 미확인", cls: "bg-amber-50 text-amber-700", Icon: HelpCircle },
  REQUESTED: { label: "요청됨", cls: "bg-gray-100 text-gray-600", Icon: Clock },
};

const fmt = (n: number | string) => Number(n).toLocaleString();

export default function AdminDepositTransferClient() {
  // 설정
  const [settings, setSettings] = useState<PgSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    secrKey: "", trtInstCd: "", bankCd: "", wdrwAcctNo: "", isProduction: false,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // 잔액
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // 이체 폼
  const [form, setForm] = useState({ rcvBnkCd: "004", rcvAcctNo: "", amount: "", wdrwAcctNm: "", memo: "" });
  const [holderName, setHolderName] = useState<string | null>(null); // 예금주 조회 결과
  const [checkingHolder, setCheckingHolder] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // 내역
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [checkingResultId, setCheckingResultId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const notify = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/admin/deposit-transfer/settings");
    if (res.ok) {
      const data: PgSettings = await res.json();
      setSettings(data);
      setSettingsForm({
        secrKey: "",
        trtInstCd: data.trtInstCd,
        bankCd: data.bankCd,
        wdrwAcctNo: data.wdrwAcctNo,
        isProduction: data.isProduction,
      });
      if (!data.configured) setShowSettings(true);
    }
  }, []);

  const loadHistory = useCallback(async (p: number) => {
    const res = await fetch(`/api/admin/deposit-transfer/history?page=${p}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.items);
      setTotal(data.total);
      setPage(data.page);
      setPageSize(data.pageSize);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadHistory(1);
  }, [loadSettings, loadHistory]);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/deposit-transfer/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify("ok", "설정을 저장했습니다.");
      setShowSettings(false);
      await loadSettings();
    } catch (e: any) {
      notify("err", e?.message || "설정 저장에 실패했습니다.");
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchBalance = async () => {
    setLoadingBalance(true);
    try {
      const res = await fetch("/api/admin/deposit-transfer/balance", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBalance(data);
    } catch (e: any) {
      notify("err", e?.message || "잔액조회에 실패했습니다.");
    } finally {
      setLoadingBalance(false);
    }
  };

  // 폼이 바뀌면 예금주 확인을 무효화 (검증된 계좌 그대로만 이체 가능)
  const updateForm = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    if (patch.rcvBnkCd !== undefined || patch.rcvAcctNo !== undefined) setHolderName(null);
  };

  const checkHolder = async () => {
    setCheckingHolder(true);
    setHolderName(null);
    try {
      const res = await fetch("/api/admin/deposit-transfer/holder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rcvBnkCd: form.rcvBnkCd, rcvAcctNo: form.rcvAcctNo, amount: Number(form.amount) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHolderName(data.holderName || "(이름 없음)");
    } catch (e: any) {
      notify("err", e?.message || "예금주 조회에 실패했습니다.");
    } finally {
      setCheckingHolder(false);
    }
  };

  const executeTransfer = async () => {
    setTransferring(true);
    try {
      const res = await fetch("/api/admin/deposit-transfer/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rcvBnkCd: form.rcvBnkCd,
          rcvAcctNo: form.rcvAcctNo,
          amount: Number(form.amount),
          wdrwAcctNm: form.wdrwAcctNm,
          rcvAcctNm: holderName,
          memo: form.memo,
        }),
      });
      const data = await res.json();
      if (data.status === "SUCCESS") {
        notify("ok", `이체가 완료되었습니다. (받는분: ${data.rcvAcctNm || holderName})`);
        setForm({ rcvBnkCd: form.rcvBnkCd, rcvAcctNo: "", amount: "", wdrwAcctNm: "", memo: "" });
        setHolderName(null);
        if (balance) fetchBalance();
      } else if (data.needsResultCheck) {
        notify("err", data.error || "처리결과 미확인 — 내역에서 [결과조회]로 확인해 주세요. 재이체 금지!");
      } else {
        notify("err", `[${data.respCd ?? "-"}] ${data.respMsg || data.error || "이체에 실패했습니다."}`);
      }
      await loadHistory(1);
    } catch (e: any) {
      notify("err", e?.message || "이체 요청 중 오류가 발생했습니다.");
    } finally {
      setTransferring(false);
      setShowConfirm(false);
    }
  };

  const checkResult = async (id: string) => {
    setCheckingResultId(id);
    try {
      const res = await fetch("/api/admin/deposit-transfer/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const badge = STATUS_BADGE[data.status];
      notify("ok", `결과조회 완료: ${badge?.label ?? data.status}`);
      await loadHistory(page);
    } catch (e: any) {
      notify("err", e?.message || "결과조회에 실패했습니다.");
    } finally {
      setCheckingResultId(null);
    }
  };

  const amountNum = Number(form.amount) || 0;
  const canCheckHolder = /^\d{3}$/.test(form.rcvBnkCd) && form.rcvAcctNo.trim().length >= 6 && !checkingHolder;
  const canTransfer = holderName !== null && amountNum >= 1 && !transferring;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Banknote size={22} className="text-brand-600" />
            입금이체 관리
            {settings && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${settings.isProduction ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                {settings.isProduction ? "운영" : "개발(테스트)"}
              </span>
            )}
          </h1>
          <p className="text-[13px] text-gray-400 mt-1">쿠콘 입금이체PG로 계좌 송금을 실행합니다. (예금주 확인 후 이체)</p>
        </div>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 text-[13px] text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <Icon name="Settings" size={15} /> PG 설정
        </button>
      </div>

      {/* 미설정 경고 */}
      {settings && !settings.configured && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800">
          <Icon name="Warning" size={16} />
          입금이체PG 설정(인증키·취급기관코드·연계은행코드)이 필요합니다. 아래 설정을 저장해 주세요.
        </div>
      )}

      {/* 설정 패널 */}
      {showSettings && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h2 className="text-[15px] font-bold text-gray-900">입금이체PG 설정</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-500 mb-1">API 인증키 (SECR_KEY)</label>
              <input
                type="password"
                value={settingsForm.secrKey}
                onChange={(e) => setSettingsForm((s) => ({ ...s, secrKey: e.target.value }))}
                placeholder={settings?.secrKeyMasked ? `저장됨: ${settings.secrKeyMasked} (변경 시에만 입력)` : "쿠콘에서 발급받은 인증키"}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-500 mb-1">취급기관코드 (TRT_INST_CD)</label>
              <input
                value={settingsForm.trtInstCd}
                onChange={(e) => setSettingsForm((s) => ({ ...s, trtInstCd: e.target.value }))}
                placeholder="8자리"
                maxLength={8}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-500 mb-1">연계은행 (BANK_CD)</label>
              <select
                value={settingsForm.bankCd}
                onChange={(e) => setSettingsForm((s) => ({ ...s, bankCd: e.target.value }))}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                <option value="">선택</option>
                {BANK_CODES.map((b) => (
                  <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-500 mb-1">출금계좌번호 (WDRW_ACCT_NO)</label>
              <input
                value={settingsForm.wdrwAcctNo}
                onChange={(e) => setSettingsForm((s) => ({ ...s, wdrwAcctNo: e.target.value }))}
                placeholder="숫자만 입력"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-gray-700">
            <input
              type="checkbox"
              checked={settingsForm.isProduction}
              onChange={(e) => setSettingsForm((s) => ({ ...s, isProduction: e.target.checked }))}
              className="rounded"
            />
            운영 모드 (체크 해제 시 쿠콘 개발계로 요청 — 실제 이체 없음)
          </label>
          {settingsForm.isProduction && (
            <p className="text-[12px] text-red-500 flex items-center gap-1">
              <Icon name="Warning" size={13} /> 운영 모드에서는 실제 계좌 이체가 발생하며 수수료가 부과됩니다.
            </p>
          )}
          <div className="flex justify-end">
            <button
              onClick={saveSettings}
              disabled={savingSettings}
              className="px-4 py-2 text-[13px] font-semibold text-black bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50"
            >
              {savingSettings ? "저장 중..." : "설정 저장"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 잔액 카드 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-1.5">
              <Icon name="Wallet" size={16} className="text-brand-600" /> 출금계좌 잔액
            </h2>
            <button
              onClick={fetchBalance}
              disabled={loadingBalance}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Icon name="Reorder" size={13} className={loadingBalance ? "animate-spin" : ""} /> 조회
            </button>
          </div>
          {balance ? (
            <div className="space-y-2">
              <p className="text-2xl font-bold text-gray-900">{fmt(balance.balAmt)}<span className="text-sm font-medium text-gray-400 ml-1">원</span></p>
              <div className="text-[12px] text-gray-500 space-y-0.5">
                <p>송금가능: <b className="text-gray-700">{fmt(balance.wdrwCanAmt)}원</b></p>
                <p>정지금액: {fmt(balance.wdrwCannotAmt)}원</p>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-gray-400 py-4">조회 버튼을 눌러 잔액을 확인하세요.</p>
          )}
        </div>

        {/* 이체 실행 카드 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 lg:col-span-2">
          <h2 className="text-[15px] font-bold text-gray-900 mb-4 flex items-center gap-1.5">
            <Icon name="Share" size={16} className="text-brand-600" /> 입금이체 실행
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-gray-500 mb-1">입금은행</label>
              <select
                value={form.rcvBnkCd}
                onChange={(e) => updateForm({ rcvBnkCd: e.target.value })}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                {BANK_CODES.map((b) => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-500 mb-1">입금계좌번호</label>
              <input
                value={form.rcvAcctNo}
                onChange={(e) => updateForm({ rcvAcctNo: e.target.value.replace(/[^0-9-]/g, "") })}
                placeholder="'-' 없이 입력"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-500 mb-1">이체 금액 (원)</label>
              <input
                inputMode="numeric"
                value={form.amount ? fmt(form.amount) : ""}
                onChange={(e) => updateForm({ amount: e.target.value.replace(/[^0-9]/g, "") })}
                placeholder="0"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-500 mb-1">의뢰인명 (상대 통장 표기, 선택)</label>
              <input
                value={form.wdrwAcctNm}
                onChange={(e) => updateForm({ wdrwAcctNm: e.target.value })}
                maxLength={20}
                placeholder="미입력 시 기관 기본값"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-medium text-gray-500 mb-1">메모 (내부 기록용, 선택)</label>
              <input
                value={form.memo}
                onChange={(e) => updateForm({ memo: e.target.value })}
                placeholder="예: 6월 정산 지급 — 홍길동 셀러"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
          </div>

          {/* 예금주 확인 결과 */}
          {holderName !== null && (
            <div className="mt-3 flex items-center gap-2 p-2.5 bg-green-50 rounded-lg text-[13px] text-green-800">
              <Icon name="Check" size={15} />
              예금주 확인: <b>{holderName}</b> ({bankName(form.rcvBnkCd)} {form.rcvAcctNo})
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={checkHolder}
              disabled={!canCheckHolder}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              <Icon name="Search" size={14} /> {checkingHolder ? "조회 중..." : "1. 예금주 조회"}
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!canTransfer}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-black bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-40"
            >
              <Icon name="Share" size={14} /> 2. 이체 실행
            </button>
          </div>
          {holderName === null && (
            <p className="mt-2 text-right text-[11px] text-gray-400">이체 전에 예금주 조회로 계좌를 먼저 확인해야 합니다.</p>
          )}
        </div>
      </div>

      {/* 이체 내역 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-gray-900">이체 내역 <span className="text-gray-400 font-medium">({fmt(total)}건)</span></h2>
          <button
            onClick={() => loadHistory(page)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Icon name="Reorder" size={13} /> 새로고침
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-gray-400 uppercase border-b border-gray-100">
                <th className="px-5 py-2.5 font-semibold">요청일시</th>
                <th className="px-3 py-2.5 font-semibold">입금계좌</th>
                <th className="px-3 py-2.5 font-semibold">예금주</th>
                <th className="px-3 py-2.5 font-semibold text-right">금액</th>
                <th className="px-3 py-2.5 font-semibold">상태</th>
                <th className="px-3 py-2.5 font-semibold">응답</th>
                <th className="px-3 py-2.5 font-semibold">메모</th>
                <th className="px-5 py-2.5 font-semibold text-right">결과조회</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">이체 내역이 없습니다.</td></tr>
              ) : rows.map((r) => {
                const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.REQUESTED;
                const needsCheck = ["UNKNOWN", "PROCESSING", "REQUESTED"].includes(r.status);
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-gray-900">{bankName(r.rcvBnkCd)}</span>
                      <span className="text-gray-400 ml-1.5">{r.rcvAcctNo}</span>
                    </td>
                    <td className="px-3 py-3 text-gray-700">{r.rcvAcctNm || "-"}</td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">{fmt(r.amount)}원</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.cls}`}>
                        <badge.Icon size={11} /> {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-400 max-w-[200px] truncate" title={`${r.respCd ?? ""} ${r.respMsg ?? ""}`}>
                      {r.respCd ? `[${r.respCd}] ` : ""}{r.respMsg || "-"}
                    </td>
                    <td className="px-3 py-3 text-gray-400 max-w-[160px] truncate" title={r.memo ?? ""}>{r.memo || "-"}</td>
                    <td className="px-5 py-3 text-right">
                      {needsCheck && (
                        <button
                          onClick={() => checkResult(r.id)}
                          disabled={checkingResultId === r.id}
                          className="px-2.5 py-1 text-[12px] font-semibold text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-50"
                        >
                          {checkingResultId === r.id ? "조회 중..." : "결과조회"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => loadHistory(p)}
                className={`w-7 h-7 text-[12px] rounded-lg ${p === page ? "bg-brand-500 text-black font-bold" : "text-gray-500 hover:bg-gray-100"}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 이체 확인 모달 */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-gray-900">이체 실행 확인</h3>
              <button onClick={() => setShowConfirm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-[13px]">
              <div className="flex justify-between"><span className="text-gray-400">받는분</span><b className="text-gray-900">{holderName}</b></div>
              <div className="flex justify-between"><span className="text-gray-400">입금계좌</span><span className="text-gray-700">{bankName(form.rcvBnkCd)} {form.rcvAcctNo}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-2"><span className="text-gray-400">이체 금액</span><b className="text-[16px] text-brand-700">{fmt(amountNum)}원</b></div>
              {form.wdrwAcctNm && <div className="flex justify-between"><span className="text-gray-400">의뢰인명</span><span className="text-gray-700">{form.wdrwAcctNm}</span></div>}
            </div>
            {settings?.isProduction ? (
              <p className="text-[12px] text-red-500 flex items-center gap-1">
                <Icon name="Warning" size={13} /> 운영 모드 — 실제 계좌로 즉시 이체됩니다. 취소할 수 없습니다.
              </p>
            ) : (
              <p className="text-[12px] text-blue-500">개발(테스트) 모드 — 쿠콘 개발계로 요청됩니다.</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 text-[13px] font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={executeTransfer}
                disabled={transferring}
                className="flex-1 py-2.5 text-[13px] font-bold text-black bg-brand-500 rounded-xl hover:bg-brand-600 disabled:opacity-50"
              >
                {transferring ? "이체 중..." : `${fmt(amountNum)}원 이체`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-[13px] font-semibold shadow-lg ${toast.type === "ok" ? "bg-gray-900 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
