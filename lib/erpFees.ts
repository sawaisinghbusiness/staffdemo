/* Copied from the ERP (lib/services/feeService.ts: types + numberToWordsIndian) so the app works out fees exactly as the ERP and backend do. Keep in step; never edit only here. */
import type { FeeConfig } from "./erpFeeEngine";

export interface DaySummary {
  date: string;
  count: number;
  total: number;
  byMode: { Cash: number; UPI: number; Cheque: number; Other: number };
}

/** Receipt heads: tuition_fee, annual_fee, exam_fee, computer_fee, transport_fee, admission_fee, other_fee, late_fine… */
export type FeeHeads = Record<string, number>;

export interface FeePosition {
  asOf: string;
  config: FeeConfig;
  input: { cls: string; bus: boolean; newAdmission: boolean; concession: string | null };
  ledger: { total: number; discount: number; paid: number; finePaid: number; net: number; balance: number };
  fineSupported: boolean;
}

export interface FeeTransaction {
  id: string;
  receipt_no: number;
  student_id: string;
  amount_paid: number;
  payment_mode: "Cash" | "UPI" | "Cheque" | "Net Banking";
  transaction_id?: string | null;
  fee_heads: FeeHeads;
  collected_by: string;
  payment_date: string;
  remarks?: string | null;
  /** Set on cancelled receipts: they stay in the register but are not money collected. */
  cancelled?: boolean;
  cancel_reason?: string | null;
  student?: {
    name: string;
    sr_no: string;
    admission_no?: string;
    class_name?: string;
    section?: string;
    father_name?: string;
    contact_phone?: string;
  };
}

/**
 * Convert numeric Indian currency to English words
 * Example: 4500 -> "Four Thousand Five Hundred Rupees Only"
 */
export function numberToWordsIndian(num: number): string {
  if (num === 0) return "Zero Rupees Only";

  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertTwoDigits(n: number): string {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
  }

  function convertGroup(n: number): string {
    let str = "";
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n > 0) {
      str += convertTwoDigits(n);
    }
    return str.trim();
  }

  const rounded = Math.round(num);
  const crore = Math.floor(rounded / 10000000);
  const lakh = Math.floor((rounded % 10000000) / 100000);
  const thousand = Math.floor((rounded % 100000) / 1000);
  const remainder = rounded % 1000;

  let words = "";
  if (crore > 0) words += convertGroup(crore) + " Crore ";
  if (lakh > 0) words += convertGroup(lakh) + " Lakh ";
  if (thousand > 0) words += convertGroup(thousand) + " Thousand ";
  if (remainder > 0) words += convertGroup(remainder);

  return words.trim() + " Rupees Only";
}

