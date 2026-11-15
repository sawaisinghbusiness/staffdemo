"use client";

import Link from "next/link";
import clsx from "clsx";
import { Bus, ChevronRight, Plus, RotateCw } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { fmtPhone, splitName, type TransportList } from "@/lib/erpTransport";
import { Empty, ErrorCard, ListSkeleton } from "@/components/ui";

/*
 * ERP login → Transport → Routes & buses: the ERP's page (GET /api/transport). One strip of three figures,
 * then every route as a list row (user, 2026-10-26) with its bus, driver and how full it is. Tap a route for its students and details (the ERP's
 * RouteDrawer, here /erp/transport/route/). Only the admin adds routes, as in the ERP.
 */
export default function ErpTransportPage() {
  const L = useL();
  const { data, error, reload } = useApi<TransportList>("/erp/transport");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const isAdmin = who.data?.user.role === "admin";

  if (data?.setupNeeded)
    return (
      <div className="animate-rise space-y-3">
        <Empty>
          {L({ hi: "ट्रांसपोर्ट के लिए डेटाबेस में एक बार का बदलाव चाहिए। Supabase SQL editor में sms backend/supabase/migrations/20261002_payroll_transport.sql चलाएँ।", en: "Transport needs a one-time database setup. Run sms backend/supabase/migrations/20261002_payroll_transport.sql in the Supabase SQL editor." })}
        </Empty>
        <button type="button" onClick={reload} className="btn-line w-full">
          <RotateCw className="h-4 w-4" aria-hidden /> {L({ hi: "फिर से देखें", en: "Check again" })}
        </button>
      </div>
    );

  const routes = data?.routes;
  const seats = (routes || []).reduce((t, r) => t + (r.capacity || 0), 0);
  const addHref = "/erp/transport/route/?id=new";

  return (
    <div className="animate-rise space-y-3 pb-4">
      <section className="grid grid-cols-3 gap-1.5 rounded-2xl border border-ink-100 bg-white px-4 py-3.5">
        <span className="flex flex-col">
          <b className="tnum text-[22px] font-extrabold leading-tight">{data ? data.total.toLocaleString("en-IN") : "…"}</b>
          <span className="text-[12.5px] text-ink-600">{L({ hi: "बस से आते", en: "on bus" })}</span>
        </span>
        <span className="flex flex-col">
          <b className="tnum text-[22px] font-extrabold leading-tight">{routes ? routes.length : "…"}</b>
          <span className="text-[12.5px] text-ink-600">{seats ? L({ hi: `रूट · ${seats} सीट`, en: `routes · ${seats} seats` }) : L({ hi: "रूट", en: "routes" })}</span>
        </span>
        <span className="flex flex-col">
          <b className={clsx("tnum text-[22px] font-extrabold leading-tight", data?.unassigned ? "text-rose-700" : "")}>{data ? data.unassigned : "…"}</b>
          <span className="text-[12.5px] text-ink-600">{L({ hi: "बिना रूट", en: "no route yet" })}</span>
        </span>
      </section>

      {!routes ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={5} />
      ) : routes.length === 0 ? (
        <>
          <Empty>{L({ hi: "अभी कोई बस रूट नहीं।", en: "No bus route yet." })}</Empty>
          {isAdmin && (
            <Link href={addHref} className="btn-primary w-full">
              <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "पहला रूट जोड़ें", en: "Add the first route" })}
            </Link>
          )}
        </>
      ) : (
        <>
          <h2 className="text-[15px] font-semibold text-ink-900">{L({ hi: "रूट", en: "Routes" })}</h2>
          <ul className="-mx-4 border-y border-ink-100 bg-white pl-4">
            {routes.map((r) => {
              const [no, area] = splitName(r.name);
              const full = r.capacity ? Math.round((r.students / r.capacity) * 100) : null;
              const over = r.capacity !== null && r.students > r.capacity;
              const phone = fmtPhone(r.driver_mobile);
              const missing = !r.vehicle_no ? L({ hi: "बस नहीं जोड़ी", en: "No bus added" }) : !r.driver_name ? L({ hi: "ड्राइवर नहीं जोड़ा", en: "No driver added" }) : "";
              return (
                <li key={r.id}>
                  <Link href={`/erp/transport/route/?id=${encodeURIComponent(r.id)}`} className="flex items-center gap-3 border-b border-ink-100 py-3 pr-4 active:bg-ink-50">
                    <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", missing ? "bg-ink-100 text-ink-500" : "bg-[#E8EFF7] text-[#0D2A5E]")}>
                      <Bus className="h-5 w-5" strokeWidth={1.9} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold">
                          {no}
                          {area ? <span className="font-normal text-ink-600"> · {area}</span> : null}
                        </span>
                        <span className={clsx("tnum shrink-0 text-[13px] font-semibold", over && "text-rose-700")}>
                          {r.students}
                          {r.capacity ? `/${r.capacity}` : ""}
                        </span>
                      </span>
                      {missing ? (
                        <span className="flex items-center gap-1.5 text-[12.5px] text-ink-600">
                          <i className="h-[7px] w-[7px] shrink-0 rounded-full bg-rose-500" aria-hidden />
                          {missing}
                        </span>
                      ) : (
                        <span className="block truncate text-[12.5px] text-ink-600">
                          {r.vehicle_no} · {r.driver_name}
                          {phone !== "—" ? ` · ${phone}` : ""}
                        </span>
                      )}
                      {full !== null && (
                        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-ink-100" aria-hidden>
                          <span className={clsx("block h-full rounded-full", over ? "bg-rose-500" : full >= 85 ? "bg-marigold-400" : "bg-[#0D2A5E]")} style={{ width: `${Math.min(100, full)}%` }} />
                        </span>
                      )}
                    </span>
                    <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-300" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          {data && data.unassigned > 0 && (
            <Link href="/erp/transport/route/?id=unassigned" className="flex min-h-[52px] items-center gap-2.5 rounded-2xl border border-ink-100 bg-white px-3.5 active:bg-ink-50">
              <i className="h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden />
              <span className="flex-1 text-[14.5px] font-semibold">{L({ hi: `${data.unassigned} बस वाले बच्चों का रूट नहीं`, en: `${data.unassigned} bus students have no route` })}</span>
              <ChevronRight className="h-[18px] w-[18px] text-ink-400" aria-hidden />
            </Link>
          )}
          {isAdmin && (
            <Link href={addHref} className="btn-line w-full">
              <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "रूट जोड़ें", en: "Add route" })}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
