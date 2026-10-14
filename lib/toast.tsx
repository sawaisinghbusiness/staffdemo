"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { CircleAlert, CircleCheck, X } from "lucide-react";

/**
 * In-app notifications: one card slides down from the top for a save or an error, then goes away
 * by itself (the user's ask, 2026-10-14: every save or error in the app shows this way).
 * Call `toast(ok, text)` from anywhere; <Toaster /> in the root layout draws it.
 */
type Note = { id: number; ok: boolean; text: string };
let listen: ((n: Note) => void) | null = null;
let seq = 0;

export function toast(ok: boolean, text: string) {
  if (text) listen?.({ id: ++seq, ok, text });
}

/** Drop-in for the old inline `msg` state: setMsg({ ok, text }) now shows a top notification. */
export function useToastMsg() {
  return useCallback((m: { ok: boolean; text: string } | string | null) => {
    if (!m) return;
    if (typeof m === "string") toast(false, m);
    else toast(m.ok, m.text);
  }, []);
}

export function Toaster() {
  const [note, setNote] = useState<Note | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const close = useCallback(() => {
    setLeaving(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 220);
  }, []);

  useEffect(() => {
    listen = (n) => {
      clearTimeout(timer.current);
      setLeaving(false);
      setNote(n);
      // Errors stay a little longer so there is time to read them.
      timer.current = setTimeout(close, n.ok ? 2800 : 4500);
    };
    return () => {
      listen = null;
      clearTimeout(timer.current);
    };
  }, [close]);

  if (!note) return null;
  const Icon = note.ok ? CircleCheck : CircleAlert;
  return (
    <div className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto flex max-w-[560px] justify-center px-3">
      <div
        key={note.id}
        role={note.ok ? "status" : "alert"}
        className={clsx(
          "toast-card pointer-events-auto mt-3 flex w-full items-start gap-3 rounded-2xl border-[1.5px] border-ink-900 bg-white px-3.5 py-3 shadow-[0_10px_30px_rgba(16,24,40,0.16)]",
          leaving && "toast-out"
        )}
      >
        <span className={clsx("mt-px grid h-7 w-7 shrink-0 place-items-center rounded-full text-white", note.ok ? "bg-[#16a34a]" : "bg-[#dc2626]")}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden />
        </span>
        <p className="min-w-0 flex-1 pt-0.5 text-[14.5px] font-medium leading-snug text-ink-900">{note.text}</p>
        <button type="button" onClick={close} aria-label="Close" className="-mr-1.5 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-500 active:bg-ink-100">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
