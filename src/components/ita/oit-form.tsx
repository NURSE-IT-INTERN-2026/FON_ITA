"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createOit, updateOit } from "@/actions/oit";
import { TiptapEditor } from "@/components/ita/tiptap-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PickerFile } from "@/lib/files/queries";

/** Mirrors CONTENT_LIMIT in src/actions/oit.ts, which is the one that decides. */
const MAX_CHARS = 1000;

type OitDefaults = { id: number; title: string; link: string | null; content: string | null };

/**
 * Create / edit form for an OIT (F15). Client Component: the editor and the
 * character counter need state.
 *
 * The HTML never goes to the database as typed — the Server Action sanitises it
 * (F16). On success the user is sent to the parent ITA's year, which is where
 * they came from.
 */
export function OitForm({
  itaId,
  year,
  oit,
  recentFiles,
  totalFiles,
  fileAccept,
  fileMaxSizeMb,
}: {
  itaId: number;
  year: string;
  oit?: OitDefaults;
  /** Loaded on the server so the file picker opens with content (F21). */
  recentFiles: PickerFile[];
  /** Total matches, so the picker can say its list is capped. */
  totalFiles: number;
  /** `accept` for the picker's inline upload — built from the same env the server validates against. */
  fileAccept: string;
  /** Mirrors MAX_FILE_SIZE_BYTES for the picker's inline upload pre-check. */
  fileMaxSizeMb: number;
}) {
  const router = useRouter();
  const editMode = !!oit;

  const [content, setContent] = useState(oit?.content ?? "");
  const [charCount, setCharCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const overLimit = charCount > MAX_CHARS;

  /**
   * onSubmit, not `<form action={...}>`.
   *
   * React 19 resets an action form as soon as the action returns, assuming the
   * submit succeeded. Ours returns `{ error }` instead of throwing, so a
   * rejected save silently reverted every field to its defaultValue — the
   * person saw an error above fields that looked untouched, with their edits
   * already gone. Building the FormData ourselves keeps the values put.
   */
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    // The editor lives in React state, not in a form field.
    formData.set("content", content);

    startTransition(async () => {
      const result = editMode ? await updateOit(formData) : await createOit(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      toast.success(editMode ? "บันทึกการแก้ไขแล้ว" : "เพิ่ม OIT แล้ว");
      router.push(`/ita/by-year/${year}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {editMode ? (
        <input type="hidden" name="id" value={oit.id} />
      ) : (
        <input type="hidden" name="itaId" value={itaId} />
      )}

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="oit-title">
              ชื่อ OIT <span className="text-destructive">*</span>
            </Label>
            <Input
              id="oit-title"
              name="title"
              defaultValue={oit?.title ?? ""}
              placeholder="เช่น O1 โครงสร้างหน่วยงาน"
              maxLength={255}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="oit-link">ลิงก์ (ถ้ามี)</Label>
            <Input
              id="oit-link"
              name="link"
              type="url"
              defaultValue={oit?.link ?? ""}
              placeholder="https://www.nurse.cmu.ac.th/…"
            />
            <p className="text-xs text-muted-foreground">
              ถ้าใส่ลิงก์ไว้ การคลิก OIT นี้ในหน้ารายการจะเปิดลิงก์ในแท็บใหม่
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="oit-content">รายละเอียด</Label>
            <TiptapEditor
              value={content}
              onChange={(html, count) => {
                setContent(html);
                setCharCount(count);
              }}
              maxChars={MAX_CHARS}
              recentFiles={recentFiles}
              totalFiles={totalFiles}
              fileAccept={fileAccept}
              fileMaxSizeMb={fileMaxSizeMb}
            />
            <p className="text-xs text-muted-foreground">
              กดปุ่ม <span className="font-medium">📎 แนบไฟล์</span> ในแถบเครื่องมือ
              เพื่อแทรกลิงก์ไปยังไฟล์ในคลัง — แล้วตั้งชื่อลิงก์ได้ในตัว
              หรือจะลากไฟล์จากเครื่องมาวางในช่องนี้ก็ได้
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          ยกเลิก
        </Button>
        <Button type="submit" disabled={pending || overLimit}>
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </div>
    </form>
  );
}
