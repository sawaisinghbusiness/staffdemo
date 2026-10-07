"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronDown, Clock3, Phone } from "lucide-react";
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
  attendancePct: number | null;
  avgPct: number | null;
  exams: { id: string; title: string; date: string; total: number; outOf: number; subjects: { subject: string; marks: number | null; max: number }[] }[];
}

/** One student: attendance and marks only. Fees are never shown to teachers. */
export default function StudentDetailPage() {
  const L = useL();
  const { lang } = useLang();
  const [id, setId] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(window.location.search).get("id") || ""), []);
  const { data, error, reload } = useApi<Detail>(id ? `/students/detail?id=${encodeURIComponent(id)}` : null);

  if (!data) {
    if (error?.status === 404) return <Empty>{L({ hi: "यह बच्चा नहीं मिला।", en: "This student was not found." })}</Empty>;
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton rows={4} />;
  }

  const rows: [string, string][] = [
    [L({ hi: "जन्म तिथि", en: "Date of birth" }), data.dob ? fullDate(data.dob, lang) : ""],
    [L({ hi: "पिता", en: "Father" }), data.fatherName],
    [L({ hi: "मोबाइल", en: "Mobile" }), data.parentPhone ? phoneText(data.parentPhone) : ""],
    [L({ hi: "पता", en: "Address" }), data.address],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="animate-rise space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={data.name} url={data.photoUrl} size={56} />
        <div className="min-w-0">
          <p className="truncate text-[18px] font-bold">{data.name}</p>
          <p className="text-[13px] text-ink-500">
            {L({ hi: "रोल", en: "Roll" })} {data.rollNo} · {data.classSec} · {data.srNo}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-jade-50 px-3.5 py-2.5">
          <p className="text-[12px] text-ink-500">{L({ hi: "इस सत्र हाज़िरी", en: "Attendance this session" })}</p>
          <p className="tnum text-[22px] font-extrabold">{data.attendancePct == null ? "—" : `${num(data.attendancePct)}%`}</p>
        </div>
        <div className="rounded-2xl bg-brand-50 px-3.5 py-2.5">
          <p className="text-[12px] text-ink-500">{L({ hi: "औसत अंक", en: "Average marks" })}</p>
          <p className="tnum text-[22px] font-extrabold">{data.avgPct == null ? "—" : `${num(data.avgPct)}%`}</p>
        </div>
      </div>

      <dl className="kv">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      {data.parentPhone && (
        <a href={`tel:${data.parentPhone}`} className="btn-line w-full">
          <Phone className="h-4 w-4" aria-hidden /> {L({ hi: "माता-पिता को कॉल करें", en: "Call parent" })}
        </a>
      )}

      <section className="space-y-2">
        <h2 className="mlabel">{L({ hi: "परीक्षा के अंक", en: "Exam results" })}</h2>
        {data.exams.length === 0 ? (
          <Empty>{L({ hi: "अभी कोई अंक नहीं।", en: "No marks yet." })}</Empty>
        ) : (
          <ul className="space-y-2">
            {data.exams.map((e) => {
              const isOpen = open === e.id;
              return (
                <li key={e.id} className="rounded-2xl bg-ink-50">
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
