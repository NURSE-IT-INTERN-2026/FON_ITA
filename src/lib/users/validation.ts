import { z } from "zod";

// Shared Zod fields for person-name columns, used by both user management
// (F24) and the profile page (F25) — one definition, so the two forms cannot
// enforce different limits.

export const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { message: `กรุณากรอก${label}` })
    .max(100, { message: `${label}ต้องไม่เกิน 100 ตัวอักษร` });
