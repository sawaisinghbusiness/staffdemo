"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight, Search, X } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { dayIso, enquiryNo, followUp, isOpenEnquiry, STATUS_TEXT, STATUS_TONE, type Enquiry } from "@/lib/erpEnquiry";
import { Empty, ErrorCard, LineTabs, ListSkeleton, Status } from "@/components/ui";

type View = "due" | "open" | "admitted" | "dropped";

/** ERP login → Students → Admission enquiries: the ERP's enquiries list (views, search, call-back date). */
export default function ErpEnquiriesPage() {
  const L = useL();
  const { lang } = useLang();
  const { data, error, reload } = useApi<{ data: Enquiry[] }>("/erp/enquiries");
  const [view, setView] = useState<View>("open");
  const [q, setQ] = useState("");
  const all = useMemo(() => data?.data || [], [data]);

  const counts = useMemo(() => {
    const today = dayIso(0);
    const open = all.filter(isOpenEnquiry);
    return {
      due: open.filter((e) => e.next_follow_up && e.next_follow_up <= today).length,
      open: open.length,
      admitted: all.filter((e) => e.status === "admitted").length,
      dropped: all.filter((e) => e.status === "dropped").length,
    };
  }, [all]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const today = dayIso(0);
    return all
      .filter((e) => {
        if (view === "open" && !isOpenEnquiry(e)) return false;
        if (view === "due" && !(isOpenEnquiry(e) && e.next_follow_up && e.next_follow_up <= today)) return false;
        if (view === "admitted" && e.status !== "admitted") return false;
        if (view === "dropped" && e.status !== "dropped") return false;
        if (!term) return true;
        return [e.student_name, e.father_name, e.mother_name, e.mobile, e.area, enquiryNo(e.enquiry_no)].some((v) => (v || "").toLowerCase().includes(term));
      })
      .sort((a, b) => (view === "open" || view === "due" ? (a.next_follow_up || "9999").localeCompare(b.next_follow_up || "9999") : b.created_at.localeCompare(a.created_at)));
  }, [all, view, q]);

  const n = (k: number) => (data ? ` ${k}` : "");

  return (
    <div className="animate-rise space-y-3">
      <LineTabs
        label={L({ hi: "पूछताछ", en: "Enquiries" })}
        value={view}
        onChange={setView}
        options={[
          { key: "due", text: `${L({ hi: "आज कॉल", en: "Call back" })}${n(counts.due)}` },
          { key: "open", text: `${L({ hi: "खुली", en: "Open" })}${n(counts.open)}` },
          { key: "admitted", text: `${L({ hi: "प्रवेश", en: "Admitted" })}${n(counts.admitted)}` },
          { key: "dropped", text: `${L({ hi: "रुचि नहीं", en: "Dropped" })}${n(counts.dropped)}` },
        ]}
      />

      <label className="field-box min-h-[48px]">
        <Search aria-hidden />
        <input id="erp-enq-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "बच्चा, माता-पिता, मोबाइल या इलाका", en: "Child, parent, mobile or area" })} enterKeyHint="search" autoComplete="off" />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label={L({ hi: "खोज हटाएँ", en: "Clear search" })} className="-mr-2 grid h-10 w-10 shrink-0 place-items-center text-ink-400">
            <X className="h-[18px] w-[18px]" aria-hidden />
          </button>
        )}
      </label>

      {!data ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={5} />
      ) : shown.length === 0 ? (
        <Empty>
          {all.length
            ? L({ hi: "यहाँ कुछ नहीं। दूसरा टैब या खोज देखें।", en: "Nothing here. Try another tab or search." })
            : L({ hi: "अभी कोई पूछताछ नहीं। माता-पिता प्रवेश के बारे में पूछें तो ऊपर + से लिखें, ताकि कॉल करना न भूलें।", en: "No enquiry yet. When a parent asks about admission, add it with + above so nobody forgets to call back." })}
        </Empty>
      ) : (
        <ul>
          {shown.map((e) => {
            const f = followUp(e, lang);
            return (
              <li key={e.id}>
                <Link href={`/erp/students/enquiries/detail/?id=${encodeURIComponent(e.id)}`} className="flex min-h-[64px] items-center gap-3 border-b border-ink-100 py-2 active:bg-ink-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-medium">{e.student_name}</span>
                    <span className="block truncate text-[12.5px] text-ink-400">
                      {L({ hi: "कक्षा", en: "for" })} {e.class_wanted} · {e.father_name || e.mother_name || e.mobile} · {enquiryNo(e.enquiry_no)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <Status tone={STATUS_TONE[e.status]}>{L(STATUS_TEXT[e.status])}</Status>
                    {f.text && <span className={clsx("text-[12px]", f.tone === "late" ? "font-semibold text-rose-600" : f.tone === "today" ? "font-semibold text-marigold-700" : "text-ink-500")}>{f.text}</span>}
                  </span>
                  <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-300" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
