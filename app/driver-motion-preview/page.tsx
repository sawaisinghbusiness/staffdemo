"use client";
/**
 * PREVIEW ONLY (2026-11-16), not linked from the app: the driver Home with the proposed motion, to compare
 * before anything changes on the real screens.
 *   1. Opening the page: the parts arrive in layers and settle (no whole-page fade).
 *   2. Slow network: a skeleton shaped exactly like the real card (labels already in place, only the
 *      values are grey bars); when data comes the bars turn into text in the same place, nothing jumps.
 *   3. EN ⇄ हि: the text re-forms in a wave from top to bottom (lib/langWave.ts).
 * "Old" replays today's behaviour (three grey boxes, then the page pops in).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowRight, Bell, BusFront, ChevronDown, School, UsersRound } from "lucide-react";
import { useL, useLang } from "@/lib/i18n";
import { langWave } from "@/lib/langWave";
import { SlideConfirm } from "@/components/driver/SlideConfirm";
import "./preview.css";

const STOPS = [
  { name: "Mahaveer Nagar", kids: 15, time: "7:05" },
  { name: "Station Road", kids: 12, time: "7:14" },
  { name: "Baldev Nagar", kids: 18, time: "7:22" },
  { name: "Ratan Singh Colony", kids: 22, time: "7:31" },
];

type Mode = "new-slow" | "new-fast" | "old";

export default function DriverMotionPreview() {
  const L = useL();
  const { lang, setLang } = useLang();
  const [mode, setMode] = useState<Mode>("new-slow");
  const [run, setRun] = useState(0); // bump to replay
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const phone = useRef<HTMLDivElement>(null);

  // Replay: slow network waits 1.4 s for "data", fast has it at once.
  useEffect(() => {
    setLoaded(mode === "new-fast");
    setOpen(false);
    if (mode === "new-fast") return;
    const t = setTimeout(() => setLoaded(true), 1400);
    return () => clearTimeout(t);
  }, [mode, run]);

  // Language wave after the new words are on screen (not on the first paint).
  const firstLang = useRef(true);
  useLayoutEffect(() => {
    if (firstLang.current) return void (firstLang.current = false);
    if (phone.current) langWave(phone.current);
  }, [lang]);

  const replay = (m: Mode) => {
    setMode(m);
    setRun((x) => x + 1);
  };
  const kids = STOPS.reduce((a, s) => a + s.kids, 0);
  const isNew = mode !== "old";
  // A value, or (new style, still loading) a grey bar the same size as the value will be.
  const v = (text: React.ReactNode, w: string) => (loaded ? <span className={clsx(isNew && "mp-value")}>{text}</span> : <i className="mp-bar" style={{ width: w }} aria-hidden />);

  return (
    <div className="mp-page">
      <div className="mp-controls">
        <p className="mp-hint">Preview · असली स्क्रीन नहीं बदली</p>
        <div className="mp-buttons">
          <button onClick={() => replay("new-slow")} data-on={mode === "new-slow"}>नया · धीमा नेट</button>
          <button onClick={() => replay("new-fast")} data-on={mode === "new-fast"}>नया · तेज़ नेट</button>
          <button onClick={() => replay("old")} data-on={mode === "old"}>पुराना</button>
        </div>
      </div>

      <div ref={phone} className="mp-phone drv driver-home driver-dispatch" key={`${mode}-${run}`} data-motion={isNew ? "new" : "old"} data-slow={mode === "new-slow" || undefined}>
        <header className="pt-safe">
          <div className="flex items-center gap-1 pb-1 pl-2.5 pr-3 pt-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#17251E] text-[13px] font-bold text-[#FFCB00]">S</span>
            <div className="ml-1.5 min-w-0 flex-1">
              <p className="truncate text-[11.5px] text-drv-mute">{L({ hi: "सुप्रभात", en: "Good morning" })}</p>
              <p className="truncate text-[15.5px] font-semibold leading-tight">Ramesh</p>
            </div>
            <div className="relative flex shrink-0 rounded-full border border-drv-line bg-white p-0.5" role="group" data-no-lang-wave>
              <span aria-hidden className="absolute left-0.5 top-0.5 h-9 w-9 rounded-full bg-drv-black transition-transform duration-300" style={{ transform: lang === "hi" ? "translateX(36px)" : "none" }} />
              {(["en", "hi"] as const).map((k) => (
                <button key={k} onClick={() => setLang(k)} aria-pressed={lang === k} className={clsx("relative h-9 w-9 rounded-full text-[11px] font-semibold transition-colors duration-300", lang === k ? "text-white" : "text-drv-mute")}>
                  {k === "en" ? "EN" : "हि"}
                </button>
              ))}
            </div>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full">
              <Bell className="h-[21px] w-[21px]" strokeWidth={1.9} aria-hidden />
            </span>
          </div>
        </header>

        {mode === "old" && !loaded ? (
          <div className="space-y-3 px-4 pt-4">
            <div className="skeleton h-[148px] w-full rounded-[14px]" />
            <div className="skeleton h-11 w-full rounded-[12px]" />
            <div className="skeleton h-[52px] w-full rounded-[12px]" />
          </div>
        ) : (
          <div className="dispatch-main" data-loaded={loaded}>
            <div className="dispatch-title mp-in" style={{ "--i": 0 } as React.CSSProperties}>
              <h1>{L({ hi: "आज का सफ़र", en: "Today's route" })}</h1>
              <span>{new Date().toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" })}</span>
            </div>
            <div className="dispatch-tabs mp-in" style={{ "--i": 1 } as React.CSSProperties} role="radiogroup">
              <button role="radio" aria-checked>{L({ hi: "सुबह · स्कूल", en: "Morning · school" })}</button>
              <button role="radio" aria-checked={false}>{L({ hi: "छुट्टी · घर", en: "Afternoon · home" })}</button>
            </div>
            <div className="dispatch-glow mp-card">
              <section className="dispatch-sheet">
                <div className="dispatch-vehicle mp-in2" style={{ "--i": 0 } as React.CSSProperties}>
                  <span>
                    <BusFront size={19} aria-hidden />
                    {v("RJ04 PA 2231", "92px")}
                  </span>
                  <span className="dispatch-ready">{L({ hi: "शुरू नहीं हुई", en: "Not started" })}</span>
                </div>
                <h2 className="mp-in2" style={{ "--i": 1 } as React.CSSProperties}>
                  {v("Route 1 (Baldev Nagar - Ratan Singh Colony)", "88%")}
                  {!loaded && <i className="mp-bar mp-bar-2" style={{ width: "54%" }} aria-hidden />}
                </h2>
                <div className="dispatch-destination mp-in2" style={{ "--i": 2 } as React.CSSProperties}>
                  <span className="dispatch-route-mark mp-mark" aria-hidden>
                    <span />
                    <i />
                    <span />
                  </span>
                  <div>
                    <p>{L({ hi: "यहाँ से शुरू", en: "Start from" })}</p>
                    <strong>{v(STOPS[0].name, "62%")}</strong>
                    <p className="dispatch-end">
                      {L({ hi: "मंज़िल", en: "Finish at" })} · {v("Adarsh Vidya Mandir", "120px")}
                    </p>
                  </div>
                </div>
                <div className="dispatch-manifest mp-in2" style={{ "--i": 3 } as React.CSSProperties}>
                  <span>
                    <UsersRound size={16} aria-hidden />
                    {v(kids, "18px")} {L({ hi: "बच्चे", en: "children" })}
                  </span>
                  <span>
                    {v(STOPS.length, "8px")} {L({ hi: "स्टॉप", en: "stops" })}
                  </span>
                  <span>
                    {v("8.0", "22px")} km <small>{L({ hi: "रूट", en: "route" })}</small>
                  </span>
                </div>
                <div className="mp-in2" style={{ "--i": 4 } as React.CSSProperties}>
                  <SlideConfirm tone="yellow" sound="start" label={L({ hi: "ट्रिप शुरू करने को स्वाइप करें", en: "Slide to start trip" })} disabled={!loaded} onConfirm={() => true} />
                </div>
              </section>
            </div>
            <section className="dispatch-stops mp-in" style={{ "--i": 4 } as React.CSSProperties}>
              <h2>
                <button type="button" className="dispatch-stops-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)} disabled={!loaded}>
                  <span>{L({ hi: "आज के स्टॉप", en: "Today's stops" })}</span>
                  <ChevronDown size={19} aria-hidden className={open ? "is-open" : ""} />
                </button>
              </h2>
              <div className="dispatch-stops-reveal" data-open={open}>
                <div>
                  <ol>
                    {STOPS.map((s, i) => (
                      <li key={s.name} className="mp-row" style={{ "--i": i } as React.CSSProperties}>
                        <span className="dispatch-stop-number">{i + 1}</span>
                        <div>
                          <strong>{s.name}</strong>
                          <span>
                            {s.kids} {L({ hi: "बच्चे", en: "children" })}
                          </span>
                        </div>
                        <time>{s.time}</time>
                      </li>
                    ))}
                    <li className="dispatch-school mp-row" style={{ "--i": STOPS.length } as React.CSSProperties}>
                      <School size={19} aria-hidden />
                      <div>
                        <strong>Adarsh Vidya Mandir</strong>
                        <span>{L({ hi: "स्कूल पहुँचें", en: "Arrive at school" })}</span>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
      <p className="mp-foot">
        <ArrowRight size={14} aria-hidden /> EN / हि दबाकर भाषा बदलकर देखो
      </p>
    </div>
  );
}
