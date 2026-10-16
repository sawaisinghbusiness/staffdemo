"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, GraduationCap, Phone } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { fullDate, phoneText } from "@/lib/format";
import { toast } from "@/lib/toast";
import { dayIso, enquiryNo, FOLLOW_UP_CHIPS, isOpenEnquiry, STATUS_TEXT, STATUS_TONE, type Enquiry, type EnquiryStatus } from "@/lib/erpEnquiry";
import { Empty, ErrorCard, ListSkeleton, Status } from "@/components/ui";

/** ERP login → one admission enquiry: the ERP's enquiry drawer (status, next call-back, details, follow-up notes, admit). */
export default function ErpEnquiryDetailPage() {
  const L = useL();
  const { lang } = useLang();
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(window.location.search).get("id") || ""), []);
  const { data, error, reload } = useApi<{ data: Enquiry[] }>("/erp/enquiries");
  const [fresh, setFresh] = useState<Enquiry | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const e = fresh || data?.data.find((x) => x.id === id) || null;
  if (!e) {
    if (data && id !== null) return <Empty>{L({ hi: "यह पूछताछ नहीं मिली।", en: "This enquiry was not found." })}</Empty>;
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton rows={4} />;
  }
  const open = isOpenEnquiry(e);

  async function save(key: string, path: string, body: unknown, method?: string) {
    setBusy(key);
    try {
      const res = await api<{ success: boolean; data: Enquiry }>(path, { method, body });
      setFresh(res.data);
      reload();
      return true;
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      return false;
    } finally {
      setBusy(null);
    }
  }
  const patch = (key: string, body: Record<string, unknown>) => save(key, `/erp/enquiries/${e.id}`, body, "PATCH");
  const addNote = async () => {
    if (!note.trim()) return;
    if (await save("note", `/erp/enquiries/${e.id}/notes`, { text: note.trim() })) setNote("");
  };

  const rows: [string, string | null][] = [
    [L({ hi: "पिता", en: "Father" }), e.father_name],
    [L({ hi: "माता", en: "Mother" }), e.mother_name],
    [L({ hi: "मोबाइल", en: "Mobile" }), phoneText(e.mobile)],
    [L({ hi: "दूसरा मोबाइल", en: "Other mobile" }), e.alt_mobile ? phoneText(e.alt_mobile) : null],
    [L({ hi: "इलाका", en: "Area" }), e.area],
    [L({ hi: "अभी का स्कूल", en: "Present school" }), e.previous_school],
    [L({ hi: "लिंग", en: "Gender" }), e.gender === "Male" ? L({ hi: "लड़का", en: "Boy" }) : e.gender === "Female" ? L({ hi: "लड़की", en: "Girl" }) : e.gender],
    [L({ hi: "जन्म तिथि", en: "Date of birth" }), e.dob ? fullDate(e.dob.slice(0, 10), lang) : null],
    [L({ hi: "कैसे पता चला", en: "Heard of us" }), e.source],
    [L({ hi: "किसने लिखा", en: "Recorded by" }), e.created_by_name],
  ];

  return (
    <div className="animate-rise space-y-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-bold">{e.student_name}</p>
          <p className="text-[13px] text-ink-500">
            {enquiryNo(e.enquiry_no)} · {L({ hi: "कक्षा", en: "for" })} {e.class_wanted} · {fullDate(e.created_at.slice(0, 10), lang)}
          </p>
        </div>
        <Status tone={STATUS_TONE[e.status]}>{L(STATUS_TEXT[e.status])}</Status>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <a href={`tel:${e.mobile}`} className="btn-line">
          <Phone className="h-4 w-4" aria-hidden /> {L({ hi: "कॉल करें", en: "Call" })}
        </a>
        {open ? (
          <Link href={`/erp/students/admission/?enquiry=${encodeURIComponent(e.id)}`} className="btn-primary">
            <GraduationCap className="h-4 w-4" aria-hidden /> {L({ hi: "प्रवेश दें", en: "Admit" })}
          </Link>
        ) : (
          <span className="self-center text-center text-[13px] text-ink-500">{e.status === "admitted" ? L({ hi: "प्रवेश हो गया", en: "Admitted" }) : L({ hi: "रुचि नहीं", en: "Not interested" })}</span>
        )}
      </div>

      {e.status !== "admitted" && (
        <section className="space-y-2">
          <h2 className="mlabel">{L({ hi: "स्थिति", en: "Status" })}</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-2" role="radiogroup" aria-label={L({ hi: "स्थिति", en: "Status" })}>
            {(["new", "visited", "dropped"] as EnquiryStatus[]).map((s) => (
              <label key={s} className="radio">
                <input type="radio" name="enq-status" checked={e.status === s} disabled={!!busy} onChange={() => patch("status", { status: s, ...(s === "dropped" ? { next_follow_up: null } : {}) })} />
                {L(STATUS_TEXT[s])}
              </label>
            ))}
          </div>
        </section>
      )}

      {open && (
        <section className="space-y-2">
          <h2 className="mlabel">{L({ hi: "अगली बार कब कॉल करें", en: "Next follow-up" })}</h2>
          <label className="field-box">
            <small>{L({ hi: "तारीख", en: "Date" })}</small>
            <input id="enq-next" type="date" value={e.next_follow_up || ""} onChange={(ev) => patch("date", { next_follow_up: ev.target.value || null })} />
            <CalendarDays aria-hidden />
          </label>
          <div className="grid grid-cols-3 gap-2">
            {FOLLOW_UP_CHIPS.map((c) => (
              <button key={c.days} type="button" disabled={!!busy} onClick={() => patch("date", { next_follow_up: dayIso(c.days) })} className={clsx("btn-line min-h-[40px] px-2 text-[13.5px]", e.next_follow_up === dayIso(c.days) && "!border-brand-600")}>
                {L(c.text)}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-1">
        <h2 className="mlabel">{L({ hi: "जानकारी", en: "Details" })}</h2>
        <dl className="kv">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v || <span className="font-normal text-ink-400">—</span>}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="mlabel">{L({ hi: "बातचीत के नोट", en: "Follow-up notes" })}</h2>
        <textarea id="enq-note" value={note} onChange={(ev) => setNote(ev.target.value)} rows={2} className="textarea-box" placeholder={L({ hi: "क्या हुआ? जैसे: कॉल किया, पिता शनिवार को कागज़ लेकर आएँगे", en: "What happened? e.g. Called, father will visit on Saturday with documents" })} />
        <button type="button" onClick={addNote} disabled={!note.trim() || !!busy} className="btn-line w-full">
          {busy === "note" ? "…" : L({ hi: "नोट जोड़ें", en: "Add note" })}
        </button>
        {e.notes.length === 0 ? (
          <p className="text-[14px] text-ink-500">{L({ hi: "अभी कोई नोट नहीं।", en: "No notes yet." })}</p>
        ) : (
          <ol className="relative ml-1.5 space-y-4 border-l border-ink-200 pl-4 pt-1">
            {[...e.notes].reverse().map((n, i) => (
              <li key={i} className="relative">
                <span aria-hidden className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-600" />
                <p className="text-[15px] text-ink-900">{n.text}</p>
                <p className="mt-0.5 text-[12.5px] text-ink-500">
                  {new Date(n.at).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })} · {n.by}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
