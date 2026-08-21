"use client";

import { Icon } from '@/components/shared/Icon';
import { useCallback, useEffect, useMemo, useState } from "react";
import { Send, Loader2 } from 'lucide-react';

interface SellerUsage {
  sellerId: string | null;
  sellerKey: string;
  sellerName: string | null;
  shopName: string;
  alimtalkCount: number;
  smsCount: number;
  acceptedCount: number;
  failCount: number;
  sendCount: number;
  cost: number;
  lastSentAt: string | null;
}

interface PurposeUsage {
  purpose: string;
  alimtalkCount: number;
  smsCount: number;
  acceptedCount: number;
  failCount: number;
  sendCount: number;
  cost: number;
  lastSentAt: string | null;
}

interface SendLog {
  id: string;
  sellerId: string | null;
  sellerName: string | null;
  shopName: string;
  kind: string;
  purpose: string;
  templateCode: string | null;
  recipientCount: number;
  acceptedCount: number;
  failCount: number;
  cost: number | null;
  errorMessage: string | null;
  createdAt: string;
}

interface Totals {
  recipientCount: number;
  acceptedCount: number;
  failCount: number;
  cost: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface PurposeSetting {
  purpose: string;
  label: string;
  description: string;
  variables: string[];
  tplCode: string | null;
  enabled: boolean;
  templateFound: boolean;
  inspStatus: string | null;
  compatible: boolean | null;
  unknownVariables: string[];
}

interface TemplateInfo {
  code: string;
  name: string;
  type: string;
  inspStatus: string;
  content: string;
  buttons: { name: string; linkType: string; linkMo: string | null }[];
  createdAt: string;
}

const PURPOSE_LABELS: Record<string, string> = {
  LIVE_START: "라이브 방송시작 알림",
  ORDER_PLACED: "주문접수 알림(셀러)",
  SHIPPING_START: "배송 시작 안내",
  SIGNUP_WELCOME: "회원가입 환영",
  PASSWORD_RESET: "임시 비밀번호 문자",
};

const INSP_LABELS: Record<string, { label: string; cls: string }> = {
  APR: { label: "승인완료", cls: "bg-green-100 text-green-700" },
  REQ: { label: "검수중", cls: "bg-blue-100 text-blue-700" },
  REG: { label: "등록(검수 미요청)", cls: "bg-gray-100 text-gray-600" },
  REJ: { label: "반려", cls: "bg-red-100 text-red-700" },
};

type PeriodPreset = "ALL" | "TODAY" | "7D" | "30D" | "MONTH" | "CUSTOM";

const PERIOD_PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "TODAY", label: "오늘" },
  { key: "7D", label: "최근 7일" },
  { key: "30D", label: "최근 30일" },
  { key: "MONTH", label: "이번 달" },
  { key: "CUSTOM", label: "직접 지정" },
];

// 브라우저 로컬(KST) 기준으로 기간의 시작·끝 시각을 계산해 ISO로 넘긴다
function resolveRange(preset: PeriodPreset, fromDate: string, toDate: string): { from?: string; to?: string } {
  if (preset === "ALL") return {};
  if (preset === "CUSTOM") {
    const r: { from?: string; to?: string } = {};
    if (fromDate) r.from = new Date(`${fromDate}T00:00:00`).toISOString();
    if (toDate) r.to = new Date(`${toDate}T23:59:59.999`).toISOString();
    return r;
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const start =
    preset === "TODAY" ? new Date(y, m, d)
    : preset === "7D" ? new Date(y, m, d - 6)
    : preset === "30D" ? new Date(y, m, d - 29)
    : new Date(y, m, 1); // MONTH
  return { from: start.toISOString(), to: new Date(y, m, d, 23, 59, 59, 999).toISOString() };
}

export default function AdminAlimtalkClient() {
  const [sellers, setSellers] = useState<SellerUsage[]>([]);
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [purposeBreakdown, setPurposeBreakdown] = useState<PurposeUsage[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [totals, setTotals] = useState<Totals>({ recipientCount: 0, acceptedCount: 0, failCount: 0, cost: 0 });
  const [loading, setLoading] = useState(true);

  // 기간 · 셀러 필터
  const [preset, setPreset] = useState<PeriodPreset>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedSeller, setSelectedSeller] = useState<SellerUsage | null>(null);
  const [sellerQuery, setSellerQuery] = useState("");
  const [logPage, setLogPage] = useState(1);

  const [purposes, setPurposes] = useState<PurposeSetting[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [tplLoading, setTplLoading] = useState(true);
  const [savingPurpose, setSavingPurpose] = useState<string | null>(null);
  const [testingPurpose, setTestingPurpose] = useState<string | null>(null);
  const [purposeMsg, setPurposeMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  // 편집 중인 선택값 (저장 전)
  const [draft, setDraft] = useState<Record<string, { tplCode: string; enabled: boolean }>>({});

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = resolveRange(preset, fromDate, toDate);
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      if (selectedSeller) qs.set("sellerId", selectedSeller.sellerKey);
      qs.set("page", String(logPage));
      const res = await fetch(`/api/admin/alimtalk?${qs.toString()}`);
      const data = await res.json();
      setSellers(data.sellers ?? []);
      setLogs(data.logs ?? []);
      setPurposeBreakdown(data.purposeBreakdown ?? []);
      setPagination(data.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 1 });
      setTotals(data.totals ?? { recipientCount: 0, acceptedCount: 0, failCount: 0, cost: 0 });
    } finally {
      setLoading(false);
    }
  }, [preset, fromDate, toDate, selectedSeller, logPage]);

  // 필터를 바꾸면 발송 내역은 항상 첫 페이지부터
  const changePreset = (next: PeriodPreset) => {
    setPreset(next);
    setLogPage(1);
  };
  const selectSeller = (seller: SellerUsage | null) => {
    setSelectedSeller(seller);
    setLogPage(1);
  };

  const fetchTemplates = async () => {
    setTplLoading(true);
    try {
      const res = await fetch("/api/admin/alimtalk/templates");
      const data = await res.json();
      const list: PurposeSetting[] = data.purposes ?? [];
      setPurposes(list);
      setTemplates(data.templates ?? []);
      setDraft(Object.fromEntries(list.map((p) => [p.purpose, { tplCode: p.tplCode ?? "", enabled: p.enabled }])));
    } finally {
      setTplLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  useEffect(() => {
    fetchTemplates();
  }, []);

  // 셀러 검색은 이미 받아온 집계 위에서 필터링 (기간 내 발송이 있는 셀러만 집계에 포함됨)
  const visibleSellers = useMemo(() => {
    const q = sellerQuery.trim().toLowerCase();
    if (!q) return sellers;
    return sellers.filter(
      (s) => s.shopName.toLowerCase().includes(q) || (s.sellerName ?? "").toLowerCase().includes(q),
    );
  }, [sellers, sellerQuery]);

  const handleSave = async (purpose: string) => {
    const d = draft[purpose];
    if (!d?.tplCode) {
      setPurposeMsg((m) => ({ ...m, [purpose]: { ok: false, text: "템플릿을 선택해주세요." } }));
      return;
    }
    setSavingPurpose(purpose);
    setPurposeMsg((m) => ({ ...m, [purpose]: undefined as any }));
    try {
      const res = await fetch("/api/admin/alimtalk/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, tplCode: d.tplCode, enabled: d.enabled }),
      });
      const data = await res.json();
      if (res.ok) {
        setPurposeMsg((m) => ({ ...m, [purpose]: { ok: true, text: data.warning ? `저장됨 — ${data.warning}` : "저장되었습니다." } }));
        fetchTemplates();
      } else {
        setPurposeMsg((m) => ({ ...m, [purpose]: { ok: false, text: data.error || "저장 실패" } }));
      }
    } finally {
      setSavingPurpose(null);
    }
  };

  const handleTest = async (purpose: string) => {
    setTestingPurpose(purpose);
    setPurposeMsg((m) => ({ ...m, [purpose]: { ok: true, text: "테스트 발송 중... (전달 확인까지 최대 20초)" } }));
    try {
      const res = await fetch("/api/admin/alimtalk/templates/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose }),
      });
      const data = await res.json();
      setPurposeMsg((m) => ({ ...m, [purpose]: { ok: Boolean(data.success), text: data.message || data.error || "결과 없음" } }));
      fetchUsage();
    } catch {
      setPurposeMsg((m) => ({ ...m, [purpose]: { ok: false, text: "테스트 발송 요청 실패" } }));
    } finally {
      setTestingPurpose(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">알림톡 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">플랫폼 공용 알리고 계정의 템플릿 연결과 발송 현황을 관리합니다</p>
        </div>
        <button
          onClick={() => { fetchUsage(); fetchTemplates(); }}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
        >
          <Icon name="Reorder" className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {/* ── 템플릿 연결 설정 ── */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">템플릿 연결 설정</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            발송 용도별로 사용할 알리고 템플릿을 연결합니다. 본문은 발송 시점에 알리고 등록 원문을 그대로 사용하므로,
            템플릿을 수정하면 재승인 후 자동 반영됩니다. 저장 후 반드시 <b>테스트 발송</b>으로 실제 전달까지 확인하세요.
          </p>
        </div>
        {tplLoading ? (
          <div className="p-10 flex justify-center"><Icon name="Reorder" className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {purposes.map((p) => {
              const d = draft[p.purpose] ?? { tplCode: "", enabled: false };
              const insp = p.inspStatus ? INSP_LABELS[p.inspStatus] : null;
              const msg = purposeMsg[p.purpose];
              return (
                <div key={p.purpose} className="p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[220px]">
                      <p className="font-medium text-gray-900 text-sm">{p.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                    </div>
                    <select
                      value={d.tplCode}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [p.purpose]: { ...d, tplCode: e.target.value } }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 min-w-[240px]"
                    >
                      <option value="">템플릿 선택</option>
                      {templates.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.name} ({t.code}{t.inspStatus !== "APR" ? ` · ${INSP_LABELS[t.inspStatus]?.label ?? t.inspStatus}` : ""})
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [p.purpose]: { ...d, enabled: e.target.checked } }))}
                        className="accent-yellow-500"
                      />
                      활성
                    </label>
                    <button
                      onClick={() => handleSave(p.purpose)}
                      disabled={savingPurpose === p.purpose}
                      className="px-3 py-2 bg-yellow-500 text-white rounded-lg text-xs font-semibold hover:bg-yellow-600 disabled:opacity-50"
                    >
                      {savingPurpose === p.purpose ? "저장 중..." : "저장"}
                    </button>
                    <button
                      onClick={() => handleTest(p.purpose)}
                      disabled={testingPurpose === p.purpose || !p.tplCode}
                      className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                      title="관리자(발신) 번호로 예시 값을 넣어 실제 발송하고 전달 결과까지 확인합니다"
                    >
                      {testingPurpose === p.purpose ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      테스트 발송
                    </button>
                    {insp && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${insp.cls}`}>{insp.label}</span>
                    )}
                    {p.tplCode && !p.templateFound && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">알리고에 없음</span>
                    )}
                    {p.compatible === false && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        변수 불일치: {p.unknownVariables.join(", ")}
                      </span>
                    )}
                  </div>
                  {msg && (
                    <p className={`mt-2 text-xs ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 알리고 템플릿 목록 ── */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">알리고 등록 템플릿</h2>
          <p className="text-xs text-gray-500 mt-0.5">템플릿 등록·수정·삭제는 알리고 관리자 페이지에서 합니다 (수정 시 카카오 재검수 필요)</p>
        </div>
        {tplLoading ? (
          <div className="p-10 flex justify-center"><Icon name="Reorder" className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : templates.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">알리고에서 템플릿을 불러오지 못했습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-5 py-3 font-medium">코드</th>
                  <th className="px-5 py-3 font-medium">템플릿명</th>
                  <th className="px-5 py-3 font-medium">검수 상태</th>
                  <th className="px-5 py-3 font-medium">버튼</th>
                  <th className="px-5 py-3 font-medium">본문</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {templates.map((t) => {
                  const insp = INSP_LABELS[t.inspStatus] ?? { label: t.inspStatus, cls: "bg-gray-100 text-gray-600" };
                  return (
                    <tr key={t.code} className="hover:bg-gray-50 transition-colors align-top">
                      <td className="px-5 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{t.code}</td>
                      <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">{t.name}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${insp.cls}`}>{insp.label}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {t.buttons.length > 0 ? t.buttons.map((b) => b.name).join(", ") : "-"}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-600 max-w-[360px]">
                        <p className="whitespace-pre-line line-clamp-3">{t.content}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 발송 현황 필터 ── */}
      <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 mr-1">기간</span>
          {PERIOD_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => changePreset(p.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                preset === p.key
                  ? "bg-yellow-500 border-yellow-500 text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          ))}
          {preset === "CUSTOM" && (
            <span className="flex items-center gap-2 ml-1">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setLogPage(1); }}
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <span className="text-gray-400 text-sm">~</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setLogPage(1); }}
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </span>
          )}
        </div>
        {selectedSeller && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">선택한 셀러</span>
            <span className="px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-800 text-xs font-semibold">
              {selectedSeller.shopName}
              {selectedSeller.sellerName ? ` · ${selectedSeller.sellerName}` : ""}
            </span>
            <button
              onClick={() => selectSeller(null)}
              className="text-xs text-gray-500 underline hover:text-gray-700"
            >
              선택 해제
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Icon name="Reorder" className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* 요약 통계 — 선택 기간 전체 (셀러 선택과 무관) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-5">
              <p className="text-sm text-gray-500">총 발송 대상</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {totals.recipientCount.toLocaleString()}<span className="text-base font-normal text-gray-400 ml-1">건</span>
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-5">
              <p className="text-sm text-gray-500">접수 성공</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {totals.acceptedCount.toLocaleString()}<span className="text-base font-normal text-gray-400 ml-1">건</span>
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-5">
              <p className="text-sm text-gray-500">접수 실패</p>
              <p className={`text-2xl font-bold mt-1 ${totals.failCount > 0 ? "text-red-600" : "text-gray-900"}`}>
                {totals.failCount.toLocaleString()}<span className="text-base font-normal text-gray-400 ml-1">건</span>
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-5">
              <p className="text-sm text-gray-500">발송 비용 (알리고 차감)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {totals.cost.toLocaleString()}<span className="text-base font-normal text-gray-400 ml-1">원</span>
              </p>
            </div>
          </div>

          {/* 셀러별 사용량 */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-800">셀러별 발송 현황</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  행을 클릭하면 해당 셀러의 발송 내역만 볼 수 있습니다. 비밀번호 문자 등 셀러와 무관한 발송은 &quot;시스템 발송&quot;으로 집계됩니다
                </p>
              </div>
              <input
                type="search"
                value={sellerQuery}
                onChange={(e) => setSellerQuery(e.target.value)}
                placeholder="셀러명 · 샵명 검색"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 min-w-[200px]"
              />
            </div>
            {visibleSellers.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">
                {sellers.length === 0 ? "선택한 기간에 발송 기록이 없습니다." : "검색 결과가 없습니다."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-gray-500">
                      <th className="px-5 py-3 font-medium">셀러명</th>
                      <th className="px-5 py-3 font-medium">샵명</th>
                      <th className="px-5 py-3 font-medium">알림톡</th>
                      <th className="px-5 py-3 font-medium">문자</th>
                      <th className="px-5 py-3 font-medium">발송 횟수</th>
                      <th className="px-5 py-3 font-medium">접수 성공</th>
                      <th className="px-5 py-3 font-medium">실패</th>
                      <th className="px-5 py-3 font-medium">비용</th>
                      <th className="px-5 py-3 font-medium">최근 발송</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleSellers.map((s) => {
                      const active = selectedSeller?.sellerKey === s.sellerKey;
                      return (
                        <tr
                          key={s.sellerKey}
                          onClick={() => selectSeller(active ? null : s)}
                          className={`cursor-pointer transition-colors ${active ? "bg-yellow-50" : "hover:bg-gray-50"}`}
                        >
                          <td className="px-5 py-3 font-medium text-gray-900">{s.sellerName ?? "-"}</td>
                          <td className="px-5 py-3 text-gray-600">{s.shopName}</td>
                          <td className="px-5 py-3 text-gray-700">{s.alimtalkCount.toLocaleString()}건</td>
                          <td className="px-5 py-3 text-gray-700">{s.smsCount.toLocaleString()}건</td>
                          <td className="px-5 py-3 text-gray-500">{s.sendCount.toLocaleString()}회</td>
                          <td className="px-5 py-3">
                            <span className={`font-semibold ${s.acceptedCount > 0 ? "text-green-700" : "text-gray-400"}`}>
                              {s.acceptedCount.toLocaleString()}건
                            </span>
                          </td>
                          <td className={`px-5 py-3 ${s.failCount > 0 ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                            {s.failCount.toLocaleString()}건
                          </td>
                          <td className="px-5 py-3 text-gray-600">{s.cost.toLocaleString()}원</td>
                          <td className="px-5 py-3 text-gray-400 text-xs">
                            {s.lastSentAt
                              ? new Date(s.lastSentAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })
                              : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 선택한 셀러의 발송 사유별 내역 */}
          {selectedSeller && purposeBreakdown.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">
                  {selectedSeller.shopName} — 발송 사유별 집계
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">선택한 기간 내 이 셀러의 발송을 사유별로 나눈 값입니다</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-gray-500">
                      <th className="px-5 py-3 font-medium">발송 사유</th>
                      <th className="px-5 py-3 font-medium">알림톡</th>
                      <th className="px-5 py-3 font-medium">문자</th>
                      <th className="px-5 py-3 font-medium">발송 횟수</th>
                      <th className="px-5 py-3 font-medium">접수 성공</th>
                      <th className="px-5 py-3 font-medium">실패</th>
                      <th className="px-5 py-3 font-medium">비용</th>
                      <th className="px-5 py-3 font-medium">최근 발송</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {purposeBreakdown.map((p) => (
                      <tr key={p.purpose} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-gray-800">{PURPOSE_LABELS[p.purpose] ?? p.purpose}</td>
                        <td className="px-5 py-3 text-gray-700">{p.alimtalkCount.toLocaleString()}건</td>
                        <td className="px-5 py-3 text-gray-700">{p.smsCount.toLocaleString()}건</td>
                        <td className="px-5 py-3 text-gray-500">{p.sendCount.toLocaleString()}회</td>
                        <td className="px-5 py-3">
                          <span className={`font-semibold ${p.acceptedCount > 0 ? "text-green-700" : "text-gray-400"}`}>
                            {p.acceptedCount.toLocaleString()}건
                          </span>
                        </td>
                        <td className={`px-5 py-3 ${p.failCount > 0 ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                          {p.failCount.toLocaleString()}건
                        </td>
                        <td className="px-5 py-3 text-gray-600">{p.cost.toLocaleString()}원</td>
                        <td className="px-5 py-3 text-gray-400 text-xs">
                          {p.lastSentAt
                            ? new Date(p.lastSentAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 발송 내역 */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-gray-800">
                발송 내역
                {selectedSeller && <span className="text-gray-500 font-normal"> — {selectedSeller.shopName}</span>}
              </h2>
              <span className="text-xs text-gray-500">총 {pagination.total.toLocaleString()}건</span>
            </div>
            {logs.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">발송 내역이 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-gray-500">
                      <th className="px-5 py-3 font-medium">일시</th>
                      <th className="px-5 py-3 font-medium">셀러/샵</th>
                      <th className="px-5 py-3 font-medium">발송 사유</th>
                      <th className="px-5 py-3 font-medium">유형</th>
                      <th className="px-5 py-3 font-medium">대상</th>
                      <th className="px-5 py-3 font-medium">접수</th>
                      <th className="px-5 py-3 font-medium">비용</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.map((l) => (
                      <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(l.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="px-5 py-3 text-gray-700">{l.shopName}</td>
                        <td className="px-5 py-3 text-gray-800">{PURPOSE_LABELS[l.purpose] ?? l.purpose}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            l.kind === "ALIMTALK" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {l.kind === "ALIMTALK" ? "알림톡" : "문자"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-700">{l.recipientCount.toLocaleString()}명</td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              l.acceptedCount > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}
                            title={l.errorMessage ?? undefined}
                          >
                            {l.acceptedCount > 0 ? `${l.acceptedCount}건 접수` : "실패"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600">{l.cost != null ? `${l.cost.toLocaleString()}원` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pagination.totalPages > 1 && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white"
                >
                  이전
                </button>
                <span className="text-xs text-gray-500">
                  {pagination.page} / {pagination.totalPages} 페이지
                </span>
                <button
                  onClick={() => setLogPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
