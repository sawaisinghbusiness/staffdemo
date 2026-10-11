"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronLeft, TriangleAlert } from "lucide-react";
import { useL } from "@/lib/i18n";
import { DELAY_MINUTES, DELAY_REASONS, type Delay } from "@/lib/bus";

/** "The bus is late": the driver picks why and how long; the parents of children on board see it. */
export function DelaySheet({
  routeName,
  onBoard,
  current,
  busy,
  fail,
  onSend,
  onClear,
  onClose,
}: {
  routeName: string;
  onBoard: number;
  current: Delay | null;
  busy: boolean;
  fail: string;
  onSend: (reason: string, minutes: number) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const L = useL();
  const [reason, setReason] = useState(current?.reason || "traffic");
  const [mins, setMins] = useState(current?.minutes || 10);
  const why = DELAY_REASONS.find((r) => r.id === reason) || DELAY_REASONS[0];
  const late = mins >= 30 ? L({ hi: "30 मिनट से ज़्यादा", en: "more than 30 minutes" }) : L({ hi: `करीब ${mins} मिनट`, en: `about ${mins} minutes` });

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="delay-title" className="drv fixed inset-0 z-[880] mx-auto flex max-w-[560px] animate-rise flex-col bg-white">
      <div className="pt-safe">
        <div className="flex items-center gap-3 px-4 pb-2 pt-3">
          <button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-drv-soft active:bg-drv-line" aria-label={L({ hi: "वापस", en: "Back" })}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0">
            <h2 id="delay-title" className="text-[17px] font-semibold">
              {L({ hi: "पैरेंट्स को बताएँ", en: "Tell the parents" })}
            </h2>
            <p className="text-[12px] text-drv-mute">{L({ hi: `इस बस के ${onBoard} बच्चों के पैरेंट्स को दिखेगा`, en: `Shown to the parents of ${onBoard} children on this bus` })}</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="mt-3 space-y-2" role="radiogroup" aria-label={L({ hi: "वजह", en: "Reason" })}>
          {DELAY_REASONS.map((r) => (
            <button
              key={r.id}
              role="radio"
              aria-checked={reason === r.id}
              onClick={() => setReason(r.id)}
              className={clsx("flex h-12 w-full items-center gap-3 rounded-[12px] border bg-white px-3.5 text-left text-[13.5px] font-medium", reason === r.id ? "border-drv-ink shadow-[inset_0_0_0_.5px_#111]" : "border-drv-line")}
            >
              <span className={clsx("grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[1.5px]", reason === r.id ? "border-drv-ink" : "border-[#BDBDB8]")}>
                {reason === r.id && <span className="h-[9px] w-[9px] rounded-full bg-drv-ink" />}
              </span>
              {L({ hi: r.hi, en: r.en })}
            </button>
          ))}
        </div>

        <p className="mb-2 mt-5 text-[12px] font-semibold text-drv-mute">{L({ hi: "कितनी देर", en: "How late" })}</p>
        <div className="flex gap-2">
          {DELAY_MINUTES.map((m) => (
            <button key={m} onClick={() => setMins(m)} aria-pressed={mins === m} className={clsx("h-[38px] flex-1 rounded-[10px] text-[13px]", mins === m ? "bg-drv-ink font-semibold text-white" : "bg-drv-soft font-medium")}>
              {m === 30 ? "30+" : m} {L({ hi: "मिनट", en: "min" })}
            </button>
          ))}
        </div>

        <p className="mb-2 mt-5 text-[12px] font-semibold text-drv-mute">{L({ hi: "पैरेंट्स को ऐसा दिखेगा", en: "Parents will see" })}</p>
        <div className="flex gap-3 rounded-[12px] bg-drv-note p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-drv-yellow">
            <TriangleAlert className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div>
            <p className="text-[13.5px] font-semibold">{L({ hi: "बस देर से आएगी", en: "The bus is running late" })}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-[#5A5130]">
              {L({ hi: `${why.why.hi} ${routeName} की बस ${late} देर से पहुँचेगी।`, en: `${why.why.en}, the ${routeName} bus will be ${late} late.` })}
            </p>
          </div>
        </div>
        {current && (
          <button onClick={onClear} disabled={busy} className="mt-3 text-[13px] font-semibold text-drv-green underline-offset-2 active:underline">
            {L({ hi: "बस अब समय पर है, मैसेज हटाएँ", en: "The bus is on time now, remove the message" })}
          </button>
        )}
        {fail && <p className="mt-2 text-[13px] text-rose-600">{fail}</p>}
      </div>

      <div className="pb-safe px-4 pt-2">
        <button onClick={() => onSend(reason, mins)} disabled={busy} className="d-btn d-btn-k mb-4 w-full">
          {current ? L({ hi: "बदलाव भेजें", en: "Send the change" }) : L({ hi: `${onBoard} पैरेंट्स को भेजें`, en: `Send to ${onBoard} parents` })}
        </button>
      </div>
    </div>
  );
}
