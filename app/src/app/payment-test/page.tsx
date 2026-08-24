import { notFound } from "next/navigation";
import PaymentTestClient from "./PaymentTestClient";

// SeedPay 결제창 격리 디버그 라우트 — **개발 환경 전용**.
//
// 이 페이지는 임의의 Order.id 를 입력받아 PG prepare API 를 호출하는 디버그 도구다.
// 프로덕션에 열려 있으면 결제 파라미터(가맹점 ID·해시 등)와 내부 동작이 그대로 노출되고,
// 로그인만 하면 남의 주문 id 로 결제창을 띄워보는 것도 가능하다.
// 개발 환경이 아니면 라우트 자체를 존재하지 않는 것처럼 404 로 응답한다.
export const dynamic = "force-dynamic";

export default function PaymentTestPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <PaymentTestClient />;
}
