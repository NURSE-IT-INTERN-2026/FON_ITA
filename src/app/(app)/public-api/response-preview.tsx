"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BASE_PATH } from "@/lib/base-path";

/**
 * One state per outcome the endpoint can produce, including the ones a healthy
 * deployment should never show (404 from a wrong mount, 5xx, network down) —
 * the page doubles as a teaching doc for what those look like.
 */
type PreviewState =
  | { kind: "idle" }
  | { kind: "invalid-year" }
  | { kind: "loading" }
  | { kind: "ok"; status: number; count: number; shown: number; body: string; rateInfo: string | null }
  | { kind: "ok-empty"; status: number; body: string; rateInfo: string | null }
  | { kind: "rate-limited"; status: number; body: string; retryAfter: string | null }
  | { kind: "client-error"; status: number; body: string; note: string }
  | { kind: "server-error"; status: number; body: string }
  | { kind: "network-error" };

/** A full year's JSON (8 topics × all OITs' HTML) is thousands of lines — the preview shows the first topics only. */
const PREVIEW_TOPICS = 2;

/** 5xx bodies are plain text, not JSON — read as text, pretty-print if parseable. */
function formatBody(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/**
 * Display-only probe of the real endpoint. Same-origin requests skip the rate
 * limit (route handler exemption), so repeated clicks here cannot produce the
 * 429 the documentation above describes — that state exists so the page can
 * still explain what one looks like.
 */
export function ResponsePreview({ defaultYear }: { defaultYear: string }) {
  const [year, setYear] = useState(defaultYear);
  const [state, setState] = useState<PreviewState>({ kind: "idle" });

  async function fetchPreview() {
    const trimmed = year.trim();
    if (!/^\d{4}$/.test(trimmed)) {
      setState({ kind: "invalid-year" });
      return;
    }

    setState({ kind: "loading" });
    try {
      // Client fetch must carry basePath itself (AGENTS.md) — the browser does
      // not prefix the way <Link> does.
      const response = await fetch(`${BASE_PATH}/api/v1/ita/${trimmed}`);
      const body = formatBody(await response.text());

      if (response.status === 429) {
        setState({
          kind: "rate-limited",
          status: response.status,
          body,
          retryAfter: response.headers.get("retry-after"),
        });
        return;
      }

      if (response.status >= 500) {
        setState({ kind: "server-error", status: response.status, body });
        return;
      }

      if (!response.ok) {
        setState({
          kind: "client-error",
          status: response.status,
          body,
          note: "endpoint นี้ปกติไม่ตอบ 404 — ตรวจว่าติดตั้ง URL ถูกต้อง",
        });
        return;
      }

      let data: unknown;
      try {
        data = JSON.parse(body);
      } catch {
        setState({
          kind: "client-error",
          status: response.status,
          body,
          note: "การตอบกลับไม่ใช่ JSON ที่ถูกต้อง — ไม่ตรงสัญญา API",
        });
        return;
      }

      const limit = response.headers.get("x-ratelimit-limit");
      const remaining = response.headers.get("x-ratelimit-remaining");
      const rateInfo =
        limit !== null && remaining !== null ? `X-RateLimit: ${limit} คำขอ/นาที · เหลือ ${remaining}` : null;

      if (Array.isArray(data) && data.length > 0) {
        const shown = data.slice(0, PREVIEW_TOPICS);
        setState({
          kind: "ok",
          status: response.status,
          count: data.length,
          shown: shown.length,
          body: shown.length < data.length ? JSON.stringify(shown, null, 2) : body,
          rateInfo,
        });
      } else {
        setState({ kind: "ok-empty", status: response.status, body, rateInfo });
      }
    } catch {
      setState({ kind: "network-error" });
    }
  }

  const statusTone =
    state.kind === "ok" || state.kind === "ok-empty"
      ? "text-emerald-600 dark:text-emerald-400"
      : state.kind === "rate-limited"
        ? "text-amber-600 dark:text-amber-400"
        : "text-destructive";

  const message =
    state.kind === "invalid-year"
      ? "กรุณากรอกปี พ.ศ. เป็นตัวเลข 4 หลัก เช่น 2569"
      : state.kind === "ok-empty"
        ? "ไม่มีข้อมูลปีนี้ — API ตอบ [] สำหรับปีที่ไม่มีข้อมูลเสมอ"
        : state.kind === "rate-limited"
          ? `คำขอถูกจำกัด (429 Too Many Requests) — เกิน 60 คำขอ/นาที${
              state.retryAfter ? ` ลองอีกครั้งในอีก ${state.retryAfter} วินาที` : " ลองอีกครั้งใน ~1 นาที"
            }`
          : state.kind === "client-error"
            ? `ได้รับสถานะ ${state.status} ซึ่งไม่ควรเกิด — ${state.note}`
            : state.kind === "server-error"
              ? `เซิร์ฟเวอร์ API ผิดปกติ (สถานะ ${state.status}) — ลองอีกครั้งภายหลัง`
              : state.kind === "network-error"
                ? "เชื่อมต่อไม่ได้ — เครือข่ายขัดข้องหรือเว็บ API ล่มดึงไม่ได้"
                : null;

  const messageTone =
    state.kind === "invalid-year" ||
    state.kind === "client-error" ||
    state.kind === "server-error" ||
    state.kind === "network-error"
      ? "text-destructive"
      : state.kind === "rate-limited"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  const showBody =
    state.kind === "ok" ||
    state.kind === "ok-empty" ||
    state.kind === "rate-limited" ||
    state.kind === "client-error" ||
    state.kind === "server-error";

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (state.kind !== "loading") void fetchPreview();
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
        <Button type="submit" size="sm" disabled={state.kind === "loading"}>
          {state.kind === "loading" ? "กำลังดึงข้อมูล…" : "ดึงข้อมูล"}
        </Button>
      </form>

      {message ? <p className={`text-sm ${messageTone}`}>{message}</p> : null}

      {showBody ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            สถานะ <span className={`font-mono font-semibold ${statusTone}`}>{state.status}</span>
            {state.kind === "ok" ? (
              <>
                {" · "}พบ <span className="font-semibold text-foreground">{state.count}</span> หัวข้อ
              </>
            ) : null}
            {(state.kind === "ok" || state.kind === "ok-empty") && state.rateInfo ? (
              <>
                {" · "}<span className="font-mono">{state.rateInfo}</span>
              </>
            ) : null}
          </p>
          {state.kind === "ok" && state.shown < state.count ? (
            <p className="text-xs text-muted-foreground">
              พรีวิวย่อ — แสดง {state.shown} หัวข้อแรกจากทั้งหมด {state.count} หัวข้อ
              (เรียกใช้เองจะได้ข้อมูลครบทุกหัวข้อเหมือนกันหมด)
            </p>
          ) : null}
          <pre className="max-h-[70vh] overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
            {state.body}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
