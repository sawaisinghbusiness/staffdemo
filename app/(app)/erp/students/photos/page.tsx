"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Images, Lock, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { initials } from "@/lib/format";
import { toast } from "@/lib/toast";
import { classRank, type ErpStudent } from "@/lib/erpStudents";
import { shrinkPhoto } from "@/lib/erpShrinkPhoto";
import { cropPhoto } from "@/components/erp/PhotoCropper";
import { Empty, ErrorCard, LineTabs, ListSkeleton, SelectBox, Sheet } from "@/components/ui";

/*
 * ERP login → Students → Photos: the ERP's photos page. Tap a child to add or replace the photo (cropped
 * to the ID-card 3:4 shape), × to take it off, or upload many at once named by SR no. Same backend
 * (/api/student-photos), so the photo shows at once on the ERP, the ID cards and the parent app.
 * Only the admin and the accountant may change photos, as on the ERP.
 */

interface BulkResult {
  srNo: string;
  ok: boolean;
  name?: string;
  error?: string;
}

const bySectionRoll = (a: ErpStudent, b: ErpStudent) => a.section.localeCompare(b.section) || (a.rollNo || "").localeCompare(b.rollNo || "", undefined, { numeric: true }) || a.name.localeCompare(b.name);

export default function ErpPhotosPage() {
  const L = useL();
  const { data, error, reload } = useApi<{ data: ErpStudent[] }>("/erp/students");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const canEdit = ["admin", "accountant"].includes(who.data?.user.role || "");
  const [cls, setCls] = useState("");
  const [sec, setSec] = useState("");
  const [only, setOnly] = useState<"all" | "missing">("all");
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [local, setLocal] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<ErpStudent | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);

  // A photo just changed here shows at once, before the list reloads.
  const students = useMemo(() => (data?.data || []).filter((s) => s.status !== "Inactive").map((s) => (s.id in local ? { ...s, photoUrl: local[s.id] } : s)), [data, local]);
  const classes = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const s of students) {
      if (!m.has(s.class)) m.set(s.class, new Set());
      m.get(s.class)!.add(s.section);
    }
    return Array.from(m.entries())
      .sort((a, b) => classRank(a[0]) - classRank(b[0]))
      .map(([name, secs]) => ({ name, sections: Array.from(secs).sort() }));
  }, [students]);
  useEffect(() => {
    if (!cls && classes.length) setCls(classes[0].name);
  }, [classes, cls]);

  const inClass = useMemo(() => students.filter((s) => s.class === cls && (!sec || s.section === sec)).sort(bySectionRoll), [students, cls, sec]);
  const withPhoto = inClass.filter((s) => s.photoUrl).length;
  const shown = only === "missing" ? inClass.filter((s) => !s.photoUrl) : inClass;

  const mark = (id: string, on: boolean) =>
    setBusy((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const pick = (s: ErpStudent) => {
    if (!canEdit || busy.has(s.id)) return;
    target.current = s.id;
    fileRef.current?.click();
  };

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = target.current;
    e.target.value = "";
    if (!file || !id) return;
    try {
      const image = await cropPhoto(file);
      if (!image) return; // cancelled
      mark(id, true);
      const r = await api<{ success: boolean; url?: string }>(`/erp/student-photos/${id}`, { body: { image } });
      if (r.url) setLocal((p) => ({ ...p, [id]: r.url! }));
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || (err as Error)?.message || L({ hi: "फ़ोटो सेव नहीं हुई।", en: "Could not save the photo." }));
    }
    mark(id, false);
  }

  async function remove() {
    if (!removing) return;
    const s = removing;
    mark(s.id, true);
    try {
      await api(`/erp/student-photos/${s.id}`, { method: "DELETE" });
      setLocal((p) => ({ ...p, [s.id]: "" }));
      toast(true, L({ hi: `${s.name} की फ़ोटो हटा दी।`, en: `${s.name}'s photo removed.` }));
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "फ़ोटो नहीं हटी।", en: "Could not remove the photo." }));
    }
    mark(s.id, false);
    setRemoving(null);
  }

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={4} />;

  return (
    <div className="animate-rise space-y-3">
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      {who.data && !canEdit && (
        <p className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 text-[14px] text-ink-700">
          <Lock className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
          {L({ hi: "फ़ोटो सिर्फ़ एडमिन और अकाउंटेंट जोड़ सकते हैं।", en: "Only the admin and the accountant can add photos." })}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <SelectBox
          label={L({ hi: "कक्षा", en: "Class" })}
          value={cls}
          onChange={(v) => {
            setCls(v);
            setSec("");
          }}
        >
          {classes.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </SelectBox>
        <SelectBox label={L({ hi: "सेक्शन", en: "Section" })} value={sec} onChange={setSec}>
          <option value="">{L({ hi: "सभी", en: "All" })}</option>
          {(classes.find((c) => c.name === cls)?.sections || []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectBox>
      </div>
      <LineTabs
        label={L({ hi: "दिखाएँ", en: "Show" })}
        value={only}
        onChange={setOnly}
        options={[
          { key: "all", text: `${L({ hi: "सभी", en: "All" })} ${inClass.length}` },
          { key: "missing", text: `${L({ hi: "फ़ोटो नहीं", en: "No photo" })} ${inClass.length - withPhoto}` },
        ]}
      />
      {canEdit && (
        <button type="button" onClick={() => setBulkOpen(true)} className="btn-line w-full">
          <Images className="h-4 w-4" aria-hidden /> {L({ hi: "एक साथ कई फ़ोटो", en: "Upload many photos" })}
        </button>
      )}

      {shown.length === 0 ? (
        <Empty>
          {inClass.length ? (
            <span className="flex items-center gap-2">
              <Check className="h-5 w-5 text-jade-600" strokeWidth={2.5} aria-hidden /> {L({ hi: "यहाँ सबकी फ़ोटो है।", en: "Everyone here has a photo." })}
            </span>
          ) : (
            L({ hi: "इस कक्षा में कोई बच्चा नहीं।", en: "No students in this class." })
          )}
        </Empty>
      ) : (
        <ul className="grid grid-cols-3 gap-2.5 pb-4">
          {shown.map((s) => (
            <li key={s.id} className="relative">
              <button type="button" onClick={() => pick(s)} disabled={!canEdit} aria-label={s.photoUrl ? `${L({ hi: "फ़ोटो बदलें", en: "Replace photo of" })} ${s.name}` : `${L({ hi: "फ़ोटो जोड़ें", en: "Add photo of" })} ${s.name}`} className="block w-full text-left">
                <span className="relative block aspect-[3/4] overflow-hidden rounded-xl border border-ink-100 bg-white">
                  {s.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-ink-50 text-ink-400">
                      <span className="text-[22px] font-bold">{initials(s.name)}</span>
                      {canEdit && <Camera className="h-5 w-5" aria-hidden />}
                    </span>
                  )}
                  {busy.has(s.id) && <span className="absolute inset-0 grid place-items-center bg-white/70 text-[13px] font-semibold text-brand-700">…</span>}
                </span>
                <span className="mt-1 block truncate text-[13px] font-medium">{s.name}</span>
                <span className="tnum block text-[12px] text-ink-400">{s.rollNo ? `${L({ hi: "रोल", en: "Roll" })} ${s.rollNo}` : "—"}</span>
              </button>
              {canEdit && s.photoUrl && !busy.has(s.id) && (
                <button type="button" onClick={() => setRemoving(s)} aria-label={`${L({ hi: "फ़ोटो हटाएँ", en: "Remove photo of" })} ${s.name}`} className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-white text-ink-600 shadow ring-1 ring-ink-200">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {removing && (
        <Sheet title={L({ hi: `${removing.name} की फ़ोटो हटाएँ?`, en: `Remove ${removing.name}'s photo?` })} onClose={() => !busy.has(removing.id) && setRemoving(null)}>
          <p className="mb-4 text-[14.5px] text-ink-600">{L({ hi: "नई फ़ोटो जुड़ने तक कार्ड पर नाम के पहले अक्षर दिखेंगे।", en: "The card will show initials until a new photo is added." })}</p>
          <button type="button" onClick={remove} disabled={busy.has(removing.id)} className="btn-primary w-full !bg-rose-600">
            {busy.has(removing.id) ? "…" : L({ hi: "हटाएँ", en: "Remove" })}
          </button>
        </Sheet>
      )}
      {bulkOpen && (
        <BulkSheet
          onClose={() => setBulkOpen(false)}
          onDone={() => {
            setLocal({});
            reload();
          }}
        />
      )}
    </div>
  );
}

/** Many photos at once, matched to students by the SR number in each file name (ERP BulkModal). */
function BulkSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const L = useL();
  const ref = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<BulkResult[] | null>(null);

  async function run(files: File[]) {
    if (!files.length) return;
    const all: BulkResult[] = [];
    setResults(null);
    setProgress({ done: 0, total: files.length });
    let batch: { srNo: string; image: string }[] = [];
    const flush = async () => {
      if (!batch.length) return;
      try {
        const r = await api<{ success: boolean; results: BulkResult[] }>("/erp/student-photos/bulk", { body: { items: batch } });
        all.push(...r.results);
      } catch (e) {
        const msg = (e instanceof ApiError && e.message) || "Could not save.";
        all.push(...batch.map((b) => ({ srNo: b.srNo, ok: false, error: msg })));
      }
      batch = [];
    };
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const srNo = f.name.replace(/\.[^.]+$/, "").trim();
      try {
        batch.push({ srNo, image: await shrinkPhoto(f) });
      } catch (e) {
        all.push({ srNo, ok: false, error: (e as Error)?.message || "Could not use this photo." });
      }
      if (batch.length === 8) await flush();
      setProgress({ done: i + 1, total: files.length });
    }
    await flush();
    setProgress(null);
    setResults(all);
    onDone();
  }

  const saved = results?.filter((r) => r.ok).length || 0;
  const failed = results?.filter((r) => !r.ok) || [];

  return (
    <Sheet title={L({ hi: "एक साथ कई फ़ोटो", en: "Upload many photos" })} onClose={() => !progress && onClose()}>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          run(files);
        }}
      />
      <div className="space-y-4">
        {!progress && !results && (
          <>
            <p className="text-[14.5px] text-ink-700">
              {L({ hi: "हर फ़ोटो का नाम बच्चे के SR नं. से रखें, जैसे", en: "Name each photo with the student's SR no., for example" })} <span className="tnum font-semibold">SR-2024-1001.jpg</span>
            </p>
            <button type="button" onClick={() => ref.current?.click()} className="btn-primary w-full">
              <Images className="h-4 w-4" aria-hidden /> {L({ hi: "फ़ोटो चुनें", en: "Choose photos" })}
            </button>
          </>
        )}
        {progress && (
          <div>
            <div className="tnum flex justify-between text-[14px] text-ink-700">
              <span>{L({ hi: "फ़ोटो सेव हो रही हैं…", en: "Saving photos…" })}</span>
              <span>
                {progress.done} / {progress.total}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          </div>
        )}
        {results && (
          <>
            <p className="flex items-center gap-2 text-[15px] font-semibold">
              <Check className="h-5 w-5 text-jade-600" strokeWidth={2.5} aria-hidden />
              {L({ hi: `${saved} सेव हुईं`, en: `${saved} saved` })}
              {failed.length ? L({ hi: `, ${failed.length} नहीं हुईं`, en: `, ${failed.length} not saved` }) : ""}
            </p>
            {failed.length > 0 && (
              <ul className="max-h-56 overflow-y-auto rounded-xl border border-ink-100">
                {failed.map((r, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 border-b border-ink-100 px-3 py-2 text-[13.5px] last:border-0">
                    <span className="tnum min-w-0 truncate">{r.srNo || "(no name)"}</span>
                    <span className="shrink-0 text-[12.5px] text-ink-500">{r.error}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => ref.current?.click()} className="btn-line">
                {L({ hi: "और जोड़ें", en: "Add more" })}
              </button>
              <button type="button" onClick={onClose} className="btn-primary">
                {L({ hi: "हो गया", en: "Done" })}
              </button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
