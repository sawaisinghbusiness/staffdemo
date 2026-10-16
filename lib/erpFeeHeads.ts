/* Copied from the ERP (lib/feeHeads.ts) so the app works out fees exactly as the ERP and backend do. Keep in step; never edit only here. */
/** Names for receipt heads (fee_heads keys), in the order they print. Late fine always last. */
const LABELS: Record<string, string> = {
  tuition_fee: "Tuition fee",
  annual_fee: "Annual charges",
  exam_fee: "Exam fee",
  computer_fee: "Computer fee",
  transport_fee: "Transport fee",
  admission_fee: "Admission fee",
  other_fee: "Other charges",
  late_fine: "Late fine",
};
const ORDER = Object.keys(LABELS);

export function headLabel(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const words = key.replace(/_fee$/, "").replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1) + (key.endsWith("_fee") ? " fee" : "");
}

/** Heads with money in them, known ones in the usual order, others after, late fine last. */
export function headRows(heads: Record<string, number> | null | undefined): { key: string; label: string; amount: number }[] {
  const rows = Object.entries(heads || {})
    .map(([key, v]) => ({ key, label: headLabel(key), amount: Number(v) || 0 }))
    .filter((r) => r.amount > 0);
  const rank = (k: string) => (k === "late_fine" ? 999 : ORDER.indexOf(k) === -1 ? 500 : ORDER.indexOf(k));
  return rows.sort((a, b) => rank(a.key) - rank(b.key));
}
