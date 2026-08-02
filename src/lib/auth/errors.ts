/** Login failure codes. Passed as `?error=` from route handlers; the login page maps them to Thai. */
export const LoginError = {
  // CMU OAuth (F8)
  StateMismatch: "oauth_state_mismatch",
  TokenFailed: "oauth_token_failed",
  UserInfoFailed: "oauth_userinfo_failed",
  NotRegistered: "not_registered",
  AccountDisabled: "account_disabled",
  Generic: "oauth_error",
} as const;

export type LoginErrorCode = (typeof LoginError)[keyof typeof LoginError];

export const LOGIN_ERROR_MESSAGES: Record<LoginErrorCode, string> = {
  [LoginError.StateMismatch]: "เซสชันไม่ตรงกัน โปรดเข้าสู่ระบบใหม่อีกครั้ง",
  [LoginError.TokenFailed]: "ไม่สามารถขอโทเค็นจาก CMU ได้ โปรดลองอีกครั้ง",
  [LoginError.UserInfoFailed]: "ไม่สามารถดึงข้อมูลผู้ใช้จาก CMU ได้ โปรดลองอีกครั้ง",
  // decisions.md D6 — accounts are never created automatically
  [LoginError.NotRegistered]: "บัญชี CMU นี้ยังไม่มีสิทธิ์ใช้งานระบบ โปรดติดต่อผู้ดูแลระบบ",
  [LoginError.AccountDisabled]: "บัญชีของคุณถูกปิดการใช้งาน โปรดติดต่อผู้ดูแลระบบ",
  [LoginError.Generic]: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ โปรดลองอีกครั้ง",
};
