import { NextPage } from "next";

interface ErrorProps {
  statusCode?: number;
}

const ErrorPage: NextPage<ErrorProps> = ({ statusCode }) => {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, -apple-system, sans-serif", background: "#fff" }}>
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111", marginBottom: "0.5rem" }}>
          {statusCode ? `${statusCode} 오류가 발생했습니다` : "오류가 발생했습니다"}
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1.5rem" }}>
          일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.
        </p>
        <a href="/" style={{ display: "inline-block", padding: "0.75rem 1.5rem", background: "#111", color: "#fff", borderRadius: "0.5rem", textDecoration: "none", fontSize: "0.875rem", fontWeight: 600 }}>
          홈으로 돌아가기
        </a>
      </div>
    </div>
  );
};

ErrorPage.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default ErrorPage;
