"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BASE_PATH } from "@/lib/base-path";

type PreviewResult = {
  status: number;
  count: number;
  body: string;
};

/**
 * Display-only probe of the real endpoint. Same-origin requests skip the rate
 * limit (route handler exemption), so repeated clicks here cannot produce the
 * 429 the documentation above describes.
 */
export function ResponsePreview({ defaultYear }: { defaultYear: string }) {
  const [year, setYear] = useState(defaultYear);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);

  async function fetchPreview() {
    const trimmed = year.trim();
    if (!/^\d{4}$/.test(trimmed)) {
      setError("กรุณากรอกปี พ.ศ. เป็นตัวเลข 4 หลัก เช่น 2569");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Client fetch must carry basePath itself (AGENTS.md) — the browser does
      // not prefix the way <Link> does.
      const response = await fetch(`${BASE_PATH}/api/v1/ita/${trimmed}`);
      const data = await response.json();
      setResult({
        status: response.status,
        count: Array.isArray(data) ? data.length : 0,
        body: JSON.stringify(data, null, 2),
      });
    } catch {
      setError("ดึงข้อมูลไม่สำเร็จ — ตรวจการเชื่อมต่อแล้วลองอีกครั้ง");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!loading) void fetchPreview();
        }}
      >
        <Input
          value={year}
          onChange={(event) => setYear(event.currentTarget.value)}
          className="w-28 font-mono"
          inputMode="numeric"
          placeholder="2569"
          aria-label="ปี พ.ศ. ที่จะดึงข้อมูล"
        />
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "กำลังดึงข้อมูล…" : "ดึงข้อมูล"}
        </Button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            สถานะ{" "}
            <span className="font-mono font-semibold text-foreground">{result.status}</span>
            {" · "}
            {result.count > 0 ? (
              <>
                พบ <span className="font-semibold text-foreground">{result.count}</span> หัวข้อ
              </>
            ) : (
              "ไม่มีข้อมูลปีนี้ — API ตอบ [] สำหรับปีที่ไม่มีข้อมูลเสมอ"
            )}
          </p>
          <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
            {result.body}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
