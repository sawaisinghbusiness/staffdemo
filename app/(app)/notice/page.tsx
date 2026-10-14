"use client";

import { useLayoutEffect, useRef, useState } from "react";
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
        return (
          <li key={n.id}>
            <NoticeCard
              notice={n}
              date={weekdayDate(n.date, lang)}
              isOpen={isOpen}
              more={L({ hi: "पूरा पढ़ें", en: "Read more" })}
              onToggle={() => setOpen((o) => (isOpen ? o.filter((x) => x !== n.id) : [...o, n.id]))}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** One notice. "Read more" shows only when the body really overflows its two lines. */
function NoticeCard({ notice: n, date, isOpen, more, onToggle }: { notice: Notice; date: string; isOpen: boolean; more: string; onToggle: () => void }) {
  const bodyRef = useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = useState(false);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || isOpen) return;
    const check = () => setClipped(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen, n.body]);

  const long = clipped || isOpen;
  return (
    <button onClick={() => long && onToggle()} aria-expanded={long ? isOpen : undefined} className="row-card">
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 font-title text-[17px] font-bold leading-snug text-ink-900">{n.title}</span>
        <span className="meta shrink-0 pt-0.5">
          <span>
            <CalendarDays aria-hidden />
            {date}
          </span>
        </span>
      </span>
      <span ref={bodyRef} className={clsx("mt-1 block whitespace-pre-line text-[14px] leading-relaxed text-ink-600", !isOpen && "line-clamp-2")}>
        {n.body}
      </span>
      {clipped && !isOpen && <span className="mt-0.5 block text-[13px] font-semibold text-brand-600">{more}</span>}
    </button>
  );
}
