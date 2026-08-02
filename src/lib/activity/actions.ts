// The vocabulary of the activity log (F26).
//
// Kept as a plain union rather than a Prisma enum: the column is a String so
// that writing a log entry can never fail on a value the database has not seen,
// and this is where the known set is documented instead.

export const ACTIVITY_ACTIONS = [
  "login",
  "logout",
  "ita.create",
  "ita.update",
  "ita.delete",
  "oit.create",
  "oit.update",
  "oit.delete",
  "file.upload",
  "file.delete",
  "user.create",
  "user.update",
  "user.disable",
  "user.restore",
  "profile.update",
  "profile.password_change",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

const LABELS: Record<ActivityAction, string> = {
  login: "เข้าสู่ระบบ",
  logout: "ออกจากระบบ",
  "ita.create": "เพิ่มหัวข้อ ITA",
  "ita.update": "แก้ไขหัวข้อ ITA",
  "ita.delete": "ลบหัวข้อ ITA",
  "oit.create": "เพิ่มรายการ OIT",
  "oit.update": "แก้ไขรายการ OIT",
  "oit.delete": "ลบรายการ OIT",
  "file.upload": "อัปโหลดไฟล์",
  "file.delete": "ลบไฟล์",
  "user.create": "เพิ่มผู้ใช้",
  "user.update": "แก้ไขผู้ใช้",
  "user.disable": "ปิดใช้งานบัญชี",
  "user.restore": "เปิดใช้งานบัญชี",
  "profile.update": "แก้ไขโปรไฟล์ตนเอง",
  "profile.password_change": "เปลี่ยนรหัสผ่านตนเอง",
};

/**
 * Thai label for a stored action.
 *
 * Falls back to the raw key: a row written by an older or newer version of the
 * code should still be readable, not blank.
 */
export function actionLabel(action: string): string {
  return LABELS[action as ActivityAction] ?? action;
}

export function isActivityAction(value: string): value is ActivityAction {
  return (ACTIVITY_ACTIONS as readonly string[]).includes(value);
}
