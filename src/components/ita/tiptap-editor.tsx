"use client";

import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Paperclip,
  Redo2,
  RemoveFormatting,
  Undo2,
} from "lucide-react";
import { useRef, useState } from "react";
import { FilePickerDialog } from "@/components/files/file-picker-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PickerFile } from "@/lib/files/queries";
import { cn } from "@/lib/utils";

/**
 * Rich text editor for OIT content (F17). Client Component — Tiptap needs the
 * DOM and event handlers.
 *
 * `charCount` is the *visible* text length, which is what the 1000-character
 * limit counts; the HTML is always longer. The Server Action re-counts and
 * re-sanitises, so nothing here is a security control — it is the friendly
 * version of a rule the server enforces (F16).
 */
export function TiptapEditor({
  value,
  onChange,
  maxChars,
  recentFiles,
}: {
  value: string;
  onChange: (html: string, charCount: number) => void;
  maxChars: number;
  /** Seeds the "แนบไฟล์" picker so it shows something the moment it opens. */
  recentFiles: PickerFile[];
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  // The selection is lost while the dialog holds focus, so remember it.
  const selectionRef = useRef<{ from: number; to: number } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value,
    // Required under SSR: rendering on the server would mismatch on hydration.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-content min-h-40 px-3 py-2 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.getText().trim().length),
  });

  // Tiptap v3's useEditor does NOT re-render on every transaction — the editor
  // object is mutable and React never sees it change. Everything derived from
  // editor state (the counter, the pressed toolbar buttons) has to be read
  // through useEditorState, or it renders once and then silently goes stale.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      chars: editor?.getText().trim().length ?? 0,
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      alignLeft: editor?.isActive({ textAlign: "left" }) ?? false,
      alignCenter: editor?.isActive({ textAlign: "center" }) ?? false,
      alignRight: editor?.isActive({ textAlign: "right" }) ?? false,
      alignJustify: editor?.isActive({ textAlign: "justify" }) ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
      orderedList: editor?.isActive("orderedList") ?? false,
      link: editor?.isActive("link") ?? false,
    }),
  });

  // `state` is null on the very first pass, before the editor exists.
  if (!editor || !state) {
    return (
      <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
        กำลังโหลดตัวแก้ไข…
      </div>
    );
  }

  const chars = state.chars;
  const overLimit = chars > maxChars;

  function openLinkDialog() {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    selectionRef.current = { from, to };
    setLinkUrl((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkOpen(true);
  }

  function applyLink(rawUrl: string) {
    if (!editor) return;
    const selection = selectionRef.current;
    const chain = editor.chain().focus();
    if (selection) chain.setTextSelection(selection);

    if (rawUrl) {
      // Auto-prefix https:// when the user typed a bare domain — without it,
      // `href="example.com"` is treated as an in-app path and breaks navigation.
      const href = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      // Set through the command, not by writing HTML — the href stays a typed
      // attribute and cannot break out into markup.
      chain.extendMarkRange("link").setLink({ href, target: "_blank" }).run();
    } else {
      chain.extendMarkRange("link").unsetLink().run();
    }

    selectionRef.current = null;
    setLinkOpen(false);
  }

  function openPicker() {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    selectionRef.current = { from, to };
    setPickerOpen(true);
  }

  /**
   * Insert the picked file. With text selected it becomes the link; otherwise
   * the file's name is inserted as the link text.
   */
  function insertFile({ url, label }: { url: string; label: string }) {
    if (!editor) return;
    const selection = selectionRef.current;
    const hasSelection = !!selection && selection.from !== selection.to;
    const chain = editor.chain().focus();
    if (selection) chain.setTextSelection(selection);

    if (hasSelection) {
      chain.extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
    } else {
      // Inserted as a node with a typed mark, not as an HTML string — the URL
      // can never break out into markup.
      chain
        .insertContent({
          type: "text",
          text: label,
          marks: [{ type: "link", attrs: { href: url, target: "_blank" } }],
        })
        .run();
    }

    selectionRef.current = null;
    setPickerOpen(false);
  }

  return (
    <div className={cn("rounded-md border bg-card", overLimit && "border-destructive")}>
      <div className="flex flex-wrap items-center gap-1 border-b p-1">
        <ToolButton
          label="ตัวหนา"
          active={state.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolButton>
        <ToolButton
          label="ตัวเอียง"
          active={state.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolButton>

        <Divider />

        <ToolButton
          label="ชิดซ้าย"
          active={state.alignLeft}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft />
        </ToolButton>
        <ToolButton
          label="กึ่งกลาง"
          active={state.alignCenter}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter />
        </ToolButton>
        <ToolButton
          label="ชิดขวา"
          active={state.alignRight}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight />
        </ToolButton>
        <ToolButton
          label="เต็มแนว"
          active={state.alignJustify}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify />
        </ToolButton>

        <Divider />

        <ToolButton
          label="รายการหัวข้อ"
          active={state.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolButton>
        <ToolButton
          label="รายการตัวเลข"
          active={state.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolButton>

        <Divider />

        <ToolButton label="ลิงก์" active={state.link} onClick={openLinkDialog}>
          <LinkIcon />
        </ToolButton>
        <ToolButton label="แนบไฟล์จากคลัง" onClick={openPicker}>
          <Paperclip />
        </ToolButton>
        <ToolButton
          label="ล้างรูปแบบ"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <RemoveFormatting />
        </ToolButton>

        <Divider />

        <ToolButton label="เลิกทำ" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 />
        </ToolButton>
        <ToolButton label="ทำซ้ำ" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 />
        </ToolButton>
      </div>

      <EditorContent editor={editor} />

      <div className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-xs">
        <span className="text-muted-foreground">
          {overLimit ? "เนื้อหายาวเกินกำหนด — ลบบางส่วนออกก่อนบันทึก" : "รองรับตัวหนา ตัวเอียง รายการ และลิงก์"}
        </span>
        <span
          className={cn(
            "shrink-0 tabular-nums text-muted-foreground",
            overLimit && "font-semibold text-destructive",
          )}
        >
          {chars} / {maxChars}
        </span>
      </div>

      <FilePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={insertFile}
        recentFiles={recentFiles}
      />

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แทรกลิงก์</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="tiptap-link">URL</Label>
            <Input
              id="tiptap-link"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">เว้นว่างไว้เพื่อลบลิงก์ออกจากข้อความที่เลือก</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setLinkOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={() => applyLink(linkUrl.trim())}>
              ตกลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      // Inside a <form>: without type="button" every toolbar click would submit.
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn("size-8 p-0", active && "bg-accent text-accent-foreground")}
    >
      {children}
    </Button>
  );
}
