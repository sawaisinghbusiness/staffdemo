/**
 * Bus route shapes and helpers. Copied from ERP lib/services/transportService.ts, app/transport/page.tsx
 * and components/transport/RouteDrawer.tsx — keep in step with the ERP.
 *
 * Backend: GET /api/transport, GET /api/transport/:id/students (:id or "unassigned"),
 * POST /api/transport, PATCH/DELETE /api/transport/:id (admin), POST /api/transport/assign (admin, accountant).
 * Assign only sets students.bus_route / bus_stop for students who already take the bus; it never
 * touches students.transport_opted (that is a fee setting).
 */

export interface Stop {
  name: string;
  time: string;
}

export interface BusRoute {
  id: string;
  name: string;
  stops: Stop[];
  vehicle_no: string | null;
  capacity: number | null;
  driver_name: string | null;
  driver_mobile: string | null;
  conductor_name: string | null;
  conductor_mobile: string | null;
  students: number;
}

export interface Rider {
  id: string;
  name: string;
  classSec: string;
  fatherName: string;
  gender: string;
  mobile: string;
  stop: string;
}

export type RouteInput = Omit<BusRoute, "id" | "students" | "capacity"> & { capacity: string };

export interface TransportList {
  routes: BusRoute[];
  total: number;
  unassigned: number;
  setupNeeded: boolean;
}

export const blankRoute = (): RouteInput => ({ name: "", stops: [], vehicle_no: "", capacity: "", driver_name: "", driver_mobile: "", conductor_name: "", conductor_mobile: "" });

export const routeToInput = (r: BusRoute): RouteInput => ({
  name: r.name,
  stops: r.stops,
  vehicle_no: r.vehicle_no || "",
  capacity: r.capacity ? String(r.capacity) : "",
  driver_name: r.driver_name || "",
  driver_mobile: r.driver_mobile || "",
  conductor_name: r.conductor_name || "",
  conductor_mobile: r.conductor_mobile || "",
});

/** "98765 43210", or "—" for an empty / placeholder number (RouteDrawer's fmtPhone). */
export const fmtPhone = (p?: string | null) => (p && /^\d{10}$/.test(p) && !/^(\d)\1{9}$/.test(p) ? `${p.slice(0, 5)} ${p.slice(5)}` : "—");

/** "Route 8 (Rai Colony - Civil Lines)" → ["Route 8", "Rai Colony – Civil Lines"]. */
export function splitName(name: string): [string, string] {
  const m = name.match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? [m[1], m[2].replace(/\s+-\s+/g, " – ")] : [name, ""];
}
