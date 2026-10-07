"use client";

import { useState } from "react";
import clsx from "clsx";
import { CalendarDays } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { weekdayDate } from "@/lib/format";
import { Empty, ErrorCard, ListSkeleton } from "@/components/ui";

interface Notice {
  id: string;
  title: string;
  body: string;
  date: string;
}

/** Notices from the school office to staff. Tap a long one to read it all. */
export default function NoticePage() {
  const L = useL();
  const { lang } = useLang();
  const { data, error, reload } = useApi<{ notices: Notice[] }>("/notices");
  const [open, setOpen] = useState<string[]>([]);

  if (!data) {
    if (error?.status === 404) return <Empty>{L({ hi: "अभी कोई सूचना नहीं।", en: "No notices yet." })}</Empty>;
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton rows={4} />;
  }
  if (!data.notices.length) return <Empty>{L({ hi: "अभी कोई सूचना नहीं।", en: "No notices yet." })}</Empty>;

  return (
    <ul className="animate-rise space-y-2">
      {data.notices.map((n) => {
        const isOpen = open.includes(n.id);
        const long = n.body.length > 110;
        return (
          <li key={n.id}>
            <button onClick={() => long && setOpen((o) => (isOpen ? o.filter((x) => x !== n.id) : [...o, n.id]))} aria-expanded={long ? isOpen : undefined} className="row-card">
              <span className="meta">
                <span>
                  <CalendarDays aria-hidden />
                  {weekdayDate(n.date, lang)}
                </span>
              </span>
              <span className="mt-1 block text-[15.5px] font-bold leading-snug">{n.title}</span>
              <span className={clsx("mt-1 block whitespace-pre-line text-[14px] leading-relaxed text-ink-600", !isOpen && "line-clamp-2")}>{n.body}</span>
              {long && !isOpen && <span className="mt-0.5 block text-[13px] font-semibold text-brand-600">{L({ hi: "पूरा पढ़ें", en: "Read more" })}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
