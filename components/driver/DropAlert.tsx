"use client";

import { useEffect, useRef } from "react";
import { Check, MapPin, X } from "lucide-react";
import { useL } from "@/lib/i18n";
import { distText, type BusStop, type TripKind } from "@/lib/bus";
import { Face } from "./parts";

/**
 * Full screen, like an incoming call, when the bus is about 100 m from a stop: the first child's
 * photo, who else gets off (or on) there, and one line telling the driver to stop carefully.
 */
export function DropAlert({ stop, kind, dist, onClose, onOk }: { stop: BusStop; kind: TripKind; dist: number | null; onClose: () => void; onOk: () => void }) {
  const L = useL();
  const morning = kind === "morning";
  const kid = stop.kids[0];
  const rest = stop.kids.slice(1);
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => okRef.current?.focus(), []);
  if (!kid) return null;

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="drop-name" className="drv fixed inset-0 z-[900] mx-auto flex max-w-[560px] animate-fadeIn flex-col items-center bg-white px-6 pb-9 text-center" style={{ paddingTop: "calc(env(safe-area-inset-top) + 48px)" }}>
      <span className="d-chip px-3 py-1.5 text-[12.5px]">
        <MapPin className="h-[14px] w-[14px] text-drv-green" aria-hidden />
        {stop.name}
        {dist !== null && <b className="font-semibold text-drv-green"> · {distText(dist)}</b>}
      </span>

      <div className="d-ripple relative mt-12 grid h-[150px] w-[150px] place-items-center">
        <Face name={kid.name} url={kid.photoUrl} size={124} className="!text-[40px]" />
      </div>

      <h2 id="drop-name" className="mt-7 text-[22px] font-semibold tracking-[-0.01em]">
        {kid.name}
      </h2>
      <p className="mt-1 text-[13px] text-drv-mute">
        {L({ hi: "कक्षा", en: "Class" })} {kid.classSec}
      </p>
      <p className="mt-5 max-w-[270px] text-[15px] font-medium leading-normal">
        {morning
          ? L({ hi: "पिकअप पॉइंट बहुत पास है। बस रोकें और बच्चे को ध्यान से चढ़ाएँ।", en: "The pickup point is very close. Stop the bus and help the child on carefully." })
          : L({ hi: "ड्रॉप पॉइंट बहुत पास है। बस रोकें और बच्चे को ध्यान से उतारें।", en: "The drop point is very close. Stop the bus and drop the child carefully." })}
      </p>
      {rest.length > 0 && (
        <div className="mt-3.5 flex items-center gap-2 text-[12px] text-drv-mute">
          <span className="flex">
            {rest.slice(0, 3).map((k, i) => (
              <Face key={k.id} name={k.name} url={k.photoUrl} size={26} plain className={i ? "-ml-2" : ""} />
            ))}
          </span>
          {morning ? L({ hi: `साथ में ${rest.length} और बच्चे चढ़ेंगे`, en: `${rest.length} more getting on here` }) : L({ hi: `साथ में ${rest.length} और बच्चे उतरेंगे`, en: `${rest.length} more getting off here` })}
        </div>
      )}

      <div className="mt-auto flex items-end gap-14">
        <span className="flex flex-col items-center gap-2 text-[12.5px] font-medium text-drv-mute">
          <button onClick={onClose} className="grid h-14 w-14 place-items-center rounded-full bg-drv-soft text-drv-ink active:bg-drv-line" aria-label={L({ hi: "बंद करें", en: "Close" })}>
            <X className="h-[22px] w-[22px]" aria-hidden />
          </button>
          {L({ hi: "बंद करें", en: "Close" })}
        </span>
        <span className="flex flex-col items-center gap-2 text-[12.5px] font-medium text-drv-mute">
          <button ref={okRef} onClick={onOk} className="grid h-[68px] w-[68px] place-items-center rounded-full bg-drv-mint text-white shadow-[0_8px_20px_rgba(77,203,127,.35)] active:translate-y-px" aria-label="Got it">
            <Check className="h-7 w-7" strokeWidth={2.6} aria-hidden />
          </button>
          Got it
        </span>
      </div>
    </div>
  );
}
