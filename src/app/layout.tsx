import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// The UI is Thai; Geist has no Thai glyphs, so every Thai string would fall back
// to an arbitrary system font. next/font self-hosts this — no extra dependency.
const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FON-ITA — ระบบจัดการข้อมูลสาธารณะ",
  description: "ระบบจัดการข้อมูล ITA/OIT คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่",
};

// Explicit rather than relying on Next's default injection — responsive
// layouts are the contract, not an accident.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: next-themes writes the theme class onto <html>
    // before React hydrates, so the server and client markup differ by design.
    <html lang="th" suppressHydrationWarning className={`${notoSansThai.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
