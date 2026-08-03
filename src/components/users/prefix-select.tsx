"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * คำนำหน้า as a dropdown, shared by the user dialog (F24) and the profile page (F25)
 * so the two cannot drift apart.
 *
 * The list covers what a faculty roster actually holds: the three civil titles
 * plus academic ranks, which staff here carry. Editing this array is the whole
 * job of adding a title — nothing else reads these values.
 */
const PREFIXES = [
  "นาย",
  "นาง",
  "นางสาว",
  // "อาจารย์",
  // "ดร.",
  // "ผศ.",
  // "ผศ. ดร.",
  // "รศ.",
  // "รศ. ดร.",
  // "ศ.",
  // "ศ. ดร.",
];

/**
 * Radix rejects an empty string as a SelectItem value, but `prefix` is optional
 * and "no title" has to be choosable. The sentinel stays inside this component:
 * the hidden input below posts a real empty string, so the Server Actions keep
 * receiving exactly what they did when this was a text input.
 */
const NONE = "__none__";

export function PrefixSelect({
  id,
  defaultValue,
}: {
  id: string;
  /** Existing value; anything not in PREFIXES is kept and offered as-is. */
  defaultValue?: string | null;
}) {
  const initial = defaultValue?.trim() || "";
  const [value, setValue] = useState(initial || NONE);

  // A row saved before this list existed — or one typed by hand in the database
  // — must stay saveable, the same way the role dropdown keeps a legacy USER.
  const unlisted = initial && !PREFIXES.includes(initial) ? initial : null;

  return (
    <>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>ไม่ระบุ</SelectItem>
          {unlisted && <SelectItem value={unlisted}>{unlisted} (ค่าเดิม)</SelectItem>}
          {PREFIXES.map((prefix) => (
            <SelectItem key={prefix} value={prefix}>
              {prefix}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* The Select carries no `name`: it would post the sentinel. */}
      <input type="hidden" name="prefix" value={value === NONE ? "" : value} />
    </>
  );
}
