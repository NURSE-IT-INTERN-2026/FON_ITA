import { currentBEYear } from "@/lib/date";

export function PublicFooter() {
  return (
    <footer className="flex flex-col items-start gap-2 border-t py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>© {currentBEYear()} คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่</div>
      <div className="flex items-center gap-4">
        <a href="mailto:nurse@cmu.ac.th" className="hover:text-foreground">
          ติดต่อเรา
        </a>
        <a href="#" className="hover:text-foreground">
          นโยบายความเป็นส่วนตัว
        </a>
      </div>
    </footer>
  );
}
