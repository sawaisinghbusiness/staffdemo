"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { ChevronDown, ChevronRight, Clock3, MessageCircle, Phone } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { fullDate, num, phoneText } from "@/lib/format";
import { Avatar, Empty, ErrorCard, ListSkeleton } from "@/components/ui";

interface Detail {
  id: string;
  name: string;
  rollNo: string;
  classSec: string;
  srNo: string;
  photoUrl: string | null;
  dob: string | null;
  fatherName: string;
  parentPhone: string | null;
  address: string;
  motherName?: string;
  gender?: string;
  bloodGroup?: string;
  healthNotes?: string;
  bus?: string;
  attendancePct: number | null;
  absentDays?: number;
  avgPct: number | null;
  siblings?: { id: string; name: string; classSec: string; rollNo: string; photoUrl: string | null; mine: boolean }[];
  exams: { id: string; title: string; date: string; total: number; outOf: number; subjects: { subject: string; marks: number | null; max: number }[] }[];
}

/**
 * One student (user's approved preview, 2026-10-26): who, call/WhatsApp the parent, attendance and marks at a glance,
 * the important details, brothers and sisters, then exam results. Fees are never shown to teachers.
 */
export default function StudentDetailPage() {
  const L = useL();
  const { lang } = useLang();
  const [id, setId] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(window.location.search).get("id") || ""), []);
  const { data, error, reload } = useApi<Detail>(id ? `/students/detail?id=${encodeURIComponent(id)}` : null);

  if (!data) {
    if (id === "" || error?.status === 404) return <Empty>{L({ hi: "यह बच्चा नहीं मिला।", en: "This student was not found." })}</Empty>;
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} slow={error.message === "timeout"} onRetry={reload} />;
    return <ListSkeleton rows={4} />;
  }

  const details: [string, string, boolean?][] = [
    [L({ hi: "पिता", en: "Father" }), data.fatherName],
    [L({ hi: "माँ", en: "Mother" }), data.motherName || ""],
    [L({ hi: "मोबाइल", en: "Mobile" }), data.parentPhone ? phoneText(data.parentPhone) : ""],
    [L({ hi: "जन्म तिथि", en: "Date of birth" }), data.dob ? fullDate(data.dob, lang) : ""],
    [L({ hi: "ब्लड ग्रुप", en: "Blood group" }), data.bloodGroup || ""],
    [L({ hi: "बस", en: "Bus" }), data.bus || ""],
    [L({ hi: "सेहत", en: "Health" }), data.healthNotes || "", true],
    [L({ hi: "पता", en: "Address" }), data.address, true],
  ].filter(([, v]) => v) as [string, string, boolean?][];
  const tel = (data.parentPhone || "").replace(/\D/g, "").slice(-10);
  const wa = /^[6-9]\d{9}$/.test(tel) ? `https://wa.me/91${tel}` : "";

  return (
    <div className="animate-rise space-y-3 pb-4">
      <section className="rounded-xl border border-ink-100 bg-white p-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={data.name} url={data.photoUrl} size={60} />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold">{data.name}</p>
            <p className="text-[13.5px] text-ink-600">
              {data.classSec} · {L({ hi: "रोल", en: "Roll" })} {data.rollNo || "—"}
            </p>
            <p className="text-[12.5px] text-ink-500">{data.srNo}</p>
          </div>
        </div>
        {tel && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={`tel:${tel}`} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-[10px] border border-ink-200 text-[14px] font-semibold active:bg-ink-50">
              <Phone className="h-4 w-4" aria-hidden /> {L({ hi: "कॉल करें", en: "Call parent" })}
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-[10px] border border-ink-200 text-[14px] font-semibold active:bg-ink-50">
                <MessageCircle className="h-4 w-4 text-jade-700" aria-hidden /> WhatsApp
              </a>
            )}
          </div>
        )}
      </section>

      <section className="grid grid-cols-3 rounded-xl border border-ink-100 bg-white py-3 text-center">
        <span>
          <b className="tnum block text-[20px] font-semibold">{data.attendancePct == null ? "—" : `${num(data.attendancePct)}%`}</b>
          <span className="text-[12px] text-ink-600">{L({ hi: "हाज़िरी", en: "Attendance" })}</span>
        </span>
        <span className="border-x border-ink-100">
          <b className="tnum block text-[20px] font-semibold">{data.absentDays ?? "—"}</b>
          <span className="text-[12px] text-ink-600">{L({ hi: "अनुपस्थित दिन", en: "Absent days" })}</span>
        </span>
        <span>
          <b className="tnum block text-[20px] font-semibold">{data.avgPct == null ? "—" : `${num(data.avgPct)}%`}</b>
          <span className="text-[12px] text-ink-600">{L({ hi: "औसत अंक", en: "Avg. marks" })}</span>
        </span>
      </section>

      {details.length > 0 && (
        <section>
          <h2 className="mx-1 mb-1.5 teacher-section-heading">{L({ hi: "ज़रूरी जानकारी", en: "Important details" })}</h2>
          <dl className="grid grid-cols-2 rounded-xl border border-ink-100 bg-white pl-3.5">
            {details.map(([k, v, wide]) => (
              <div key={k} className={clsx("border-b border-ink-100 py-2 pr-3 last:border-b-0", wide && "col-span-2")}>
                <dt className="text-[12px] text-ink-500">{k}</dt>
                <dd className="text-[14.5px] text-ink-900">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {!!data.siblings?.length && (
        <section>
          <h2 className="mx-1 mb-1.5 teacher-section-heading">{L({ hi: "भाई-बहन", en: "Brothers & sisters" })}</h2>
          <ul className="rounded-xl border border-ink-100 bg-white pl-3.5">
            {data.siblings.map((b) => {
              const inner = (
                <>
                  <Avatar name={b.name} url={b.photoUrl} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">{b.name}</span>
                    <span className="block text-[12.5px] text-ink-500">
                      {b.classSec}
                      {b.rollNo ? ` · ${L({ hi: "रोल", en: "Roll" })} ${b.rollNo}` : ""}
                    </span>
                  </span>
                  {b.mine && <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-400" aria-hidden />}
                </>
              );
              return (
                <li key={b.id} className="border-b border-ink-100 last:border-b-0">
                  {b.mine ? (
                    <Link href={`/students/detail/?id=${encodeURIComponent(b.id)}`} className="flex min-h-[54px] items-center gap-2.5 pr-3 active:bg-ink-50">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex min-h-[54px] items-center gap-2.5 pr-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="mx-1 teacher-section-heading">{L({ hi: "परीक्षा के अंक", en: "Exam results" })}</h2>
        {data.exams.length === 0 ? (
          <Empty>{L({ hi: "अभी कोई अंक नहीं।", en: "No marks yet." })}</Empty>
        ) : (
          <ul className="space-y-2">
            {data.exams.map((e) => {
              const isOpen = open === e.id;
              return (
                <li key={e.id} className="glass-line">
                  <button onClick={() => setOpen(isOpen ? null : e.id)} aria-expanded={isOpen} className="flex min-h-[60px] w-full items-center gap-3 px-3.5 py-2.5 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold">{e.title}</span>
                      <span className="meta mt-0.5">
                        <span>
                          <Clock3 aria-hidden />
                          {fullDate(e.date, lang)}
                        </span>
                        <span className="tnum">
                          {num(e.total)}/{e.outOf}
                        </span>
                      </span>
                    </span>
                    <ChevronDown className={clsx("h-5 w-5 shrink-0 text-ink-400 transition", isOpen && "rotate-180")} aria-hidden />
                  </button>
                  {isOpen && (
                    <dl className="kv tnum animate-fadeIn border-t border-ink-100 px-3.5 pb-1">
                      {e.subjects.map((s) => (
                        <div key={s.subject}>
                          <dt>{s.subject}</dt>
                          <dd>{s.marks == null ? "—" : `${num(s.marks)}/${s.max}`}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
