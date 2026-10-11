"use client";

import clsx from "clsx";
import { Check, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
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
  canSave,
  onTick,
  onSave,
  onDone,
  onClose,
}: {
  stop: BusStop;
  no: number;
  trip: Trip;
  absent: string[];
  busy: boolean;
  fail: string;
  /** The stop's place isn't saved and the phone knows where it is. */
  canSave: boolean | null;
  onTick: (kidId: string, on: boolean) => void;
  onSave: () => void;
  onDone: () => void;
  onClose: () => void;
}) {
  const L = useL();
  const morning = trip.kind === "morning";
  const ticked = stop.kids.filter((k) => trip.marks[k.id]).length;
  const word = morning ? L({ hi: "चढ़ गया", en: "Got on" }) : L({ hi: "उतर गया", en: "Got off" });

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="stop-name" className="drv fixed inset-0 z-[880] mx-auto flex max-w-[560px] animate-rise flex-col bg-white">
      <div className="pt-safe">
        <div className="flex items-center gap-3 px-4 pb-2 pt-3">
          <button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-drv-soft active:bg-drv-line" aria-label={L({ hi: "मैप पर वापस", en: "Back to the map" })}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h2 id="stop-name" className="truncate text-[17px] font-semibold">
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
        {canSave !== null && (
          <div className="mt-2 rounded-[12px] bg-drv-note px-3 py-3">
            <p className="text-[13px] font-semibold text-[#4A3F00]">{L({ hi: "इस स्टॉप की जगह अभी सेव नहीं है", en: "This stop's place isn't saved yet" })}</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-[#5A5130]">{L({ hi: "बस स्टॉप पर खड़ी है तो सेव कर दें। अगली बार से अलर्ट अपने आप आएगा।", en: "If the bus is standing at the stop, save it. From next time the alert comes on its own." })}</p>
            <button onClick={onSave} disabled={!canSave || busy} className="d-btn d-btn-k mt-2.5 w-full">
              <MapPin className="h-4 w-4" aria-hidden />
              {L({ hi: "बस यहीं है, जगह सेव करें", en: "The bus is here, save the place" })}
            </button>
          </div>
        )}

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
              <li key={k.id} className="flex h-14 items-center gap-3 border-b border-drv-line last:border-b-0">
                <Face name={k.name} url={k.photoUrl} grey={!at} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{k.name}</span>
                  <span className="block text-[12px] text-drv-mute">
                    {L({ hi: "कक्षा", en: "Class" })} {k.classSec}
                    {at ? ` · ${timeOf(at)}` : ""}
                  </span>
                </span>
                <button
                  onClick={() => onTick(k.id, !at)}
                  disabled={busy}
                  aria-pressed={!!at}
                  className={clsx(
                    "flex h-8 min-w-[88px] items-center justify-center gap-1 rounded-full px-3 text-[12.5px] transition-colors disabled:opacity-60",
                    at ? "bg-drv-mint font-semibold text-white" : "border-[1.5px] border-drv-ink bg-white font-medium text-drv-ink active:bg-drv-soft"
                  )}
                >
                  {at && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
                  {word}
                </button>
              </li>
            );
          })}
        </ul>
        {fail && <p className="mt-2 text-[13px] text-rose-600">{fail}</p>}
      </div>

      <div className="pb-safe px-4 pt-2">
        <button onClick={onDone} disabled={busy} className="d-btn d-btn-k mb-4 w-full">
          {ticked < stop.kids.length
            ? L({ hi: `स्टॉप पूरा (${stop.kids.length - ticked} बाकी) · आगे चलें`, en: `Stop done (${stop.kids.length - ticked} left) · Next` })
            : L({ hi: "स्टॉप पूरा · आगे चलें", en: "Stop done · Next" })}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
