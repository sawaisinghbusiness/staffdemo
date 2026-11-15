"use client";

/**
 * Unclear payments: fee taken by cheque waits here until the office marks it cleared or bounced.
 * Bounced cancels the receipt, so the fee is due again. (Student profile 360; Codex owns the look.)
 */
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { fullDate, rupees } from "@/lib/format";
import { toast } from "@/lib/toast";
import { Empty, ErrorCard, LineTabs, ListSkeleton, Status } from "@/components/ui";

interface Cheque {
  id: string;
  receiptNo: string;
  studentId: string;
  name: string;
  classSec: string;
  srNo: string;
  amount: number;
  paidOn: string;
  status: "pending" | "cleared" | "bounced";
  chequeNo: string | null;
  bank: string | null;
  chequeDate: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export default function ErpChequesPage() {
  const L = useL();
  const { lang } = useLang();
  const [view, setView] = useState<"pending" | "all">("pending");
  const q = useApi<{ setupNeeded: boolean; items: Cheque[] }>(`/erp/fees/cheques?status=${view}`);
  const [busy, setBusy] = useState("");

  async function act(c: Cheque, what: "clear" | "bounce") {
    let note = "";
    if (what === "bounce") {
      const ok = window.confirm(L({ hi: `${c.name} का ${rupees(c.amount)} का चेक बाउंस? रसीद ${c.receiptNo} रद्द होगी और फ़ीस फिर बाकी हो जाएगी।`, en: `Mark ${c.name}'s ${rupees(c.amount)} cheque bounced? Receipt ${c.receiptNo} will be cancelled and the fee becomes due again.` }));
      if (!ok) return;
      note = window.prompt(L({ hi: "बैंक ने क्या कारण बताया? (वैकल्पिक)", en: "Reason from the bank (optional)" })) || "";
    }
    setBusy(c.id);
    try {
      await api(`/erp/fees/cheques/${c.id}/${what}`, { body: what === "bounce" ? { note } : {} });
      toast(true, what === "clear" ? L({ hi: "चेक क्लियर हो गया।", en: "Cheque cleared." }) : L({ hi: "चेक बाउंस दर्ज, रसीद रद्द।", en: "Cheque bounced; receipt cancelled." }));
      q.reload();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
    } finally {
      setBusy("");
    }
  }

  const items = q.data?.items || [];
  const waiting = items.filter((c) => c.status === "pending");
  const total = waiting.reduce((n, c) => n + c.amount, 0);

  return (
    <div className="animate-rise space-y-4">
      <LineTabs
        label={L({ hi: "चेक", en: "Cheques" })}
        value={view}
        onChange={setView}
        options={[
          { key: "pending", text: L({ hi: "क्लियर होने बाकी", en: "Waiting to clear" }) },
          { key: "all", text: L({ hi: "सभी चेक", en: "All cheques" }) },
        ]}
      />
      {q.data?.setupNeeded ? (
        <Empty>{L({ hi: "यह हिस्सा डेटाबेस अपडेट (student profile 360 SQL) के बाद चालू होगा।", en: "This starts working after the one-time database update (student profile 360 SQL)." })}</Empty>
      ) : !q.data ? (
        q.error && q.error.status !== 401 ? <ErrorCard offline={q.error.status === 0} onRetry={q.reload} /> : <ListSkeleton rows={4} />
      ) : items.length === 0 ? (
        <Empty>{view === "pending" ? L({ hi: "कोई चेक क्लियर होने बाकी नहीं।", en: "No cheques waiting to clear." }) : L({ hi: "अभी कोई चेक नहीं आया।", en: "No cheques yet." })}</Empty>
      ) : (
        <>
          {view === "pending" && <p className="text-[13px] text-ink-500">{L({ hi: `${waiting.length} चेक · ${rupees(total)} क्लियर होना बाकी`, en: `${waiting.length} cheque${waiting.length === 1 ? "" : "s"} · ${rupees(total)} waiting to clear` })}</p>}
          <ul className="row-card !py-1">
            {items.map((c) => (
              <li key={c.id} className="border-b border-ink-100 py-2.5 last:border-0">
                <div className="flex items-center gap-3">
                  <Link href={`/erp/students/detail/?id=${encodeURIComponent(c.studentId)}`} className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{c.name}</span>
                    <span className="block truncate text-[12.5px] text-ink-500">
                      {[c.classSec, c.receiptNo, fullDate(c.paidOn, lang), c.chequeNo ? `${L({ hi: "चेक", en: "Cheque" })} ${c.chequeNo}` : "", c.bank].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                  <span className="tnum text-[15px] font-semibold">{rupees(c.amount)}</span>
                </div>
                {c.status === "pending" ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" className="btn-line" disabled={!!busy} onClick={() => act(c, "clear")}>
                      {L({ hi: "क्लियर हुआ", en: "Cleared" })}
                    </button>
                    <button type="button" className="btn-line !text-rose-700" disabled={!!busy} onClick={() => act(c, "bounce")}>
                      {L({ hi: "बाउंस हुआ", en: "Bounced" })}
                    </button>
                  </div>
                ) : (
                  <p className={clsx("mt-1 text-[12.5px]", c.status === "bounced" ? "text-rose-700" : "text-ink-500")}>
                    <Status tone={c.status === "cleared" ? "ok" : "bad"}>{c.status === "cleared" ? L({ hi: "क्लियर", en: "Cleared" }) : L({ hi: "बाउंस", en: "Bounced" })}</Status>{" "}
                    {[c.updatedAt ? fullDate(c.updatedAt.slice(0, 10), lang) : "", c.updatedBy].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
