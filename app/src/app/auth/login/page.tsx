"use client";

import { Icon } from "@/components/shared/Icon";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession, getProviders } from "next-auth/react";
import { useAppDialog } from "@/components/shared/AppDialog";
import BusinessInfoFooter from "@/components/shared/BusinessInfoFooter";
import { parseShopCookie, SB_SHOP_COOKIE } from "@/lib/shopContext";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function getDashboardPath(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin";
    case "MIDDLE_ADMIN":
      return "/middle";
    case "SELLER":
      return "/seller";
    case "BRAND_ADMIN":
      return "/brand";
    case "BUYER":
      return "/";
    default:
      return "/";
  }
}

function normalizeInternalCallbackUrl(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function readShopCallbackUrl(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${SB_SHOP_COOKIE}=`));
  const shop = parseShopCookie(match?.slice(SB_SHOP_COOKIE.length + 1));
  return shop ? `/shop/${encodeURIComponent(shop.slug)}` : null;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { appAlert } = useAppDialog();
  const rawCallbackUrl = searchParams?.get("callbackUrl") ?? null;
  const [shopFallbackUrl, setShopFallbackUrl] = useState<string | null>(null);
  const callbackUrl =
    normalizeInternalCallbackUrl(rawCallbackUrl) ?? shopFallbackUrl;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [sellerPending, setSellerPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [findIdOpen, setFindIdOpen] = useState(false);
  const [forgotPwOpen, setForgotPwOpen] = useState(false);

  useEffect(() => {
    setShopFallbackUrl(readShopCallbackUrl());
  }, []);

  const redirectAfterLogin = async () => {
    const session = await getSession();
    // 임시 비밀번호로 로그인한 경우 강제 재설정 페이지로 우선 이동
    if (session?.user?.mustResetPassword) {
      router.push("/auth/reset-password");
      router.refresh();
      return;
    }
    if (callbackUrl) {
      router.push(callbackUrl);
    } else {
      const role = session?.user?.role || "BUYER";
      router.push(getDashboardPath(role));
    }
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        if (result.error === "CredentialsSignin") {
          try {
            const checkRes = await fetch("/api/auth/check-seller-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            const checkData = await checkRes.json();
            if (checkData.sellerNotApproved) {
              setSellerPending(true);
              return;
            }
          } catch {}
          setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        } else {
          setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        }
      } else {
        await redirectAfterLogin();
      }
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const [enabledOAuth, setEnabledOAuth] = useState<Set<string>>(new Set());
  useEffect(() => {
    getProviders()
      .then((p) => {
        if (!p) return;
        const s = new Set<string>();
        for (const id of Object.keys(p)) {
          if (id !== "credentials") s.add(id);
        }
        setEnabledOAuth(s);
      })
      .catch(() => {});
  }, []);

  const errorParam = searchParams?.get("error");
  const methodParam = searchParams?.get("method");
  useEffect(() => {
    if (errorParam === "EmailExists") {
      appAlert("이미 일반 가입된 이메일입니다. 비밀번호로 로그인해주세요.");
    } else if (errorParam === "OAuthAccountNotLinked") {
      const LABEL: Record<string, string> = {
        credentials: "이메일·비밀번호",
        kakao: "카카오",
        naver: "네이버",
        google: "구글",
      };
      const methods = (methodParam ?? "")
        .split(",")
        .map((m) => LABEL[m.trim()])
        .filter(Boolean);
      if (methods.length) {
        appAlert(
          `이미 ${methods.join(" / ")}(으)로 가입된 이메일입니다. ${methods.join(" / ")} 로그인을 이용해주세요.`,
        );
      } else {
        appAlert(
          "다른 방식으로 가입된 이메일입니다. 기존 가입 방식으로 로그인해주세요.",
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorParam, methodParam]);

  const handleSocialLogin = (provider: "kakao" | "naver" | "google") => {
    if (!enabledOAuth.has(provider)) {
      appAlert(
        `${provider} 로그인이 아직 설정되지 않았습니다. 관리자에게 문의해주세요.`,
      );
      return;
    }
    // 분양몰 등에서 ?callbackUrl=/shop/slug 로 진입했으면 로그인 후 그 페이지로 복귀.
    signIn(provider, { callbackUrl: callbackUrl || "/" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="flex-shrink-0 pt-12 pb-6 text-center">
        <Link href="/" className="inline-block mb-3">
          <img
            src="/logo.svg"
            alt="바닐라폼"
            className="h-10 w-auto object-contain mx-auto"
          />
        </Link>
        <p className="text-sm text-gray-400">
          바닐라폼 인플루언서 커머스 플랫폼
        </p>
      </div>

      <div className="flex-1 px-5 pb-8 max-w-md mx-auto w-full">
        <div className="grid grid-cols-3 gap-2 mb-5">
          <button
            type="button"
            onClick={() => handleSocialLogin("kakao")}
            disabled={!enabledOAuth.has("kakao")}
            title={
              enabledOAuth.has("kakao")
                ? "카카오로 로그인"
                : "카카오 로그인 설정 미완료"
            }
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-[#FEE500] hover:bg-[#FDD835] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3C6.477 3 2 6.477 2 10.5c0 2.592 1.677 4.877 4.2 6.2-.13.47-.84 3.03-.87 3.23 0 0-.017.14.074.193.091.053.199.025.199.025.263-.037 3.047-1.987 3.53-2.313.59.083 1.2.165 1.867.165 5.523 0 10-3.477 10-7.5S17.523 3 12 3z"
                fill="#3C1E1E"
              />
            </svg>
            <span className="text-[10px] font-medium text-gray-800">
              카카오
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleSocialLogin("naver")}
            disabled={!enabledOAuth.has("naver")}
            title={
              enabledOAuth.has("naver")
                ? "네이버로 로그인"
                : "네이버 로그인 설정 미완료"
            }
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-[#03C75A] hover:bg-[#02B550] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M14.5 12.65L9.3 5H5v14h4.5v-7.65L14.7 19H19V5h-4.5v7.65z"
                fill="white"
              />
            </svg>
            <span className="text-[10px] font-medium text-white">네이버</span>
          </button>
          <button
            type="button"
            onClick={() => handleSocialLogin("google")}
            disabled={!enabledOAuth.has("google")}
            title={
              enabledOAuth.has("google")
                ? "Google로 로그인"
                : "Google 로그인 설정 미완료"
            }
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span className="text-[10px] font-medium text-gray-600">
              Google
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[11px] text-gray-400 font-medium">
            이메일로 로그인
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {sellerPending && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-5">
            <div className="flex items-start gap-3">
              <Icon
                name="Clock"
                size={20}
                className="text-yellow-600 flex-shrink-0 mt-0.5"
              />
              <div>
                <p className="text-sm font-semibold text-yellow-800 mb-1">
                  라이브 셀러 승인 대기 중
                </p>
                <p className="text-xs text-yellow-700 leading-relaxed">
                  라이브 셀러 계정은 관리자 승인 후 이용 가능합니다. 승인이
                  완료되면 로그인하여 서비스를 이용하실 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <form
            onSubmit={handleSubmit}
            className="space-y-3.5"
          >
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                이메일
              </label>
              <input
                type="email"
                name="email"
                className="input-field text-sm py-2.5"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                비밀번호
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="input-field text-sm py-2.5 pr-10"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 active:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <Icon name="Eye" size={18} />
                  ) : (
                    <Icon name="Eye" size={18} />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-3 text-sm"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  로그인 중...
                </span>
              ) : (
                "로그인"
              )}
            </button>
          </form>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-gray-400">
          <button
            type="button"
            onClick={() => setFindIdOpen(true)}
            className="hover:text-amber-600 transition-colors"
          >
            아이디 찾기
          </button>
          <span className="text-gray-200">|</span>
          <button
            type="button"
            onClick={() => setForgotPwOpen(true)}
            className="hover:text-amber-600 transition-colors"
          >
            비밀번호 찾기
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            아직 계정이 없으신가요?{" "}
            <Link
              href="/auth/register"
              className="text-brand-600 font-semibold hover:underline"
            >
              회원가입
            </Link>
          </p>
        </div>

        {/* 전자상거래법상 초기 화면 하단 사업자 정보 (네이버 로그인 검수 요건) */}
        <div className="px-5 pb-8">
          <BusinessInfoFooter />
        </div>
      </div>

      {findIdOpen && <FindIdModal onClose={() => setFindIdOpen(false)} />}
      {forgotPwOpen && (
        <ForgotPasswordModal onClose={() => setForgotPwOpen(false)} />
      )}
    </div>
  );
}

// 바닐라 플라워 테마 모달 공통 셸
function BeeModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border-2 border-amber-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-amber-800">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

// 셀러 계정 고객센터 안내 (아이디/비밀번호 공용)
function SellerSupportNotice() {
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
      <p className="mb-2">
        셀러 계정은 보안을 위해 고객센터를 통해서만 아이디/비밀번호 찾기가
        가능합니다.
      </p>
      <p className="text-xs text-amber-700">
        고객센터: 카카오톡 채널 <b>@바닐라폼</b>
        <br />
        또는 <b>support@vanillaform.local</b>
      </p>
    </div>
  );
}

// 아이디 찾기 모달 — 이름 + 전화번호
function FindIdModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[] | null>(null);
  const [isSeller, setIsSeller] = useState(false);
  const [error, setError] = useState("");

  const handleFind = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResults(null);
    setIsSeller(false);
    try {
      const res = await fetch("/api/auth/find-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (res.ok) {
        setResults(data.emails as string[]);
      } else if (data.isSeller) {
        setIsSeller(true);
      } else {
        setError(data.error || "아이디를 찾을 수 없습니다.");
      }
    } catch {
      setError("아이디 찾기 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BeeModal title="아이디 찾기" onClose={onClose}>
      {isSeller ? (
        <SellerSupportNotice />
      ) : results ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-xs text-amber-700">회원님의 아이디는</p>
          {results.map((em) => (
            <p key={em} className="my-1.5 text-lg font-bold text-amber-800">
              {em}
            </p>
          ))}
          <p className="text-xs text-amber-700">입니다.</p>
        </div>
      ) : (
        <form onSubmit={handleFind} className="mt-3 space-y-3">
          <p className="text-xs text-gray-500">
            가입 시 입력한 이름과 전화번호를 입력해주세요.
          </p>
          <input
            type="text"
            className="input-field text-sm py-2.5"
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="tel"
            className="input-field text-sm py-2.5"
            placeholder="전화번호 (- 없이 숫자만)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-500">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber-400 py-3 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-500 disabled:opacity-50"
          >
            {loading ? "찾는 중..." : "아이디 찾기"}
          </button>
        </form>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50"
      >
        닫기
      </button>
    </BeeModal>
  );
}

// 비밀번호 초기화 모달 — 아이디(이메일) + 이름 + 전화번호 확인 후 임시 비밀번호 문자 발송
function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentPhone, setSentPhone] = useState<string | null>(null);
  const [isSeller, setIsSeller] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSentPhone(null);
    setIsSeller(false);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, phone }),
      });
      const data = await res.json();
      if (res.ok) {
        setSentPhone(data.phone || "");
      } else if (data.isSeller) {
        setIsSeller(true);
      } else {
        setError(data.error || "요청 처리에 실패했습니다.");
      }
    } catch {
      setError("비밀번호 초기화 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BeeModal title="비밀번호 초기화" onClose={onClose}>
      {isSeller ? (
        <SellerSupportNotice />
      ) : sentPhone !== null ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm leading-relaxed text-amber-800">
          <p>
            {sentPhone ? `${sentPhone} 번호로` : "등록된 전화번호로"} 임시
            비밀번호를 문자로 발송했습니다.
          </p>
          <p className="mt-1 text-xs text-amber-700">
            임시 비밀번호로 로그인 후 새 비밀번호를 설정해주세요.
          </p>
        </div>
      ) : (
        <form onSubmit={handleReset} className="mt-3 space-y-3">
          <p className="text-xs text-gray-500">
            가입한 아이디(이메일)·이름·전화번호를 확인 후 임시 비밀번호를 문자로
            보내드려요.
          </p>
          <input
            type="email"
            className="input-field text-sm py-2.5"
            placeholder="아이디 (email@example.com)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="text"
            className="input-field text-sm py-2.5"
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="tel"
            className="input-field text-sm py-2.5"
            placeholder="전화번호 (- 없이 숫자만)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-500">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber-400 py-3 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-500 disabled:opacity-50"
          >
            {loading ? "전송 중..." : "임시 비밀번호 문자 받기"}
          </button>
        </form>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50"
      >
        닫기
      </button>
    </BeeModal>
  );
}
