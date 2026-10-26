"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useL, type Bi } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { downloadCsv, isoDate, parseCsv } from "@/lib/csv";

/*
 * The Excel round trip shared by ERP-login lists (2026-10-26): 1 download the filled sheet, 2 upload it back as
 * CSV. The backend's import endpoint ({ rows, apply }) first only checks it; `toPreview` turns its answer into
 * new items, changes and errors, and Save sends the same rows with apply: true.
 */

export interface Preview {
  newCount: number;
  changedCount: number;
  unchanged: number;
  errorCount: number;
  newItems: { key: string; title: string; sub: string }[];
  changes: { key: string; title: string; lines: { label: string; from: string; to: string }[] }[];
  errors: { row: number; error: string }[];
}

export function ExcelRoundTrip({
  header,
  keys,
  dateKeys = [],
  fileName,
  download,
  endpoint,
  toPreview,
  intro,
  rule,
  onDone,
}: {
  header: string[];
  keys: string[];
  dateKeys?: string[];
  fileName: string;
  download: () => unknown[][];
  endpoint: string;
  toPreview: (r: any) => Preview;
  intro: Bi;
  rule?: Bi;
  onDone?: () => void;
}) {
  const L = useL();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string | number>[] | null>(null);
  const [picked, setPicked] = useState("");
  const [check, setCheck] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"" | "check" | "save">("");

  async function pick(f: File | undefined) {
    if (!f) return;
    setCheck(null);
    if (/\.xlsx?$/i.test(f.name)) return toast(false, L({ hi: "Excel में File → Save As → CSV चुनकर सेव करें, फिर वह फ़ाइल डालें।", en: "In Excel use File → Save As → CSV, then pick that file." }));
    const table = parseCsv(await f.text()).filter((r) => r.some((c) => c));
    if (table.length < 2) return toast(false, L({ hi: "फ़ाइल में कोई लाइन नहीं।", en: "No rows in the file." }));
    const head = table[0].map((h) => h.toLowerCase());
    const at = header.map((h) => head.findIndex((x) => x === h.toLowerCase() || x.startsWith(h.toLowerCase().split(" (")[0])));
    if (at[0] < 0) return toast(false, L({ hi: `पहली लाइन में '${header[0]}' कॉलम नहीं मिला। डाउनलोड की गई फ़ाइल ही भरें।`, en: `No '${header[0]}' column in the first line. Fill the downloaded file.` }));
    const parsed = table.slice(1).map((r, i) => {
      const o: Record<string, string | number> = { row: i + 2 };
      keys.forEach((k, j) => {
        if (at[j] >= 0) o[k] = dateKeys.includes(k) ? isoDate(r[at[j]] || "") : r[at[j]] || "";
      });
      return o;
    });
    setRows(parsed);
    setPicked(f.name);
    await run(parsed, false);
  }

  async function run(list: Record<string, string | number>[], apply: boolean) {
    setBusy(apply ? "save" : "check");
    try {
      const r = await api<any>(endpoint, { body: { rows: list, apply }, timeoutMs: 120_000 });
      if (apply) {
        const failed: { row: number; error: string }[] = Array.isArray(r.failed) ? r.failed : [];
        toast(!failed.length, L({ hi: `${r.added ?? 0} नए जुड़े, ${r.updated ?? 0} बदले${failed.length ? `, ${failed.length} नहीं हुए` : ""}।`, en: `${r.added ?? 0} added, ${r.updated ?? 0} updated${failed.length ? `, ${failed.length} failed` : ""}.` }));
        setCheck(failed.length ? { newCount: 0, changedCount: 0, unchanged: 0, errorCount: failed.length, newItems: [], changes: [], errors: failed } : null);
        setRows(null);
        setPicked("");
        onDone?.();
      } else setCheck(toPreview(r));
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "फ़ाइल नहीं पढ़ी जा सकी।", en: "Could not read the file." }));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="animate-rise space-y-4 pb-6">
      <section className="rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="text-[15px] font-bold">{L({ hi: "1. फ़ाइल डाउनलोड करें", en: "1. Download the file" })}</h2>
        <p className="mt-0.5 text-[13.5px] text-ink-600">{L(intro)}</p>
        <button type="button" onClick={() => downloadCsv(fileName, header, download())} className="btn-primary mt-3 w-full">
          <Download className="h-4 w-4" aria-hidden /> {L({ hi: "फ़ाइल डाउनलोड", en: "Download file" })}
        </button>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="text-[15px] font-bold">{L({ hi: "2. भरकर वापस डालें", en: "2. Upload it back" })}</h2>
        <p className="mt-0.5 text-[13.5px] text-ink-600">{L({ hi: "Excel में File → Save As → CSV। पहले जाँच होगी, सेव तभी होगा जब आप कहेंगे।", en: "In Excel, File → Save As → CSV. It is checked first; nothing is saved until you say so." })}</p>
        <button type="button" onClick={() => input.current?.click()} disabled={!!busy} className="btn-line mt-3 w-full disabled:opacity-60">
          <Upload className="h-4 w-4" aria-hidden /> {busy === "check" ? L({ hi: "जाँच हो रही है…", en: "Checking…" }) : picked || L({ hi: "CSV फ़ाइल चुनें", en: "Choose CSV file" })}
        </button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv,.xlsx,.xls"
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {rule && <p className="mt-2 text-[12.5px] text-ink-500">{L(rule)}</p>}
      </section>

      {check && (
        <section className="space-y-3">
          <p className="rounded-2xl border border-ink-100 bg-white px-4 py-3 text-[14px] leading-relaxed">
            {L({
              hi: `${check.newCount} नए · ${check.changedCount} बदलाव · ${check.unchanged} वैसे ही · ${check.errorCount} गलती वाली लाइन`,
              en: `${check.newCount} new · ${check.changedCount} changes · ${check.unchanged} same · ${check.errorCount} rows with errors`,
            })}
          </p>
          {check.errors.length > 0 && (
            <Block title={L({ hi: "गलतियाँ (ये सेव नहीं होंगी)", en: "Errors (these won't be saved)" })}>
              {check.errors.map((e, i) => (
                <li key={i} className="border-b border-ink-100 py-2 text-[13.5px] last:border-b-0">
                  <b className="font-semibold">
                    {L({ hi: "लाइन", en: "Row" })} {e.row}
                  </b>{" "}
                  <span className="text-rose-700">{e.error}</span>
                </li>
              ))}
            </Block>
          )}
          {check.newItems.length > 0 && (
            <Block title={L({ hi: "नए", en: "New" })}>
              {check.newItems.map((n) => (
                <li key={n.key} className="border-b border-ink-100 py-2 last:border-b-0">
                  <span className="block text-[14.5px] font-medium">{n.title}</span>
                  <span className="block text-[12.5px] text-ink-600">{n.sub}</span>
                </li>
              ))}
            </Block>
          )}
          {check.changes.length > 0 && (
            <Block title={L({ hi: "बदलाव", en: "Changes" })}>
              {check.changes.map((c) => (
                <li key={c.key} className="border-b border-ink-100 py-2 last:border-b-0">
                  <span className="block text-[14.5px] font-medium">{c.title}</span>
                  {c.lines.map((f) => (
                    <span key={f.label} className="block text-[13px] text-ink-700">
                      {f.label}: <span className="text-ink-500 line-through">{f.from}</span> → <b className="font-semibold">{f.to}</b>
                    </span>
                  ))}
                </li>
              ))}
            </Block>
          )}
          {check.newCount + check.changedCount > 0 ? (
            <button type="button" onClick={() => rows && run(rows, true)} disabled={!!busy || !rows} className="btn-primary w-full">
              {busy === "save" ? "…" : L({ hi: `सेव करें: ${check.newCount} नए, ${check.changedCount} बदलाव`, en: `Save: ${check.newCount} new, ${check.changedCount} changes` })}
            </button>
          ) : (
            rows && <p className="text-center text-[14px] text-ink-600">{L({ hi: "सेव करने को कुछ नया नहीं।", en: "Nothing new to save." })}</p>
          )}
        </section>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-[12.5px] font-semibold uppercase tracking-wide text-ink-500">{title}</h3>
      <ul className="rounded-2xl border border-ink-100 bg-white px-3.5">{children}</ul>
    </div>
  );
}
