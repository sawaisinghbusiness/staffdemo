"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Plus, RotateCcw, Search, Trash2, Users, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { fineFor, planFor, validateConfig, type Concession, type FeeBand, type FeeConfig } from "@/lib/erpFeeEngine";
import type { ErpStudent } from "@/lib/erpStudents";
import { ErrorCard, ListSkeleton, SelectBox, Sheet, StickyBar } from "@/components/ui";

/*
 * ERP login → Fees → Fee setup: the ERP's fee setup page (GET/PUT /api/fee-setup), same rules. Amounts by
 * class group, instalments and the late fine, bus and admission fee, concessions. Nothing changes until Save;
 * "Apply to students" first shows what would change (dry run, POST /api/fee-setup/apply) and only then updates.
 * Every figure here is worked out with the ERP's own fee engine (lib/erpFeeEngine, copied).
 */

interface FeeSetup {
  config: FeeConfig;
  saved: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  setupMissing: boolean;
}
interface ApplyChange {
  studentId: string;
  name: string;
  classSec: string;
  oldTotal: number;
  newTotal: number;
  oldDiscount: number;
  newDiscount: number;
  paid: number;
}
interface ApplyResult {
  checked: number;
  unchanged: number;
  changed: number;
  raise: number;
  reduce: number;
  changes: ApplyChange[];
  blocked: ApplyChange[];
  noGroup: string[];
  applied: boolean;
}
interface ConcessionHolder {
  studentId: string;
  name: string;
  srNo: string;
  classSec: string;
  code: string;
  discount: number;
  total: number;
  paid: number;
}

// The ERP's helpers (components/fees/setup/parts).
const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const sum = (a: number[]) => a.reduce((s, x) => s + (x || 0), 0);
const ALL_CLASSES = ["Pre Nursery", "Nursery", "LKG", "UKG", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
const shortDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—");
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/** Whole-rupee input: digits only, right-aligned, shows 0 as empty (ERP Money). */
function Money({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <span className="flex min-h-[44px] items-center gap-1 rounded-xl border border-ink-200 bg-white px-2.5 focus-within:border-brand-500">
      <span className="text-[13px] text-ink-400">₹</span>
      <input inputMode="numeric" aria-label={label} value={value ? String(value) : ""} placeholder="0" onChange={(e) => onChange(Math.min(1_000_000, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)))} className="tnum min-w-0 flex-1 bg-transparent text-right text-[15px] outline-none" />
    </span>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="today-card space-y-3 pb-4">
      <div>
        <h2 className="text-[16px] font-bold text-brand-800">{title}</h2>
        {note && <p className="text-[12.5px] text-ink-500">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export default function ErpFeeSetupPage() {
  const L = useL();
  const [cfg, setCfg] = useState<FeeConfig | null>(null);
  const [savedCfg, setSavedCfg] = useState<FeeConfig | null>(null);
  const [meta, setMeta] = useState<Omit<FeeSetup, "config"> | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  async function load() {
    try {
      const r = await api<FeeSetup>("/erp/fee-setup");
      setCfg(clone(r.config));
      setSavedCfg(r.config);
      setMeta(r);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e : new ApiError(0, ""));
    }
  }
  useEffect(() => {
    load();
  }, []);

  const dirty = useMemo(() => !!cfg && !!savedCfg && JSON.stringify(cfg) !== JSON.stringify(savedCfg), [cfg, savedCfg]);
  const problem = useMemo(() => (cfg ? validateConfig(cfg) : null), [cfg]);
  // Leaving with unsaved changes loses them: ask first.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  async function save() {
    if (!cfg) return;
    if (problem) return toast(false, problem);
    setSaving(true);
    try {
      const r = await api<FeeSetup>("/erp/fee-setup", { method: "PUT", body: { config: cfg } });
      setSavedCfg(r.config);
      setCfg(clone(r.config));
      setMeta(r);
      toast(true, L({ hi: "फ़ीस सेटअप सेव हुआ। बच्चों की फ़ीस बदलने के लिए \"बच्चों पर लगाएँ\" दबाएँ।", en: "Fee setup saved. Use \"Apply to students\" to update their fees." }));
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
    } finally {
      setSaving(false);
    }
  }

  if (loadError && !cfg) return loadError.status === 401 ? null : <ErrorCard offline={loadError.status === 0} onRetry={load} />;
  if (!cfg || !savedCfg || !meta) return <ListSkeleton rows={5} />;

  const setIns = (i: number, patch: Partial<FeeConfig["instalments"][number]>) => setCfg({ ...cfg, instalments: cfg.instalments.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const busYear = sum(cfg.transport.amounts);
  const covered = new Set(cfg.bands.flatMap((b) => b.classes));
  const missing = ALL_CLASSES.filter((c) => !covered.has(c) && c !== "Pre Nursery");

  return (
    <div className="animate-rise space-y-4 pb-24">
      <p className="text-[13px] text-ink-500">
        {L({ hi: "सत्र 2026-27", en: "Session 2026-27" })} ·{" "}
        {meta.saved ? `${L({ hi: "सेव", en: "saved" })} ${meta.updatedAt ? when(meta.updatedAt) : ""}${meta.updatedBy ? ` · ${meta.updatedBy.split(" (")[0]}` : ""}` : L({ hi: "अभी सेव नहीं: आज की फ़ीस जिस ढाँचे पर है, वह दिख रहा है", en: "not saved yet: showing the structure your current fees follow" })}
      </p>
      {meta.setupMissing && (
        <p className="flex gap-2 rounded-xl bg-marigold-50 p-3 text-[13.5px] text-ink-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-marigold-600" aria-hidden />
          {L({ hi: "फ़ीस सेटअप सेव करने से पहले डेटाबेस में एक बार का बदलाव चाहिए (fee setup SQL)।", en: "Fee setup needs a one-time database update before it can be saved (fee setup SQL)." })}
        </p>
      )}
      <button type="button" onClick={() => setApplyOpen(true)} disabled={!meta.saved || dirty || meta.setupMissing} className="btn-line w-full">
        <Users className="h-4 w-4" aria-hidden /> {L({ hi: "बच्चों पर लगाएँ", en: "Apply to students" })}
        {dirty && <span className="font-normal text-ink-500">· {L({ hi: "पहले सेव करें", en: "save first" })}</span>}
      </button>

      {/* Fee by class */}
      <Card title={L({ hi: "कक्षा के हिसाब से फ़ीस", en: "Fee by class" })} note={L({ hi: "हर हेड की साल भर की रकम। बदलने के लिए समूह पर छुएँ।", en: "Yearly amount of each head. Tap a group to change amounts or classes." })}>
        <ul>
          {cfg.bands.map((b, i) => {
            const year = cfg.heads.reduce((t, h) => t + sum(b.amounts[h.key] || []), 0);
            return (
              <li key={b.key}>
                <button type="button" onClick={() => setEditing(i)} className="flex min-h-[60px] w-full items-center gap-3 border-b border-ink-100 text-left last:border-0 active:bg-ink-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{b.name}</span>
                    <span className="block truncate text-[12.5px] text-ink-400">{b.classes.join(", ") || L({ hi: "कोई कक्षा नहीं", en: "No classes" })}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tnum block text-[15px] font-bold">{inr(year)}</span>
                    <span className="tnum block text-[12px] text-ink-500">
                      {inr(year + busYear)} {L({ hi: "बस सहित", en: "with bus" })}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
        {missing.length > 0 && (
          <p className="rounded-xl bg-marigold-50 px-3 py-2 text-[13px] text-ink-800">
            {L({ hi: "किसी समूह में नहीं, इसलिए कक्षा की फ़ीस नहीं:", en: "Not in any group, so no class fee:" })} <b>{missing.join(", ")}</b>
          </p>
        )}
      </Card>

      <FeeCheck cfg={cfg} />

      {/* Instalments & fine */}
      <Card title={L({ hi: "किस्तें और लेट फ़ाइन", en: "Instalments and late fine" })} note={L({ hi: "फ़ीस का हर हिस्सा कब देना है", en: "When each part of the fee is due" })}>
        {cfg.instalments.map((ins, i) => (
          <div key={i} className="grid grid-cols-2 gap-2.5">
            <label className="field-box">
              <small>{L({ hi: "नाम", en: "Name" })}</small>
              <input id={`fs-ins-${i}`} value={ins.name} onChange={(e) => setIns(i, { name: e.target.value })} />
            </label>
            <label className="field-box">
              <small>{L({ hi: "आख़िरी तारीख", en: "Due on" })}</small>
              <input id={`fs-due-${i}`} type="date" value={ins.due} onChange={(e) => setIns(i, { due: e.target.value })} />
              <CalendarDays aria-hidden />
            </label>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <label className="space-y-1">
            <span className="block text-[12px] font-semibold text-ink-600">{L({ hi: "रोज़ का फ़ाइन", en: "Fine per day" })}</span>
            <Money value={cfg.fine.perDay} onChange={(v) => setCfg({ ...cfg, fine: { ...cfg.fine, perDay: Math.min(1000, v) } })} label="Fine per day" />
          </label>
          <label className="space-y-1">
            <span className="block text-[12px] font-semibold text-ink-600">{L({ hi: "फ़ाइन की सीमा", en: "Fine limit" })}</span>
            <Money value={cfg.fine.cap} onChange={(v) => setCfg({ ...cfg, fine: { ...cfg.fine, cap: v } })} label="Fine limit" />
          </label>
          <label className="space-y-1">
            <span className="block text-[12px] font-semibold text-ink-600">{L({ hi: "छूट के दिन", en: "Grace days" })}</span>
            <span className="flex min-h-[44px] items-center rounded-xl border border-ink-200 bg-white px-2.5 focus-within:border-brand-500">
              <input
                inputMode="numeric"
                value={cfg.fine.graceDays ? String(cfg.fine.graceDays) : ""}
                placeholder="0"
                onChange={(e) => setCfg({ ...cfg, fine: { ...cfg.fine, graceDays: Math.min(60, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)) } })}
                aria-label="Grace days"
                className="tnum min-w-0 flex-1 bg-transparent text-right text-[15px] outline-none"
              />
            </span>
          </label>
        </div>
        <FineExample cfg={cfg} />
      </Card>

      {/* Transport & admission */}
      <Card title={L({ hi: "बस और प्रवेश फ़ीस", en: "Transport and admission fee" })} note={L({ hi: "कक्षा की फ़ीस के ऊपर जुड़ती है", en: "Added on top of the class fee" })}>
        <div className="flex items-baseline justify-between text-[12.5px]">
          <span className="font-semibold text-ink-600">{L({ hi: "स्कूल बस, हर किस्त", en: "School bus, each instalment" })}</span>
          <span className="text-ink-500">
            {L({ hi: "साल", en: "Year" })} <b className="tnum text-ink-900">{inr(busYear)}</b>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {cfg.instalments.map((ins, i) => (
            <label key={i} className="space-y-1">
              <span className="block text-[12px] text-ink-500">{ins.name}</span>
              <Money value={cfg.transport.amounts[i] || 0} onChange={(v) => setCfg({ ...cfg, transport: { ...cfg.transport, amounts: cfg.transport.amounts.map((x, j) => (j === i ? v : x)) } })} label={`Bus fee, ${ins.name}`} />
            </label>
          ))}
        </div>
        <p className="text-[12.5px] text-ink-500">{L({ hi: "हर रूट पर एक जैसी।", en: "The same on every route." })}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="space-y-1">
            <span className="block text-[12px] font-semibold text-ink-600">{L({ hi: "प्रवेश फ़ीस (नए बच्चे, एक बार)", en: "Admission fee (new, once)" })}</span>
            <Money value={cfg.admission.amount} onChange={(v) => setCfg({ ...cfg, admission: { ...cfg.admission, amount: v } })} label="Admission fee" />
          </label>
          <div className="space-y-1">
            <span className="block text-[12px] font-semibold text-ink-600">{L({ hi: "किस किस्त में", en: "Charged in" })}</span>
            <SelectBox label={L({ hi: "किस्त", en: "Instalment" })} value={String(cfg.admission.instalment)} onChange={(v) => setCfg({ ...cfg, admission: { ...cfg.admission, instalment: Number(v) } })}>
              {cfg.instalments.map((ins, i) => (
                <option key={i} value={String(i)}>
                  {ins.name}
                </option>
              ))}
            </SelectBox>
          </div>
        </div>
      </Card>

      <Concessions cfg={cfg} setCfg={setCfg} savedCfg={savedCfg} disabled={meta.setupMissing || !meta.saved} />

      {dirty && (
        <StickyBar>
          <div className="flex items-center gap-2">
            {problem ? <AlertTriangle className="h-4 w-4 shrink-0 text-marigold-600" aria-hidden /> : <span className="h-2 w-2 shrink-0 rounded-full bg-marigold-400" />}
            <span className={clsx("min-w-0 flex-1 truncate text-[13px]", problem ? "text-marigold-700" : "text-ink-600")}>{problem || L({ hi: "बदलाव सेव नहीं हुए", en: "You have unsaved changes" })}</span>
            <button type="button" onClick={() => setCfg(clone(savedCfg))} className="flex min-h-[40px] items-center gap-1 px-2 text-[13.5px] font-semibold text-ink-600">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {L({ hi: "वापस", en: "Undo" })}
            </button>
            <button type="button" onClick={save} disabled={saving || !!problem || meta.setupMissing} className="btn-primary shrink-0 px-5">
              {saving ? "…" : L({ hi: "सेव करें", en: "Save" })}
            </button>
          </div>
        </StickyBar>
      )}

      {editing !== null && cfg.bands[editing] && <BandSheet cfg={cfg} index={editing} onClose={() => setEditing(null)} onChange={(band) => setCfg({ ...cfg, bands: cfg.bands.map((b, i) => (i === editing ? band : b)) })} />}
      {applyOpen && <ApplySheet onClose={() => setApplyOpen(false)} />}
    </div>
  );
}

/** Worked example so the fine rule is unambiguous (ERP FineExample). */
function FineExample({ cfg }: { cfg: FeeConfig }) {
  const L = useL();
  const ins = cfg.instalments[1] || cfg.instalments[0];
  if (!ins || !/^\d{4}-\d{2}-\d{2}$/.test(ins.due)) return null;
  const d = new Date(ins.due + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 20);
  const paid = d.toISOString().slice(0, 10);
  const f = fineFor(cfg, ins.due, paid);
  const daysToCap = cfg.fine.perDay ? Math.ceil(cfg.fine.cap / cfg.fine.perDay) + cfg.fine.graceDays : 0;
  return (
    <p className="rounded-xl bg-ink-50 px-3 py-2.5 text-[13px] leading-relaxed text-ink-600">
      {cfg.fine.perDay
        ? L({
            hi: `उदाहरण: ${ins.name} की आख़िरी तारीख ${shortDate(ins.due)}, ${shortDate(paid)} को दी (20 दिन देर) → फ़ाइन ${inr(f)}।${cfg.fine.cap ? ` ${inr(cfg.fine.cap)} पर रुक जाता है (${daysToCap} दिन बाद)।` : " कोई ऊपरी सीमा नहीं।"}`,
            en: `Example: ${ins.name} due ${shortDate(ins.due)}, paid ${shortDate(paid)} (20 days late) → fine ${inr(f)}.${cfg.fine.cap ? ` It stops growing at ${inr(cfg.fine.cap)} (after ${daysToCap} days).` : " There is no upper limit."}`,
          })
        : L({ hi: "कोई लेट फ़ाइन नहीं।", en: "No late fine is charged." })}
    </p>
  );
}

/** Pick a class and see exactly what a student pays, instalment by instalment (ERP FeeCheck). */
function FeeCheck({ cfg }: { cfg: FeeConfig }) {
  const L = useL();
  const classes = cfg.bands.flatMap((b) => b.classes);
  const [cls, setCls] = useState(classes.includes("1st") ? "1st" : classes[0] || "");
  const [bus, setBus] = useState(false);
  const [newAdm, setNewAdm] = useState(false);
  const [con, setCon] = useState("");
  const plan = planFor(cfg, { cls, bus, newAdmission: newAdm, concession: con || null });

  return (
    <Card title={L({ hi: "किसी बच्चे की फ़ीस देखें", en: "Check a student's fee" })} note={L({ hi: "ऊपर के सेटअप से हर किस्त में कितना देना होगा", en: "What they pay in each instalment, with the setup above" })}>
      <div className="grid grid-cols-2 gap-2.5">
        <SelectBox label={L({ hi: "कक्षा", en: "Class" })} value={cls} onChange={setCls}>
          {classes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectBox>
        <SelectBox label={L({ hi: "छूट", en: "Concession" })} value={con} onChange={setCon}>
          <option value="">{L({ hi: "कोई नहीं", en: "None" })}</option>
          {cfg.concessions
            .filter((c) => c.name.trim())
            .map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} {c.percent}%
              </option>
            ))}
        </SelectBox>
      </div>
      <div className="flex gap-6">
        <label className="flex min-h-[40px] items-center gap-2 text-[14px]">
          <input type="checkbox" checked={bus} onChange={(e) => setBus(e.target.checked)} className="h-5 w-5 accent-brand-600" /> {L({ hi: "बस", en: "Bus" })}
        </label>
        <label className="flex min-h-[40px] items-center gap-2 text-[14px]">
          <input type="checkbox" checked={newAdm} onChange={(e) => setNewAdm(e.target.checked)} className="h-5 w-5 accent-brand-600" /> {L({ hi: "नया प्रवेश", en: "New admission" })}
        </label>
      </div>
      <ul className="rounded-xl border border-ink-100">
        {plan.instalments.map((ins, i) => (
          <li key={ins.name} className="border-b border-ink-100 px-3 py-2 last:border-0">
            <div className="flex items-baseline justify-between">
              <span className="text-[14px] font-semibold">
                {ins.name} <span className="text-[12px] font-normal text-ink-400">· {shortDate(ins.due)}</span>
              </span>
              <span className="tnum text-[15px] font-bold">{inr(plan.net[i])}</span>
            </div>
            <p className="tnum text-[12px] text-ink-500">
              {plan.lines
                .filter((l) => l.amounts[i])
                .map((l) => `${l.name} ${inr(l.amounts[i])}`)
                .join(" · ")}
              {plan.concession && plan.concession.amounts[i] ? <span className="text-jade-700"> · −{inr(plan.concession.amounts[i])}</span> : null}
            </p>
          </li>
        ))}
      </ul>
      {plan.concession && (
        <p className="text-[13px] text-jade-700">
          {plan.concession.name} {L({ hi: "छूट", en: "concession" })} ({plan.concession.percent}%): −{inr(plan.concession.total)}
        </p>
      )}
      <div className="flex items-baseline justify-between rounded-xl bg-brand-50 px-3 py-2.5">
        <span className="text-[14px] font-semibold">{L({ hi: "साल में देना", en: "To pay in the year" })}</span>
        <span className="tnum text-[18px] font-extrabold text-brand-700">{inr(plan.total)}</span>
      </div>
    </Card>
  );
}

/** Edits one class group: its name, which classes it covers, and every head × instalment amount (ERP BandDrawer). */
function BandSheet({ cfg, index, onClose, onChange }: { cfg: FeeConfig; index: number; onClose: () => void; onChange: (b: FeeBand) => void }) {
  const L = useL();
  const band = cfg.bands[index];
  const n = cfg.instalments.length;
  const takenElsewhere = new Map<string, string>();
  cfg.bands.forEach((b, i) => i !== index && b.classes.forEach((c) => takenElsewhere.set(c, b.name)));
  const setAmount = (head: string, i: number, v: number) => {
    const row = [...(band.amounts[head] || Array(n).fill(0))];
    row[i] = v;
    onChange({ ...band, amounts: { ...band.amounts, [head]: row } });
  };
  const toggleClass = (c: string) => onChange({ ...band, classes: band.classes.includes(c) ? band.classes.filter((x) => x !== c) : ALL_CLASSES.filter((x) => x === c || band.classes.includes(x)) });
  const colTotals = cfg.instalments.map((_, i) => sum(cfg.heads.map((h) => band.amounts[h.key]?.[i] || 0)));

  return (
    <Sheet title={band.name || L({ hi: "कक्षा समूह", en: "Class group" })} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[12.5px] text-ink-500">{L({ hi: "यहाँ के बदलाव \"सेव करें\" दबाने तक पेज पर ही रहते हैं।", en: "Changes here stay on the page until you press Save." })}</p>
        <label className="field-box">
          <small>{L({ hi: "समूह का नाम", en: "Group name" })}</small>
          <input id="fs-band-name" value={band.name} onChange={(e) => onChange({ ...band, name: e.target.value })} />
        </label>
        <div>
          <p className="mb-1.5 text-[12.5px] font-semibold text-ink-600">{L({ hi: "इस समूह की कक्षाएँ", en: "Classes in this group" })}</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CLASSES.map((c) => {
              const on = band.classes.includes(c);
              const other = takenElsewhere.get(c);
              return (
                <button key={c} type="button" disabled={!!other} onClick={() => toggleClass(c)} aria-pressed={on} className={clsx("min-h-[36px] rounded-lg px-2.5 text-[13px] font-semibold", on ? "bg-brand-600 text-white" : other ? "bg-ink-50 text-ink-300" : "bg-ink-100 text-ink-600")}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>
        <p className="pt-1 text-[12.5px] text-ink-500">{L({ hi: "हर किस्त की फ़ीस। एक बार वाली रकम (जैसे वार्षिक) उसी किस्त में डालें जिसमें ली जाती है।", en: "Fee in each instalment. Put a one-time charge (like annual charges) in the instalment it is collected in." })}</p>
        {cfg.heads.map((h) => (
          <div key={h.key} className="rounded-xl border border-ink-100 p-2.5">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[14px] font-semibold">{h.name}</span>
              <span className="tnum text-[13px] font-semibold">{inr(sum(band.amounts[h.key] || []))}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {cfg.instalments.map((ins, i) => (
                <label key={ins.name} className="space-y-0.5">
                  <span className="block text-[11.5px] text-ink-500">
                    {ins.name} · {shortDate(ins.due)}
                  </span>
                  <Money value={band.amounts[h.key]?.[i] || 0} onChange={(v) => setAmount(h.key, i, v)} label={`${h.name}, ${ins.name}`} />
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="rounded-xl bg-brand-50 px-3 py-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-semibold">{L({ hi: "कुल", en: "Total" })}</span>
            <span className="tnum text-[17px] font-extrabold text-brand-700">{inr(sum(colTotals))}</span>
          </div>
          <p className="tnum text-[12px] text-ink-600">{cfg.instalments.map((ins, i) => `${ins.name} ${inr(colTotals[i])}`).join(" · ")}</p>
        </div>
        <p className="text-[12.5px] text-ink-500">{L({ hi: "बस फ़ीस और एक बार की प्रवेश फ़ीस अपने हिस्सों से ऊपर जुड़ती हैं।", en: "Bus fee and the one-time admission fee are added on top, from their own sections." })}</p>
        <button type="button" onClick={onClose} className="btn-primary w-full">
          {L({ hi: "हो गया", en: "Done" })}
        </button>
      </div>
    </Sheet>
  );
}

/**
 * Concession types live in the fee setup (saved with the page); giving one to a student saves at once and
 * recalculates that student's discount (ERP ConcessionCard; PUT /api/fee-setup/concessions).
 */
function Concessions({ cfg, setCfg, savedCfg, disabled }: { cfg: FeeConfig; setCfg: (c: FeeConfig) => void; savedCfg: FeeConfig; disabled: boolean }) {
  const L = useL();
  const holdersApi = useApi<{ data: ConcessionHolder[] }>("/erp/fee-setup/concessions");
  const holders = holdersApi.data?.data;
  const { data: st } = useApi<{ data: ErpStudent[] }>("/erp/students");
  const students = useMemo(() => (st?.data || []).filter((s) => s.status !== "Inactive"), [st]);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<ErpStudent | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const setType = (i: number, patch: Partial<Concession>) => setCfg({ ...cfg, concessions: cfg.concessions.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const addType = () => {
    let k = 1;
    while (cfg.concessions.some((c) => c.code === `custom${k}`)) k++;
    setCfg({ ...cfg, concessions: [...cfg.concessions, { code: `custom${k}`, name: "", percent: 0, on: "tuition" }] });
  };
  const removeType = (i: number) => setCfg({ ...cfg, concessions: cfg.concessions.filter((_, j) => j !== i) });
  const countOf = (c: string) => (holders || []).filter((h) => h.code === c).length;
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return students.filter((s) => s.name.toLowerCase().includes(t) || s.srNo.toLowerCase().includes(t) || (s.fatherName || "").toLowerCase().includes(t)).slice(0, 6);
  }, [q, students]);
  // Only types that are already saved can be given (the backend checks the saved setup).
  const savedCodes = savedCfg.concessions.filter((c) => c.name.trim());
  const preview = pick && code ? planFor(savedCfg, { cls: pick.class, bus: pick.transportOpted, newAdmission: false, concession: code }) : null;

  async function give() {
    if (!pick || !code) return;
    setBusy("give");
    try {
      await api("/erp/fee-setup/concessions", { method: "PUT", body: { studentId: pick.id, code } });
      toast(true, L({ hi: `${pick.name} को अब ${savedCfg.concessions.find((c) => c.code === code)?.name} छूट मिलेगी।`, en: `${pick.name} now gets the ${savedCfg.concessions.find((c) => c.code === code)?.name} concession.` }));
      setAdding(false);
      setPick(null);
      setQ("");
      holdersApi.reload();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
    } finally {
      setBusy(null);
    }
  }
  async function remove(h: ConcessionHolder) {
    setBusy(h.studentId);
    try {
      await api("/erp/fee-setup/concessions", { method: "PUT", body: { studentId: h.studentId, code: null } });
      toast(true, L({ hi: `${h.name} की छूट हटाई।`, en: `Concession removed for ${h.name}.` }));
      holdersApi.reload();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "नहीं हटी।", en: "Could not remove." }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title={L({ hi: "छूट (कंसेशन)", en: "Concessions" })} note={L({ hi: "फ़ीस में से छूट; बस और प्रवेश फ़ीस पर कभी छूट नहीं", en: "Taken off the fee as a discount; bus and admission fee are never discounted" })}>
      {cfg.concessions.map((c, i) => (
        <div key={c.code} className="space-y-2 rounded-xl border border-ink-100 p-2.5">
          <div className="flex items-center gap-2">
            <label className="field-box flex-1">
              <small>{L({ hi: "नाम", en: "Name" })}</small>
              <input id={`fs-con-${c.code}`} value={c.name} onChange={(e) => setType(i, { name: e.target.value })} placeholder={L({ hi: "जैसे: इकलौती बेटी", en: "e.g. Single girl child" })} />
            </label>
            <button type="button" onClick={() => removeType(i)} disabled={countOf(c.code) > 0} aria-label={`${L({ hi: "हटाएँ", en: "Remove" })} ${c.name}`} className="grid h-11 w-11 shrink-0 place-items-center text-ink-400 disabled:opacity-30">
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="flex min-h-[44px] items-center gap-1 rounded-xl border border-ink-200 bg-white px-2.5">
              <input inputMode="numeric" value={c.percent ? String(c.percent) : ""} placeholder="0" onChange={(e) => setType(i, { percent: Math.min(100, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)) })} aria-label={`${c.name} percent`} className="tnum min-w-0 flex-1 bg-transparent text-right text-[15px] outline-none" />
              <span className="text-[13px] text-ink-400">%</span>
            </span>
            <SelectBox label={L({ hi: "किस पर", en: "On" })} value={c.on} onChange={(v) => setType(i, { on: v as Concession["on"] })}>
              <option value="tuition">{L({ hi: "सिर्फ़ ट्यूशन", en: "Tuition only" })}</option>
              <option value="school">{L({ hi: "सारी स्कूल फ़ीस", en: "All school fees" })}</option>
            </SelectBox>
          </div>
          <p className="text-[12px] text-ink-500">
            {holders ? countOf(c.code) : "…"} {L({ hi: "बच्चों को मिली", en: "students have it" })}
          </p>
        </div>
      ))}
      <button type="button" onClick={addType} className="flex min-h-[40px] items-center gap-1 text-[13.5px] font-semibold text-brand-600">
        <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "नई छूट जोड़ें", en: "Add a concession type" })}
      </button>

      <div className="flex items-center justify-between border-t border-ink-100 pt-3">
        <h3 className="text-[14.5px] font-semibold">{L({ hi: "जिन बच्चों को छूट है", en: "Students with a concession" })}</h3>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} disabled={disabled} className="btn-line min-h-[38px] px-3 text-[13.5px]">
            <Plus className="h-3.5 w-3.5" aria-hidden /> {L({ hi: "छूट दें", en: "Give concession" })}
          </button>
        )}
      </div>
      {adding && (
        <div className="space-y-2.5 rounded-xl bg-ink-50 p-3">
          {pick ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{pick.name}</p>
                <p className="truncate text-[12.5px] text-ink-500">
                  {pick.classSec} · {pick.srNo} · {pick.fatherName}
                </p>
              </div>
              <button type="button" onClick={() => setPick(null)} className="btn-line min-h-[38px] px-3 text-[13px]">
                {L({ hi: "बदलें", en: "Change" })}
              </button>
            </div>
          ) : (
            <>
              <label className="field-box min-h-[48px] bg-white">
                <Search aria-hidden />
                <input id="fs-con-find" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "बच्चे का नाम, SR नं. या पिता", en: "Student name, SR no. or father" })} autoComplete="off" />
              </label>
              {results.length > 0 && (
                <ul className="rounded-xl border border-ink-100 bg-white">
                  {results.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => setPick(s)} className="block w-full border-b border-ink-100 px-3 py-2 text-left last:border-0">
                        <span className="block truncate text-[14.5px] font-medium">{s.name}</span>
                        <span className="block truncate text-[12px] text-ink-500">
                          {s.classSec} · {s.srNo} · {s.fatherName}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <SelectBox label={L({ hi: "छूट", en: "Concession" })} value={code} onChange={setCode}>
            <option value="">{L({ hi: "चुनें", en: "Choose" })}</option>
            {savedCodes.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.percent}%)
              </option>
            ))}
          </SelectBox>
          {preview && (
            <p className="text-[13px] text-ink-600">
              {L({ hi: "छूट", en: "Takes" })} <b className="text-jade-700">{inr(preview.discount)}</b> · {L({ hi: "फ़ीस होगी", en: "fee becomes" })} <b className="text-ink-900">{inr(preview.total)}</b>
            </p>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setPick(null);
                setQ("");
              }}
              className="btn-line"
            >
              {L({ hi: "रद्द", en: "Cancel" })}
            </button>
            <button type="button" onClick={give} disabled={!pick || !code || busy === "give"} className="btn-primary">
              {busy === "give" ? "…" : L({ hi: "सेव करें", en: "Save" })}
            </button>
          </div>
        </div>
      )}
      {!holders ? (
        <ListSkeleton rows={1} />
      ) : holders.length === 0 ? (
        <p className="text-[14px] text-ink-500">{L({ hi: "अभी किसी को छूट नहीं।", en: "Nobody has a concession yet." })}</p>
      ) : (
        <ul className="rounded-xl border border-ink-100">
          {holders.map((h) => (
            <li key={h.studentId} className="flex items-center gap-3 border-b border-ink-100 px-3 py-2 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold">{h.name}</p>
                <p className="truncate text-[12px] text-ink-500">
                  {h.classSec} · {savedCfg.concessions.find((c) => c.code === h.code)?.name || h.code}
                </p>
              </div>
              <span className="tnum shrink-0 text-[14px] font-semibold text-jade-700">−{inr(h.discount)}</span>
              <button type="button" onClick={() => remove(h)} disabled={busy === h.studentId} aria-label={`${L({ hi: "छूट हटाएँ", en: "Remove concession for" })} ${h.name}`} className="grid h-10 w-10 shrink-0 place-items-center text-ink-400">
                {busy === h.studentId ? "…" : <X className="h-4 w-4" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Shows what applying the setup would change (dry run), then applies it on a clear yes (ERP ApplyModal). */
function ApplySheet({ onClose }: { onClose: () => void }) {
  const L = useL();
  const [preview, setPreview] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ApplyResult | null>(null);
  useEffect(() => {
    api<ApplyResult>("/erp/fee-setup/apply", { body: { dryRun: true } })
      .then(setPreview)
      .catch((e) => setError((e instanceof ApiError && e.message) || L({ hi: "हिसाब नहीं निकला।", en: "Could not work it out." })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function go() {
    setBusy(true);
    try {
      const r = await api<ApplyResult>("/erp/fee-setup/apply", { body: { dryRun: false } });
      setDone(r);
      toast(true, L({ hi: `${r.changed} बच्चों की फ़ीस बदली।`, en: `Fees updated for ${r.changed} students.` }));
    } catch (e) {
      setError((e instanceof ApiError && e.message) || L({ hi: "लागू नहीं हुआ।", en: "Could not apply." }));
    } finally {
      setBusy(false);
    }
  }
  const net = (t: number, d: number) => inr(t - d);

  return (
    <Sheet title={L({ hi: "फ़ीस सेटअप बच्चों पर लगाएँ", en: "Apply fee setup to students" })} onClose={() => !busy && onClose()}>
      <div className="space-y-3">
        {error ? (
          <p className="rounded-xl bg-rose-50 p-3 text-[14px] text-rose-800">{error}</p>
        ) : !preview ? (
          <p className="py-6 text-center text-[14px] text-ink-500">{L({ hi: "हर बच्चे की फ़ीस निकाली जा रही है…", en: "Working out every student's fee…" })}</p>
        ) : done ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-jade-600" aria-hidden />
            <p className="mt-2 text-[16px] font-semibold">{L({ hi: `${done.changed} बच्चों की फ़ीस बदली`, en: `${done.changed} students updated` })}</p>
            <p className="mt-1 text-[13.5px] text-ink-500">{L({ hi: "पहले जमा हुआ पैसा नहीं बदला।", en: "Payments already made are unchanged." })}</p>
            <button type="button" onClick={onClose} className="btn-primary mt-4 w-full">
              {L({ hi: "बंद करें", en: "Close" })}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  [L({ hi: "जाँचे", en: "Checked" }), preview.checked, ""],
                  [L({ hi: "पहले से सही", en: "Already correct" }), preview.unchanged, "text-jade-700"],
                  [L({ hi: "बदलेंगे", en: "Will change" }), preview.changed, preview.changed ? "text-brand-700" : ""],
                ] as [string, number, string][]
              ).map(([k, v, tone]) => (
                <div key={k} className="rounded-xl bg-ink-50 px-2.5 py-2">
                  <p className="text-[11.5px] text-ink-500">{k}</p>
                  <p className={clsx("tnum text-[19px] font-bold", tone)}>{v.toLocaleString("en-IN")}</p>
                </div>
              ))}
            </div>
            {preview.changed > 0 && (
              <p className="text-[13.5px] text-ink-600">
                {L({ hi: `कुल मिलाकर फ़ीस ${inr(preview.raise)} बढ़ेगी और ${inr(preview.reduce)} घटेगी। जो बच्चे दे चुके, वह नहीं बदलेगा।`, en: `Fees go up by ${inr(preview.raise)} and down by ${inr(preview.reduce)} in total. What students have already paid does not change.` })}
              </p>
            )}
            {preview.blocked.length > 0 && (
              <p className="rounded-xl bg-marigold-50 p-3 text-[13px] text-ink-800">
                {L({ hi: `${preview.blocked.length} बच्चे नई फ़ीस से ज़्यादा दे चुके, इसलिए वैसे ही रहेंगे:`, en: `${preview.blocked.length} student(s) already paid more than the new fee, so they are left as they are:` })} {preview.blocked.slice(0, 5).map((b) => b.name).join(", ")}
                {preview.blocked.length > 5 ? "…" : ""}
              </p>
            )}
            {preview.noGroup.length > 0 && (
              <p className="rounded-xl bg-marigold-50 p-3 text-[13px] text-ink-800">
                {L({ hi: "किसी समूह में न होने वाली कक्षाएँ वैसी ही रहेंगी:", en: "Classes in no group are left as they are:" })} {preview.noGroup.join(", ")}
              </p>
            )}
            {preview.changes.length > 0 && (
              <ul className="max-h-64 overflow-y-auto rounded-xl border border-ink-100">
                {preview.changes.map((c) => (
                  <li key={c.studentId} className="flex items-center gap-3 border-b border-ink-100 px-3 py-2 last:border-0">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{c.name}</span>
                      <span className="block text-[12px] text-ink-500">{c.classSec}</span>
                    </span>
                    <span className="tnum shrink-0 text-right text-[13px]">
                      <span className="block text-ink-400 line-through">{net(c.oldTotal, c.oldDiscount)}</span>
                      <span className="block font-semibold">{net(c.newTotal, c.newDiscount)}</span>
                    </span>
                  </li>
                ))}
                {preview.changed > preview.changes.length && <li className="px-3 py-2 text-[12.5px] text-ink-500">…{L({ hi: `और ${preview.changed - preview.changes.length}`, en: `and ${preview.changed - preview.changes.length} more` })}</li>}
              </ul>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={onClose} disabled={busy} className={clsx("btn-line", !preview.changed && "col-span-2")}>
                {preview.changed ? L({ hi: "रद्द", en: "Cancel" }) : L({ hi: "बंद करें", en: "Close" })}
              </button>
              {preview.changed > 0 && (
                <button type="button" onClick={go} disabled={busy} className="btn-primary">
                  {busy ? "…" : L({ hi: `${preview.changed} बच्चों पर लगाएँ`, en: `Update ${preview.changed} students` })}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

