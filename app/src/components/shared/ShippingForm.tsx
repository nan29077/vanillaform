"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect, useCallback } from "react";
import {CheckCircle, MapPinned, X} from 'lucide-react';

interface ShippingData {
  name: string;
  phone: string;
  zipCode: string;
  address: string;
  addressDetail: string;
  memo: string;
}

interface SavedAddress {
  id: string;
  name: string;
  phone: string;
  zipCode: string | null;
  address1: string;
  address2: string | null;
  isDefault: boolean;
}

interface ShippingFormProps {
  value: ShippingData;
  onChange: (data: ShippingData) => void;
}

export default function ShippingForm({ value, onChange }: ShippingFormProps) {
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [showAddressList, setShowAddressList] = useState(false);
  const [showFirstTimeSavePopup, setShowFirstTimeSavePopup] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 저장된 배송지 불러오기
  useEffect(() => {
    fetch("/api/addresses")
      .then((r) => r.json())
      .then((data) => {
        setSavedAddresses(data.addresses || []);
        // 기본 배송지가 있고 아직 폼이 비어있으면 자동 적용
        if (data.addresses?.length > 0 && !value.name && !value.address) {
          const def = data.addresses.find((a: SavedAddress) => a.isDefault) || data.addresses[0];
          applyAddress(def);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 한국 휴대폰 11자리 + 자동 하이픈. 비숫자 무시, 12자리 이상은 잘라냄.
  const formatPhone = (input: string): string => {
    const digits = input.replace(/\D/g, "").slice(0, 11);
    if (digits.length < 4) return digits;
    if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const applyAddress = (addr: SavedAddress) => {
    onChange({
      name: addr.name,
      phone: formatPhone(addr.phone),
      zipCode: addr.zipCode || "",
      address: addr.address1,
      addressDetail: addr.address2 || "",
      memo: value.memo,
    });
    setShowAddressList(false);
  };

  // 다음 주소찾기
  const openPostcode = useCallback(() => {
    if (!(window as any).daum?.Postcode) {
      const script = document.createElement("script");
      script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.onload = () => runPostcode();
      document.head.appendChild(script);
    } else {
      runPostcode();
    }

    function runPostcode() {
      new (window as any).daum.Postcode({
        oncomplete: (data: any) => {
          const addr = data.userSelectedType === "R" ? data.roadAddress : data.jibunAddress;
          onChange({
            ...value,
            zipCode: data.zonecode,
            address: addr,
            addressDetail: "",
          });
          // 상세주소 입력에 포커스
          setTimeout(() => {
            document.getElementById("address-detail-input")?.focus();
          }, 100);
        },
      }).open();
    }
  }, [value, onChange]);

  // 주문 시 배송지 자동 저장 (부모에서 호출)
  const saveAddressIfNew = useCallback(async () => {
    if (!value.name || !value.address) return;
    // 이미 같은 주소가 저장되어 있는지 확인
    const exists = savedAddresses.some(
      (a) => a.address1 === value.address && a.name === value.name && a.phone === value.phone
    );
    if (exists) return;

    // 첫 입력이면 팝업 표시
    if (savedAddresses.length === 0) {
      setShowFirstTimeSavePopup(true);
    }

    await fetch("/api/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: value.name,
        phone: value.phone,
        zipCode: value.zipCode || null,
        address1: value.address,
        address2: value.addressDetail || null,
        isDefault: savedAddresses.length === 0,
      }),
    });
  }, [value, savedAddresses]);

  // saveAddressIfNew를 부모가 접근할 수 있게 window에 등록
  useEffect(() => {
    (window as any).__saveShippingAddress = saveAddressIfNew;
    return () => { delete (window as any).__saveShippingAddress; };
  }, [saveAddressIfNew]);

  const update = (field: keyof ShippingData, val: string) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <Icon name="Location" size={14} strokeWidth={1.5} /> 배송 정보
        </h3>
        {savedAddresses.length > 0 && (
          <button
            onClick={() => setShowAddressList(!showAddressList)}
            className="flex items-center gap-1 text-[11px] text-brand-600 font-medium hover:text-brand-700"
          >
            <MapPinned size={12} />
            저장된 배송지
            <Icon name="ChevronDown" size={12} className={`transition-transform ${showAddressList ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {/* 저장된 배송지 목록 */}
      {showAddressList && (
        <div className="mb-4 border border-gray-100 rounded-xl overflow-hidden">
          {savedAddresses.map((addr) => (
            <button
              key={addr.id}
              onClick={() => applyAddress(addr)}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-900">{addr.name}</span>
                {addr.isDefault && (
                  <span className="text-[9px] bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded-full font-medium">기본</span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                {addr.zipCode && `[${addr.zipCode}] `}{addr.address1} {addr.address2}
              </p>
              <p className="text-[11px] text-gray-400">{addr.phone}</p>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {/* 수령인 */}
        <div>
          <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Icon name="MyPage" size={12} /> 수령인 *</label>
          <input
            type="text" value={value.name} onChange={(e) => update("name", e.target.value)}
            placeholder="이름"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
          />
        </div>

        {/* 연락처 */}
        <div>
          <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Icon name="Phone" size={12} /> 연락처 *</label>
          <input
            type="tel"
            inputMode="numeric"
            value={value.phone}
            onChange={(e) => update("phone", formatPhone(e.target.value))}
            placeholder="010-0000-0000"
            maxLength={13}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
          />
        </div>

        {/* 주소 */}
        <div>
          <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Icon name="Location" size={12} /> 배송주소 *</label>
          <div className="flex gap-2">
            <input
              type="text" value={value.zipCode} readOnly
              placeholder="우편번호"
              className="w-24 px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 flex-shrink-0"
            />
            <button
              type="button" onClick={openPostcode}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors flex-shrink-0"
            >
              <Icon name="Search" size={14} /> 주소찾기
            </button>
          </div>
          <input
            type="text" value={value.address} readOnly
            placeholder="주소를 검색해주세요"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 mt-2"
          />
          <input
            id="address-detail-input"
            type="text" value={value.addressDetail} onChange={(e) => update("addressDetail", e.target.value)}
            placeholder="상세주소 입력 (동/호수 등)"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 mt-2"
          />
        </div>

        {/* 배송 메모 */}
        <div>
          <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Icon name="File" size={12} /> 배송 메모</label>
          <input
            type="text" value={value.memo} onChange={(e) => update("memo", e.target.value)}
            placeholder="문 앞에 놓아주세요"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
          />
        </div>
      </div>

      {/* 첫 배송지 저장 안내 팝업 */}
      {showFirstTimeSavePopup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]" onClick={() => setShowFirstTimeSavePopup(false)} />
          <div className="relative w-full max-w-[320px] bg-white rounded-2xl shadow-2xl overflow-hidden animate-[dialogIn_200ms_ease-out]">
            <div className="h-1 bg-gradient-to-r from-brand-400 to-brand-500" />
            <div className="px-6 pt-6 pb-2 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-brand-50 flex items-center justify-center">
                <Icon name="Truck" size={26} className="text-brand-500" />
              </div>
              <h3 className="text-[15px] font-bold text-gray-900 mb-2">배송지가 저장되었습니다</h3>
              <p className="text-[13px] text-gray-500 leading-relaxed">
                입력하신 배송지가 배송지 정보에{"\n"}자동 저장되었습니다.{"\n"}다음 주문부터는 저장된 배송지를{"\n"}바로 선택하실 수 있습니다.
              </p>
            </div>
            <div className="p-4 pt-5">
              <button
                onClick={() => setShowFirstTimeSavePopup(false)}
                className="w-full py-3 text-[13px] font-bold text-white bg-gray-900 rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
