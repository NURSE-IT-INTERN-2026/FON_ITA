import {
  File as FileGeneric,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  type LucideIcon,
} from "lucide-react";

// Display helpers shared by the file library page (F18) and the OIT editor's
// file picker (F21). Client-safe — no Node or env imports here; the page passes
// the env-derived values (accept, label, max size) down as props.

/**
 * Map a stored path's extension to a Lucide icon.
 *
 * Uses `path` (the timestamped name we generated, e.g. `1234-abc.png`) rather
 * than `name` (the display name staff typed, which may have no extension).
 */
export function fileIcon(storedPath: string): LucideIcon {
  const ext = extOf(storedPath);
  switch (ext) {
    case "pdf":
      return FileType;
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
      return FileImage;
    case "xlsx":
      return FileSpreadsheet;
    case "docx":
      return FileText;
    default:
      return FileGeneric;
  }
}

/** Uppercase extension for the "ประเภท" column, e.g. `png` → `PNG`. */
export function fileTypeLabel(storedPath: string): string {
  return extOf(storedPath).toUpperCase();
}

/** Lowercased extension of a stored path, or `""` if none. */
function extOf(storedPath: string): string {
  const dot = storedPath.lastIndexOf(".");
  return dot > 0 ? storedPath.slice(dot + 1).toLowerCase() : "";
}
