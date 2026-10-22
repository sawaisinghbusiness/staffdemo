"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarPlus, CheckCheck, ChevronLeft, Clock3, Phone, School, SendHorizontal, Video, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, useLang, type Lang } from "@/lib/i18n";
import { ampm, clockOf, dayLine, type ChatMessage, type SchoolDay, type Thread } from "@/lib/messages";
import { Avatar, ErrorCard, Skeleton } from "@/components/ui";

/** New messages show without a refresh: the chat is asked again this often while it is on screen. */
const POLL_MS = 3000;

/** One parent conversation, laid out like the parent app's chat, with "send a meeting time" by the reply box. */
export default function MessageChatPage() {
  const L = useL();
  const { lang } = useLang();
  const [chatId, setChatId] = useState("");
  const [data, setData] = useState<Thread>();
  const [error, setError] = useState<ApiError | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [sheet, setSheet] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const count = useRef(0);
  // While a reply is on its way, a poll answer (made before it arrived) must not wipe it off the screen.
  const sending = useRef(false);
  // Bumped on every send, so an older poll that comes back late is thrown away.
  const gen = useRef(0);

  useEffect(() => {
    setChatId(new URLSearchParams(window.location.search).get("id") || "");
  }, []);

  const load = useCallback(async () => {
    if (!chatId) return;
    try {
      const g = gen.current;
      const fresh = await api<Thread>(`/chats/${encodeURIComponent(chatId)}`);
      if (!sending.current && g === gen.current) setData(fresh);
      setError(null);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, "offline");
      if (err.status === 401) window.location.replace("/login/");
      setError(err);
    }
  }, [chatId]);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const n = data?.messages.length || 0;
    if (n !== count.current) end.current?.scrollIntoView({ block: "end", behavior: count.current ? "smooth" : "auto" });
    count.current = n;
  }, [data]);

  async function post(path: string, body: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true);
    setFail("");
    try {
      setData(await api<Thread>(`/chats/${encodeURIComponent(chatId)}${path}`, { body }));
      return true;
    } catch (e: any) {
      setFail(e?.status === 0 ? L({ hi: "इंटरनेट नहीं है। फिर भेजें।", en: "No internet. Try again." }) : e?.message || L({ hi: "नहीं भेज पाए।", en: "Could not send. Try again." }));
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** The reply shows at once (with a clock) and the box empties; if it can't be sent, it comes back. */
  async function send() {
    const msg = text.trim();
    if (!msg || busy) return;
    const tmp: ChatMessage = { id: `tmp-${Date.now()}`, from: "teacher", text: msg, at: new Date().toISOString(), pending: true, meeting: null };
    setData((d) => d && { ...d, messages: [...d.messages, tmp] });
    setText("");
    sending.current = true;
    gen.current++;
    const ok = await post("/send", { text: msg });
    sending.current = false;
    gen.current++;
    if (!ok) {
      setData((d) => d && { ...d, messages: d.messages.filter((m) => m.id !== tmp.id) });
      setText(msg);
    }
  }

  const s = data?.student;
  const sub = s ? [`${L({ hi: "अभिभावक", en: "Parent" })} · ${s.classSec}`, s.rollNo && `${L({ hi: "रोल", en: "Roll" })} ${s.rollNo}`].filter(Boolean).join(" · ") : "";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink-50">
      <header className="pt-safe sticky top-0 z-20 border-b border-ink-100 bg-white">
        <div className="flex h-14 items-center gap-2 pl-1.5 pr-4">
          <Link href="/messages/" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-900 active:bg-ink-100" aria-label={L({ hi: "वापस", en: "Back" })}>
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </Link>
          {s ? (
            <>
              <Avatar name={s.name} url={s.photoUrl} size={36} />
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold leading-tight text-ink-900">{s.name}</p>
                <p className="truncate text-[12.5px] text-ink-500">{sub}</p>
              </div>
            </>
          ) : (
            <Skeleton className="h-9 w-40 rounded-lg" />
          )}
        </div>
      </header>

      <div className="flex-1 px-4 pb-28 pt-3" aria-live="polite">
        {!data ? (
          error ? (
            <ErrorCard offline={error.status === 0} onRetry={load} />
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-16 w-3/4 rounded-2xl" />
              <Skeleton className="ml-auto h-14 w-2/3 rounded-2xl" />
            </div>
          )
        ) : (
          <div className="flex flex-col gap-2">
            {data.messages.map((m, i) => {
              const newDay = i === 0 || new Date(m.at).toDateString() !== new Date(data.messages[i - 1].at).toDateString();
              return (
                <Fragment key={m.id}>
                  {newDay && <p className="self-center pb-0.5 pt-2 text-[12.5px] font-medium text-ink-400">{dayLine(m.at, lang)}</p>}
                  {m.meeting ? <SentTime m={m} lang={lang} /> : <Bubble m={m} lang={lang} />}
                </Fragment>
              );
            })}
          </div>
        )}
        <div ref={end} />
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[560px] border-t border-ink-100 bg-white">
        {fail && (
          <p className="px-4 pt-2 text-[13px] text-rose-600" role="alert">
            {fail}
          </p>
        )}
        <form
          className="flex items-end gap-2 px-3 py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <button type="button" onClick={() => setSheet(true)} disabled={!data} aria-label={L({ hi: "मिलने का समय भेजें", en: "Send a meeting time" })} className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl border border-ink-200 bg-white text-brand-700 disabled:opacity-40">
            <CalendarPlus className="h-[22px] w-[22px]" aria-hidden />
          </button>
          <label htmlFor="reply" className="sr-only">
            {L({ hi: "जवाब", en: "Reply" })}
          </label>
          <textarea
            id="reply"
            rows={1}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            placeholder={L({ hi: "जवाब लिखें", en: "Write a reply" })}
            className="max-h-32 min-h-[46px] flex-1 resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-[11px] text-[16px] leading-snug text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
          <button type="submit" disabled={busy || !text.trim() || !data} aria-label={L({ hi: "भेजें", en: "Send" })} className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl bg-brand-700 text-white transition-opacity disabled:opacity-40">
            <SendHorizontal className="h-5 w-5" aria-hidden />
          </button>
        </form>
      </div>

      {sheet && data && (
        <TimeSheet
          name={data.student.name}
          today={data.today}
          busy={busy}
          onClose={() => setSheet(false)}
          onSend={async (b) => {
            if (await post("/meet", b)) setSheet(false);
          }}
        />
      )}
    </div>
  );
}

function Bubble({ m, lang }: { m: ChatMessage; lang: Lang }) {
  const mine = m.from === "teacher";
  return (
    <div className={mine ? "max-w-[80%] self-end rounded-2xl rounded-br-md border-[1.5px] border-ink-900 bg-brand-700 px-3.5 pb-1.5 pt-2 text-white" : "max-w-[80%] self-start rounded-2xl rounded-bl-md border-[1.5px] border-ink-900 bg-white px-3.5 pb-1.5 pt-2 text-ink-900"}>
      <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.text}</p>
      <p className={clsx("mt-0.5 flex items-center justify-end gap-1 text-[11px]", mine ? "text-white/70" : "text-ink-400")}>
        {clockOf(m.at, lang)}
        {mine && (m.pending ? <Clock3 className="h-3 w-3" aria-label="Sending" /> : <CheckCheck className="h-3.5 w-3.5" aria-hidden />)}
      </p>
    </div>
  );
}

/** A time the teacher sent, with what the family said (the parent app's meeting card, from this side). */
function SentTime({ m, lang }: { m: ChatMessage; lang: Lang }) {
  const L = useL();
  const x = m.meeting!;
  const loc = lang === "hi" ? "hi-IN" : "en-IN";
  const d = new Date(x.date + "T00:00:00");
  const day = `${d.toLocaleDateString(loc, { weekday: "short" })}, ${d.toLocaleDateString(loc, { month: "long" })}`;
  const place = { school: L({ hi: "स्कूल में", en: "In school" }), call: L({ hi: "फ़ोन पर", en: "Phone call" }), online: L({ hi: "ऑनलाइन", en: "Online" }) }[x.place];
  const state =
    x.status === "yes"
      ? { dot: "bg-jade-600", text: "text-jade-700", word: L({ hi: "अभिभावक आएँगे", en: "Parent is coming" }) }
      : x.status === "other"
        ? { dot: "bg-ink-400", text: "text-ink-500", word: L({ hi: "दूसरा समय माँगा", en: "Asked for another time" }) }
        : { dot: "bg-marigold-500", text: "text-marigold-600", word: L({ hi: "जवाब का इंतज़ार", en: "Waiting for the parent" }) };
  return (
    <div className="w-[84%] max-w-[320px] self-end overflow-hidden rounded-2xl border-[1.5px] border-ink-900 bg-white">
      <p className="px-4 pt-3 text-[12.5px] font-semibold text-ink-500">{L({ hi: "मिलने का समय भेजा", en: "Meeting time sent" })}</p>
      <div className="flex items-center gap-3 px-4 pb-3 pt-1">
        <b className="tnum text-[32px] font-bold leading-none text-brand-700">{+x.date.slice(8)}</b>
        <span className="text-[14px] leading-snug text-ink-700">
          {day} · {ampm(x.time)}
          <br />
          <span className="text-ink-500">
            {place} · {x.minutes} {L({ hi: "मिनट", en: "min" })}
          </span>
        </span>
      </div>
      <p className={clsx("flex items-center gap-1.5 border-t border-ink-100 px-4 py-2.5 text-[13.5px] font-medium", state.text)}>
        <span className={clsx("h-2 w-2 rounded-full", state.dot)} aria-hidden />
        {state.word}
      </p>
    </div>
  );
}

const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

/** The next school days (Sundays left out). */
function schoolDays(today: string, n: number) {
  const out: string[] = [];
  for (let i = 0; out.length < n && i < 14; i++) {
    const d = addDays(today, i);
    if (new Date(d + "T00:00:00Z").getUTCDay() !== 0) out.push(d);
  }
  return out;
}

const mins = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Day, time (the teacher's class periods shut) and where. The button repeats the choice in full. */
function TimeSheet({ name, today, busy, onClose, onSend }: { name: string; today: string; busy: boolean; onClose: () => void; onSend: (b: { date: string; time: string; place: string }) => void }) {
  const L = useL();
  const { lang } = useLang();
  const days = schoolDays(today, 6);
  const [date, setDate] = useState(days[0]);
  const [time, setTime] = useState("");
  const [place, setPlace] = useState<"school" | "call" | "online">("school");
  const { data } = useApi<SchoolDay>(`/chats/day?date=${date}`);

  // Each period's start; a break shows its own name. After the last period: three times after school.
  const now = new Date();
  const nowMin = date === today ? now.getHours() * 60 + now.getMinutes() : -1;
  const slots: { time: string; state: "free" | "class" | "break"; label?: string }[] = [];
  if (data) {
    for (const p of data.periods) slots.push({ time: p.start, state: p.state, label: p.state === "break" ? p.label : undefined });
    const last = data.periods.length ? mins(data.periods[data.periods.length - 1].end) : 14 * 60;
    for (const add of [0, 30, 60]) slots.push({ time: hhmm(last + add), state: "free" });
  }
  const open = (s: (typeof slots)[number]) => s.state !== "class" && mins(s.time) > nowMin;

  const dayName = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + "T00:00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", o);
  const PLACES = [
    { k: "school" as const, icon: School, text: L({ hi: "स्कूल", en: "School" }) },
    { k: "call" as const, icon: Phone, text: L({ hi: "फ़ोन", en: "Call" }) },
    { k: "online" as const, icon: Video, text: L({ hi: "ऑनलाइन", en: "Online" }) },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-950/50 animate-fadeIn" role="dialog" aria-modal="true" aria-label={L({ hi: "मिलने का समय भेजें", en: "Send a meeting time" })} onClick={onClose}>
      <div className="pb-safe w-full max-w-[560px] animate-slide-up rounded-t-3xl bg-white text-ink-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 pb-1 pt-4">
          <div>
            <h2 className="text-[19px] font-bold leading-tight">{L({ hi: "मिलने का समय भेजें", en: "Send a meeting time" })}</h2>
            <p className="text-[13.5px] text-ink-500">{L({ hi: `${name} के अभिभावक को · 10 मिनट`, en: `To ${name}'s parent · 10 minutes` })}</p>
          </div>
          <button onClick={onClose} className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-ink-500 active:bg-ink-100" aria-label={L({ hi: "बंद करें", en: "Close" })}>
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 px-5 pb-5 pt-3">
          <div>
            <p className="mb-2 text-[13.5px] font-semibold text-ink-500">{L({ hi: "दिन", en: "Day" })}</p>
            <div className="grid grid-cols-6 gap-1.5">
              {days.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDate(d);
                    setTime("");
                  }}
                  aria-pressed={date === d}
                  className={clsx("flex min-h-[54px] flex-col items-center justify-center rounded-xl border text-[11.5px] font-medium leading-tight", date === d ? "border-brand-700 bg-brand-700 text-white/80" : "border-ink-200 bg-white text-ink-500")}
                >
                  {dayName(d, { weekday: "short" })}
                  <b className={clsx("text-[17px] font-bold", date === d ? "text-white" : "text-ink-900")}>{+d.slice(8)}</b>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13.5px] font-semibold text-ink-500">{L({ hi: "समय", en: "Time" })}</p>
            {!data ? (
              <Skeleton className="h-[104px] w-full rounded-xl" />
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {slots.map((sl) => {
                  const ok = open(sl);
                  return (
                    <button
                      key={sl.time}
                      disabled={!ok}
                      onClick={() => setTime(sl.time)}
                      aria-pressed={time === sl.time}
                      className={clsx(
                        "flex h-[50px] flex-col items-center justify-center rounded-xl border text-[14.5px] font-semibold tabular-nums leading-none",
                        time === sl.time ? "border-brand-700 bg-brand-700 text-white" : ok ? "border-ink-200 bg-white text-ink-900" : "border-transparent bg-ink-100 text-ink-400"
                      )}
                    >
                      {ampm(sl.time).replace(/ (AM|PM)$/, "")}
                      {(sl.state === "class" || sl.label) && <span className="mt-1 text-[10.5px] font-medium">{sl.state === "class" ? L({ hi: "क्लास", en: "Class" }) : sl.label}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-[13.5px] font-semibold text-ink-500">{L({ hi: "कहाँ", en: "Where" })}</p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1">
              {PLACES.map(({ k, icon: Icon, text }) => (
                <button key={k} onClick={() => setPlace(k)} aria-pressed={place === k} className={clsx("flex h-10 items-center justify-center gap-1.5 rounded-lg text-[14px] font-semibold", place === k ? "bg-white text-ink-900 shadow-[0_1px_3px_rgba(15,23,42,.12)]" : "text-ink-500")}>
                  <Icon className="h-4 w-4" aria-hidden />
                  {text}
                </button>
              ))}
            </div>
          </div>

          <button disabled={!time || busy} onClick={() => onSend({ date, time, place })} className="flex h-[52px] w-full items-center justify-center rounded-xl bg-brand-700 text-[15.5px] font-semibold text-white disabled:opacity-40">
            {time ? L({ hi: `भेजें · ${dayName(date, { weekday: "short", day: "numeric", month: "short" })}, ${ampm(time)}`, en: `Send · ${dayName(date, { weekday: "short", day: "numeric", month: "short" })}, ${ampm(time)}` }) : L({ hi: "समय चुनें", en: "Pick a time" })}
          </button>
        </div>
      </div>
    </div>
  );
}
