"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Copy a file's public URL, for pasting into a document or an OIT link field
 * (F21 — the "คัดลอก URL" of the old system).
 *
 * Copies the absolute URL: a bare `/fonita/storage/…` is useless once it leaves
 * the browser, which is the whole point of copying it.
 */
export function FileCopyUrlButton({ url, name }: { url: string; name: string }) {
  async function copy() {
    const absolute = new URL(url, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(absolute);
      toast.success("คัดลอกลิงก์แล้ว");
    } catch {
      // Clipboard access is refused outside a secure context, and on http://
      // that is every browser — show the URL so it can still be copied by hand.
      toast.error("คัดลอกอัตโนมัติไม่ได้", { description: absolute, duration: 10000 });
    }
  }

  return (
    <Button variant="ghost" size="icon" aria-label={`คัดลอกลิงก์ของ ${name}`} onClick={copy}>
      <Copy className="size-4" aria-hidden />
    </Button>
  );
}
