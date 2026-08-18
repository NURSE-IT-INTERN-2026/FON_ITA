import { currentBEYear } from "@/lib/date";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? "nurse@cmu.ac.th";

export function PublicFooter() {
  return (
    <footer className="flex flex-col items-start gap-2 border-t py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>© {currentBEYear()} คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่</div>
      <div className="flex items-center gap-4">
        <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">
          ติดต่อเรา
        </a>
        <a href="#" className="hover:text-foreground">
          นโยบายความเป็นส่วนตัว
        </a>
      </div>
    </footer>
  );
}
