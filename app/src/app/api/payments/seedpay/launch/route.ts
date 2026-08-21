import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildPayRequestHash,
  ensureSeedpayConfigured,
  getEdiDate,
  seedpayConfig,
} from "@/lib/seedpay";

export const dynamic = "force-dynamic";

// SeedPay 결제창을 iframe 안에서 호출하기 위한 HTML 응답.
// 이유: 부모(Next.js) 페이지에서 form.submit(target="iframeName") 으로 iframe 에 결제 페이지를
// 띄우는 표준 방식이 Next.js dev 환경에서 cross-frame target lookup 실패로 동작하지 않음.
// 우회: iframe.src 로 이 엔드포인트를 same-origin 로드 → iframe 내부에서 form 자체 submit.

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlResponse(body: string, status = 200) {
  return new Response(
    `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>SeedPay</title></head><body style="margin:0;padding:0;font-family:sans-serif;">${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function errorPage(msg: string) {
  return htmlResponse(
    `<div style="padding:24px;color:#c00;">결제 페이지 호출 실패: ${escapeHtml(msg)}</div>`,
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");
  const payMethodRaw = (url.searchParams.get("payMethod") || "CARD").toUpperCase();
  const debug = url.searchParams.get("debug") === "1";
  // full=1: 모바일 전체페이지 호출. SeedPay 모바일 결제창은 리다이렉트 기반이라
  // iframe 이 아닌 top-level 로 띄워야 닫기 시 Whitelabel(SeedPay 도메인 상대경로 이동)이 안 난다.
  const isFull = url.searchParams.get("full") === "1";

  if (!orderId) return errorPage("orderId 가 필요합니다.");

  const session = await auth();
  if (!session) return errorPage("로그인이 필요합니다.");

  try {
    ensureSeedpayConfigured();
  } catch (e: any) {
    return errorPage(e.message);
  }

  const METHOD_MAP: Record<string, string> = {
    CARD: "CARD",
    BANK: "BANK",
    VACNT: "VACNT",
    EASYPAY: "ALL",
    ALL: "ALL",
  };
  const method = METHOD_MAP[payMethodRaw] ?? "CARD";

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: { select: { email: true, name: true, phone: true } } },
  });
  if (!order) return errorPage("주문을 찾을 수 없습니다.");
  if (order.userId !== session.user!.id) return errorPage("본인 주문만 결제할 수 있습니다.");
  if (order.paymentStatus === "COMPLETED") return errorPage("이미 결제 완료된 주문입니다.");

  const ediDate = getEdiDate();
  const goodsAmt = Math.round(Number(order.finalAmount));
  if (goodsAmt <= 0) return errorPage("결제 금액이 유효하지 않습니다.");
  const hashString = buildPayRequestHash(ediDate, goodsAmt);

  const firstItem = order.items[0];
  const goodsNm =
    order.items.length > 1
      ? `${firstItem?.productName ?? "상품"} 외 ${order.items.length - 1}건`
      : firstItem?.productName ?? "상품";

  // returnUrl: SeedPay 가 인증 결과를 보낼 URL.
  // - PC iframe(full 아님): pgAsistant.js 의 returnData 가 부모 window 에서 form.action 으로
  //   사용하므로 상대경로가 부모 origin 기준으로 자동 해석됨 → 상대경로 유지.
  // - 모바일 전체페이지(full=1): SeedPay 서버가 직접 returnUrl 로 redirect/POST 하므로
  //   상대경로면 SeedPay 도메인 기준으로 풀려 Whitelabel 이 난다 → 절대 URL 필수.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    new URL(request.url).origin;
  const returnUrl = isFull
    ? `${origin}/api/payments/seedpay/result`
    : `/api/payments/seedpay/result`;

  // SeedPay 필드 길이/문자 제한 sanitize:
  // - ordNo: 하이픈 등 특수문자 거부 → 알파넘메릭만
  // - ordTel: 한국 휴대폰 11자리 초과 시 거부 → 앞 11자리만
  // - mbsUsrId: 길이 제한(보통 20자) 초과 시 거부 → cuid 앞 20자만
  // 결제 결과 매핑은 mbsReserved(= 전체 order.id cuid) 로 하므로 truncate 영향 없음.
  const sanitizedOrdNo = order.orderNumber.replace(/[^A-Za-z0-9]/g, "");
  const sanitizedOrdTel = (order.shippingPhone || order.user.phone || "")
    .replace(/[^0-9]/g, "")
    .slice(0, 11);
  const sanitizedMbsUsrId = order.userId.slice(0, 20);

  const fields: Record<string, string> = {
    mid: seedpayConfig.mid,
    method,
    goodsNm,
    ordNo: sanitizedOrdNo,
    goodsAmt: String(goodsAmt),
    ordNm: order.shippingName || order.user.name || "구매자",
    ordEmail: order.user.email || "",
    ordTel: sanitizedOrdTel,
    ordIp: "",
    mbsUsrId: sanitizedMbsUsrId,
    mbsReserved: order.id,
    ediDate,
    hashString,
    returnUrl,
  };


  const actionUrl = seedpayConfig.isProduction
    ? "https://pay.seedpayments.co.kr/payment/v1/view/request"
    : "https://devpay.seedpayments.co.kr/payment/v1/view/request";

  // debug=3 — vanillaform 의 정상 작동 필드 값을 그대로 써서 POST.
  // 우리 setup(env/네트워크/hash 함수) 이 정상인지 격리 검증.
  if (url.searchParams.get("debug") === "3") {
    const testGoodsAmt = "1004";
    const testHash = buildPayRequestHash(ediDate, testGoodsAmt);
    const testFields: Record<string, string> = {
      mid: seedpayConfig.mid,
      method: "ALL",
      goodsNm: "테스트상품",
      ordNo: "TEST" + ediDate,
      goodsAmt: testGoodsAmt,
      ordNm: "홍길동",
      ordEmail: "test@example.com",
      ordTel: "01012345678",
      ordIp: "",
      mbsUsrId: "testUser",
      mbsReserved: "예약필드테스트",
      ediDate,
      hashString: testHash,
      returnUrl: "/pay/result",
    };
    const body = new URLSearchParams(testFields).toString();
    let status = 0;
    let text = "";
    try {
      const res = await fetch(actionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      status = res.status;
      text = await res.text();
    } catch (e: any) {
      text = "fetch 오류: " + (e?.message ?? String(e));
    }
    const m = text.match(/"resultCd":"(\d+)","resultMsg":"([^"]+)"/);
    const decoded = m ? `resultCd=${m[1]}, resultMsg=${JSON.parse(`"${m[2]}"`)}` : "(에러 패턴 없음 — 정상 응답 가능)";
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="padding:16px;font-family:sans-serif;font-size:12px;">
        <h3>vanillaform-style 테스트 (debug=3)</h3>
        <p><b>Status</b>: ${status}</p>
        <p><b>해석</b>: ${escapeHtml(decoded)}</p>
        <h4>사용 필드값</h4>
        <pre style="background:#f5f5f5;padding:8px;">${escapeHtml(JSON.stringify(testFields, null, 2))}</pre>
        <h4>Response Body (앞 5000자)</h4>
        <pre style="background:#f5f5f5;padding:8px;white-space:pre-wrap;">${escapeHtml(text.slice(0, 5000))}</pre>
      </body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  // debug=2 — 서버 측에서 직접 SeedPay 로 POST 해서 raw 응답을 본다.
  // 브라우저 iframe 으로 가지 않으므로 X-Frame-Options/CSP 영향 없이 순수 응답 확인.
  if (url.searchParams.get("debug") === "2") {
    const body = new URLSearchParams(fields).toString();
    let status = 0;
    let headers: Record<string, string> = {};
    let text = "";
    try {
      const res = await fetch(actionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      status = res.status;
      headers = Object.fromEntries(res.headers.entries());
      text = await res.text();
    } catch (e: any) {
      text = "fetch 오류: " + (e?.message ?? String(e));
    }
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>debug=2</title></head><body style="padding:16px;font-family:sans-serif;font-size:12px;">
        <h3>서버 측 SeedPay POST 결과</h3>
        <p><b>Status</b>: ${status}</p>
        <p><b>Response Headers</b>:</p>
        <pre style="background:#f5f5f5;padding:8px;">${escapeHtml(JSON.stringify(headers, null, 2))}</pre>
        <p><b>Response Body (앞 5000자)</b>:</p>
        <pre style="background:#f5f5f5;padding:8px;white-space:pre-wrap;">${escapeHtml(text.slice(0, 5000))}</pre>
      </body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const inputs = Object.entries(fields)
    .map(
      ([k, v]) =>
        `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`,
    )
    .join("\n");

  if (debug) {
    // debug=1 — 자동 제출 끄고 필드 값 시각화. 진단용.
    const fieldRows = Object.entries(fields)
      .map(([k, v]) => `<tr><td><b>${escapeHtml(k)}</b></td><td>${escapeHtml(v)}</td></tr>`)
      .join("");
    return htmlResponse(`
<div style="padding:16px;background:#fffae0;border:1px solid #e0d800;font-size:12px;line-height:1.6;">
  <h3 style="margin:0 0 8px;">[디버그] SeedPay 결제 호출 (자동 제출 비활성)</h3>
  <p>action URL: <code>${escapeHtml(actionUrl)}</code></p>
  <details open><summary>전송될 필드 (${Object.keys(fields).length}개)</summary>
    <table style="border-collapse:collapse;margin-top:8px;font-family:monospace;font-size:11px;">${fieldRows}</table>
  </details>
  <button onclick="document.getElementById('seedpay_form').submit()" style="margin-top:12px;padding:8px 16px;">수동 제출</button>
</div>
<form id="seedpay_form" method="post" action="${escapeHtml(actionUrl)}" accept-charset="UTF-8">
${inputs}
</form>`);
  }

  return htmlResponse(`
<div id="loading" style="padding:24px;color:#666;text-align:center;">결제 페이지를 불러오는 중입니다...</div>
<form id="seedpay_form" method="post" action="${escapeHtml(actionUrl)}" accept-charset="UTF-8">
${inputs}
</form>
<script>
(function(){
  try { document.getElementById("seedpay_form").submit(); }
  catch (e) {
    document.getElementById("loading").innerText = "결제 호출 실패: " + e.message;
  }
})();
</script>`);
}
