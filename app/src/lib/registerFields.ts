// 회원가입 항목 권한(필수/선택/숨김) 설정 — 클라이언트/서버 공용.
//
// - 최고관리자 "회원가입 항목 권한설정"에서 항목별로 필수/선택/숨김을 지정합니다.
// - 실제 런타임 값은 DB(Setting) 에 JSON 으로 저장되며, 없으면 아래 기본값을 사용합니다.
//   (lib/settings.ts 의 getRegisterFieldSettings 참고)
// - 이 파일은 클라이언트 번들에도 포함되므로 prisma 등 서버 전용 모듈을 import 하지 않습니다.

export type RegisterFieldStatus = "required" | "optional" | "hidden";

export type RegisterFieldKey =
  | "name"
  | "email"
  | "password"
  | "passwordConfirm"
  | "phone"
  | "gender"
  | "birthday"
  | "address";

export type RegisterFieldSettings = Record<RegisterFieldKey, RegisterFieldStatus>;

// 항상 필수(관리자 변경 불가) 항목 — 계정 생성에 반드시 필요한 값
export const REGISTER_LOCKED_FIELDS: RegisterFieldKey[] = [
  "name",
  "email",
  "password",
  "passwordConfirm",
];

export function isRegisterFieldLocked(key: RegisterFieldKey): boolean {
  return REGISTER_LOCKED_FIELDS.includes(key);
}

// 코드 기본값 (DB 값이 없을 때 사용)
// 초기 셋팅: 이름·이메일·비밀번호·비밀번호확인·휴대전화 = 필수, 성별·생년월일·주소 = 선택
export const REGISTER_FIELD_DEFAULTS: RegisterFieldSettings = {
  name: "required",
  email: "required",
  password: "required",
  passwordConfirm: "required",
  phone: "required",
  gender: "optional",
  birthday: "optional",
  address: "optional",
};

// Setting 테이블에 저장되는 key (단일 JSON 문자열)
export const REGISTER_FIELDS_SETTING_KEY = "register.fields";

// 권한 설정 화면 / 가입 폼에서 사용할 메타 정보
export const REGISTER_FIELD_META: {
  key: RegisterFieldKey;
  label: string;
  desc: string;
}[] = [
  { key: "name", label: "이름", desc: "회원 이름 (실명 권장)" },
  { key: "email", label: "이메일", desc: "로그인 아이디로 사용되는 이메일" },
  { key: "password", label: "비밀번호", desc: "8자 이상 로그인 비밀번호" },
  { key: "passwordConfirm", label: "비밀번호 확인", desc: "비밀번호 재입력 확인" },
  { key: "phone", label: "휴대전화번호", desc: "본인 확인·주문 안내용 연락처" },
  { key: "gender", label: "성별", desc: "남성/여성 선택" },
  { key: "birthday", label: "생년월일", desc: "생년월일 (YYYY-MM-DD)" },
  { key: "address", label: "주소", desc: "우편번호·도로명주소·상세주소" },
];

// 임의의 값(Setting JSON 등)을 안전한 RegisterFieldSettings 로 정규화한다.
// - 잘못된 값/누락 항목은 기본값으로 폴백
// - 잠금 항목은 항상 required 로 강제
export function normalizeRegisterFieldSettings(raw: unknown): RegisterFieldSettings {
  const valid: RegisterFieldStatus[] = ["required", "optional", "hidden"];
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const result = { ...REGISTER_FIELD_DEFAULTS };
  (Object.keys(REGISTER_FIELD_DEFAULTS) as RegisterFieldKey[]).forEach((key) => {
    const v = source[key];
    if (typeof v === "string" && valid.includes(v as RegisterFieldStatus)) {
      result[key] = v as RegisterFieldStatus;
    }
    // 잠금 항목은 무조건 필수
    if (isRegisterFieldLocked(key)) {
      result[key] = "required";
    }
  });
  return result;
}
