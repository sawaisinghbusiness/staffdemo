/* Copied from the ERP (lib/feeEngine.ts) so the app works out fees exactly as the ERP and backend do. Keep in step; never edit only here. */
/**
 * Fee engine: the one place that turns the school's fee setup into money owed.
 *
 * KEEP IN SYNC with `sms backend/src/lib/feeEngine.ts` (same file, copied). The backend
 * version is the one that writes ledgers; this copy powers previews in the browser.
 *
 * All amounts are whole rupees. Concessions are rounded per instalment.
 */

export interface FeeHead {
  key: string;
  name: string;
}

export interface FeeBand {
  key: string;
  name: string;
  classes: string[];
  /** head key -> amount in each instalment (same length as `instalments`) */
  amounts: Record<string, number[]>;
}

export interface Instalment {
  name: string;
  /** yyyy-mm-dd */
  due: string;
}

export interface Concession {
  code: string;
  name: string;
  percent: number;
  /** "tuition": only the tuition head; "school": every class head (not bus, not admission) */
  on: "tuition" | "school";
}

export interface FeeConfig {
  version: 1;
  heads: FeeHead[];
  bands: FeeBand[];
  instalments: Instalment[];
  transport: { name: string; amounts: number[] };
  admission: { name: string; amount: number; instalment: number };
  fine: { perDay: number; cap: number; graceDays: number };
  concessions: Concession[];
}

export const TUITION = "tuition";

const q = (a: number, b = a, c = a, d = a) => [a, b, c, d];

/** The structure St. Paul's ledgers already follow (class band + ₹12,000 bus), split into heads and quarters. */
export const DEFAULT_FEE_CONFIG: FeeConfig = {
  version: 1,
  heads: [
    { key: "tuition", name: "Tuition fee" },
    { key: "annual", name: "Annual charges" },
    { key: "exam", name: "Exam fee" },
    { key: "computer", name: "Computer fee" },
  ],
  bands: [
    { key: "pre", name: "Nursery – UKG", classes: ["Pre Nursery", "Nursery", "LKG", "UKG"], amounts: { tuition: q(4500), annual: q(4000, 0, 0, 0), exam: q(0, 1000, 0, 1000), computer: q(0) } },
    { key: "primary", name: "Class 1 – 5", classes: ["1st", "2nd", "3rd", "4th", "5th"], amounts: { tuition: q(5500), annual: q(5000, 0, 0, 0), exam: q(0, 1000, 0, 1000), computer: q(250) } },
    { key: "middle", name: "Class 6 – 8", classes: ["6th", "7th", "8th"], amounts: { tuition: q(6500), annual: q(6000, 0, 0, 0), exam: q(0, 1500, 0, 1500), computer: q(250) } },
    { key: "secondary", name: "Class 9 – 10", classes: ["9th", "10th"], amounts: { tuition: q(7500), annual: q(7000, 0, 0, 0), exam: q(0, 2000, 0, 2000), computer: q(250) } },
    { key: "senior", name: "Class 11 – 12", classes: ["11th", "12th"], amounts: { tuition: q(8500), annual: q(8000, 0, 0, 0), exam: q(0, 2000, 0, 2000), computer: q(500) } },
  ],
  instalments: [
    { name: "Quarter 1", due: "2026-04-10" },
    { name: "Quarter 2", due: "2026-07-10" },
    { name: "Quarter 3", due: "2026-10-10" },
    { name: "Quarter 4", due: "2027-01-10" },
  ],
  transport: { name: "Transport fee", amounts: q(3000) },
  admission: { name: "Admission fee", amount: 5000, instalment: 0 },
  fine: { perDay: 10, cap: 500, graceDays: 0 },
  concessions: [
    { code: "sibling", name: "Sibling", percent: 10, on: "tuition" },
    { code: "staff", name: "Staff ward", percent: 50, on: "tuition" },
    { code: "rte", name: "RTE", percent: 100, on: "school" },
  ],
};

const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

export function bandOf(cfg: FeeConfig, cls: string): FeeBand | null {
  return cfg.bands.find((b) => b.classes.includes(cls)) || null;
}

export interface PlanInput {
  cls: string;
  bus: boolean;
  newAdmission: boolean;
  concession?: string | null;
}

export interface PlanLine {
  key: string;
  name: string;
  amounts: number[];
  total: number;
}

export interface Plan {
  band: FeeBand | null;
  instalments: Instalment[];
  /** Charges, one line per head that has money in it (class heads, then transport, then admission). */
  lines: PlanLine[];
  concession: (Concession & { amounts: number[]; total: number }) | null;
  /** What is owed in each instalment after concession. */
  net: number[];
  gross: number;
  discount: number;
  total: number;
}

/** A student's year: every charge by instalment, the concession, and the net due per instalment. */
export function planFor(cfg: FeeConfig, input: PlanInput): Plan {
  const n = cfg.instalments.length;
  const zero = () => Array.from({ length: n }, () => 0);
  const band = bandOf(cfg, input.cls);
  const lines: PlanLine[] = [];

  for (const h of cfg.heads) {
    const amounts = (band?.amounts[h.key] || zero()).slice(0, n).map((x) => Math.max(0, Math.round(x || 0)));
    while (amounts.length < n) amounts.push(0);
    if (sum(amounts) > 0) lines.push({ key: h.key, name: h.name, amounts, total: sum(amounts) });
  }
  if (input.bus) {
    const amounts = cfg.transport.amounts.slice(0, n).map((x) => Math.max(0, Math.round(x || 0)));
    while (amounts.length < n) amounts.push(0);
    if (sum(amounts) > 0) lines.push({ key: "transport", name: cfg.transport.name, amounts, total: sum(amounts) });
  }
  if (input.newAdmission && cfg.admission.amount > 0) {
    const amounts = zero();
    amounts[Math.min(Math.max(0, cfg.admission.instalment), n - 1)] = Math.round(cfg.admission.amount);
    lines.push({ key: "admission", name: cfg.admission.name, amounts, total: sum(amounts) });
  }

  const gross = zero();
  for (const l of lines) l.amounts.forEach((a, i) => (gross[i] += a));

  let concession: Plan["concession"] = null;
  const c = input.concession ? cfg.concessions.find((x) => x.code === input.concession) : undefined;
  if (c && c.percent > 0) {
    const classHeads = new Set(cfg.heads.map((h) => h.key));
    const base = zero();
    for (const l of lines) {
      const applies = c.on === "tuition" ? l.key === TUITION : classHeads.has(l.key);
      if (applies) l.amounts.forEach((a, i) => (base[i] += a));
    }
    const amounts = base.map((b) => Math.round((b * Math.min(100, c.percent)) / 100));
    concession = { ...c, amounts, total: sum(amounts) };
  }

  const net = gross.map((g, i) => g - (concession?.amounts[i] || 0));
  return {
    band,
    instalments: cfg.instalments,
    lines,
    concession,
    net,
    gross: sum(gross),
    discount: concession?.total || 0,
    total: sum(net),
  };
}

/** Late fine on one instalment: per day after due date (+ grace), capped. */
export function fineFor(cfg: FeeConfig, dueIso: string, onIso: string): number {
  const due = Date.parse(dueIso + "T00:00:00Z");
  const on = Date.parse(onIso + "T00:00:00Z");
  if (!Number.isFinite(due) || !Number.isFinite(on)) return 0;
  const lateDays = Math.floor((on - due) / 86400000) - cfg.fine.graceDays;
  if (lateDays <= 0) return 0;
  return Math.min(cfg.fine.cap, lateDays * cfg.fine.perDay);
}

export interface InstalmentStatus {
  name: string;
  due: string;
  /** Net amount of this instalment (after concession). */
  amount: number;
  /** Part of the student's payments that covers this instalment (oldest first). */
  paid: number;
  outstanding: number;
  /** Due date has passed and money is still outstanding. */
  overdue: boolean;
  daysLate: number;
  fine: number;
}

export interface Dues {
  instalments: InstalmentStatus[];
  /** Outstanding on instalments whose due date has passed (fine not included). */
  dueNow: number;
  fine: number;
  /** The next instalment that is not due yet and still has money outstanding. */
  upcoming: InstalmentStatus | null;
  /** True when the ledger total differed from the setup and was used instead. */
  adjusted: boolean;
}

/**
 * Where a student stands on a given day. Payments are applied to the oldest instalment
 * first. `ledgerNet` (total − discount on the ledger) is the truth: if it differs from
 * the setup, the difference is put on the first instalment (or taken from the last ones).
 */
export function duesFor(cfg: FeeConfig, plan: Plan, ledgerNet: number, paid: number, asOf: string): Dues {
  const net = [...plan.net];
  let diff = Math.round(ledgerNet) - plan.total;
  const adjusted = diff !== 0 && net.length > 0;
  if (diff > 0) net[0] += diff;
  for (let i = net.length - 1; diff < 0 && i >= 0; i--) {
    const cut = Math.min(net[i], -diff);
    net[i] -= cut;
    diff += cut;
  }

  let left = Math.max(0, Math.round(paid));
  const instalments: InstalmentStatus[] = plan.instalments.map((ins, i) => {
    const amount = net[i] || 0;
    const covered = Math.min(amount, left);
    left -= covered;
    const outstanding = amount - covered;
    const isDue = ins.due <= asOf;
    const overdue = isDue && outstanding > 0;
    const daysLate = overdue ? Math.max(0, Math.floor((Date.parse(asOf + "T00:00:00Z") - Date.parse(ins.due + "T00:00:00Z")) / 86400000)) : 0;
    return { name: ins.name, due: ins.due, amount, paid: covered, outstanding, overdue, daysLate, fine: overdue ? fineFor(cfg, ins.due, asOf) : 0 };
  });

  return {
    instalments,
    dueNow: instalments.filter((x) => x.overdue).reduce((s, x) => s + x.outstanding, 0),
    fine: instalments.reduce((s, x) => s + x.fine, 0),
    upcoming: instalments.find((x) => x.due > asOf && x.outstanding > 0) || null,
    adjusted,
  };
}

/** Receipt head key for a fee line: "tuition" -> "tuition_fee". Late fine is always "late_fine". */
export const headKey = (lineKey: string) => `${lineKey}_fee`;
export const LATE_FINE = "late_fine";

/**
 * What the student owes, line by line in each instalment, after the concession
 * (taken off tuition first, then the other class heads) and the same ledger
 * adjustment duesFor uses (extra on the first instalment, shortfall off the last ones).
 */
export function netLines(cfg: FeeConfig, plan: Plan, ledgerNet: number): PlanLine[] {
  const n = plan.instalments.length;
  const lines: PlanLine[] = plan.lines.map((l) => ({ ...l, amounts: [...l.amounts] }));
  if (plan.concession) {
    const classHeads = new Set(cfg.heads.map((h) => h.key));
    for (let i = 0; i < n; i++) {
      let cut = plan.concession.amounts[i] || 0;
      for (const l of lines) {
        if (cut <= 0) break;
        if (plan.concession.on === "tuition" ? l.key !== TUITION : !classHeads.has(l.key)) continue;
        const take = Math.min(l.amounts[i], cut);
        l.amounts[i] -= take;
        cut -= take;
      }
    }
  }
  let diff = Math.round(ledgerNet) - plan.total;
  if (diff > 0) {
    const amounts = Array.from({ length: n }, () => 0);
    amounts[0] = diff;
    lines.push({ key: "other", name: "Other charges", amounts, total: diff });
  }
  for (let i = n - 1; diff < 0 && i >= 0; i--) {
    for (let j = lines.length - 1; diff < 0 && j >= 0; j--) {
      const take = Math.min(lines[j].amounts[i], -diff);
      lines[j].amounts[i] -= take;
      diff += take;
    }
  }
  for (const l of lines) l.total = sum(l.amounts);
  return lines.filter((l) => l.total > 0);
}

export interface PaymentSplit {
  /** Receipt heads for the fee part, e.g. { tuition_fee: 5500, transport_fee: 3000 }. */
  heads: Record<string, number>;
  /** Fee part going to each instalment. */
  perInstalment: number[];
  /** Instalments this payment finishes paying. */
  cleared: number[];
  /** Late fine on the overdue instalments this payment clears (on `asOf`). */
  fine: number;
  /** More than is still owed for the session. */
  excess: number;
}

/**
 * Where a payment of `amount` goes. Money fills instalments oldest first and, inside
 * an instalment, heads in setup order, continuing after what was already paid.
 * The late fine is charged once, when an overdue instalment is finally cleared.
 */
export function splitPayment(cfg: FeeConfig, plan: Plan, ledgerNet: number, alreadyPaid: number, amount: number, asOf: string): PaymentSplit {
  const lines = netLines(cfg, plan, ledgerNet);
  const n = plan.instalments.length;
  const perInstalment = Array.from({ length: n }, () => 0);
  const owedBefore = Array.from({ length: n }, (_, i) => lines.reduce((s, l) => s + l.amounts[i], 0));
  const heads: Record<string, number> = {};
  let skip = Math.max(0, Math.round(alreadyPaid));
  let left = Math.max(0, Math.round(amount));

  for (let i = 0; i < n; i++) {
    for (const l of lines) {
      let cell = l.amounts[i];
      const s = Math.min(skip, cell);
      skip -= s;
      cell -= s;
      const take = Math.min(left, cell);
      if (take > 0) {
        heads[headKey(l.key)] = (heads[headKey(l.key)] || 0) + take;
        perInstalment[i] += take;
        left -= take;
      }
    }
  }

  // Outstanding before this payment = owed − already paid (oldest first).
  let paidLeft = Math.max(0, Math.round(alreadyPaid));
  const cleared: number[] = [];
  let fine = 0;
  for (let i = 0; i < n; i++) {
    const coveredBefore = Math.min(owedBefore[i], paidLeft);
    paidLeft -= coveredBefore;
    const outstanding = owedBefore[i] - coveredBefore;
    if (outstanding > 0 && perInstalment[i] === outstanding) {
      cleared.push(i);
      fine += fineFor(cfg, plan.instalments[i].due, asOf);
    }
  }
  return { heads, perInstalment, cleared, fine, excess: left };
}

/** Checks a config before it is saved. Returns a message for the first problem, or null. */
export function validateConfig(cfg: FeeConfig): string | null {
  const n = cfg?.instalments?.length || 0;
  if (!cfg || cfg.version !== 1) return "Unknown fee setup format.";
  if (n < 1 || n > 12) return "Have between 1 and 12 instalments.";
  for (let i = 0; i < n; i++) {
    const ins = cfg.instalments[i];
    if (!ins.name?.trim()) return `Instalment ${i + 1} needs a name.`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ins.due || "")) return `${ins.name}: choose a due date.`;
    if (i > 0 && ins.due <= cfg.instalments[i - 1].due) return `${ins.name} must be due after ${cfg.instalments[i - 1].name}.`;
  }
  const money = (x: unknown) => typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 1_000_000;
  if (!cfg.heads.length) return "Add at least one fee head.";
  const headKeys = new Set<string>();
  for (const h of cfg.heads) {
    if (!h.key || !h.name?.trim()) return "Every fee head needs a name.";
    if (headKeys.has(h.key)) return `Fee head "${h.name}" is listed twice.`;
    headKeys.add(h.key);
  }
  const seen = new Map<string, string>();
  for (const b of cfg.bands) {
    if (!b.name?.trim()) return "Every class group needs a name.";
    if (!b.classes.length) return `${b.name}: pick at least one class.`;
    for (const c of b.classes) {
      if (seen.has(c)) return `Class ${c} is in both "${seen.get(c)}" and "${b.name}".`;
      seen.set(c, b.name);
    }
    for (const h of cfg.heads) {
      const a = b.amounts[h.key] || [];
      if (a.length !== n || !a.every(money)) return `${b.name} – ${h.name}: enter a whole-rupee amount for every instalment.`;
    }
  }
  if (cfg.transport.amounts.length !== n || !cfg.transport.amounts.every(money)) return "Transport fee: enter an amount for every instalment.";
  if (!money(cfg.admission.amount)) return "Admission fee must be a whole-rupee amount.";
  if (!Number.isInteger(cfg.admission.instalment) || cfg.admission.instalment < 0 || cfg.admission.instalment >= n) return "Choose the instalment the admission fee is charged in.";
  const f = cfg.fine;
  if (!money(f.perDay) || f.perDay > 1000) return "Late fine per day must be between ₹0 and ₹1,000.";
  if (!money(f.cap)) return "Late fine limit must be a whole-rupee amount.";
  if (!Number.isInteger(f.graceDays) || f.graceDays < 0 || f.graceDays > 60) return "Grace days must be between 0 and 60.";
  const codes = new Set<string>();
  for (const c of cfg.concessions) {
    if (!c.code || !c.name?.trim()) return "Every concession needs a name.";
    if (codes.has(c.code)) return `Concession "${c.name}" is listed twice.`;
    codes.add(c.code);
    if (typeof c.percent !== "number" || c.percent < 0 || c.percent > 100) return `${c.name}: percent must be between 0 and 100.`;
    if (c.on !== "tuition" && c.on !== "school") return `${c.name}: choose what it applies to.`;
  }
  return null;
}
