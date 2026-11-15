"use client";

import { useEffect, useState } from "react";
import { Circle } from "lucide-react";
import { useL } from "@/lib/i18n";
import { SOON_MODULES, type SoonModule } from "@/lib/erpSoon";
import { Empty } from "@/components/ui";

/*
 * ERP login → a module that isn't built yet (?m=<key> from lib/erpSoon.ts): what it will do, and "coming soon".
 * Nothing can be filled in here.
 */
export default function ErpSoonPage() {
  const L = useL();
  const [m, setM] = useState<SoonModule | null | undefined>(undefined);
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("m");
    setM(SOON_MODULES.find((x) => x.key === key) || null);
  }, []);

  if (m === undefined) return null;
  if (!m) return <Empty>{L({ hi: "यह मॉड्यूल नहीं मिला।", en: "This module was not found." })}</Empty>;
  const Icon = m.icon;
  return (
    <div className="animate-rise space-y-4 pt-2">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-ink-200 bg-white">
          <Icon className="h-6 w-6 text-ink-900" strokeWidth={1.8} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-[19px] font-bold leading-tight">{L(m.text)}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-500">
            <i className="h-2 w-2 rounded-full bg-marigold-400" aria-hidden />
            {L({ hi: "जल्द आ रहा है", en: "Coming soon" })}
          </p>
        </div>
      </div>
      <section className="row-card">
        <h3 className="text-[14px] font-semibold text-ink-500">{L({ hi: "इसमें क्या होगा", en: "What it will do" })}</h3>
        <ul className="mt-2 space-y-2.5">
          {m.lines.map((line, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] leading-snug">
              <Circle className="mt-1 h-3 w-3 shrink-0 text-ink-400" strokeWidth={1.8} aria-hidden />
              <span>{L(line)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
