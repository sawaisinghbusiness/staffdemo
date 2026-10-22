"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarCheck, CalendarX2, ChevronLeft, Megaphone, Mic, Plus, SendHorizontal, Table2, UserX, X, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useL, useLang, type Bi } from "@/lib/i18n";

type Turn = { role: "user" | "assistant"; content: string };
type Question = { text: Bi; icon: LucideIcon };

/** The first four are the big buttons on the opening screen; "+" lists them all. Teachers get class questions. */
const TEACHER: Question[] = [
  { text: { hi: "आज कौन absent है?", en: "Who is absent today?" }, icon: UserX },
  { text: { hi: "मेरा आज का टाइम टेबल?", en: "My timetable today?" }, icon: Table2 },
  { text: { hi: "छुट्टी की अर्ज़ियाँ?", en: "Leave requests waiting?" }, icon: CalendarX2 },
  { text: { hi: "मेरी कितनी छुट्टी बची?", en: "How much leave do I have?" }, icon: CalendarCheck },
  { text: { hi: "नई सूचनाएँ?", en: "Any new notices?" }, icon: Megaphone },
];
const OTHER: Question[] = [
  { text: { hi: "मेरी इस महीने की हाज़िरी?", en: "My attendance this month?" }, icon: CalendarCheck },
  { text: { hi: "मेरी कितनी छुट्टी बची?", en: "How much leave do I have?" }, icon: CalendarX2 },
  { text: { hi: "नई सूचनाएँ?", en: "Any new notices?" }, icon: Megaphone },
];

/** The browser's own speech-to-text (Chrome on Android has it); absent elsewhere, so the mic hides. */
const speechApi = () => (typeof window === "undefined" ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null);

/** School Sahayak's face: a purple orb with two eyes that floats and blinks. */
function Orb({ size, still }: { size: number; still?: boolean }) {
  const eyeW = Math.round(size * 0.107);
  const eyeH = Math.round(size * 0.227);
  return (
    <span className={clsx("sahayak-orb flex shrink-0 items-center justify-center rounded-full", !still && "sahayak-float")} style={{ width: size, height: size, gap: Math.round(size * 0.147) }} aria-hidden>
      <span className="sahayak-eye rounded-full bg-white" style={{ width: eyeW, height: eyeH }} />
      <span className="sahayak-eye rounded-full bg-white" style={{ width: eyeW, height: eyeH }} />
    </span>
  );
}

/**
 * School Sahayak in the staff app: questions about their own day, classes and leave, answered only
 * from what this staff member can already see. Same orb design as the parent app's (2026-10-22).
 */
export default function AssistantPage() {
  const { me } = useStaff();
  const L = useL();
  const { lang } = useLang();
  const QUESTIONS = me?.role === "teacher" ? TEACHER : OTHER;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [list, setList] = useState(false);
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const rec = useRef<any>(null);
  const first = me?.name.split(" ")[0] || "";

  useEffect(() => setCanSpeak(!!speechApi()), []);

  // The server gets this person's data ready now, so the first answer is quick.
  useEffect(() => {
    api("/assistant/warm", { body: {} }).catch(() => {});
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns, busy]);

  useEffect(() => () => rec.current?.abort?.(), []);

  async function ask(q: string) {
    const msg = q.trim();
    if (!msg || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: msg }];
    setTurns(next);
    setText("");
    setFail("");
    setList(false);
    setBusy(true);
    try {
      const r = await api<{ reply: string }>("/assistant", { body: { messages: next } });
      setTurns([...next, { role: "assistant", content: r.reply }]);
    } catch (e: any) {
      // The question goes back in the box so it can be sent again.
      setTurns(turns);
      setText(msg);
      setFail(e?.status === 0 ? L({ hi: "इंटरनेट नहीं है। फिर भेजें।", en: "No internet. Try again." }) : e?.message || L({ hi: "जवाब नहीं आया। फिर भेजें।", en: "No answer came. Try again." }));
    } finally {
      setBusy(false);
    }
  }

  /** Speak the question: what is heard goes straight in as the question. */
  function listen() {
    const Api = speechApi();
    if (!Api || busy) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new Api();
    r.lang = lang === "hi" ? "hi-IN" : "en-IN";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e: any) => {
      const said = String(e.results?.[0]?.[0]?.transcript || "");
      if (said) ask(said);
    };
    r.onerror = (e: any) => {
      if (e?.error === "not-allowed") setFail(L({ hi: "माइक की इजाज़त दें, फिर बोलें।", en: "Allow the microphone, then speak." }));
    };
    r.onend = () => setListening(false);
    rec.current = r;
    setFail("");
    setListening(true);
    r.start();
  }

  const empty = turns.length === 0;

  return (
    <div className="sahayak-bg relative flex min-h-[100dvh] flex-col overflow-hidden text-[#2A2350]">
      {/* Soft round shapes behind everything, as in the reference. */}
      <span aria-hidden className="pointer-events-none absolute -left-24 top-[420px] h-64 w-64 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff_0%,#E9DDFF_55%,#D9C8FF_100%)] opacity-70" />
      <span aria-hidden className="pointer-events-none absolute -right-16 top-24 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff_0%,#FBDDF2_55%,#F5C6E8_100%)] opacity-70" />

      <header className="pt-safe sticky top-0 z-20">
        <div className="flex h-14 items-center gap-2.5 px-2">
          <Link href="/" className="grid h-11 w-11 shrink-0 place-items-center rounded-full active:bg-white/60" aria-label={L({ hi: "वापस", en: "Back" })}>
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </Link>
          {empty ? (
            <p className="flex-1 pr-11 text-center text-[15px] font-semibold text-[#5A5380]">{L({ hi: "स्कूल सहायक", en: "School Sahayak" })}</p>
          ) : (
            <>
              <Orb size={36} still />
              <div className="min-w-0">
                <p className="text-[16px] font-semibold leading-tight">{L({ hi: "स्कूल सहायक", en: "School Sahayak" })}</p>
                <p className="truncate text-[12.5px] text-[#6B6492]">{L({ hi: "आपकी क्लास और स्कूल", en: "Your classes and school" })}</p>
              </div>
            </>
          )}
        </div>
      </header>

      {empty ? (
        <div className="relative flex flex-1 flex-col px-4 pb-40">
          <div className="mt-4 text-center">
            <p className="text-[26px] font-semibold leading-tight">{first ? `Hello, ${first}!` : "Hello!"}</p>
            <p className="mt-1 text-[21px] font-medium leading-snug text-[#3E3670]">{L({ hi: "आज क्या जानना है?", en: "What would you like to know?" })}</p>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6">
            <Orb size={150} />
            <span aria-hidden className="sahayak-shadow h-3.5 w-28 rounded-full bg-[#6A45E0]/20" />
            <p className="max-w-[270px] text-center text-[14px] leading-snug text-[#5A5380]">
              {L({ hi: "हाज़िरी, टाइम टेबल, छुट्टी या सूचना के बारे में पूछें – हिंदी या English में।", en: "Ask about attendance, timetable, leave or notices – in Hindi or English." })}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {QUESTIONS.slice(0, 4).map(({ text: q, icon: Icon }) => (
              <button key={q.en} type="button" disabled={!me} onClick={() => ask(L(q))} className="flex min-h-[48px] items-center gap-2 rounded-[14px] border border-[#E3DCFA] bg-white/85 px-3 py-2 text-left text-[14px] font-medium leading-tight active:bg-white disabled:opacity-50">
                <Icon className="h-[18px] w-[18px] shrink-0 text-[#6A45E0]" strokeWidth={2} aria-hidden />
                {L(q)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col gap-3 px-4 pb-44 pt-2" aria-live="polite">
          {turns.map((t, i) =>
            t.role === "user" ? (
              <p key={i} className="max-w-[78%] self-end whitespace-pre-wrap break-words rounded-[18px] rounded-br-md bg-[#6A45E0] px-3.5 py-2.5 text-[15px] leading-snug text-white">
                {t.content}
              </p>
            ) : (
              <p key={i} className="max-w-[86%] self-start whitespace-pre-wrap break-words rounded-[18px] rounded-bl-md border border-[#E8E2FB] bg-white/90 px-3.5 py-2.5 text-[15px] leading-relaxed">
                {t.content}
              </p>
            )
          )}
          {busy && (
            <p className="flex items-center gap-1.5 self-start rounded-[18px] rounded-bl-md border border-[#E8E2FB] bg-white/90 px-4 py-3.5" aria-label={L({ hi: "जवाब आ रहा है", en: "Answering" })}>
              {["#B9A8F2", "#9B84EC", "#6A45E0"].map((c, k) => (
                <span key={c} className="h-[7px] w-[7px] animate-pulse rounded-full" style={{ background: c, animationDelay: `${k * 200}ms` }} aria-hidden />
              ))}
            </p>
          )}
          <div ref={end} />
        </div>
      )}

      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[560px] px-4 pb-3 pt-2">
        {list && (
          <div className="mb-2.5 overflow-hidden rounded-2xl border border-[#E3DCFA] bg-white shadow-[0_8px_24px_rgba(42,35,80,0.12)]" role="menu">
            <div className="flex items-center justify-between px-4 pb-1 pt-3">
              <p className="text-[13px] font-semibold text-[#6B6492]">{L({ hi: "ये पूछ सकते हैं", en: "You can ask" })}</p>
              <button type="button" onClick={() => setList(false)} className="grid h-9 w-9 place-items-center rounded-full active:bg-[#F1ECFF]" aria-label={L({ hi: "बंद करें", en: "Close" })}>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {QUESTIONS.map(({ text: q, icon: Icon }) => (
              <button key={q.en} type="button" role="menuitem" disabled={busy} onClick={() => ask(L(q))} className="flex min-h-[48px] w-full items-center gap-3 border-t border-[#F1ECFF] px-4 text-left text-[15px] active:bg-[#F7F4FF] disabled:opacity-50">
                <Icon className="h-[18px] w-[18px] shrink-0 text-[#6A45E0]" aria-hidden />
                {L(q)}
              </button>
            ))}
          </div>
        )}
        {!empty && !list && (
          <div className="no-scrollbar -mx-4 mb-2.5 flex gap-2 overflow-x-auto px-4">
            {QUESTIONS.map((q) => (
              <button key={q.text.en} type="button" disabled={busy} onClick={() => ask(L(q.text))} className="h-10 shrink-0 rounded-xl border border-[#E3DCFA] bg-white/85 px-3 text-[14px] font-medium active:bg-white disabled:opacity-50">
                {L(q.text)}
              </button>
            ))}
          </div>
        )}
        {fail && (
          <p className="pb-2 text-[13px] text-rose-600" role="alert">
            {fail}
          </p>
        )}
        <form
          className="flex items-center gap-2 rounded-[28px] border border-[#E3DCFA] bg-white/95 py-1.5 pl-2 pr-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            ask(text);
          }}
        >
          <button type="button" onClick={() => setList((v) => !v)} aria-expanded={list} aria-label={L({ hi: "सवालों की सूची", en: "List of questions" })} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F1ECFF] text-[#6A45E0] active:bg-[#E6DEFF]">
            <Plus className={clsx("h-[18px] w-[18px] transition-transform duration-200", list && "rotate-45")} strokeWidth={2.2} aria-hidden />
          </button>
          <label htmlFor="ask" className="sr-only">
            {L({ hi: "सवाल", en: "Question" })}
          </label>
          <input
            id="ask"
            value={text}
            maxLength={1000}
            autoComplete="off"
            onChange={(e) => setText(e.target.value)}
            placeholder={listening ? L({ hi: "सुन रहे हैं… बोलिए", en: "Listening… speak now" }) : L({ hi: "कुछ भी पूछें…", en: "Ask anything…" })}
            className="h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#8A84A8]"
          />
          {text.trim() || !canSpeak ? (
            <button type="submit" disabled={busy || !text.trim()} aria-label={L({ hi: "भेजें", en: "Send" })} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#6A45E0] text-white transition-opacity disabled:opacity-40">
              <SendHorizontal className="h-5 w-5" aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={listen} disabled={busy} aria-pressed={listening} aria-label={listening ? L({ hi: "सुनना बंद करें", en: "Stop listening" }) : L({ hi: "बोलकर पूछें", en: "Ask by speaking" })} className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition-colors disabled:opacity-40", listening ? "animate-pulse bg-rose-500" : "bg-[#6A45E0]")}>
              <Mic className="h-5 w-5" aria-hidden />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
