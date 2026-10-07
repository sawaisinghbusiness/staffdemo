"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { fullDate, monthYear, rupees } from "@/lib/format";
import { Empty, ErrorCard, ListSkeleton } from "@/components/ui";

interface Slip {
  month: string;
  basic: number;
  allowances: number;
  deductions: { name: string; amount: number }[];
  net: number;
  paidOn: string;
}

/** One card per month: the take-home on top, tap for how it was worked out. */
export default function SalaryPage() {
  const L = useL();
  const { lang } = useLang();
  const { data, error, reload } = useApi<{ slips: Slip[] }>("/my/salary");
  const [open, setOpen] = useState<string | null>(null);

  if (!data) {
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton rows={3} />;
  }
  if (!data.slips.length) return <Empty>{L({ hi: "अभी कोई सैलरी स्लिप नहीं है।", en: "No salary slips yet." })}</Empty>;
  const shown = open ?? data.slips[0].month;

  return (
    <ul className="animate-rise space-y-2">
      {data.slips.map((s) => {
        const isOpen = shown === s.month;
        return (
          <li key={s.month} className="rounded-2xl bg-ink-50">
            <button onClick={() => setOpen(isOpen ? "" : s.month)} aria-expanded={isOpen} className="flex min-h-[64px] w-full items-center gap-3 px-3.5 py-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-bold">{monthYear(s.month, lang)}</span>
                <span className="block text-[13px] text-ink-500">
                  {L({ hi: "भुगतान", en: "Paid on" })} {fullDate(s.paidOn, lang)}
                </span>
              </span>
              <span className="tnum text-[18px] font-extrabold">{rupees(s.net)}</span>
              <ChevronDown className={clsx("h-5 w-5 shrink-0 text-ink-400 transition", isOpen && "rotate-180")} aria-hidden />
            </button>
            {isOpen && (
              <dl className="kv tnum animate-fadeIn border-t border-ink-100 px-3.5 pb-1">
                <div>
                  <dt>{L({ hi: "मूल वेतन", en: "Basic" })}</dt>
                  <dd>{rupees(s.basic)}</dd>
                </div>
                <div>
                  <dt>{L({ hi: "भत्ते", en: "Allowances" })}</dt>
                  <dd>{rupees(s.allowances)}</dd>
                </div>
                {s.deductions.map((d) => (
                  <div key={d.name}>
                    <dt>{d.name}</dt>
                    <dd className="text-rose-600">− {rupees(d.amount)}</dd>
                  </div>
                ))}
                <div>
                  <dt className="!font-bold !text-ink-900">{L({ hi: "हाथ में", en: "Take-home" })}</dt>
                  <dd className="!font-extrabold">{rupees(s.net)}</dd>
                </div>
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}
