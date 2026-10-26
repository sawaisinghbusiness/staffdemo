"use client";

import { useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { shrinkScan } from "@/lib/erpDocs";

/*
 * Homework attachments (user, 2026-10-26: "photo ya PDF upload, parents ko bhi jaye"). Photos are shrunk on the
 * phone, then each file is uploaded at once (backend homeworkFileService) and comes back as { url, name, kind };
 * the form sends that list with the homework. Parents open the same links in the parent app.
 */

export interface HomeworkFile {
  url: string;
  name: string;
  kind: "image" | "pdf";
}

const MAX = 5;
const MAX_PDF = 3.5 * 1024 * 1024;

const readAsDataUrl = (f: File) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => fail(new Error("read"));
    r.readAsDataURL(f);
  });

/** The picker and the chips. `uploadPath`: "/homework/files" (teacher) or "/erp/homework/files" (ERP login). */
export function HomeworkFilePicker({ files, onChange, uploadPath }: { files: HomeworkFile[]; onChange: (f: HomeworkFile[]) => void; uploadPath: string }) {
  const L = useL();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);

  async function add(list: FileList | null) {
    const picked = Array.from(list || []).slice(0, MAX - files.length);
    if (!picked.length) return;
    let next = files;
    setBusy(picked.length);
    for (const f of picked) {
      try {
        const pdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
        if (pdf && f.size > MAX_PDF) throw new Error(L({ hi: "PDF 3.5 MB से छोटी हो।", en: "Keep the PDF under 3.5 MB." }));
        const dataUrl = pdf ? (await readAsDataUrl(f)).replace(/^data:[^;]*;/, "data:application/pdf;") : await shrinkScan(f);
        const r = await api<{ data: HomeworkFile }>(uploadPath, { body: { dataUrl, name: f.name }, timeoutMs: 60_000 });
        next = [...next, r.data];
        onChange(next);
      } catch (e) {
        toast(false, (e instanceof ApiError && e.message) || (e instanceof Error && e.message) || L({ hi: "फ़ाइल नहीं लगी।", en: "Could not attach the file." }));
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li key={f.url} className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-ink-200 bg-white pl-2 pr-1">
              {f.kind === "image" ? <img src={f.url} alt="" className="h-9 w-9 shrink-0 rounded-lg bg-ink-50 object-contain" /> : <FileText className="h-9 w-9 shrink-0 rounded-lg bg-rose-50 p-2 text-rose-700" aria-hidden />}
              <span className="min-w-0 flex-1 truncate text-[14px]">{f.name}</span>
              <button type="button" onClick={() => onChange(files.filter((x) => x.url !== f.url))} aria-label={`${L({ hi: "हटाएँ", en: "Remove" })} ${f.name}`} className="grid h-10 w-10 shrink-0 place-items-center text-ink-500">
                <X className="h-[18px] w-[18px]" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {files.length < MAX && (
        <button type="button" onClick={() => input.current?.click()} disabled={busy > 0} className="btn-line w-full disabled:opacity-60">
          <Paperclip className="h-4 w-4" aria-hidden />
          {busy > 0 ? L({ hi: "लग रही है…", en: "Attaching…" }) : L({ hi: "फ़ोटो या PDF लगाएँ", en: "Attach photo or PDF" })}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Attachments under a homework in a list: photo thumbnails and PDF rows that open in a new tab. */
export function HomeworkFileLinks({ files }: { files?: HomeworkFile[] }) {
  const L = useL();
  if (!files?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map((f) =>
        f.kind === "image" ? (
          <a key={f.url} href={f.url} target="_blank" rel="noreferrer" aria-label={`${L({ hi: "फ़ोटो खोलें", en: "Open photo" })}: ${f.name}`} className="block h-16 w-16 overflow-hidden rounded-xl border border-ink-100">
            <img src={f.url} alt="" loading="lazy" className="h-full w-full bg-ink-50 object-contain" />
          </a>
        ) : (
          <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="flex min-h-[44px] max-w-full items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 text-[13.5px] font-medium">
            <FileText className="h-4 w-4 shrink-0 text-rose-700" aria-hidden />
            <span className="truncate">{f.name}</span>
          </a>
        )
      )}
    </div>
  );
}

