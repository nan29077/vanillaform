// 회원 가입 경로(소셜 제공자) 배지 — 카카오·네이버·구글, 없으면 이메일(비밀번호) 가입.
// 여러 회원 목록 화면에서 공용으로 사용한다.

// 소셜 가입 제공자 배지 설정 (브랜드 컬러). 제공자 문자열은 lib/auth.ts 의 provider 값과 동일.
export const PROVIDER_MAP: Record<string, { label: string; className: string }> = {
  kakao: { label: "카카오", className: "bg-[#FEE500] text-[#3C1E1E]" },
  naver: { label: "네이버", className: "bg-[#03C75A] text-white" },
  google: { label: "구글", className: "bg-white text-gray-600 border border-gray-300" },
  email: { label: "이메일", className: "bg-gray-100 text-gray-500" },
};

// OAuth 계정이 없으면 이메일(비밀번호) 가입으로 표시한다.
export default function SignupBadges({ providers }: { providers?: string[] }) {
  const list = providers && providers.length > 0 ? providers : ["email"];
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {list.map((p) => {
        const cfg = PROVIDER_MAP[p] || { label: p, className: "bg-gray-100 text-gray-500" };
        return (
          <span key={p} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.className}`}>
            {cfg.label}
          </span>
        );
      })}
    </span>
  );
}
