"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";

interface Address {
  id: string;
  name: string;
  phone: string;
  zipCode: string | null;
  address1: string;
  address2: string | null;
  isDefault: boolean;
}

export default function AddressesClient({ initialAddresses }: { initialAddresses: Address[] }) {
  const router = useRouter();
  const { appAlert, appConfirm } = useAppDialog();
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    zipCode: "",
    address1: "",
    address2: "",
    isDefault: false,
  });

  const openPostcode = useCallback(() => {
    if (!(window as any).daum?.Postcode) {
      const script = document.createElement("script");
      script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.onload = () => run();
      document.head.appendChild(script);
    } else {
      run();
    }

    function run() {
      new (window as any).daum.Postcode({
        oncomplete: (data: any) => {
          const addr = data.userSelectedType === "R" ? data.roadAddress : data.jibunAddress;
          setForm((prev) => ({ ...prev, zipCode: data.zonecode, address1: addr, address2: "" }));
          setTimeout(() => document.getElementById("addr-detail")?.focus(), 100);
        },
      }).open();
    }
  }, []);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", phone: "", zipCode: "", address1: "", address2: "", isDefault: false });
  };

  const openEdit = (addr: Address) => {
    setEditingId(addr.id);
    setForm({
      name: addr.name,
      phone: addr.phone,
      zipCode: addr.zipCode || "",
      address1: addr.address1,
      address2: addr.address2 || "",
      isDefault: addr.isDefault,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.address1) {
      appAlert("수령인, 연락처, 주소를 모두 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/addresses", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          name: form.name,
          phone: form.phone,
          zipCode: form.zipCode || null,
          address1: form.address1,
          address2: form.address2 || null,
          isDefault: form.isDefault || addresses.length === 0,
        }),
      });
      if (res.ok) {
        closeForm();
        router.refresh();
        // 목록 갱신
        const listRes = await fetch("/api/addresses");
        const listData = await listRes.json();
        setAddresses(listData.addresses || []);
      } else {
        const d = await res.json().catch(() => ({}));
        appAlert(d.error || "저장에 실패했습니다.");
      }
    } catch {
      appAlert("저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await fetch("/api/addresses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, isDefault: a.id === id }))
      );
    } catch {
      appAlert("설정에 실패했습니다.");
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await appConfirm({ message: "이 배송지를 삭제하시겠습니까?", type: "warning", confirmText: "삭제" });
    if (!ok) return;
    try {
      await fetch("/api/addresses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch {
      appAlert("삭제에 실패했습니다.");
    }
  };

  return (
    <div className="animate-fade-in pb-4">
      {/* 헤더 */}
      <div className="sticky top-12 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">
              <Icon name="ArrowRight" size={20} strokeWidth={1.5} className="rotate-180" />
            </button>
            <h1 className="text-base font-bold text-gray-900">배송지 관리</h1>
            <span className="text-xs text-gray-400">{addresses.length}개</span>
          </div>
          <button
            onClick={() => { setEditingId(null); setForm({ name: "", phone: "", zipCode: "", address1: "", address2: "", isDefault: false }); setShowForm(true); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Icon name="Plus" size={14} /> 배송지 추가
          </button>
        </div>
      </div>

      {/* 배송지 추가 폼 */}
      {showForm && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeForm} />
          <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-[dialogIn_200ms_ease-out] max-h-[90vh] overflow-y-auto">
            <div className="h-1 bg-gradient-to-r from-brand-400 to-brand-500" />

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <h3 className="text-[15px] font-bold text-gray-900">{editingId ? "배송지 수정" : "새 배송지 추가"}</h3>
              <button onClick={closeForm} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pb-5 space-y-3.5">
              {/* 수령인 */}
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Icon name="MyPage" size={11} /> 수령인 *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="이름" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
              </div>

              {/* 연락처 */}
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Icon name="Phone" size={11} /> 연락처 *</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="010-0000-0000" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
              </div>

              {/* 주소 */}
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Icon name="Location" size={11} /> 배송주소 *</label>
                <div className="flex gap-2">
                  <input type="text" value={form.zipCode} readOnly placeholder="우편번호"
                    className="w-24 px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 flex-shrink-0" />
                  <button type="button" onClick={openPostcode}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors flex-shrink-0">
                    <Icon name="Search" size={14} /> 주소찾기
                  </button>
                </div>
                <input type="text" value={form.address1} readOnly placeholder="주소를 검색해주세요"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 mt-2" />
                <input id="addr-detail" type="text" value={form.address2} onChange={(e) => setForm({ ...form, address2: e.target.value })}
                  placeholder="상세주소 입력 (동/호수 등)"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 mt-2" />
              </div>

              {/* 기본 배송지 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
                <span className="text-xs text-gray-600">기본 배송지로 설정</span>
              </label>

              {/* 저장 */}
              <button onClick={handleSave} disabled={loading}
                className="w-full py-3 text-[13px] font-bold text-white bg-gray-900 rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50">
                {loading ? "저장 중..." : editingId ? "수정 저장" : "배송지 저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 배송지 목록 */}
      <div className="px-4 pt-4">
        {addresses.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Icon name="Location" size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">등록된 배송지가 없습니다.</p>
            <p className="text-xs text-gray-300 mt-1">위의 '배송지 추가' 버튼을 눌러 추가해보세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <div key={addr.id} className={`bg-white rounded-xl border p-4 transition-colors ${addr.isDefault ? "border-brand-200" : "border-gray-100"}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{addr.name}</span>
                    {addr.isDefault && (
                      <span className="text-[10px] bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-medium">기본</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!addr.isDefault && (
                      <button onClick={() => handleSetDefault(addr.id)} title="기본 배송지로 설정"
                        className="p-1.5 text-gray-300 hover:text-brand-500 transition-colors">
                        <Icon name="Star" size={30} strokeWidth={1.5} />
                      </button>
                    )}
                    <button onClick={() => openEdit(addr)} title="수정"
                      className="p-1.5 text-gray-300 hover:text-gray-700 transition-colors">
                      <Icon name="Edit" size={30} strokeWidth={1.5} />
                    </button>
                    <button onClick={() => handleDelete(addr.id)} title="삭제"
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                      <Icon name="Delete" size={30} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{addr.phone}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {addr.zipCode && <span className="text-gray-400">[{addr.zipCode}] </span>}
                  {addr.address1} {addr.address2}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
