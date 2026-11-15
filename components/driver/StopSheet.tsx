"use client";

import { useRef, useState } from "react";
import { useDialog } from "@/lib/useDialog";
import clsx from "clsx";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useL } from "@/lib/i18n";
import type { BusStop, Trip } from "@/lib/bus";
import { Face, timeOf } from "./parts";

/**
 * At a stop: only the children coming today, each with one button ("Got off" in the afternoon,
 * "Got on" in the morning). The tap tells the parent at once. Then "Stop done" moves on.
 */
export function StopSheet({
  stop,
  no,
  trip,
  absent,
  busy,
  fail,
  onTick,
  onDone,
  onClose,
}: {
  stop: BusStop;
  no: number;
  trip: Trip;
  absent: string[];
  busy: boolean;
  fail: string;
  onTick: (kidId: string, on: boolean) => void;
  onDone: () => void;
  onClose: () => void;
}) {
  const L = useL();
  const panel = useRef<HTMLDivElement>(null);
  const [confirmRemaining, setConfirmRemaining] = useState(false);
  useDialog(true, panel, onClose, busy);
  const morning = trip.kind === "morning";
  const ticked = stop.kids.filter((k) => trip.marks[k.id]).length;
  const word = morning ? L({ hi: "चढ़ गया", en: "Got on" }) : L({ hi: "उतर गया", en: "Got off" });

  return (
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="stop-name" className="drv fixed inset-0 z-[880] mx-auto flex max-w-[560px] animate-rise flex-col bg-white">
      <div className="pt-safe">
        <div className="flex items-center gap-3 px-4 pb-2 pt-3">
          <button onClick={onClose} disabled={busy} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-drv-soft active:bg-drv-line" aria-label={L({ hi: "मैप पर वापस", en: "Back to the map" })}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h2 id="stop-name" className="break-words text-[18px] font-semibold leading-snug">
              {stop.name}
            </h2>
            <p className="text-[12px] text-drv-mute">{L({ hi: `स्टॉप ${no}`, en: `Stop ${no}` })}</p>
          </div>
          <div className="text-right">
            <p className="text-[18px] font-semibold leading-tight">
              {ticked}
              <span className="text-[14px] font-medium text-drv-faint">/{stop.kids.length}</span>
            </p>
            <p className="text-[11.5px] text-drv-mute">{morning ? L({ hi: "चढ़े", en: "on" }) : L({ hi: "उतरे", en: "off" })}</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {absent.length > 0 && (
          <p className="mt-3 flex items-center gap-2 rounded-[10px] bg-drv-soft px-2.5 py-2 text-[12px] text-drv-mute">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#BDBDB8]" aria-hidden />
            {L({ hi: `आज अनुपस्थित: ${absent.join(", ")} (लिस्ट में नहीं)`, en: `Absent today: ${absent.join(", ")} (not in the list)` })}
          </p>
        )}

        <ul className="mt-1">
          {stop.kids.map((k) => {
            const at = trip.marks[k.id];
            return (
              <li key={k.id} className="flex min-h-[72px] items-center py-3 gap-3 border-b border-drv-line last:border-b-0">
                <Face name={k.name} url={k.photoUrl} grey={!at} />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[15px] font-semibold leading-snug">{k.name}</span>
                  <span className="block text-[12px] text-drv-mute">
                    {L({ hi: "कक्षा", en: "Class" })} {k.classSec}
                    {at ? ` · ${timeOf(at)}` : ""}
                  </span>
                </span>
                <button
                  onClick={() => { setConfirmRemaining(false); onTick(k.id, !at); }}
                  disabled={busy}
                  aria-pressed={!!at}
                  className={clsx(
                    "flex min-h-[48px] min-w-[88px] items-center justify-center gap-1 rounded-[10px] px-3 text-[14px] transition-colors disabled:opacity-60",
                    at ? "bg-drv-green font-semibold text-white" : "border-[1.5px] border-drv-ink bg-white font-medium text-drv-ink active:bg-drv-soft"
                  )}
                >
                  {at && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
                  {word}
                </button>
              </li>
            );
          })}
        </ul>
        {fail && <p role="alert" className="mt-2 text-[14px] text-rose-700">{fail}</p>}
      </div>

      <div className="pb-safe px-4 pt-2">
        {confirmRemaining && <p role="alert" className="mb-3 text-[14px] leading-relaxed text-drv-mute">{L({ hi: "\u0915\u0941\u091b \u092c\u091a\u094d\u091a\u0947 \u0905\u092d\u0940 \u092e\u093e\u0930\u094d\u0915 \u0928\u0939\u0940\u0902 \u0939\u0941\u090f \u0939\u0948\u0902\u0964", en: "Some children are still unmarked. Review them, or confirm below to continue without changing their status." })}</p>}
        <button onClick={() => { if (ticked < stop.kids.length && !confirmRemaining) { setConfirmRemaining(true); return; } onDone(); }} disabled={busy} className="d-btn d-btn-k mb-4 w-full">
          {confirmRemaining && ticked < stop.kids.length ? L({ hi: `${stop.kids.length - ticked} \u092c\u093e\u0915\u0940 \u0930\u0916\u0915\u0930 \u0906\u0917\u0947 \u092c\u095d\u0947\u0902`, en: `Continue with ${stop.kids.length - ticked} unmarked` }) : ticked < stop.kids.length
            ? L({ hi: `स्टॉप पूरा (${stop.kids.length - ticked} बाकी) · आगे चलें`, en: `Stop done (${stop.kids.length - ticked} left) · Next` })
            : L({ hi: "स्टॉप पूरा · आगे चलें", en: "Stop done · Next" })}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
