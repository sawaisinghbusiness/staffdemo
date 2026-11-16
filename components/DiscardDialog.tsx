"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useL } from "@/lib/i18n";
import { useDialog } from "@/lib/useDialog";
import "./discard-dialog.css";

const DiscardContext = createContext<() => Promise<boolean>>(async () => false);
export const useDiscardDialog = () => useContext(DiscardContext);

export function DiscardDialogProvider({ children }: { children: ReactNode }) {
  const L = useL();
  const [open, setOpen] = useState(false);
  const resolve = useRef<((answer: boolean) => void) | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const finish = useCallback((answer: boolean) => {
    const pending = resolve.current;
    resolve.current = null;
    setOpen(false);
    pending?.(answer);
  }, []);
  const ask = useCallback(() => {
    if (resolve.current) return Promise.resolve(false);
    return new Promise<boolean>(answer => { resolve.current = answer; setOpen(true); });
  }, []);
  useDialog(open, panel, () => finish(false));
  useEffect(() => { if (open) keep.current?.focus(); }, [open]);
  useEffect(() => () => { resolve.current?.(false); resolve.current = null; }, []);
  const value = useMemo(() => ask, [ask]);
  return <DiscardContext.Provider value={value}>
    {children}
    {open && createPortal(<div className="discard-dialog-backdrop" data-discard-dialog onClick={e => { if (e.target === e.currentTarget) finish(false); }}>
      <div ref={panel} className="discard-dialog" role="alertdialog" aria-modal="true" aria-labelledby="discard-dialog-title" aria-describedby="discard-dialog-description" tabIndex={-1}>
        <button type="button" className="discard-dialog-close" aria-label={L({ hi: "वापस एडिट करें", en: "Keep editing" })} onClick={() => finish(false)}><X size={20} aria-hidden /></button>
        <h2 id="discard-dialog-title">{L({ hi: "बदलाव सेव नहीं हुए हैं", en: "Leave without saving?" })}</h2>
        <p id="discard-dialog-description">{L({ hi: "अभी बाहर जाने पर आपके किए हुए बदलाव हट जाएँगे।", en: "Your changes haven’t been saved. If you leave now, those changes will be lost." })}</p>
        <div className="discard-dialog-actions">
          <button ref={keep} type="button" className="discard-dialog-keep" onClick={() => finish(false)}>{L({ hi: "वापस एडिट करें", en: "Keep editing" })}</button>
          <button type="button" className="discard-dialog-leave" onClick={() => finish(true)}>{L({ hi: "बिना सेव किए छोड़ें", en: "Leave without saving" })}</button>
        </div>
      </div>
    </div>, document.body)}
  </DiscardContext.Provider>;
}
