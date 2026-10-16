/* Copied from the ERP (lib/services/reportService.ts: report shapes). Keep in step. */

export type ModeKey = "Cash" | "UPI" | "Cheque" | "Other";
export type ByMode = Record<ModeKey, number>;

export interface CollectionReport {
  from: string;
  to: string;
  /** Only days with receipts, newest first. */
  days: { date: string; receipts: number; total: number; byMode: ByMode }[];
  totals: { receipts: number; total: number; byMode: ByMode };
  /** Always sums to totals.total (an "Unsplit" head takes any gap). */
  heads: { key: string; label: string; amount: number }[];
  byCollector: { name: string; receipts: number; total: number }[];
}

export interface ClassMoney {
  students: number;
  total: number;
  discount: number;
  paid: number;
  balance: number;
}

export interface ClasswiseReport {
  session: string;
  classes: (ClassMoney & { class: string; sections: (ClassMoney & { section: string })[] })[];
  totals: ClassMoney;
}

