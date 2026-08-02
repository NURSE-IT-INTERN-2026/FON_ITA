"use client";

/**
 * ข้อผิดพลาดระดับ root layout (F31)
 *
 * Only reached when the root layout itself fails, which means it must render
 * its own <html> and <body> — the layout that normally supplies them is the
 * thing that broke. For the same reason the styling is inline: the stylesheet
 * and the Thai font are loaded by that layout and cannot be assumed here.
 *
 * Rare enough that it is a plain apology in Thai with a way out, nothing more.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
          // The Thai webfont lives in the broken layout; fall back to whatever
          // the device has that can render Thai.
          fontFamily: '"Noto Sans Thai", "Sarabun", system-ui, sans-serif',
          color: "#18181b",
          background: "#fafafa",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            ระบบขัดข้อง
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#52525b", marginBottom: "1.5rem" }}>
            เกิดข้อผิดพลาดที่ทำให้หน้าเว็บทำงานต่อไม่ได้ โปรดลองใหม่อีกครั้ง
            หากยังไม่ได้ โปรดแจ้งผู้ดูแลระบบ
            {error.digest ? ` (รหัส ${error.digest})` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              cursor: "pointer",
              borderRadius: "0.375rem",
              border: "1px solid #18181b",
              background: "#18181b",
              color: "#fafafa",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontFamily: "inherit",
            }}
          >
            ลองใหม่อีกครั้ง
          </button>
        </div>
      </body>
    </html>
  );
}
