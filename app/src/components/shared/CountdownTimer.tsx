"use client";

import { Icon } from '@/components/shared/Icon';
import { useEffect, useState } from "react";
import { getTimeRemaining } from "@/lib/utils";
;
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  endDate: Date;
  className?: string;
  compact?: boolean;
}

export default function CountdownTimer({
  endDate,
  className,
  compact = false,
}: CountdownTimerProps) {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 1 });

  useEffect(() => {
    setMounted(true);
    setTime(getTimeRemaining(endDate));
    const timer = setInterval(() => {
      setTime(getTimeRemaining(endDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [endDate]);

  if (!mounted) {
    // Server-side / initial render: show loading placeholder to avoid hydration mismatch
    if (compact) {
      return (
        <span className={cn("flex items-center gap-1 text-sm font-medium text-brand-600", className)}>
          <Icon name="Clock" size={14} />
          --:--:--
        </span>
      );
    }
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Icon name="Clock" size={16} className="text-brand-600" />
        <div className="flex items-center gap-1">
          <TimeBlock value={0} label="시" />
          <span className="text-gray-300 font-light">:</span>
          <TimeBlock value={0} label="분" />
          <span className="text-gray-300 font-light">:</span>
          <TimeBlock value={0} label="초" />
        </div>
      </div>
    );
  }

  if (time.total <= 0) {
    return (
      <span className={cn("text-gray-400 text-sm", className)}>마감</span>
    );
  }

  if (compact) {
    return (
      <span className={cn("flex items-center gap-1 text-sm font-medium text-brand-600", className)}>
        <Icon name="Clock" size={14} />
        {time.days > 0 && `${time.days}일 `}
        {String(time.hours).padStart(2, "0")}:{String(time.minutes).padStart(2, "0")}:
        {String(time.seconds).padStart(2, "0")}
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Icon name="Clock" size={16} className="text-brand-600" />
      <div className="flex items-center gap-1">
        {time.days > 0 && (
          <>
            <TimeBlock value={time.days} label="일" />
            <span className="text-gray-300 font-light">:</span>
          </>
        )}
        <TimeBlock value={time.hours} label="시" />
        <span className="text-gray-300 font-light">:</span>
        <TimeBlock value={time.minutes} label="분" />
        <span className="text-gray-300 font-light">:</span>
        <TimeBlock value={time.seconds} label="초" />
      </div>
    </div>
  );
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-0.5">
      <span className="text-lg font-bold tabular-nums text-gray-900">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] text-gray-400">{label}</span>
    </div>
  );
}
