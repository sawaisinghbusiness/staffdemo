"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Check, Phone, Plus, Printer, Search, Trash2, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { blankRoute, fmtPhone, routeToInput, type BusRoute, type Rider, type RouteInput, type Stop, type TransportList } from "@/lib/erpTransport";
import { Empty, ErrorCard, LineTabs, ListSkeleton, SelectBox, Sheet, StickyBar } from "@/components/ui";
import { PrintSheet } from "@/components/erp/certs/SheetPreview";
import { DriverList } from "@/components/erp/transport/DriverList";

type Tab = "students" | "details";

/*
 * ERP login → one bus route: the ERP's RouteDrawer. ?id=<route id> shows its riders (move them, set their
 * stop, print the driver's list) and its details (stops with pickup times, bus, driver, conductor);
 * ?id=unassigned lists bus students with no route yet; ?id=new is an empty form (admin only).
 * Same calls as the ERP: GET /api/transport/:id/students, POST /api/transport/assign, POST/PATCH/DELETE
 * /api/transport. Moving a student only changes their route and stop, never their transport (fee) setting.
 */
export default function ErpTransportRoutePage() {
  const L = useL();
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(window.location.search).get("id") || ""), []);
  const isNew = id === "new";
  const isUnassigned = id === "unassigned";

  const list = useApi<TransportList>("/erp/transport");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const { data: p } = useApi<Record<string, string>>("/erp/school");
  const isAdmin = who.data?.user.role === "admin";
  const routes = useMemo(() => list.data?.routes || [], [list.data]);
  const r = (id && !isNew && !isUnassigned && routes.find((x) => x.id === id)) || null;

  const ridersPath = id && !isNew && (isUnassigned || r) ? `/erp/transport/${encodeURIComponent(id)}/students` : null;
  const ridersRes = useApi<{ data: Rider[] }>(ridersPath);
  const riders = ridersRes.data?.data ?? null;

  const [tab, setTab] = useState<Tab>("students");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const [f, setF] = useState<RouteInput>(blankRoute);
  const [formFor, setFormFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Fill the form once the route is known (the ERP fills it when the drawer opens).
  useEffect(() => {
    if (id === null) return;
    if (isNew && formFor !== "new") {
      setF(blankRoute());
      setFormFor("new");
      setTab("details");
    } else if (r && formFor !== r.id) {
      setF(routeToInput(r));
      setFormFor(r.id);
    }
  }, [id, isNew, r, formFor]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (riders || []).filter((s) => !q || s.name.toLowerCase().includes(q) || s.classSec.toLowerCase().includes(q) || s.stop.toLowerCase().includes(q));
  }, [riders, query]);

  if (id === null || (!list.data && !isNew)) {
    if (list.error && list.error.status !== 401) return <ErrorCard offline={list.error.status === 0} onRetry={list.reload} />;
    return <ListSkeleton rows={5} />;
  }
  if (!isNew && !isUnassigned && !r) return <Empty>{L({ hi: "यह रूट नहीं मिला।", en: "This route was not found." })}</Empty>;
  if (isNew && who.data && !isAdmin) return <Empty>{L({ hi: "सिर्फ़ एडमिन नया रूट जोड़ सकते हैं।", en: "Only the admin can add a route." })}</Empty>;

  const reloadAll = () => {
    list.reload();
    ridersRes.reload();
  };

  const setStop = (i: number, patch: Partial<Stop>) => setF((pr) => ({ ...pr, stops: pr.stops.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const moveStopRow = (i: number, d: number) =>
    setF((pr) => {
      const stops = [...pr.stops];
      const j = i + d;
      if (j < 0 || j >= stops.length) return pr;
      [stops[i], stops[j]] = [stops[j], stops[i]];
      return { ...pr, stops };
    });

  async function saveDetails() {
    setBusy(true);
    const body = { ...f, stops: f.stops.filter((s) => s.name.trim()) };
    try {
      const res = await api<{ success: boolean; data?: BusRoute }>(r ? `/erp/transport/${r.id}` : "/erp/transport", { method: r ? "PATCH" : "POST", body });
      toast(true, L({ hi: `${f.name} सेव हो गया।`, en: `${f.name} saved.` }));
      if (isNew) return router.replace(res.data ? `/erp/transport/route/?id=${encodeURIComponent(res.data.id)}` : "/erp/transport/");
      setFormFor(null); // refill from the fresh route
      list.reload();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!r) return;
    if (!window.confirm(L({ hi: `${r.name} हटाएँ?`, en: `Delete ${r.name}?` }))) return;
    setBusy(true);
    try {
      await api(`/erp/transport/${r.id}`, { method: "DELETE" });
      toast(true, L({ hi: `${r.name} हटा दिया।`, en: `${r.name} deleted.` }));
      router.replace("/erp/transport/");
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "हटाया नहीं गया।", en: "Could not delete." }));
      setBusy(false);
    }
  }

  async function assign(dest: string, stop: string) {
    if (!dest || !picked.size) return;
    setBusy(true);
    try {
      const res = await api<{ success: boolean; moved?: number }>("/erp/transport/assign", { body: { routeId: dest, studentIds: Array.from(picked), stop } });
      toast(true, L({ hi: `${res.moved ?? 0} बच्चों का रूट/स्टॉप बदल गया।`, en: `${res.moved ?? 0} students updated.` }));
      setPicked(new Set());
      setMoving(false);
      reloadAll();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "बदला नहीं गया।", en: "Could not move." }));
    } finally {
      setBusy(false);
    }
  }

  const toggle = (sid: string) =>
    setPicked((pr) => {
      const n = new Set(pr);
      if (n.has(sid)) n.delete(sid);
      else n.add(sid);
      return n;
    });

  const showTabs = !isNew && !isUnassigned;
  const view: Tab = isNew ? "details" : isUnassigned ? "students" : tab;
  const school = p?.school_name || "School";

  return (
    <div className={clsx("animate-rise space-y-3", (picked.size > 0 || (view === "details" && isAdmin)) && "pb-20")}>
      <div>
        <p className="text-[18px] font-bold leading-tight">{isNew ? L({ hi: "नया रूट", en: "New route" }) : isUnassigned ? L({ hi: "बिना रूट के बस वाले बच्चे", en: "Bus students without a route" }) : r!.name}</p>
        {r && (r.vehicle_no || r.driver_name) && <p className="text-[13px] text-ink-500">{[r.vehicle_no, r.driver_name].filter(Boolean).join(" · ")}</p>}
      </div>

      {showTabs && (
        <LineTabs
          label={L({ hi: "रूट", en: "Route" })}
          value={tab}
          onChange={setTab}
          options={[
            { key: "students", text: `${L({ hi: "बच्चे", en: "Students" })}${riders ? ` · ${riders.length}` : ""}` },
            { key: "details", text: L({ hi: "रूट की जानकारी", en: "Route details" }) },
          ]}
        />
      )}

      {view === "students" && (
        <>
          <label className="field-box min-h-[48px]">
            <Search aria-hidden />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L({ hi: "नाम, कक्षा या स्टॉप", en: "Name, class or stop" })} aria-label={L({ hi: "बच्चा खोजें", en: "Find a student" })} autoComplete="off" />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label={L({ hi: "खोज हटाएँ", en: "Clear search" })} className="-mr-2 grid h-10 w-10 shrink-0 place-items-center text-ink-400">
                <X className="h-[18px] w-[18px]" aria-hidden />
              </button>
            )}
          </label>

          {!isUnassigned && riders && riders.length > 0 && picked.size === 0 && (
            <button type="button" onClick={() => setPrinting(true)} className="btn-line w-full">
              <Printer className="h-4 w-4" aria-hidden /> {L({ hi: "ड्राइवर की लिस्ट", en: "Driver's list" })}
            </button>
          )}

          {riders === null ? (
            ridersRes.error && ridersRes.error.status !== 401 ? <ErrorCard offline={ridersRes.error.status === 0} onRetry={ridersRes.reload} /> : <ListSkeleton rows={6} />
          ) : !shown.length ? (
            <Empty>
              {riders.length
                ? L({ hi: "कोई नहीं मिला।", en: "Nobody matches." })
                : isUnassigned
                  ? L({ hi: "बस वाले हर बच्चे का रूट है।", en: "Every bus student has a route." })
                  : L({ hi: "इस रूट पर अभी कोई बच्चा नहीं।", en: "No student rides this route yet." })}
            </Empty>
          ) : (
            <ul>
              {shown.map((s) => {
                const on = picked.has(s.id);
                return (
                  <li key={s.id}>
                    <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(s.id)} className={clsx("flex min-h-[60px] w-full items-center gap-3 border-b border-ink-100 py-2 text-left active:bg-ink-50", on && "bg-brand-50")}>
                      <span className={clsx("ml-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border-[1.5px]", on ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 bg-white")}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{s.name}</span>
                        <span className="block truncate text-[12.5px] text-ink-400">{s.classSec}</span>
                      </span>
                      <span className={clsx("max-w-[40%] shrink-0 truncate pr-1 text-right text-[13px]", s.stop ? "text-ink-700" : "text-ink-400")}>{s.stop || L({ hi: "स्टॉप नहीं", en: "No stop" })}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {view === "details" && (
        <>
          <section className="space-y-2.5">
            <label className="field-box">
              <small>{L({ hi: "रूट का नाम", en: "Route name" })}</small>
              <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Route 9 (Gandhi Chowk - Jasdev Nagar)" maxLength={80} disabled={!isAdmin} />
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="field-box">
                <small>{L({ hi: "बस नंबर", en: "Bus no." })}</small>
                <input value={f.vehicle_no || ""} onChange={(e) => setF({ ...f, vehicle_no: e.target.value.toUpperCase() })} placeholder="RJ04 PA 1234" maxLength={20} disabled={!isAdmin} className="uppercase" />
              </label>
              <label className="field-box">
                <small>{L({ hi: "सीटें", en: "Seats" })}</small>
                <input type="number" inputMode="numeric" min={1} max={120} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} placeholder="40" disabled={!isAdmin} className="tnum" />
              </label>
            </div>
            <label className="field-box">
              <small>{L({ hi: "ड्राइवर", en: "Driver" })}</small>
              <input value={f.driver_name || ""} onChange={(e) => setF({ ...f, driver_name: e.target.value })} maxLength={60} disabled={!isAdmin} />
            </label>
            <label className="field-box">
              <small>{L({ hi: "ड्राइवर का मोबाइल", en: "Driver mobile" })}</small>
              <input type="tel" value={f.driver_mobile || ""} onChange={(e) => setF({ ...f, driver_mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="tel" disabled={!isAdmin} className="tnum" />
            </label>
            <label className="field-box">
              <small>{L({ hi: "कंडक्टर", en: "Conductor" })}</small>
              <input value={f.conductor_name || ""} onChange={(e) => setF({ ...f, conductor_name: e.target.value })} maxLength={60} disabled={!isAdmin} />
            </label>
            <label className="field-box">
              <small>{L({ hi: "कंडक्टर का मोबाइल", en: "Conductor mobile" })}</small>
              <input type="tel" value={f.conductor_mobile || ""} onChange={(e) => setF({ ...f, conductor_mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="tel" disabled={!isAdmin} className="tnum" />
            </label>
          </section>

          <section className="space-y-2">
            <div className="sec-head pt-2">
              <h2 className="text-[16px] font-bold">{L({ hi: "स्टॉप", en: "Stops" })}</h2>
              <span className="text-[12.5px] text-ink-500">{L({ hi: "बच्चे लेने के क्रम में", en: "In pickup order" })}</span>
            </div>
            {f.stops.length === 0 && <p className="text-[14px] text-ink-500">{L({ hi: "अभी कोई स्टॉप नहीं।", en: "No stops yet." })}</p>}
            <ol className="space-y-2">
              {f.stops.map((s, i) => (
                <li key={i} className="rounded-2xl border border-ink-100 bg-white p-2.5">
                  <div className="flex items-center gap-1">
                    <span className="tnum flex-1 pl-1 text-[13px] font-semibold text-ink-500">
                      {L({ hi: "स्टॉप", en: "Stop" })} {i + 1}
                    </span>
                    {isAdmin && (
                      <>
                        <button type="button" onClick={() => moveStopRow(i, -1)} disabled={i === 0} className="grid h-11 w-11 place-items-center rounded-full text-ink-500 active:bg-ink-100 disabled:opacity-30" aria-label={L({ hi: "ऊपर करें", en: "Move up" })}>
                          <ArrowUp className="h-[18px] w-[18px]" aria-hidden />
                        </button>
                        <button type="button" onClick={() => moveStopRow(i, 1)} disabled={i === f.stops.length - 1} className="grid h-11 w-11 place-items-center rounded-full text-ink-500 active:bg-ink-100 disabled:opacity-30" aria-label={L({ hi: "नीचे करें", en: "Move down" })}>
                          <ArrowDown className="h-[18px] w-[18px]" aria-hidden />
                        </button>
                        <button type="button" onClick={() => setF((pr) => ({ ...pr, stops: pr.stops.filter((_, j) => j !== i) }))} className="grid h-11 w-11 place-items-center rounded-full text-ink-500 active:bg-ink-100 active:text-rose-600" aria-label={L({ hi: "स्टॉप हटाएँ", en: "Remove stop" })}>
                          <X className="h-[18px] w-[18px]" aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="mt-1 grid grid-cols-[minmax(0,1fr)_8.5rem] gap-2">
                    <label className="field-box min-h-[48px]">
                      <input value={s.name} onChange={(e) => setStop(i, { name: e.target.value })} placeholder={L({ hi: "स्टॉप का नाम", en: "Stop name" })} maxLength={60} disabled={!isAdmin} aria-label={`${L({ hi: "स्टॉप", en: "Stop" })} ${i + 1}`} />
                    </label>
                    <label className="field-box min-h-[48px] px-2.5">
                      <input type="time" value={s.time} onChange={(e) => setStop(i, { time: e.target.value })} disabled={!isAdmin} aria-label={L({ hi: `स्टॉप ${i + 1} पर लेने का समय`, en: `Pickup time at stop ${i + 1}` })} className="tnum" />
                    </label>
                  </div>
                </li>
              ))}
            </ol>
            {isAdmin && (
              <button type="button" onClick={() => setF((pr) => ({ ...pr, stops: [...pr.stops, { name: "", time: "" }] }))} className="btn-line w-full">
                <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "स्टॉप जोड़ें", en: "Add a stop" })}
              </button>
            )}
          </section>

          {r && (r.driver_mobile || r.conductor_mobile) && (
            <section className="space-y-1">
              <h2 className="mlabel">{L({ hi: "कॉल करें", en: "Call" })}</h2>
              {(
                [
                  [L({ hi: "ड्राइवर", en: "Driver" }), r.driver_name, r.driver_mobile],
                  [L({ hi: "कंडक्टर", en: "Conductor" }), r.conductor_name, r.conductor_mobile],
                ] as [string, string | null, string | null][]
              )
                .filter(([, , m]) => m)
                .map(([who, name, m]) => (
                  <a key={who} href={`tel:${m}`} className="flex min-h-[52px] items-center gap-3 border-b border-ink-100 text-[15px] last:border-b-0 active:bg-ink-50">
                    <Phone className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                    <span className="min-w-0 truncate font-medium">{name || who}</span>
                    <span className="text-[13px] text-ink-500">{who}</span>
                    <span className="tnum ml-auto shrink-0 text-ink-700">{fmtPhone(m)}</span>
                  </a>
                ))}
            </section>
          )}

          {isAdmin && (
            <StickyBar>
              <div className="flex items-center gap-2">
                {r && (
                  <button type="button" onClick={remove} disabled={busy} className="btn-line h-11 w-11 shrink-0 px-0 text-rose-600" aria-label={L({ hi: "रूट हटाएँ", en: "Delete route" })}>
                    <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                  </button>
                )}
                <button type="button" onClick={saveDetails} disabled={busy} className="btn-primary flex-1">
                  {busy ? "…" : isNew ? L({ hi: "रूट जोड़ें", en: "Add route" }) : L({ hi: "सेव करें", en: "Save" })}
                </button>
              </div>
            </StickyBar>
          )}
        </>
      )}

      {view === "students" && picked.size > 0 && (
        <StickyBar>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-[13.5px] text-ink-600">
              <b className="text-ink-900">{picked.size}</b> {L({ hi: "चुने", en: "selected" })}
            </p>
            <button type="button" onClick={() => setPicked(new Set())} aria-label={L({ hi: "चुनाव हटाएँ", en: "Clear selection" })} className="grid h-11 w-11 place-items-center text-ink-400">
              <X className="h-5 w-5" aria-hidden />
            </button>
            <button type="button" onClick={() => setMoving(true)} className="btn-primary shrink-0 px-4">
              {L({ hi: "रूट / स्टॉप बदलें", en: "Route / stop" })}
            </button>
          </div>
        </StickyBar>
      )}

      {moving && <MoveSheet count={picked.size} routes={routes} current={r} isUnassigned={isUnassigned} busy={busy} onApply={assign} onClose={() => setMoving(false)} />}

      {printing && r && riders && (
        <PrintSheet onDone={() => setPrinting(false)}>
          <DriverList route={r} riders={riders} school={school} />
        </PrintSheet>
      )}
    </div>
  );
}

/** The ERP drawer's footer for picked students: a route (this one, or another) and a stop on it, then Apply. */
function MoveSheet({ count, routes, current, isUnassigned, busy, onApply, onClose }: { count: number; routes: BusRoute[]; current: BusRoute | null; isUnassigned: boolean; busy: boolean; onApply: (dest: string, stop: string) => void; onClose: () => void }) {
  const L = useL();
  const [moveTo, setMoveTo] = useState(isUnassigned ? routes[0]?.id || "" : "");
  const [moveStop, setMoveStop] = useState("");
  const target = routes.find((x) => x.id === (moveTo || current?.id));
  const dest = moveTo || current?.id || "";

  return (
    <Sheet title={L({ hi: `${count} बच्चे: रूट और स्टॉप`, en: `${count} selected: route & stop` })} onClose={onClose}>
      <div className="space-y-3">
        <SelectBox
          label={L({ hi: "रूट", en: "Route" })}
          value={moveTo}
          onChange={(v) => {
            setMoveTo(v);
            setMoveStop("");
          }}
        >
          {!isUnassigned && <option value="">{L({ hi: "यही रूट", en: "This route" })}</option>}
          {routes
            .filter((x) => x.id !== current?.id)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name.split(" (")[0]}
              </option>
            ))}
        </SelectBox>
        <SelectBox label={L({ hi: "स्टॉप", en: "Stop" })} value={moveStop} onChange={setMoveStop}>
          <option value="">{L({ hi: "स्टॉप नहीं", en: "No stop" })}</option>
          {(target?.stops || []).map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </SelectBox>
        <p className="text-[12.5px] text-ink-500">{L({ hi: "सिर्फ़ रूट और स्टॉप बदलता है। बस की फ़ीस वाली सेटिंग वैसी ही रहती है।", en: "Only the route and stop change. The bus fee setting stays as it is." })}</p>
        <button type="button" onClick={() => onApply(dest, moveStop)} disabled={busy || !dest} className="btn-primary w-full">
          {busy ? "…" : L({ hi: "लागू करें", en: "Apply" })}
        </button>
      </div>
    </Sheet>
  );
}
