"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Loader2, Lock, Play, Printer, RefreshCw } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { useSchoolInfo } from "@/lib/erpCerts";
import { EMPTY_STRUCTURE, inr, monthLabel, nowMonth, PAY_MODES, previewNet, rupees, shiftMonth, todayIso, type PayrollRow, type SalaryStructure } from "@/lib/erpPayroll";
import { PayslipDocument } from "@/components/erp/PayslipDocument";
import { PrintSheet } from "@/components/erp/certs/SheetPreview";
import { Avatar, Empty, ErrorCard, ListSkeleton, SelectBox, Sheet, StickyBar } from "@/components/ui";

/*
 * ERP login → Staff → Payroll: the ERP's payroll page (GET /api/payroll?month=, PUT /structure/:id,
 * POST /generate, PATCH /slips/:id, POST /pay, POST /slips/:id/undo-pay). Admin and accountant only.
 * Every rupee is worked out by the backend; this screen only shows the slips and sends the office's choices.
 */

interface MonthResult {
  rows: PayrollRow[];
  setupNeeded: boolean;
}

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.message) || fallback;

export default function ErpPayrollPage() {
  const L = useL();
  const school = useSchoolInfo();
  const [month, setMonth] = useState(nowMonth());
  const { data, error, reload } = useApi<MonthResult>(`/erp/payroll?month=${month}`);
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const isAdmin = who.data?.user.role === "admin";
  const [running, setRunning] = useState(false);
  const [salaryFor, setSalaryFor] = useState<PayrollRow | null>(null);
  const [slipFor, setSlipFor] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [payOpen, setPayOpen] = useState(false);

  // The list belongs to the month on screen; a stale copy of another month is never shown.
  const rows = data && data.rows ? data.rows : null;

  const stats = useMemo(() => {
    const list = rows || [];
    const slips = list.map((r) => r.slip).filter(Boolean) as NonNullable<PayrollRow["slip"]>[];
    return {
      net: slips.reduce((t, s) => t + Number(s.net), 0),
      paid: slips.filter((s) => s.status === "paid").reduce((t, s) => t + Number(s.net), 0),
      due: slips.filter((s) => s.status === "draft").reduce((t, s) => t + Number(s.net), 0),
      noSalary: list.filter((r) => !r.structure).length,
      made: slips.length,
    };
  }, [rows]);

  const go = (by: number) => {
    setMonth((m) => shiftMonth(m, by));
    setPicked(new Set());
    setPicking(false);
  };

  async function run() {
    setRunning(true);
    try {
      const r = await api<{ made?: number; noSalary?: number }>("/erp/payroll/generate", { body: { month } });
      toast(
        true,
        L({
          hi: `${monthLabel(month)} की सैलरी ${r.made ?? 0} स्टाफ़ की बन गई।${r.noSalary ? ` ${r.noSalary} की सैलरी तय नहीं है।` : ""}`,
          en: `Salaries for ${monthLabel(month)} worked out for ${r.made ?? 0} staff.${r.noSalary ? ` ${r.noSalary} without a salary set.` : ""}`,
        })
      );
      reload();
    } catch (e) {
      toast(false, errText(e, L({ hi: "सैलरी नहीं बन सकी।", en: "Could not make salaries." })));
    } finally {
      setRunning(false);
    }
  }

  if (error?.status === 403)
    return (
      <div className="animate-rise pt-10 text-center">
        <Lock className="mx-auto h-8 w-8 text-ink-300" aria-hidden />
        <p className="mt-3 font-semibold text-ink-900">{L({ hi: "सैलरी सिर्फ़ एडमिन और अकाउंटेंट देख सकते हैं", en: "Only the admin and the accountant can see salaries" })}</p>
      </div>
    );
  if (error && !data) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
  if (data?.setupNeeded)
    return (
      <Empty>
        {L({ hi: "पेरोल के लिए डेटाबेस में एक बार का बदलाव चाहिए (20261002_payroll_transport.sql)।", en: "Payroll needs a one-time database setup (20261002_payroll_transport.sql)." })}
      </Empty>
    );

  const drafts = (rows || []).filter((r) => r.slip?.status === "draft");
  const pickedNet = (rows || []).filter((r) => r.slip && picked.has(r.slip.id)).reduce((t, r) => t + Number(r.slip!.net), 0);
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const active = (rows || []).find((r) => r.staffId === slipFor) || null;
  const future = month > nowMonth();

  return (
    <div className="animate-rise space-y-3 pb-4">
      {/* Month */}
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => go(-1)} className="grid h-11 w-11 place-items-center rounded-full border border-ink-200 bg-white active:bg-ink-100" aria-label={L({ hi: "पिछला महीना", en: "Previous month" })}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <span className="flex items-center gap-1.5 text-[16px] font-bold text-ink-900">
          <CalendarDays className="h-[18px] w-[18px] text-[#3099a4]" aria-hidden />
          {monthLabel(month)}
        </span>
        <button type="button" onClick={() => go(1)} disabled={month >= nowMonth()} className="grid h-11 w-11 place-items-center rounded-full border border-ink-200 bg-white active:bg-ink-100 disabled:opacity-35" aria-label={L({ hi: "अगला महीना", en: "Next month" })}>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* Figures */}
      <div className="grid grid-cols-2 gap-2.5">
        <Figure label={L({ hi: "कुल सैलरी", en: "Net salary" })} value={rows ? inr(stats.net) : "…"} dot="bg-ink-400" />
        <Figure label={L({ hi: "दे दी", en: "Paid" })} value={rows ? inr(stats.paid) : "…"} dot="bg-jade-600" />
        <Figure label={L({ hi: "देनी बाकी", en: "To pay" })} value={rows ? inr(stats.due) : "…"} dot="bg-marigold-500" />
        <Figure label={L({ hi: "सैलरी तय नहीं", en: "Salary not set" })} value={rows ? String(stats.noSalary) : "…"} dot="bg-rose-500" />
      </div>

      {/* Run / recalculate, and paying many at once */}
      <div className="flex gap-2">
        <button type="button" onClick={run} disabled={running || !rows?.length || future} className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#3099a4] px-4 text-[15px] font-semibold text-white active:opacity-90 disabled:opacity-40">
          {running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : stats.made ? <RefreshCw className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          {stats.made ? L({ hi: "दोबारा हिसाब", en: "Recalculate" }) : L({ hi: "सैलरी बनाएँ", en: "Run payroll" })}
        </button>
        {drafts.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setPicking((p) => !p);
              setPicked(new Set());
            }}
            className={clsx("min-h-[48px] rounded-xl border px-4 text-[15px] font-semibold", picking ? "border-ink-900 bg-ink-900 text-white" : "border-ink-300 bg-white text-ink-900")}
          >
            {picking ? L({ hi: "रहने दें", en: "Cancel" }) : L({ hi: "एक साथ दें", en: "Pay many" })}
          </button>
        )}
      </div>

      {picking && (
        <div className="flex items-center justify-between px-0.5 text-[13.5px]">
          <span className="text-ink-500">{L({ hi: "जिनकी सैलरी देनी है, उन्हें चुनें", en: "Pick the unpaid salaries to mark paid" })}</span>
          <button type="button" onClick={() => setPicked(picked.size === drafts.length ? new Set() : new Set(drafts.map((r) => r.slip!.id)))} className="min-h-[44px] font-semibold text-[#3099a4]">
            {picked.size === drafts.length ? L({ hi: "कोई नहीं", en: "None" }) : L({ hi: "सब चुनें", en: "All" })}
          </button>
        </div>
      )}

      {/* Staff */}
      {!rows ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <Empty>
          {L({ hi: `${monthLabel(month)} में कोई स्टाफ़ नहीं।`, en: `No staff on the rolls in ${monthLabel(month)}.` })}{" "}
          <Link href="/erp/staff/" className="font-semibold text-[#3099a4]">
            {L({ hi: "स्टाफ़ जोड़ें", en: "Add staff" })}
          </Link>
        </Empty>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r, i) => {
            const s = r.slip;
            const canPick = picking && s?.status === "draft";
            const on = !!s && picked.has(s.id);
            return (
              <li key={r.staffId} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }} className="row-card p-0">
                <button
                  type="button"
                  onClick={() => (canPick ? toggle(s!.id) : picking ? undefined : s ? setSlipFor(r.staffId) : setSalaryFor(r))}
                  disabled={picking && !canPick}
                  aria-pressed={canPick ? on : undefined}
                  className={clsx("flex w-full items-center gap-3 px-3.5 py-3 text-left", picking && !canPick && "opacity-45")}
                >
                  {picking && (
                    <span className={clsx("grid h-6 w-6 shrink-0 place-items-center rounded-full border-[1.5px]", on ? "border-[#3099a4] bg-[#3099a4] text-white" : "border-ink-300 bg-white")} aria-hidden>
                      {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                  )}
                  <Avatar name={r.name} size={42} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-semibold text-ink-900">{r.name}</span>
                    <span className="block truncate text-[13px] text-ink-500">
                      {r.designation}
                      {s ? ` · ${s.paid_days}/${s.days_in_month} ${L({ hi: "दिन", en: "days" })}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {s ? (
                      <>
                        <span className="tnum block text-[15.5px] font-bold text-ink-900">{inr(s.net)}</span>
                        <SlipState paid={s.status === "paid"} />
                      </>
                    ) : r.structure ? (
                      <span className="text-[13px] text-ink-500">{L({ hi: "बनी नहीं", en: "Not run" })}</span>
                    ) : (
                      <span className="text-[13px] font-semibold text-[#3099a4]">{L({ hi: "सैलरी तय करें", en: "Set salary" })}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {picking && picked.size > 0 && (
        <StickyBar>
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1 text-[14px] text-ink-600">
              <b className="text-ink-900">{picked.size}</b> {L({ hi: "चुनी", en: "selected" })} · <b className="tnum text-ink-900">{inr(pickedNet)}</b>
            </span>
            <button type="button" onClick={() => setPayOpen(true)} className="min-h-[46px] rounded-xl bg-ink-900 px-5 text-[15px] font-semibold text-white active:opacity-90">
              {L({ hi: "दी गई लिखें", en: "Mark paid" })}
            </button>
          </div>
        </StickyBar>
      )}

      {payOpen && (
        <PaySheet
          count={picked.size}
          total={pickedNet}
          onClose={() => setPayOpen(false)}
          onPay={async (paidOn, mode, ref) => {
            try {
              const r = await api<{ paid?: number }>("/erp/payroll/pay", { body: { ids: Array.from(picked), paidOn, mode, ref } });
              toast(true, L({ hi: `${r.paid ?? picked.size} सैलरी दी गई लिखी गईं।`, en: `${r.paid ?? picked.size} salaries marked paid.` }));
              setPayOpen(false);
              setPicked(new Set());
              setPicking(false);
              reload();
            } catch (e) {
              toast(false, errText(e, L({ hi: "सेव नहीं हुआ।", en: "Could not save." })));
            }
          }}
        />
      )}
      {salaryFor && (
        <SalarySheet
          row={salaryFor}
          onClose={() => setSalaryFor(null)}
          onSaved={() => {
            toast(true, L({ hi: `${salaryFor.name} की सैलरी सेव हो गई।`, en: `${salaryFor.name}'s salary saved.` }));
            setSalaryFor(null);
            reload();
          }}
        />
      )}
      {active?.slip && (
        <SlipSheet
          row={active}
          school={school.name}
          place={school.place}
          isAdmin={isAdmin}
          onClose={() => setSlipFor(null)}
          onEditSalary={() => {
            setSlipFor(null);
            setSalaryFor(active);
          }}
          onChanged={reload}
        />
      )}
    </div>
  );
}

function Figure({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white px-3.5 py-3">
      <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500">
        <i className={clsx("h-2 w-2 rounded-full", dot)} aria-hidden />
        {label}
      </span>
      <span className="tnum mt-1 block truncate text-[19px] font-bold text-ink-900">{value}</span>
    </div>
  );
}

function SlipState({ paid }: { paid: boolean }) {
  const L = useL();
  return (
    <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-ink-600">
      <i className={clsx("h-1.5 w-1.5 rounded-full", paid ? "bg-jade-600" : "bg-marigold-500")} aria-hidden />
      {paid ? L({ hi: "दी गई", en: "Paid" }) : L({ hi: "बाकी", en: "Not paid" })}
    </span>
  );
}

/** Paid on, mode and reference: the same three boxes as the ERP's payment modal. */
function PaymentFields({ paidOn, setPaidOn, mode, setMode, refNo, setRefNo }: { paidOn: string; setPaidOn: (v: string) => void; mode: string; setMode: (v: string) => void; refNo: string; setRefNo: (v: string) => void }) {
  const L = useL();
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <label className="field-box">
          <small>{L({ hi: "किस दिन दी", en: "Paid on" })}</small>
          <input type="date" value={paidOn} max={todayIso()} onChange={(e) => setPaidOn(e.target.value)} />
          <CalendarDays aria-hidden />
        </label>
        <SelectBox label={L({ hi: "कैसे दी", en: "Mode" })} value={mode} onChange={setMode}>
          {PAY_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </SelectBox>
      </div>
      <label className="field-box">
        <small>{L({ hi: "रेफ़रेंस", en: "Reference" })}</small>
        <input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="UTR / cheque no." maxLength={60} />
      </label>
    </div>
  );
}

function PaySheet({ count, total, onClose, onPay }: { count: number; total: number; onClose: () => void; onPay: (paidOn: string, mode: string, ref: string) => Promise<void> }) {
  const L = useL();
  const [paidOn, setPaidOn] = useState(todayIso());
  const [mode, setMode] = useState(PAY_MODES[0]);
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={L({ hi: `${count} सैलरी दी गई लिखें`, en: `Mark ${count} salaries paid` })} onClose={() => !busy && onClose()}>
      <p className="tnum pb-3 text-[26px] font-extrabold text-ink-900">{inr(total)}</p>
      <PaymentFields paidOn={paidOn} setPaidOn={setPaidOn} mode={mode} setMode={setMode} refNo={ref} setRefNo={setRef} />
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onPay(paidOn, mode, ref);
          setBusy(false);
        }}
        className="mt-4 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-ink-900 text-[16px] font-semibold text-white disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {L({ hi: "दी गई लिखें", en: "Mark paid" })}
      </button>
    </Sheet>
  );
}

type Form = { basic: string; hra: string; da: string; other_allowance: string; pf: boolean; esi: boolean; tds: string; other_deduction: string; bank_name: string; account_no: string; ifsc: string; pan: string };
const toForm = (s: SalaryStructure): Form => ({
  basic: s.basic ? String(s.basic) : "",
  hra: s.hra ? String(s.hra) : "",
  da: s.da ? String(s.da) : "",
  other_allowance: s.other_allowance ? String(s.other_allowance) : "",
  pf: !!s.pf,
  esi: !!s.esi,
  tds: s.tds ? String(s.tds) : "",
  other_deduction: s.other_deduction ? String(s.other_deduction) : "",
  bank_name: s.bank_name || "",
  account_no: s.account_no || "",
  ifsc: s.ifsc || "",
  pan: s.pan || "",
});

/** Monthly salary and bank details for one staff member (the ERP's SalaryDrawer). */
function SalarySheet({ row, onClose, onSaved }: { row: PayrollRow; onClose: () => void; onSaved: () => void }) {
  const L = useL();
  const [f, setF] = useState<Form>(() => toForm(row.structure || EMPTY_STRUCTURE));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const { gross, pf, esi, net } = previewNet(f);

  async function save() {
    setBusy(true);
    const body: SalaryStructure = {
      basic: rupees(f.basic),
      hra: rupees(f.hra),
      da: rupees(f.da),
      other_allowance: rupees(f.other_allowance),
      pf: f.pf,
      esi: f.esi,
      tds: rupees(f.tds),
      other_deduction: rupees(f.other_deduction),
      bank_name: f.bank_name,
      account_no: f.account_no,
      ifsc: f.ifsc,
      pan: f.pan,
    };
    try {
      await api(`/erp/payroll/structure/${row.staffId}`, { method: "PUT", body });
      onSaved();
    } catch (e) {
      toast(false, errText(e, L({ hi: "सेव नहीं हुआ।", en: "Could not save." })));
    } finally {
      setBusy(false);
    }
  }

  const money = (k: "basic" | "hra" | "da" | "other_allowance" | "tds" | "other_deduction", label: string) => (
    <label className="field-box">
      <small>{label}</small>
      <span className="pt-4 text-ink-400">₹</span>
      <input type="number" inputMode="numeric" min={0} value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder="0" className="tnum text-right" />
    </label>
  );

  return (
    <Sheet title={L({ hi: `सैलरी · ${row.name}`, en: `Salary · ${row.name}` })} onClose={() => !busy && onClose()}>
      <p className="-mt-1 pb-3 text-[13.5px] text-ink-500">{row.designation}</p>
      <div className="space-y-4">
        <section>
          <h3 className="mlabel mb-2">{L({ hi: "कमाई", en: "Earnings" })}</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {money("basic", "Basic")}
            {money("hra", "HRA")}
            {money("da", "DA")}
            {money("other_allowance", L({ hi: "दूसरा भत्ता", en: "Other allowance" }))}
          </div>
        </section>

        <section>
          <h3 className="mlabel mb-1">{L({ hi: "कटौती", en: "Deductions" })}</h3>
          <Toggle on={f.pf} onChange={(v) => set("pf", v)} label={L({ hi: "प्रोविडेंट फ़ंड (PF)", en: "Provident fund" })} value={f.pf ? inr(pf) : ""} />
          <Toggle on={f.esi} onChange={(v) => set("esi", v)} label="ESI" value={f.esi ? (gross > 21000 ? L({ hi: "₹21,000 से ऊपर नहीं कटता", en: "Not due above ₹21,000" }) : inr(esi)) : ""} />
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            {money("tds", L({ hi: "TDS हर महीने", en: "TDS a month" }))}
            {money("other_deduction", L({ hi: "दूसरी कटौती", en: "Other deduction" }))}
          </div>
        </section>

        <section>
          <h3 className="mlabel mb-2">{L({ hi: "बैंक", en: "Bank" })}</h3>
          <div className="space-y-2.5">
            <label className="field-box">
              <small>{L({ hi: "बैंक का नाम", en: "Bank name" })}</small>
              <input value={f.bank_name} onChange={(e) => set("bank_name", e.target.value)} maxLength={80} />
            </label>
            <label className="field-box">
              <small>{L({ hi: "खाता नं.", en: "Account no." })}</small>
              <input value={f.account_no} onChange={(e) => set("account_no", e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={20} className="tnum" />
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="field-box">
                <small>IFSC</small>
                <input value={f.ifsc} onChange={(e) => set("ifsc", e.target.value.toUpperCase())} maxLength={11} className="uppercase" />
              </label>
              <label className="field-box">
                <small>PAN</small>
                <input value={f.pan} onChange={(e) => set("pan", e.target.value.toUpperCase())} maxLength={10} className="uppercase" />
              </label>
            </div>
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-4 flex items-center gap-3 border-t border-ink-100 bg-white px-4 pt-3">
        <span className="min-w-0 flex-1 text-[13.5px] text-ink-600">
          {L({ hi: "हर महीने", en: "Net a month" })} <b className="tnum block text-[18px] text-ink-900">{inr(net)}</b>
        </span>
        <button type="button" onClick={save} disabled={busy} className="flex min-h-[48px] items-center gap-2 rounded-xl bg-[#3099a4] px-6 text-[15px] font-semibold text-white disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {L({ hi: "सेव करें", en: "Save" })}
        </button>
      </div>
    </Sheet>
  );
}

function Toggle({ on, onChange, label, value }: { on: boolean; onChange: (v: boolean) => void; label: string; value: string }) {
  return (
    <div className="flex min-h-[48px] items-center gap-3">
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={clsx("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-[#3099a4]" : "bg-ink-300")}>
        <span className={clsx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
      <span className="text-[14.5px] font-medium text-ink-800">{label}</span>
      <span className="tnum ml-auto text-right text-[13.5px] text-ink-600">{value}</span>
    </div>
  );
}

/** One month's slip: the breakdown, changes while it is a draft, printing and payment (the ERP's SlipDrawer). */
function SlipSheet({ row, school, place, isAdmin, onClose, onEditSalary, onChanged }: { row: PayrollRow; school: string; place: string; isAdmin: boolean; onClose: () => void; onEditSalary: () => void; onChanged: () => void }) {
  const L = useL();
  const slip = row.slip!;
  const [lop, setLop] = useState(slip.lop_manual ? String(slip.lop_days) : "");
  const [bonus, setBonus] = useState(slip.bonus ? String(slip.bonus) : "");
  const [advance, setAdvance] = useState(slip.advance ? String(slip.advance) : "");
  const [paidOn, setPaidOn] = useState(todayIso());
  const [mode, setMode] = useState(PAY_MODES[0]);
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);

  const draft = slip.status === "draft";
  const changed = draft && (lop !== (slip.lop_manual ? String(slip.lop_days) : "") || bonus !== (slip.bonus ? String(slip.bonus) : "") || advance !== (slip.advance ? String(slip.advance) : ""));

  async function act(path: string, body: unknown, ok: string, close: boolean) {
    setBusy(true);
    try {
      await api(path, { method: path.endsWith("/undo-pay") || path.endsWith("/pay") ? "POST" : "PATCH", body });
      toast(true, ok);
      onChanged();
      if (close) onClose();
    } catch (e) {
      toast(false, errText(e, L({ hi: "सेव नहीं हुआ।", en: "Could not save." })));
    } finally {
      setBusy(false);
    }
  }

  const lines = (items: [string, number][]) =>
    items
      .filter(([, v]) => v > 0)
      .map(([k, v]) => (
        <div key={k} className="flex justify-between py-1 text-[14px]">
          <span className="text-ink-600">{k}</span>
          <span className="tnum text-ink-900">{inr(v)}</span>
        </div>
      ));
  const paidDay = slip.paid_on ? new Date(slip.paid_on + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

  return (
    <>
      <Sheet title={row.name} onClose={() => !busy && onClose()}>
        <p className="-mt-1 pb-3 text-[13.5px] text-ink-500">{monthLabel(slip.month)}</p>

        <section className="rounded-2xl border border-ink-100 bg-ink-50 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-semibold text-ink-600">{L({ hi: "हाथ में सैलरी", en: "Net pay" })}</span>
            <span className="tnum text-[26px] font-extrabold text-ink-900">{inr(slip.net)}</span>
          </div>
          <p className="mt-0.5 text-[13px] text-ink-600">
            {L({ hi: `${slip.days_in_month} में से ${slip.paid_days} दिन`, en: `${slip.paid_days} of ${slip.days_in_month} days paid` })}
            {slip.lop_days > 0 && ` · ${slip.lop_days} LOP`}
            {!draft && slip.paid_on && ` · ${L({ hi: "दी", en: "paid" })} ${paidDay}, ${slip.pay_mode}`}
          </p>
        </section>

        <section className="mt-3 grid grid-cols-1 gap-3">
          <div>
            <h3 className="mlabel mb-0.5">{L({ hi: "कमाई", en: "Earnings" })}</h3>
            {lines([
              ["Basic", slip.earnings.basic],
              ["HRA", slip.earnings.hra],
              ["DA", slip.earnings.da],
              [L({ hi: "दूसरा भत्ता", en: "Other allowance" }), slip.earnings.other],
              [L({ hi: "बोनस", en: "Bonus" }), slip.earnings.bonus],
            ])}
            <div className="mt-1 flex justify-between border-t border-ink-100 pt-1.5 text-[14px] font-semibold">
              <span>{L({ hi: "कुल कमाई", en: "Gross" })}</span>
              <span className="tnum">{inr(slip.gross)}</span>
            </div>
          </div>
          <div>
            <h3 className="mlabel mb-0.5">{L({ hi: "कटौती", en: "Deductions" })}</h3>
            {lines([
              [L({ hi: "प्रोविडेंट फ़ंड", en: "Provident fund" }), slip.deductions.pf],
              ["ESI", slip.deductions.esi],
              ["TDS", slip.deductions.tds],
              [L({ hi: "दूसरी", en: "Other" }), slip.deductions.other],
              [L({ hi: "एडवांस", en: "Advance" }), slip.deductions.advance],
            ])}
            {slip.total_deductions === 0 && <p className="py-1 text-[14px] text-ink-500">{L({ hi: "कोई नहीं", en: "None" })}</p>}
            <div className="mt-1 flex justify-between border-t border-ink-100 pt-1.5 text-[14px] font-semibold">
              <span>{L({ hi: "कुल कटौती", en: "Total" })}</span>
              <span className="tnum">{inr(slip.total_deductions)}</span>
            </div>
          </div>
        </section>

        {draft && (
          <section className="mt-4">
            <h3 className="mlabel mb-2">{L({ hi: "इस महीने", en: "This month" })}</h3>
            <div className="grid grid-cols-3 gap-2">
              <label className="field-box">
                <small>{L({ hi: "LOP दिन", en: "LOP days" })}</small>
                <input type="number" inputMode="decimal" step={0.5} min={0} max={slip.days_in_month} value={lop} onChange={(e) => setLop(e.target.value)} placeholder={slip.lop_manual ? "" : String(slip.lop_days)} className="tnum w-full text-right" />
              </label>
              <label className="field-box">
                <small>{L({ hi: "बोनस", en: "Bonus" })}</small>
                <input type="number" inputMode="numeric" min={0} value={bonus} onChange={(e) => setBonus(e.target.value)} placeholder="0" className="tnum w-full text-right" />
              </label>
              <label className="field-box">
                <small>{L({ hi: "एडवांस", en: "Advance" })}</small>
                <input type="number" inputMode="numeric" min={0} value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="0" className="tnum w-full text-right" />
              </label>
            </div>
            <p className="mt-1.5 text-[12.5px] text-ink-500">{L({ hi: "LOP खाली छोड़ें तो हाज़िरी से लिया जाएगा।", en: "Leave LOP blank to take it from attendance." })}</p>
          </section>
        )}

        {draft && !changed && (
          <section className="mt-4">
            <h3 className="mlabel mb-2">{L({ hi: "सैलरी देना", en: "Payment" })}</h3>
            <PaymentFields paidOn={paidOn} setPaidOn={setPaidOn} mode={mode} setMode={setMode} refNo={ref} setRefNo={setRef} />
          </section>
        )}

        <button type="button" onClick={onEditSalary} className="mt-3 min-h-[44px] text-[14px] font-semibold text-[#3099a4]">
          {L({ hi: "तय सैलरी बदलें", en: "Change monthly salary" })}
        </button>

        <div className="sticky bottom-0 -mx-4 mt-2 flex gap-2 border-t border-ink-100 bg-white px-4 pt-3">
          {draft ? (
            changed ? (
              <button type="button" onClick={() => act(`/erp/payroll/slips/${slip.id}`, { lopDays: lop, bonus, advance }, L({ hi: "सैलरी बदल गई।", en: "Salary updated." }), false)} disabled={busy} className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#3099a4] text-[15px] font-semibold text-white disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {L({ hi: "बदलाव सेव करें", en: "Save changes" })}
              </button>
            ) : (
              <>
                <button type="button" onClick={() => setPrinting(true)} className="grid min-h-[48px] w-14 place-items-center rounded-xl border border-ink-300 bg-white" aria-label={L({ hi: "प्रिंट", en: "Print" })}>
                  <Printer className="h-5 w-5" aria-hidden />
                </button>
                <button type="button" onClick={() => act("/erp/payroll/pay", { ids: [slip.id], paidOn, mode, ref }, L({ hi: `${row.name} की सैलरी दी गई लिखी।`, en: `${row.name}'s salary marked paid.` }), true)} disabled={busy} className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-ink-900 text-[15px] font-semibold text-white disabled:opacity-50">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {L({ hi: "दी गई लिखें", en: "Mark paid" })} · <span className="tnum">{inr(slip.net)}</span>
                </button>
              </>
            )
          ) : (
            <>
              {isAdmin && (
                <button type="button" onClick={() => act(`/erp/payroll/slips/${slip.id}/undo-pay`, undefined, L({ hi: "पेमेंट हटा दिया। स्लिप फिर से ड्राफ़्ट है।", en: "Payment undone. The slip is a draft again." }), true)} disabled={busy} className="min-h-[48px] rounded-xl border border-ink-300 bg-white px-4 text-[14.5px] font-semibold text-ink-900 disabled:opacity-50">
                  {L({ hi: "पेमेंट हटाएँ", en: "Undo payment" })}
                </button>
              )}
              <button type="button" onClick={() => setPrinting(true)} className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#3099a4] text-[15px] font-semibold text-white">
                <Printer className="h-[18px] w-[18px]" aria-hidden />
                {L({ hi: "स्लिप प्रिंट करें", en: "Print slip" })}
              </button>
            </>
          )}
        </div>
      </Sheet>

      {printing && (
        <PrintSheet onDone={() => setPrinting(false)}>
          <PayslipDocument slip={slip} school={school} place={place} account={row.structure ? { bank: row.structure.bank_name, no: row.structure.account_no, ifsc: row.structure.ifsc, pan: row.structure.pan } : undefined} />
        </PrintSheet>
      )}
    </>
  );
}
