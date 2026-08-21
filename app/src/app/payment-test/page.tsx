"use client";

// SeedPay 결제창 격리 디버그 라우트.
//
// 목적: checkout 페이지의 어떤 요소(헤더/네비/스택컨텍스트/CSS)도 영향을 주지 않는
// 최소 페이지에서 SendPay 호출만 수행한다. 여기서 결제창이 정상적으로 뜨면
// 충돌 원인은 checkout 페이지의 layout/스타일이고, 여기서도 안 뜨면
// SeedPay 가맹점 설정 또는 SDK 자체 문제로 좁혀진다.
//
// 사용: 로그인 후 http://localhost:3026/payment-test 진입 → "결제창 띄우기" 클릭.
// 사전 조건: 임의 주문 1개가 DB 에 있어야 함. URL ?orderId=<Order.id> 로 지정.
//            지정 안 하면 "더미 호출(승인 안 됨)" 버튼이 활성화되어 인증창까지만 확인.

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const SEEDPAY_PG_JS_URL = "https://pay.seedpayments.co.kr/js/pgAsistant.js";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).SendPay) return resolve();
    const existing = document.querySelector('script[data-seedpay="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("스크립트 로드 실패")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.dataset.seedpay = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("스크립트 로드 실패"));
    document.head.appendChild(s);
  });
}

function PaymentTestInner() {
  const sp = useSearchParams();
  const orderIdParam = sp?.get("orderId") ?? "";
  const [orderId, setOrderId] = useState(orderIdParam);
  const [status, setStatus] = useState("초기 상태");
  const [logLines, setLogLines] = useState<string[]>([]);

  const log = (s: string) => {
    setLogLines((arr) => [...arr, `${new Date().toISOString().slice(11, 19)} ${s}`]);
  };

  useEffect(() => {
    log("SeedPay JS 사전 로드 시작");
    loadScript(SEEDPAY_PG_JS_URL)
      .then(() => log(`스크립트 로드 완료, typeof SendPay=${typeof (window as any).SendPay}`))
      .catch((e) => log(`스크립트 로드 실패: ${e.message}`));

    const w = window as any;
    w.pay_result_submit = function pay_result_submit() {
      log("pay_result_submit 호출됨");
    };
    w.pay_result_close = function pay_result_close() {
      log("pay_result_close 호출됨 (사용자 X 클릭 또는 SDK 종료)");
    };
    return () => {
      try {
        delete w.pay_result_submit;
        delete w.pay_result_close;
      } catch {}
    };
  }, []);

  const callSendPay = async () => {
    if (!orderId.trim()) {
      setStatus("orderId 필요");
      return;
    }
    setStatus("prepare 호출 중");
    const prepRes = await fetch("/api/payments/seedpay/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: orderId.trim(), payMethod: "CARD" }),
    });
    if (!prepRes.ok) {
      const t = await prepRes.text();
      setStatus(`prepare 실패: ${prepRes.status} ${t}`);
      log(`prepare 실패: ${prepRes.status} ${t}`);
      return;
    }
    const prep = await prepRes.json();
    log(`prepare ok, formKeys=${Object.keys(prep.form).join(",")}`);

    try {
      await loadScript(SEEDPAY_PG_JS_URL);
    } catch (e: any) {
      setStatus("스크립트 로드 실패: " + e.message);
      return;
    }

    const prev = document.querySelector('form[name="payInit"]');
    if (prev) prev.remove();
    const form = document.createElement("form");
    form.name = "payInit";
    form.method = "post";
    form.acceptCharset = "UTF-8";
    form.enctype = "application/x-www-form-urlencoded";
    // action 은 SDK 가 설정하도록 빈 값으로 둠 (vanillaform pay.html 패턴)
    form.setAttribute("action", "");
    Object.entries(prep.form as Record<string, string>).forEach(([k, v]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = k;
      input.value = String(v ?? "");
      form.appendChild(input);
    });
    document.body.appendChild(form);
    log(`form mounted, document.forms.length=${document.forms.length}`);

    const SendPay = (window as any).SendPay;
    if (typeof SendPay !== "function") {
      setStatus("SendPay 함수 없음");
      return;
    }
    log(`SendPay 호출 (isProduction=${prep.isProduction})`);
    const formArg = (document as any).payInit ?? form;
    try {
      if (prep.isProduction) SendPay(formArg);
      else SendPay(formArg, "TEST");
    } catch (e: any) {
      log("SendPay threw: " + (e?.message ?? e));
    }
    setStatus("SendPay 호출 완료 — 결제창 확인");
  };

  return (
    <div style={{ padding: 32, fontFamily: "sans-serif", maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>SeedPay 격리 디버그</h1>
      <p style={{ fontSize: 14, color: "#555", marginBottom: 16 }}>
        이 페이지는 모든 layout/header/footer 를 우회한다. checkout 페이지에서 결제창이
        안 뜨고 여기서는 뜨면 → checkout 컴포넌트의 stacking-context 충돌.
        여기서도 안 뜨면 → SDK 또는 SeedPay 가맹점 설정 문제.
      </p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Order ID (cuid)</label>
        <input
          type="text"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="cmxxxxxxxx... (DB의 Order.id)"
          style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
        />
        <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
          URL로 전달: <code>?orderId=...</code>. 본인 소유 PENDING 주문이어야 합니다.
        </p>
      </div>

      <button
        onClick={callSendPay}
        style={{
          padding: "10px 16px",
          background: "#0a8",
          color: "#fff",
          border: 0,
          borderRadius: 4,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        결제창 띄우기
      </button>

      <div style={{ marginTop: 24 }}>
        <strong style={{ fontSize: 13 }}>상태:</strong> <span style={{ fontSize: 13 }}>{status}</span>
      </div>

      <pre
        style={{
          marginTop: 16,
          padding: 12,
          background: "#0b1020",
          color: "#cfe",
          fontSize: 11,
          lineHeight: 1.5,
          maxHeight: 320,
          overflow: "auto",
          borderRadius: 4,
        }}
      >
        {logLines.join("\n") || "(로그 없음)"}
      </pre>

      <details style={{ marginTop: 16, fontSize: 12, color: "#555" }}>
        <summary>다음 단계 (이 페이지에서 결과별)</summary>
        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
          <li>결제창이 정상적으로 뜸 → checkout 페이지의 stacking-context 문제. globals.css 의 강제 z-index 가 작동했는지, 또는 checkout 페이지 부모에 transform 등이 있는지 확인.</li>
          <li>여기서도 dimming 만 뜨고 결제창 안 보임 → SDK 로드 시점 문제 가능성. 브라우저 콘솔에서 pgPayMask/pgPayWindow 노드 위치 확인.</li>
          <li>아예 아무 것도 안 뜸 → SendPay 호출 자체가 fail. 콘솔 에러 확인.</li>
        </ul>
      </details>
    </div>
  );
}

export default function PaymentTestPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, fontFamily: "sans-serif" }}>로딩…</div>}>
      <PaymentTestInner />
    </Suspense>
  );
}
