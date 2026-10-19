/* Copied from the ERP (components/transport/RouteDrawer.tsx → DriverList). Keep in step. */

import { fmtPhone, type BusRoute, type Rider } from "@/lib/erpTransport";

/** A4 list for the bus: students grouped by stop, with parents' numbers. */
export function DriverList({ route, riders, school }: { route: BusRoute; riders: Rider[]; school: string }) {
  const order = new Map(route.stops.map((s, i) => [s.name, i]));
  const rows = [...riders].sort((a, b) => (order.get(a.stop) ?? 999) - (order.get(b.stop) ?? 999) || a.name.localeCompare(b.name));
  const time = (stop: string) => route.stops.find((s) => s.name === stop)?.time || "";
  const cell = "border border-black px-2 py-1";
  return (
    // Not a fixed A4 box: a long route runs onto a second page.
    <div className="mx-auto w-[794px] bg-white px-10 py-10 text-[12px] text-black" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div className="border-b-2 border-black pb-2">
        <div className="text-[16px] font-bold">{school}</div>
        <div className="mt-0.5 flex justify-between text-[13px]">
          <b>{route.name}</b>
          <span>{[route.vehicle_no, route.driver_name && `Driver ${route.driver_name} ${fmtPhone(route.driver_mobile)}`].filter(Boolean).join(" · ")}</span>
        </div>
      </div>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="bg-neutral-100">
            <th className={`${cell} w-8 text-left`}>#</th>
            <th className={`${cell} text-left`}>Student</th>
            <th className={`${cell} text-left`}>Class</th>
            <th className={`${cell} text-left`}>Stop</th>
            <th className={`${cell} text-left`}>Parent</th>
            <th className={`${cell} text-left`}>Mobile</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={s.id}>
              <td className={cell}>{i + 1}</td>
              <td className={cell}>{s.name}</td>
              <td className={cell}>{s.classSec}</td>
              <td className={cell}>{s.stop ? `${s.stop}${time(s.stop) ? ` (${time(s.stop)})` : ""}` : "—"}</td>
              <td className={cell}>{s.fatherName}</td>
              <td className={`${cell} tabular-nums`}>{fmtPhone(s.mobile)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
