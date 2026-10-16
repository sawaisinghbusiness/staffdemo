"use client";

/**
 * ERP login (2026-10-16): someone signed in with the ERP website's username + password sees the exact
 * teacher app, but every screen is empty for now. What each screen may show for them comes later,
 * screen by screen. Their session is the backend's /api/auth one; /api/staff-app is never called.
 */

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

async function getJson(url: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  } catch {
    throw new ErpError(0, "offline");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErpError(res.status, (data as any)?.error || "");
  return data as any;
}

/**
 * "/erp/…" goes to the ERP's own backend API ("/erp/students" → /api/students), so the ERP's role
 * rules apply unchanged. Every other path is a staff-app path, answered with the right shape and nothing in it.
 */
export async function erpApi(path: string, method: string, body?: unknown): Promise<unknown> {
  if (path.startsWith("/erp/"))
    return getJson("/api" + path.slice(4), method === "GET" ? undefined : { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

  const u = new URL(path, "http://erp");
  const p = u.pathname;
  const t = today();

  if (p === "/logout") {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => null);
    setErpMode(false);
    return { success: true };
  }
  if (p === "/school") return getJson("/api/staff-app/school");
  if (p === "/me") {
    const [{ user }, school] = await Promise.all([getJson("/api/auth/me"), getJson("/api/staff-app/school").catch(() => ({ name: "", shortName: "", logoUrl: null, officePhone: "" }))]);
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
    };
  }

  // Nothing can be saved from an ERP login yet.
  if (method !== "GET") throw new ErpError(403, "ERP लॉगिन में यह अभी चालू नहीं है।");

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
  throw new ErpError(404, "ERP लॉगिन में यह अभी खाली है।");
}
