"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarCheck, ChevronRight, Gift, IndianRupee, Landmark, Plus, type LucideIcon } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL, useLang, type Lang } from "@/lib/i18n";
import { useStaff } from "@/lib/staff";
import { fmt, money, type Dashboard } from "@/lib/erpDashboard";
import { ErrorCard, Skeleton } from "@/components/ui";

/*
 * ERP login → Report → Overview: the ERP's Dashboard (app/dashboard/page.tsx). Every figure comes from
 * GET /api/dashboard, the same call the ERP makes: fees this month and session, dues, students, collection
 * by month, how parents paid, classes with most dues, and what needs attention today.
 */

const TEAL = "#3099a4";

export default function ErpReportPage() {
  const L = useL();
  const { lang } = useLang();
  const { me } = useStaff();
  const { data: res, error, reload } = useApi<{ data: Dashboard }>("/erp/dashboard");
  const data = res?.data;
  const f = data?.fees;
  const paidPct = f && f.sessionTotal > 0 ? Math.round((f.sessionPaid / f.sessionTotal) * 100) : 0;

  const hour = new Date().getHours();
  const hello = hour < 12 ? L({ hi: "सुप्रभात", en: "Good morning" }) : hour < 17 ? L({ hi: "नमस्ते", en: "Good afternoon" }) : L({ hi: "नमस्ते", en: "Good evening" });
  const today = new Date().toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="animate-rise space-y-3 pb-6">
      <div>
        <h1 className="text-[20px] font-bold leading-tight">
          {hello}
          {me?.name ? `, ${me.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-[13px] text-ink-500">{today}</p>
      </div>

      {/* The ERP's three quick actions. */}
      <div className="grid grid-cols-3 gap-2">
        <Quick href="/erp/attendance/mark/" icon={CalendarCheck} text={L({ hi: "हाज़िरी", en: "Attendance" })} />
        <Quick href="/erp/students/admission/" icon={Plus} text={L({ hi: "नया प्रवेश", en: "Admission" })} />
        <Quick href="/erp/fees/collect/" icon={IndianRupee} text={L({ hi: "फ़ीस जमा", en: "Collect fee" })} primary />
      </div>

      {error && !data && error.status !== 401 && <ErrorCard offline={error.status === 0} onRetry={reload} />}

      {/* Fees and students at a glance: the month figure, then three rows that open their lists. */}
      <section className="row-card !p-0" aria-label={L({ hi: "फ़ीस और बच्चे एक नज़र में", en: "Fees and students at a glance" })}>
        {!f || !data ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="px-4 pb-3 pt-3.5">
              <p className="text-[13px] font-medium text-ink-500">{L({ hi: "इस महीने जमा", en: "Collected this month" })}</p>
              <p className="tnum mt-0.5 text-[28px] font-extrabold leading-tight">{money(f.thisMonth)}</p>
            </div>
            <ul className="border-t border-ink-100">
              <GlanceRow href="/erp/fees/reports/" title={L({ hi: "इस सत्र में जमा", en: "Collected this session" })} meta={`${paidPct}% ${L({ hi: "कुल", en: "of" })} ${money(f.sessionTotal)}`} value={money(f.sessionPaid)}>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ink-100" role="img" aria-label={`${paidPct}% of ${money(f.sessionTotal)} collected`}>
                  <span className="block h-full rounded-full" style={{ width: `${paidPct}%`, background: TEAL }} />
                </span>
              </GlanceRow>
              <GlanceRow href="/erp/fees/dues/" title={L({ hi: "बाकी फ़ीस", en: "Fees pending" })} meta={`${fmt(f.dueStudents)} ${L({ hi: "बच्चे", en: "students" })}`} value={money(f.sessionDue)} bad />
              <GlanceRow
                href="/erp/students/"
                title={L({ hi: "बच्चे", en: "Students" })}
                meta={`${fmt(data.students.boys)} ${L({ hi: "लड़के", en: "boys" })} · ${fmt(data.students.girls)} ${L({ hi: "लड़कियाँ", en: "girls" })} · ${fmt(data.students.bus)} ${L({ hi: "बस से", en: "by bus" })}`}
                value={fmt(data.students.total)}
              />
            </ul>
          </>
        )}
      </section>

      <section className="row-card">
        <h2 className="text-[16px] font-bold">{L({ hi: "हर महीने की फ़ीस वसूली", en: "Fee collection by month" })}</h2>
        <p className="text-[13px] text-ink-500">{L({ hi: "सत्र 2026-27 · ₹ लाख में", en: "Session 2026-27 · ₹ in lakh" })}</p>
        {f ? <MonthChart data={f.byMonth} lang={lang} /> : <Skeleton className="mt-3 h-48 w-full" />}
      </section>

      <section className="row-card">
        <h2 className="text-[16px] font-bold">{L({ hi: "माता-पिता ने कैसे दिया", en: "How parents paid" })}</h2>
        <p className="text-[13px] text-ink-500">
          {L({ hi: "इस सत्र", en: "This session" })}
          {f ? ` · ${money(f.sessionPaid)}` : ""}
        </p>
        {f ? (
          <ul className="mt-3 space-y-3">
            {(["Cash", "UPI", "Cheque"] as const).map((m) => {
              const share = f.sessionPaid ? (f.byMode[m] / f.sessionPaid) * 100 : 0;
              return (
                <li key={m}>
                  <span className="flex items-baseline gap-2 text-[14.5px]">
                    <span className="flex-1 font-medium">{m === "Cash" ? L({ hi: "नकद", en: "Cash" }) : m === "Cheque" ? L({ hi: "चेक", en: "Cheque" }) : "UPI"}</span>
                    <span className="tnum font-bold">{money(f.byMode[m])}</span>
                    <span className="tnum w-10 text-right text-[13px] text-ink-500">{Math.round(share)}%</span>
                  </span>
                  <Bar pct={share} />
                </li>
              );
            })}
          </ul>
        ) : (
          <Skeleton className="mt-3 h-28 w-full" />
        )}
      </section>

      <section className="row-card">
        <h2 className="text-[16px] font-bold">{L({ hi: "सबसे ज़्यादा बाकी फ़ीस वाली कक्षाएँ", en: "Classes with most fees pending" })}</h2>
        <p className="text-[13px] text-ink-500">{L({ hi: "₹ लाख में", en: "₹ in lakh" })}</p>
        {f ? (
          f.topDueClasses.length ? (
            <ul className="mt-3 space-y-2.5">
              {f.topDueClasses.map((c) => (
                <li key={c.class} className="grid grid-cols-[52px_minmax(0,1fr)_44px] items-center gap-2.5 text-[14px]" aria-label={`Class ${c.class}: ${money(c.due)} pending`}>
                  <span className="truncate font-semibold">{c.class}</span>
                  <Bar pct={(c.due / f.topDueClasses[0].due) * 100} flat />
                  <span className="tnum text-right font-bold">{(c.due / 1e5).toFixed(1)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-ink-500">{L({ hi: "किसी कक्षा की फ़ीस बाकी नहीं है।", en: "No class has fees pending." })}</p>
          )
        ) : (
          <Skeleton className="mt-3 h-36 w-full" />
        )}
      </section>

      <section className="row-card !pb-1">
        <h2 className="text-[16px] font-bold">{L({ hi: "आज ध्यान दें", en: "Needs attention today" })}</h2>
        {data ? (
          <ul className="mt-1 divide-y divide-ink-100">
            {(() => {
              const a = data.attention;
              const left = a.sectionsTotal - a.sectionsMarkedToday;
              return (
                <Attention
                  icon={CalendarCheck}
                  tone={a.sectionsMarkedToday < a.sectionsTotal ? "warn" : "good"}
                  title={
                    a.sectionsMarkedToday < a.sectionsTotal
                      ? a.sectionsMarkedToday === 0
                        ? L({ hi: `अभी किसी सेक्शन की हाज़िरी नहीं लगी (${a.sectionsTotal} सेक्शन)`, en: `No section has marked attendance yet (${a.sectionsTotal} sections)` })
                        : L({ hi: `${a.sectionsTotal} में से ${left} सेक्शन की हाज़िरी बाकी है`, en: `${left} of ${a.sectionsTotal} sections haven't marked attendance` })
                      : L({ hi: "हर सेक्शन की हाज़िरी लग गई", en: "Attendance marked in every section" })
                  }
                  sub={L({ hi: `आज अब तक ${a.sectionsMarkedToday} लगी`, en: `${a.sectionsMarkedToday} marked so far today` })}
                  href="/erp/attendance/mark/"
                  action={L({ hi: "लगाएँ", en: "Mark" })}
                />
              );
            })()}
            <Attention
              icon={Landmark}
              tone="brand"
              title={data.attention.chequesThisWeek.count ? L({ hi: `इस हफ़्ते ${data.attention.chequesThisWeek.count} चेक आए`, en: `${data.attention.chequesThisWeek.count} cheques received this week` }) : L({ hi: "इस हफ़्ते कोई चेक नहीं आया", en: "No cheques received this week" })}
              sub={data.attention.chequesThisWeek.count ? L({ hi: `${money(data.attention.chequesThisWeek.amount)} बैंक में जमा करने हैं`, en: `${money(data.attention.chequesThisWeek.amount)} to deposit in the bank` }) : L({ hi: "जमा करने को कुछ नहीं", en: "Nothing to deposit" })}
            />
            <Attention
              icon={IndianRupee}
              tone="bad"
              title={L({ hi: `${fmt(data.fees.dueStudents)} बच्चों की फ़ीस बाकी है`, en: `${fmt(data.fees.dueStudents)} students have fees pending` })}
              sub={L({ hi: `कुल ${money(data.fees.sessionDue)}`, en: `${money(data.fees.sessionDue)} in total` })}
              href="/erp/fees/collect/"
              action={L({ hi: "जमा करें", en: "Collect" })}
            />
            {(() => {
              const b = data.attention.birthdaysToday;
              return (
                <Attention
                  icon={Gift}
                  tone="good"
                  title={b.length ? L({ hi: `आज ${b.length} बच्चों का जन्मदिन`, en: `${b.length} birthdays today` }) : L({ hi: "आज किसी का जन्मदिन नहीं", en: "No birthdays today" })}
                  sub={
                    b.length
                      ? b
                          .slice(0, 3)
                          .map((x) => `${x.name} (${x.classSec})`)
                          .join(", ") + (b.length > 3 ? L({ hi: ` और ${b.length - 3}`, en: ` and ${b.length - 3} more` }) : "")
                      : L({ hi: "बच्चों की जन्मतिथि से", en: "From students' dates of birth" })
                  }
                />
              );
            })()}
          </ul>
        ) : (
          <Skeleton className="my-3 h-40 w-full" />
        )}
      </section>
    </div>
  );
}

function Quick({ href, icon: Icon, text, primary }: { href: string; icon: LucideIcon; text: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] px-1 text-[13px] font-semibold active:scale-[.98]",
        primary ? "border-[#3099a4] bg-[#3099a4] text-white" : "border-ink-900 bg-white text-ink-900"
      )}
    >
      <Icon className="h-[19px] w-[19px]" aria-hidden />
      <span className="truncate">{text}</span>
    </Link>
  );
}

function GlanceRow({ href, title, meta, value, bad, children }: { href: string; title: string; meta: string; value: string; bad?: boolean; children?: React.ReactNode }) {
  return (
    <li className="border-b border-ink-100 last:border-0">
      <Link href={href} className="flex min-h-[60px] items-center gap-2 px-4 py-2.5 active:bg-ink-50">
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold">{title}</span>
          <span className="block truncate text-[12.5px] text-ink-500">{meta}</span>
          {children}
        </span>
        <span className={clsx("tnum shrink-0 text-[16px] font-bold", bad && "text-rose-600")}>{value}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" aria-hidden />
      </Link>
    </li>
  );
}

/** One teal bar on a light track, rounded only at the data end unless `flat` is off. */
function Bar({ pct, flat }: { pct: number; flat?: boolean }) {
  return (
    <span className={clsx("block h-2.5 overflow-hidden bg-ink-100", flat ? "rounded-r" : "mt-1.5 rounded-full")}>
      <span className={clsx("block h-full", flat ? "rounded-r" : "rounded-full")} style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: TEAL }} />
    </span>
  );
}

/** The ERP's column chart, one series, to scale in SVG. Tap a month to see its figure. */
function MonthChart({ data, lang }: { data: { month: string; amount: number }[]; lang: Lang }) {
  const name = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { month: "short" });
  const W = 340, H = 196, Lp = 30, R = 4, T = 18, B = 24;
  const lakhs = data.map((d) => d.amount / 1e5);
  const rawMax = Math.max(10, ...lakhs);
  const step = [5, 10, 20, 25, 50, 100, 200].find((s) => rawMax / s <= 5) || 250;
  const max = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  const plotH = H - T - B, slot = (W - Lp - R) / Math.max(1, data.length), bw = Math.min(24, slot * 0.56);
  const y = (v: number) => T + plotH - (v / max) * plotH;
  const peak = lakhs.indexOf(Math.max(...lakhs));
  const [pick, setPick] = useState<number | null>(null);
  const at = pick ?? data.length - 1;

  if (!data.length) return null;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label={`Fee collection by month: ${data.map((d, i) => `${name(d.month)} ${lakhs[i].toFixed(1)} lakh`).join(", ")}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={Lp} x2={W - R} y1={y(t) + 0.5} y2={y(t) + 0.5} stroke="#E9ECF2" />
            <text x={Lp - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#8A93A6">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = Lp + i * slot + (slot - bw) / 2, v = lakhs[i], top = y(v), r = Math.min(4, (T + plotH - top) / 2);
          const label = i === peak || i === data.length - 1 || pick === i;
          return (
            <g key={d.month} onClick={() => setPick(pick === i ? null : i)} className="cursor-pointer">
              <rect x={Lp + i * slot} y={0} width={slot} height={H} fill="transparent" />
              {v > 0 && <path d={`M${x} ${T + plotH} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + bw - r} Q${x + bw} ${top} ${x + bw} ${top + r} V${T + plotH} Z`} fill={TEAL} opacity={pick === null || pick === i ? 1 : 0.45} />}
              <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize="11" fill={pick === i ? "#16213A" : "#8A93A6"} fontWeight={pick === i ? 700 : 400}>
                {name(d.month)}
              </text>
              {label && v > 0 && (
                <text x={x + bw / 2} y={top - 6} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#16213A">
                  {v.toFixed(1)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="tnum mt-1 text-[13px] text-ink-500">
        {new Date(data[at].month + "-01T00:00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { month: "long", year: "numeric" })} · <b className="text-ink-900">{money(data[at].amount)}</b>
      </p>
    </>
  );
}

function Attention({ icon: Icon, tone, title, sub, href, action }: { icon: LucideIcon; tone: "warn" | "brand" | "bad" | "good"; title: string; sub: string; href?: string; action?: string }) {
  const tint = { warn: "text-marigold-600", brand: "text-[#3099a4]", bad: "text-rose-600", good: "text-jade-600" }[tone];
  return (
    <li className="flex min-h-[60px] items-center gap-3 py-2.5">
      <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 bg-white", tint)}>
        <Icon className="h-4 w-4" strokeWidth={2.2} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold leading-snug">{title}</span>
        <span className="block truncate text-[12.5px] text-ink-500">{sub}</span>
      </span>
      {href && action && (
        <Link href={href} className="btn-line min-h-[44px] shrink-0 px-3 text-[13.5px]">
          {action}
        </Link>
      )}
    </li>
  );
}
