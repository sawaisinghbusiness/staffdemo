"use client";

/**
 * ERP login (2026-10-16): someone signed in with the ERP website's username + password sees the exact
 * teacher app, but every screen is empty for now. What each screen may show for them comes later,
 * screen by screen. Their session is the backend's /api/auth one; /api/staff-app is never called.
 */

import { say } from "@/lib/i18n";

const MODE = "sa:erp";

export function isErpMode() {
  try {
    return localStorage.getItem(MODE) === "1";
  } catch {
    return false;
  }
}
export function setErpMode(on: boolean) {
  try {
    if (on) localStorage.setItem(MODE, "1");
    else localStorage.removeItem(MODE);
  } catch {
    /* storage blocked: they land on staff sign-in next time */
  }
}

class ErpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function getJson(url:string,init?:RequestInit,ms=30000){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ms);try{const res=await fetch(url,{credentials:'include',cache:'no-store',...init,signal:controller.signal});const data=await res.json().catch(e=>{if(controller.signal.aborted)throw e;if(res.ok)throw new ErpError(502,say({hi:'ERP सर्वर से गलत जवाब आया।',en:'The ERP server returned invalid data.'}));return {};});if(res.status===403&&FAMILY_403.test(data?.error||''))notErp();if(!res.ok)throw new ErpError(res.status,data?.error||say({hi:'काम पूरा नहीं हो सका।',en:'The request could not be completed.'}));return data as any;}catch(e){if(e instanceof ErpError)throw e;throw new ErpError(0,controller.signal.aborted?'timeout':'offline');}finally{clearTimeout(timer);}}

const FAMILY_403 = /^This area is for school staff/;
const ERP_ROLES = ["admin", "teacher", "accountant", "exam_cell"];
function notErp(): never {
  setErpMode(false);
  throw new ErpError(401, say({ hi: "कृपया फिर से लॉगिन करें।", en: "Please sign in again." }));
}

/**
 * "/erp/…" goes to the ERP's own backend API ("/erp/students" → /api/students), so the ERP's role
 * rules apply unchanged. Every other path is a staff-app path, answered with the right shape and nothing in it.
 */
export async function erpApi(path: string, method: string, body?: unknown, timeoutMs?: number): Promise<unknown> {
  if (path.startsWith("/erp/"))
    return getJson("/api" + path.slice(4), method === "GET" ? undefined : { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

  const u = new URL(path, "http://erp");
  const p = u.pathname;
  const t = today();

  if (p === "/logout") {
    try{await getJson("/api/auth/logout",{method:"POST"});}catch(e){if(!(e instanceof ErpError)||e.status!==401)throw e;}
    setErpMode(false);
    return { success: true };
  }
  if (p === "/school") return getJson("/api/staff-app/school");
  if (p === "/me") {
    const [{ user }, school] = await Promise.all([getJson("/api/auth/me"), getJson("/api/staff-app/school").catch(() => ({ name: "", shortName: "", logoUrl: null, officePhone: "" }))]);
    if (!ERP_ROLES.includes(user?.role)) notErp();
    return {
      role: "teacher",
      name: user.name,
      roleLabel: { hi: "ERP लॉगिन", en: "ERP login" },
      empCode: user.identifier,
      photoUrl: null,
      phone: user.identifier,
      joined: t,
      school,
      sections: [],
      erpRole: user.role,
      erpPerms: Array.isArray(user.permissions) ? user.permissions : undefined,
    };
  }

  // School Sahayak: the office version answers from the school's own figures.
  if (p === "/assistant" || p === "/assistant/warm") return getJson(`/api/dashboard${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }, timeoutMs);

  // Nothing can be saved from an ERP login yet.
  if (method !== "GET") throw new ErpError(403, say({ hi: "ERP लॉगिन में यह अभी चालू नहीं है।", en: "This is not available with the ERP login yet." }));

  const month = /^\d{4}-\d{2}$/.test(u.searchParams.get("month") || "") ? u.searchParams.get("month")! : t.slice(0, 7);
  switch (p) {
    case "/home":
      return { date: t, myMark: null, lessons: [], attendanceToMark: [], pendingLeaves: 0 };
    case "/chats/unread":
      return { unread: 0 };
    case "/chats":
      return { classes: [], waiting: [], replied: [] };
    case "/notices":
      return { notices: [] };
    case "/my/attendance": {
      const n = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
      const days = Array.from({ length: n }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, "0")}`;
        return { date, mark: null, holiday: null, sunday: new Date(date + "T00:00:00").getDay() === 0 };
      });
      return { month, today: t, days, totals: { present: 0, absent: 0, leave: 0, half: 0 } };
    }
    case "/my/salary":
      return { slips: [] };
    case "/my/timetable":
      return { periods: [], days: {}, todayDay: new Date().getDay() };
    case "/my/leave":
      return { rules: { today: t, minFrom: t, maxFrom: t }, requests: [] };
    case "/attendance/sections":
      return { date: t, sections: [] };
    case "/homework/options":
      return { sections: [] };
    case "/homework":
      return { items: [] };
    case "/notes":
      return { notes: [] };
    case "/marks/exams":
      return { exams: [], sections: [] };
    case "/leave-requests":
      return { requests: [] };
  }
  throw new ErpError(404, say({ hi: "ERP लॉगिन में यह अभी खाली है।", en: "This is empty with the ERP login for now." }));
}
