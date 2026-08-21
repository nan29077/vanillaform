"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import {X} from 'lucide-react';

// 라이브 예정시간 선택: 날짜 피커 + 시/분 피커 조합 → "확인"으로 datetime-local 문자열(YYYY-MM-DDTHH:mm) 확정.
export default function ScheduledTimePicker({
  value,
  onChange,
}: {
  value: string; // "YYYY-MM-DDTHH:mm"
  onChange: (v: string) => void;
}) {
  const parse = (v: string) => {
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(v || "");
    return { date: m?.[1] || "", hour: m?.[2] || "", minute: m?.[3] || "" };
  };
  const init = parse(value);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(init.date);
  const [hour, setHour] = useState(init.hour);
  const [minute, setMinute] = useState(init.minute);

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

  const display = (() => {
    const p = parse(value);
    if (!p.date || !p.hour) return "예정 시간 선택";
    const d = new Date(`${p.date}T${p.hour}:${p.minute}`);
    return d.toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
  })();

  const confirm = () => {
    if (!date || hour === "" || minute === "") return;
    onChange(`${date}T${hour}:${minute}`);
    setOpen(false);
  };

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => { const p = parse(value); setDate(p.date); setHour(p.hour); setMinute(p.minute); setOpen((o) => !o); }}
        className="w-full flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-left hover:border-brand-300"
      >
        <Icon name="Calendar" size={15} className="text-brand-500 flex-shrink-0" />
        <span className={value ? "text-gray-900" : "text-gray-400"}>{display}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm space-y-3">
          <div>
            <label className="text-[11px] font-bold text-gray-500 flex items-center gap-1 mb-1"><Icon name="Calendar" size={11} /> 날짜</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full input-field text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 flex items-center gap-1 mb-1"><Icon name="Clock" size={11} /> 시간</label>
            <div className="flex items-center gap-2">
              <select value={hour} onChange={(e) => setHour(e.target.value)} className="flex-1 input-field text-sm">
                <option value="">시</option>
                {hours.map((h) => <option key={h} value={h}>{h}시</option>)}
              </select>
              <span className="text-gray-400">:</span>
              <select value={minute} onChange={(e) => setMinute(e.target.value)} className="flex-1 input-field text-sm">
                <option value="">분</option>
                {minutes.map((m) => <option key={m} value={m}>{m}분</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100">
              <X size={13} /> 취소
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!date || hour === "" || minute === ""}
              className="inline-flex items-center gap-1 text-xs font-bold text-black bg-brand-500 hover:bg-brand-600 px-4 py-2 rounded-lg disabled:opacity-40"
            >
              <Icon name="Check" size={13} /> 확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
