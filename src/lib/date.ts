// Buddhist-era (พ.ศ.) helpers. CLAUDE.md forbids inlining `+543` anywhere else —
// every conversion goes through this file.
//
// Timestamps are stored as real Gregorian dates; the +543 shift is display-only.

const BE_OFFSET = 543;

const TH_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const TH_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

/** Gregorian year → Buddhist era. `toBE(2026)` → `2569` */
export function toBE(gregorianYear: number): number {
  return gregorianYear + BE_OFFSET;
}

/** Current year in Buddhist era — the default year for the ITA list. */
export function currentBEYear(): number {
  return toBE(new Date().getFullYear());
}

/** `"2026-08-01T09:00:00Z"` → `"01/08/2569"` */
export function formatBEDate(value: string | Date): string {
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${toBE(d.getFullYear())}`;
}

/** `"1 สิงหาคม 2569"` */
export function formatBELong(value: string | Date): string {
  const d = new Date(value);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${toBE(d.getFullYear())}`;
}

/** `"1 ส.ค. 2569"` */
export function formatBEShort(value: string | Date): string {
  const d = new Date(value);
  return `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${toBE(d.getFullYear())}`;
}

/**
 * `"1 ส.ค. 2569 16:45 น."` — for the activity log (F26), where the time of day
 * is half the information.
 *
 * Unlike the helpers above, this one pins the zone to Asia/Bangkok instead of
 * reading the host's. A server running on UTC would otherwise timestamp every
 * entry seven hours early, and a log that disagrees with the clock on the wall
 * is worse than no log. (The date-only helpers have the same exposure at the
 * day boundary — see F30.)
 */
const BANGKOK_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatBEDateTime(value: string | Date): string {
  const parts = new Map(
    BANGKOK_PARTS.formatToParts(new Date(value)).map((p) => [p.type, p.value]),
  );
  const day = Number(parts.get("day"));
  const month = Number(parts.get("month")) - 1;
  const year = toBE(Number(parts.get("year")));
  return `${day} ${TH_MONTHS_SHORT[month]} ${year} ${parts.get("hour")}:${parts.get("minute")} น.`;
}
