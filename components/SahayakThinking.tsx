"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { useL, type Bi } from "@/lib/i18n";

/**
 * School Sahayak's "thinking" look (option C, picked by the user 2026-10-23): while the answer is on its
 * way a shimmering "सोच रहा हूँ…" with the steps under it; once it lands, a "3 सेकंड सोचा" line that
 * opens to show those steps. The server answers in one go, so the steps move on a timer.
 */

const STEP_MS = 1300;
const SLOW_MS = 12_000;

/** Shown while waiting: one more step every 1.3s, and a "taking longer" line after 12s. */
export function Thinking({ steps }: { steps: Bi[] }) {
  const L = useL();
  const [shown, setShown] = useState(1);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    setShown(1);
    setSlow(false);
    const step = setInterval(() => setShown((k) => Math.min(k + 1, steps.length)), STEP_MS);
    const late = setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      clearInterval(step);
      clearTimeout(late);
    };
  }, [steps]);

  return (
    <div className="flex max-w-[86%] flex-col gap-1.5 self-start" role="status">
      <p className="flex items-center gap-2 text-[14px]">
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#E3DCFA] border-t-[#6A45E0]" aria-hidden />
        <span className="sahayak-shine">{slow ? L({ hi: "थोड़ा और समय लग रहा है…", en: "Taking a little longer…" }) : L({ hi: "सोच रहा हूँ…", en: "Thinking…" })}</span>
      </p>
      <StepList steps={steps.slice(0, shown)} />
    </div>
  );
}

/** Above an answer: how long it took; tap to see the steps again. */
export function Thought({ secs, steps }: { secs: number; steps: Bi[] }) {
  const L = useL();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="-my-2 flex min-h-[44px] items-center gap-1.5 self-start text-[13.5px] text-[#6B6492]">
        <ChevronRight className={clsx("h-3.5 w-3.5 transition-transform", open && "rotate-90")} strokeWidth={2.5} aria-hidden />
        {L({ hi: `${secs} सेकंड सोचा`, en: `Thought for ${secs}s` })}
      </button>
      {open && <StepList steps={steps} />}
    </div>
  );
}

function StepList({ steps }: { steps: Bi[] }) {
  const L = useL();
  return (
    <ol className="border-l-2 border-[#E3DCFA] pl-2.5 text-[13.5px] leading-relaxed text-[#6B6492]">
      {steps.map((s) => (
        <li key={s.en}>{L(s)}</li>
      ))}
    </ol>
  );
}

/** A new answer appears word by word; all at once when the phone asks for less motion. */
export function TypeOut({ text, onGrow }: { text: string; onGrow?: () => void }) {
  const parts = useMemo(() => text.split(/(\s+)/), [text]);
  const [n, setN] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setN(parts.length);
      return;
    }
    setN(0);
    const t = setInterval(() => setN((k) => (k >= parts.length ? k : k + 1)), 25);
    return () => clearInterval(t);
  }, [parts]);

  useEffect(() => {
    onGrow?.();
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{parts.slice(0, n).join("")}</>;
}
