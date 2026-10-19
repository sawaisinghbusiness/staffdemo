"use client";

import Link from "next/link";
import clsx from "clsx";
import { ChevronRight, Plus, RotateCw } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { fmtPhone, splitName, type TransportList } from "@/lib/erpTransport";
import { Empty, ErrorCard, ListSkeleton } from "@/components/ui";

/*
 * ERP login → Transport → Routes & buses: the ERP's page (GET /api/transport). Four figures, then every
 * route with its bus, driver and how full it is. Tap a route for its students and details (the ERP's
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
  const noBus = (routes || []).filter((r) => !r.vehicle_no || !r.driver_name).length;
  const addHref = "/erp/transport/route/?id=new";

  return (
    <div className="animate-rise space-y-3 pb-4">
      <div className="grid grid-cols-2 gap-2">
        <Figure label={L({ hi: "बस वाले बच्चे", en: "Students on bus" })} value={data ? data.total.toLocaleString("en-IN") : "…"} dot="bg-brand-500" />
        <Figure label={L({ hi: "रूट", en: "Routes" })} value={routes ? String(routes.length) : "…"} dot="bg-ink-300" />
        <Figure label={L({ hi: "सीटें", en: "Seats" })} value={routes ? (seats ? seats.toLocaleString("en-IN") : "—") : "…"} dot="bg-jade-500" />
        <Figure label={L({ hi: "बिना रूट के", en: "Without a route" })} value={data ? String(data.unassigned) : "…"} dot="bg-rose-500" href={data?.unassigned ? "/erp/transport/route/?id=unassigned" : undefined} />
      </div>

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
          {noBus > 0 && (
            <p className="flex items-start gap-2 text-[13px] text-ink-600">
              <i className="dot mt-1.5 h-2 w-2 bg-marigold-500" aria-hidden />
              {noBus === routes.length
                ? L({ hi: "हर रूट में बस नंबर और ड्राइवर जोड़ें।", en: "Add the bus number and driver to each route." })
                : L({ hi: `${noBus} रूट में अभी बस नंबर या ड्राइवर नहीं है।`, en: `${noBus} routes still need a bus number or driver.` })}
            </p>
          )}
          <ul className="space-y-2">
            {routes.map((r) => {
              const [no, area] = splitName(r.name);
              const full = r.capacity ? Math.round((r.students / r.capacity) * 100) : null;
              const over = r.capacity !== null && r.students > r.capacity;
              const phone = fmtPhone(r.driver_mobile);
              return (
                <li key={r.id}>
                  <Link href={`/erp/transport/route/?id=${encodeURIComponent(r.id)}`} className="row-card flex items-center gap-3 active:bg-ink-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-semibold">{no}</span>
                      <span className="block truncate text-[12.5px] text-ink-500">{area || L({ hi: `${r.stops.length} स्टॉप`, en: `${r.stops.length} stops` })}</span>
                      <span className={clsx("mt-1 block truncate text-[13px]", r.vehicle_no ? "font-medium text-ink-800" : "text-ink-400")}>
                        {r.vehicle_no || L({ hi: "बस नहीं जोड़ी", en: "No bus added" })}
                        <span className="font-normal text-ink-500"> · {r.driver_name ? `${r.driver_name}${phone !== "—" ? ` · ${phone}` : ""}` : L({ hi: "ड्राइवर नहीं", en: "No driver" })}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tnum block text-[14px] text-ink-600">
                        <b className="text-[15.5px] font-bold text-ink-900">{r.students}</b>
                        {r.capacity ? ` / ${r.capacity}` : ""}
                      </span>
                      <span className="block text-[12px] text-ink-400">{r.capacity ? L({ hi: "सीटें", en: "seats" }) : L({ hi: "बच्चे", en: "students" })}</span>
                      {full !== null && (
                        <span className="mt-1 block h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
                          <span className={clsx("block h-full rounded-full", over ? "bg-rose-500" : "bg-brand-500")} style={{ width: `${Math.min(100, full)}%` }} />
                        </span>
                      )}
                    </span>
                    <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-300" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
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

function Figure({ label, value, dot, href }: { label: string; value: string; dot: string; href?: string }) {
  const inner = (
    <>
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-500">
        <i className={clsx("h-2 w-2 shrink-0 rounded-full", dot)} />
        <span className="truncate">{label}</span>
        {href && <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-ink-300" aria-hidden />}
      </span>
      <span className="tnum mt-0.5 block text-[20px] font-extrabold">{value}</span>
    </>
  );
  const cls = "block rounded-2xl border border-ink-100 bg-white px-3 py-2.5";
  return href ? (
    <Link href={href} className={clsx(cls, "active:bg-ink-50")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
