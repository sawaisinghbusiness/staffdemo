"use client";

import Link from "next/link";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { useApi } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useL } from "@/lib/i18n";
import { useLang } from "@/lib/i18n";
import { weekdayDate } from "@/lib/format";
import { ErrorCard, Skeleton } from "@/components/ui";

interface Home {
  date: string;
  myMark: "P" | "A" | "L" | "H" | null;
  lessons: { id: string; label: string; start: string; end: string; classSec: string; subject: string }[];
  attendanceToMark: { id: string; classSec: string }[];
  pendingLeaves: number;
}

const MARK = {
  P: { dot: "bg-jade-600", text: { hi: "उपस्थित", en: "Present" } },
  A: { dot: "bg-rose-500", text: { hi: "अनुपस्थित", en: "Absent" } },
  L: { dot: "bg-marigold-500", text: { hi: "छुट्टी पर", en: "On leave" } },
  H: { dot: "bg-marigold-500", text: { hi: "आधा दिन", en: "Half day" } },
};

export default function HomePage() {
  const { me } = useStaff();
  const { data, error, reload } = useApi<Home>(me ? "/home" : null);
  const L = useL();
  const { lang } = useLang();

  if (!data) {
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return (
      <>
        {[96, 150, 110].map((h, i) => (
          <div key={i} className="card space-y-3 p-4">
            <Skeleton className="h-4 w-28" />
            <div style={{ height: h - 48 }} className="skeleton" />
          </div>
        ))}
      </>
    );
  }

  const teacher = me?.role === "teacher";

  return (
    <div className="animate-rise space-y-3">
      <p className="px-1 pt-1 text-sm font-medium text-ink-500">{weekdayDate(data.date, lang)}</p>

      {/* My own attendance today */}
      <Link href="/me/attendance/" className="card flex items-center gap-4 p-4 active:bg-ink-50">
        <div className="min-w-0 flex-1">
          <p className="card-title">{L({ hi: "आज मेरी हाज़िरी", en: "My attendance today" })}</p>
          <p className="mt-1 flex items-center gap-2 text-xl font-bold text-ink-900">
            {data.myMark ? (
              <>
                <span className={clsx("dot", MARK[data.myMark].dot)} aria-hidden />
                {L(MARK[data.myMark].text)}
              </>
            ) : (
              <>
                <span className="dot border-2 border-ink-300 bg-white" aria-hidden />
                <span className="text-ink-600">{L({ hi: "अभी नहीं लगी", en: "Not marked yet" })}</span>
              </>
            )}
          </p>
        </div>
        <span className="flex items-center text-sm font-semibold text-brand-700">
          {L({ hi: "पूरा महीना", en: "Whole month" })} <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
      </Link>

      {teacher && (
        <>
          {/* To do now */}
          {(data.attendanceToMark.length > 0 || data.pendingLeaves > 0) && (
            <section className="card p-4">
              <p className="card-title">{L({ hi: "अभी करना है", en: "To do" })}</p>
              <ul className="mt-1 divide-y divide-ink-100">
                {data.attendanceToMark.map((s) => (
                  <li key={s.id}>
                    <Link href="/attendance/" className="flex min-h-[56px] items-center gap-3 py-2">
                      <span className="dot bg-rose-500" aria-hidden />
                      <span className="flex-1 font-medium text-ink-900">
                        {s.classSec} {L({ hi: "की हाज़िरी लगानी है", en: "attendance is not marked" })}
                      </span>
                      <ChevronRight className="h-5 w-5 text-ink-400" aria-hidden />
                    </Link>
                  </li>
                ))}
                {data.pendingLeaves > 0 && (
                  <li>
                    <Link href="/me/requests/" className="flex min-h-[56px] items-center gap-3 py-2">
                      <span className="dot bg-marigold-500" aria-hidden />
                      <span className="flex-1 font-medium text-ink-900">
                        {data.pendingLeaves} {L({ hi: "छुट्टी की अर्ज़ियाँ जवाब का इंतज़ार कर रही हैं", en: "leave applications are waiting" })}
                      </span>
                      <ChevronRight className="h-5 w-5 text-ink-400" aria-hidden />
                    </Link>
                  </li>
                )}
              </ul>
            </section>
          )}

          {/* Today's classes */}
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <p className="card-title">{L({ hi: "आज की कक्षाएँ", en: "Today's classes" })}</p>
              <Link href="/me/timetable/" className="link -my-3 text-sm">
                {L({ hi: "पूरी टाइम टेबल", en: "Full timetable" })} <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            {data.lessons.length === 0 ? (
              <p className="mt-1 text-ink-600">{L({ hi: "आज आपकी कोई कक्षा नहीं है।", en: "You have no classes today." })}</p>
            ) : (
              <ul className="mt-1 divide-y divide-ink-100">
                {data.lessons.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-3 first:pt-2 last:pb-0">
                    <span className="tnum w-[112px] shrink-0 whitespace-nowrap text-sm text-ink-500">
                      {l.start}–{l.end}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink-900">{l.classSec}</span>
                      <span className="block text-sm text-ink-600">{l.subject}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {!teacher && (
        <section className="card space-y-3 p-4">
          <p className="card-title">{L({ hi: "मेरी जानकारी", en: "My details" })}</p>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/me/salary/" className="btn-quiet">
              {L({ hi: "सैलरी स्लिप", en: "Salary slips" })}
            </Link>
            <Link href="/me/leave/" className="btn-quiet">
              {L({ hi: "छुट्टी की अर्ज़ी", en: "Apply for leave" })}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
