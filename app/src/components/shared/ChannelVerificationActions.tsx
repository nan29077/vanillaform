"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import {X} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";

interface ChannelVerificationActionsProps {
  verificationId: string;
}

export default function ChannelVerificationActions({ verificationId }: ChannelVerificationActionsProps) {
  const { appAlert } = useAppDialog();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleAction = async (action: "approve" | "reject") => {
    setLoading(true);
    try {
      await fetch("/api/channel-verification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationId, action }),
      });
      setDone(true);
      // Refresh page
      window.location.reload();
    } catch {
      appAlert("처리에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (done) return <span className="text-[10px] text-gray-400">처리됨</span>;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleAction("approve")}
        disabled={loading}
        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
        title="승인"
      >
        <Icon name="Check" size={14} />
      </button>
      <button
        onClick={() => handleAction("reject")}
        disabled={loading}
        className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
        title="거부"
      >
        <X size={14} />
      </button>
    </div>
  );
}
