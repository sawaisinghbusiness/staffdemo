/**
 * Demo mode: the whole staff app runs on the phone with sample data, no backend.
 * Sign in with any 10-digit mobile and the code 123456; pick a role to see its screens.
 * Set NEXT_PUBLIC_DEMO=0 (Vercel → Environment Variables) to use the real backend.
 */
export const DEMO = process.env.NEXT_PUBLIC_DEMO !== "0";
export const DEMO_CODE = "123456";

const SESSION = "sa:demo-session";
const STORE = "sa:demo-store";

export class DemoError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type Role = "teacher" | "driver" | "peon";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const weekday = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay();
const schoolDay = (iso: string) => (weekday(iso) === 0 ? addDays(iso, -1) : iso);

const SCHOOL = { name: "Mother Teresa Nobles Academy", shortName: "MTNA", logoUrl: null as string | null, address: "Nehru Nagar, Barmer", officePhone: "94600 62543" };

const PEOPLE: Record<Role, { name: string; roleLabel: { hi: string; en: string }; empCode: string; joined: string; salary: number }> = {
  teacher: { name: "Rakesh Bishnoi", roleLabel: { hi: "अध्यापक", en: "Teacher" }, empCode: "T-014", joined: "2019-06-15", salary: 28000 },
  driver: { name: "Bhanwar Lal", roleLabel: { hi: "बस ड्राइवर", en: "Bus driver" }, empCode: "D-003", joined: "2018-04-02", salary: 16000 },
  peon: { name: "Mangi Lal", roleLabel: { hi: "सहायक", en: "Attendant" }, empCode: "P-007", joined: "2021-07-01", salary: 12000 },
};

/* ───────────── classes this teacher takes ───────────── */

const SECTIONS = [
  { id: "sec-5b", classSec: "5th - B", subjects: ["Maths", "Science"], classTeacher: true },
  { id: "sec-5a", classSec: "5th - A", subjects: ["Maths"], classTeacher: false },
  { id: "sec-6a", classSec: "6th - A", subjects: ["Maths", "Science"], classTeacher: false },
];

const NAMES = ["Aarav Choudhary", "Ananya Sharma", "Bhavesh Rathore", "Chetna Meena", "Devendra Singh", "Divya Bishnoi", "Farhan Khan", "Geeta Kanwar", "Harsh Vyas", "Ishita Jain", "Jayant Soni", "Kavya Panwar", "Lokesh Gehlot", "Mahi Garg", "Naman Joshi", "Om Prakash", "Priya Garg", "Ritu Parihar", "Sahil Mali", "Tanvi Purohit"];

function roster(secId: string) {
  const start = secId === "sec-5b" ? 0 : secId === "sec-5a" ? 5 : 9;
  const n = secId === "sec-5b" ? 14 : 12;
  return Array.from({ length: n }, (_, i) => ({ id: `${secId}-s${i + 1}`, name: NAMES[(start + i) % NAMES.length], rollNo: String(i + 1).padStart(2, "0") }));
}

/** Small stable number from a string, so each demo child keeps the same marks and details. */
const hash = (x: string) => Array.from(x).reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
const FATHERS = ["Ramesh", "Suresh", "Mahendra", "Bhagirath", "Jagdish", "Om Prakash", "Hanuman Ram", "Prakash", "Dinesh", "Mohan Lal"];
const AREAS = ["Shastri Nagar", "Nehru Nagar", "Sindhari Road", "Station Road", "Ambedkar Circle", "Mahabar Road"];

function studentDetail(id: string) {
  const sec = SECTIONS.find((x) => id.startsWith(x.id + "-"));
  const st = sec && roster(sec.id).find((r) => r.id === id);
  if (!sec || !st) throw new DemoError(404, "Student not found.");
  const h = hash(id);
  const surname = st.name.split(" ").slice(1).join(" ") || "";
  const subjects = sec.classSec.startsWith("6") ? ["English", "Hindi", "Maths", "Science", "Social Studies", "Sanskrit"] : ["English", "Hindi", "Maths", "Science", "Social Studies"];
  const exams = [
    { id: "half-yearly", title: "Half Yearly Exam", date: "2026-09-26", max: 100 },
    { id: "unit-1", title: "Unit Test 1", date: "2026-07-25", max: 50 },
  ].map((e) => {
    const marks = subjects.map((sub, k) => ({ subject: sub, marks: Math.round(e.max * (0.55 + (((h >> k) + k * 7) % 40) / 100)), max: e.max }));
    const total = marks.reduce((a, m) => a + m.marks, 0);
    return { ...e, subjects: marks, total, outOf: e.max * subjects.length };
  });
  const avg = Math.round((exams.reduce((a, e) => a + e.total / e.outOf, 0) / exams.length) * 1000) / 10;
  return {
    ...st,
    classSec: sec.classSec,
    srNo: `SR-20${21 + (h % 4)}-${String(800 + (h % 199)).padStart(4, "0")}`,
    photoUrl: null,
    dob: `20${sec.classSec.startsWith("6") ? 15 : 16}-${String(1 + (h % 12)).padStart(2, "0")}-${String(1 + (h % 27)).padStart(2, "0")}`,
    fatherName: `${FATHERS[h % FATHERS.length]} ${surname}`.trim(),
    parentPhone: `94${String(14000000 + h * 913).slice(0, 8)}`,
    address: `${AREAS[h % AREAS.length]}, Barmer`,
    attendancePct: 84 + (h % 15),
    avgPct: avg,
    exams,
  };
}

/* ───────────── what the staff member adds (kept on the phone) ───────────── */

interface Store {
  role: Role;
  att: Record<string, Record<string, string>>; // `${sec}|${date}` -> studentId -> P/A/L/H
  hw: any[];
  marks: Record<string, Record<string, Record<string, number | null>>>; // `${exam}|${sec}|${subject}` -> studentId -> part -> marks
  leave: any[] | null;
  decided: Record<string, "approved" | "rejected">;
  subs: Record<string, Record<string, boolean>>; // homework id -> studentId -> submitted
  notes: any[];
}
function load(): Store {
  const base: Store = { role: "teacher", att: {}, hw: [], marks: {}, leave: null, decided: {}, subs: {}, notes: [] };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(STORE) || "{}") };
  } catch {
    return base;
  }
}
function save(s: Store) {
  try {
    localStorage.setItem(STORE, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
export const demoSignedIn = () => {
  try {
    return localStorage.getItem(SESSION) === "1";
  } catch {
    return false;
  }
};
export const demoRole = (): Role => load().role;

/* ───────────── screens ───────────── */

const PERIODS = [
  ["p1", "Period 1", "08:00", "08:40"],
  ["p2", "Period 2", "08:40", "09:20"],
  ["p3", "Period 3", "09:20", "10:00"],
  ["p4", "Period 4", "10:00", "10:40"],
  ["brk", "Interval", "10:40", "11:00"],
  ["p5", "Period 5", "11:00", "11:40"],
  ["p6", "Period 6", "11:40", "12:20"],
  ["p7", "Period 7", "12:20", "13:00"],
].map(([id, label, start, end]) => ({ id, label, start, end, isBreak: id === "brk" }));

/** This teacher's week: [period id → class + subject], different each weekday. */
function myTimetable() {
  const slots: Record<string, Record<string, { classSec: string; subject: string }>> = {};
  const pattern = [
    { p1: ["5th - B", "Maths"], p3: ["5th - A", "Maths"], p4: ["6th - A", "Science"], p6: ["5th - B", "Science"] },
    { p2: ["6th - A", "Maths"], p3: ["5th - B", "Maths"], p5: ["5th - A", "Maths"], p7: ["6th - A", "Science"] },
    { p1: ["5th - A", "Maths"], p2: ["5th - B", "Science"], p4: ["5th - B", "Maths"], p6: ["6th - A", "Maths"] },
  ];
  for (let d = 1; d <= 6; d++) {
    slots[d] = {};
    for (const [pid, [classSec, subject]] of Object.entries(pattern[(d - 1) % 3])) slots[d][pid] = { classSec, subject };
  }
  return { periods: PERIODS, days: slots, todayDay: weekday(today()) };
}

function attSheet(secId: string, date: string, s: Store) {
  const sec = SECTIONS.find((x) => x.id === secId);
  if (!sec) throw new DemoError(404, "Class not found.");
  const saved = s.att[`${secId}|${date}`];
  const sunday = weekday(date) === 0;
  return {
    id: sec.id,
    classSec: sec.classSec,
    date,
    sunday,
    holiday: date.endsWith("-10-02") ? "Gandhi Jayanti" : null,
    marked: !!saved,
    students: roster(secId).map((st) => ({ ...st, status: saved?.[st.id] || null })),
  };
}

const EXAMS = [
  { id: "half-yearly", title: "Half Yearly Exam", locked: false, parts: [{ key: "theory", name: "Theory", max: 80 }, { key: "internal", name: "Internal", max: 20 }] },
  { id: "unit-2", title: "Unit Test 2", locked: true, parts: [{ key: "marks", name: "Marks", max: 25 }] },
];

function marksSheet(examId: string, secId: string, subject: string, s: Store) {
  const exam = EXAMS.find((e) => e.id === examId);
  const sec = SECTIONS.find((x) => x.id === secId);
  if (!exam || !sec || !sec.subjects.includes(subject)) throw new DemoError(404, "Not found.");
  const saved = s.marks[`${examId}|${secId}|${subject}`] || {};
  return { exam, classSec: sec.classSec, subject, students: roster(secId).map((st) => ({ ...st, marks: saved[st.id] || {} })) };
}

function leaveRequestsFor(s: Store) {
  const t = today();
  const base = [
    { id: "lr1", student: "Ishita Jain", classSec: "5th - B", from: addDays(t, 1), to: addDays(t, 2), reason: "शादी में बाहर जाना है", parentPhone: "9414011111" },
    { id: "lr2", student: "Harsh Vyas", classSec: "5th - B", from: t, to: t, reason: "बुखार है", parentPhone: "9828022222" },
    { id: "lr3", student: "Tanvi Purohit", classSec: "5th - B", from: addDays(t, 4), to: addDays(t, 6), reason: "Family function in Jodhpur", parentPhone: "9001033333" },
  ];
  return base.map((r) => ({ ...r, type: r.id === "lr2" ? "sick" : "family", halfDay: false, days: Math.round((Date.parse(r.to) - Date.parse(r.from)) / 864e5) + 1, status: (s.decided[r.id] as "approved" | "rejected" | undefined) ?? ("pending" as "pending" | "approved" | "rejected") }));
}

function myMonth(role: Role, month: string) {
  const t = today();
  const first = month + "-01";
  const n = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  const tot = { present: 0, absent: 0, leave: 0, half: 0 };
  const days = [];
  for (let i = 1; i <= n; i++) {
    const date = addDays(first, i - 1);
    const sunday = weekday(date) === 0;
    let mark: "P" | "A" | "L" | "H" | null = null;
    if (!sunday && date <= t && date >= "2026-04-01" && !date.endsWith("-10-02")) {
      const k = (i + role.length) % 19;
      mark = k === 6 ? "L" : k === 13 ? "H" : "P";
      tot[({ P: "present", A: "absent", L: "leave", H: "half" } as const)[mark]]++;
    }
    days.push({ date, mark, holiday: date.endsWith("-10-02") ? "Gandhi Jayanti" : null, sunday });
  }
  return { month, today: t, days, totals: tot };
}

function salary(role: Role) {
  const base = PEOPLE[role].salary;
  const slips = ["2026-09", "2026-08", "2026-07", "2026-06"].map((m, i) => {
    const leaveDays = i === 1 ? 1 : 0;
    const cut = Math.round((base / 30) * leaveDays);
    const pf = Math.round(base * 0.06);
    return { month: m, basic: Math.round(base * 0.6), allowances: Math.round(base * 0.4), deductions: [{ name: "PF", amount: pf }, ...(cut ? [{ name: "Leave cut (1 day)", amount: cut }] : [])], net: base - pf - cut, paidOn: `${m}-30` };
  });
  return { slips };
}

/* ───────────── router ───────────── */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Answers /api/staff-app/* like the backend will. Errors carry the same status codes. */
export async function demoApi(path: string, method: string, body: any): Promise<unknown> {
  await wait(250);
  const u = new URL(path, "http://demo");
  const p = u.pathname;
  const q = (k: string) => u.searchParams.get(k) || "";
  const s = load();
  const t = today();

  try {
    if (p === "/school") return SCHOOL;
    if (p === "/otp" && method === "POST") {
      if (!/^[6-9]\d{9}$/.test(String(body?.mobile || ""))) throw new DemoError(400, "Enter your 10-digit mobile number.");
      return { success: true };
    }
    if (p === "/verify" && method === "POST") {
      if (String(body?.code || "") !== DEMO_CODE) throw new DemoError(401, `That code is not right. (Demo code: ${DEMO_CODE})`);
      s.role = (["teacher", "driver", "peon"].includes(body?.role) ? body.role : "teacher") as Role;
      save(s);
      localStorage.setItem(SESSION, "1");
      return { success: true };
    }
    if (p === "/logout") {
      localStorage.removeItem(SESSION);
      return { success: true };
    }
    if (!demoSignedIn()) throw new DemoError(401, "Please sign in again.");

    const me = PEOPLE[s.role];
    const isTeacher = s.role === "teacher";
    if (p === "/me") return { role: s.role, name: me.name, roleLabel: me.roleLabel, empCode: me.empCode, phone: "9414000000", joined: me.joined, school: SCHOOL, sections: isTeacher ? SECTIONS : [] };

    if (p === "/home") {
      const open = SECTIONS.filter((x) => x.classTeacher && !s.att[`${x.id}|${schoolDay(t)}`]);
      const tt = myTimetable();
      const today_ = weekday(t) === 0 ? {} : tt.days[weekday(t)] || {};
      const mine = myMonth(s.role, t.slice(0, 7)).days.find((d) => d.date === t);
      return {
        date: t,
        myMark: mine?.mark || null,
        lessons: isTeacher ? PERIODS.filter((x) => today_[x.id]).map((x) => ({ ...x, ...today_[x.id] })) : [],
        attendanceToMark: isTeacher ? open.map((x) => ({ id: x.id, classSec: x.classSec })) : [],
        pendingLeaves: isTeacher ? leaveRequestsFor(s).filter((r) => r.status === "pending").length : 0,
      };
    }

    if (p === "/my/attendance") {
      const m = q("month");
      return myMonth(s.role, /^\d{4}-\d{2}$/.test(m) && m <= t.slice(0, 7) && m >= "2026-04" ? m : t.slice(0, 7));
    }
    if (p === "/my/salary") return salary(s.role);
    if (p === "/notices")
      return {
        notices: [
          { id: "n1", title: "Half yearly exam duty chart", body: "Invigilation duties for 21 to 27 October are on the staff room board. Please check your rooms and timings by Friday.", date: addDays(t, -1) },
          { id: "n2", title: "Dussehra holiday", body: "School stays closed from 20 to 22 October. Classes start again on 23 October.", date: addDays(t, -3) },
          { id: "n3", title: "Staff meeting on Saturday", body: "All staff meet in the hall at 1:15 pm after school. Class teachers bring the attendance registers.", date: addDays(t, -6) },
          { id: "n4", title: "September salary credited", body: "September salary has been credited to your bank accounts. Salary slips are in the app.", date: "2026-09-30" },
        ],
      };
    if (p === "/my/timetable") {
      if (!isTeacher) throw new DemoError(403, "Not for your role.");
      return myTimetable();
    }
    if (p === "/my/leave") {
      const mine = (s.leave ||= [
        { id: "my-s1", from: "2026-09-11", to: "2026-09-11", days: 1, type: "casual", halfDay: false, reason: "Bank work in Jodhpur.", status: "approved", createdAt: "2026-09-08T09:00:00Z" },
        { id: "my-s2", from: "2026-08-24", to: "2026-08-24", days: 0.5, type: "sick", halfDay: true, reason: "Doctor's appointment in the morning.", status: "approved", createdAt: "2026-08-23T17:00:00Z" },
      ]);
      if (method === "POST") {
        const from = String(body?.from || "");
        const to = String(body?.to || from);
        const reason = String(body?.reason || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new DemoError(400, "Choose the first day of leave.");
        if (to < from) throw new DemoError(400, "The last day cannot be before the first day.");
        if (from < addDays(t, -3)) throw new DemoError(400, "Leave can start at most 3 days back.");
        if (reason.length < 3) throw new DemoError(400, "Write the reason for leave.");
        if (mine.some((x) => x.status !== "rejected" && x.from <= to && x.to >= from)) throw new DemoError(400, "You have already applied for leave on these days.");
        const halfDay = !!body?.halfDay && from === to;
        const type = ["sick", "family", "casual", "other"].includes(body?.type) ? body.type : "other";
        const row = { id: `my-${Date.now()}`, from, to, days: halfDay ? 0.5 : Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1, type, halfDay, reason, status: "pending", createdAt: new Date().toISOString() };
        mine.unshift(row);
        save(s);
        return { success: true, request: row };
      }
      return { rules: { today: t, minFrom: addDays(t, -3), maxFrom: addDays(t, 90) }, requests: mine };
    }
    const del = /^\/my\/leave\/(.+)$/.exec(p);
    if (del && method === "DELETE") {
      const i = (s.leave || []).findIndex((x) => x.id === del[1] && x.status === "pending");
      if (i < 0) throw new DemoError(404, "Application not found.");
      s.leave!.splice(i, 1);
      save(s);
      return { success: true };
    }

    // Everything below is for teachers.
    if (!isTeacher) throw new DemoError(403, "This part is for teachers.");

    if (p === "/attendance/sections") {
      const date = q("date") || schoolDay(t);
      return { date, sections: SECTIONS.map((x) => ({ id: x.id, classSec: x.classSec, students: roster(x.id).length, marked: !!s.att[`${x.id}|${date}`], mine: x.classTeacher })) };
    }
    if (p === "/attendance/section") {
      if (method === "POST") {
        const sec = SECTIONS.find((x) => x.id === body?.id);
        if (!sec) throw new DemoError(404, "Class not found.");
        if (!sec.classTeacher) throw new DemoError(403, "Only the class teacher marks attendance.");
        const date = String(body?.date || "");
        if (date > t) throw new DemoError(400, "You can't mark a future date.");
        const rows = roster(sec.id);
        const m: Record<string, string> = {};
        for (const r of rows) {
          const v = body?.marks?.[r.id];
          if (!["P", "A", "L", "H"].includes(v)) throw new DemoError(400, "Mark every student before saving.");
          m[r.id] = v;
        }
        s.att[`${sec.id}|${date}`] = m;
        save(s);
        const count = (x: string) => Object.values(m).filter((v) => v === x).length;
        return { success: true, present: count("P"), absent: count("A"), leave: count("L"), half: count("H") };
      }
      return attSheet(q("id"), q("date") || schoolDay(t), s);
    }

    if (p === "/students") {
      const sec = SECTIONS.find((x) => x.id === q("section"));
      if (!sec) throw new DemoError(404, "Class not found.");
      return { id: sec.id, classSec: sec.classSec, students: roster(sec.id) };
    }
    if (p === "/students/detail") return studentDetail(q("id"));

    if (p === "/homework/submissions") {
      const all = [...s.hw, { id: "seed1", sectionId: "sec-5b", classSec: "5th - B", subject: "Maths", title: "Exercise 4.2 — Q 1 to 10", assignedOn: schoolDay(addDays(t, -1)) }, { id: "seed2", sectionId: "sec-5a", classSec: "5th - A", subject: "Maths", title: "Table of 13 and 14", assignedOn: schoolDay(addDays(t, -2)) }];
      const hw = all.find((h) => h.id === (method === "POST" ? body?.id : q("id")));
      if (!hw) throw new DemoError(404, "Homework not found.");
      const rows = roster(hw.sectionId);
      if (method === "POST") {
        const m: Record<string, boolean> = {};
        for (const r of rows) m[r.id] = !!body?.submitted?.[r.id];
        s.subs[hw.id] = m;
        save(s);
        return { success: true, submitted: Object.values(m).filter(Boolean).length };
      }
      const saved = s.subs[hw.id];
      return { homework: hw, checked: !!saved, students: rows.map((r) => ({ ...r, submitted: saved ? !!saved[r.id] : null })) };
    }

    if (p === "/notes") {
      if (method === "POST") {
        const st = studentDetail(String(body?.student || ""));
        const text = String(body?.text || "").trim();
        if (text.length < 3) throw new DemoError(400, "Write the note.");
        const row = { id: `note-${Date.now()}`, studentId: st.id, student: st.name, classSec: st.classSec, text, parentCanSee: !!body?.parentCanSee, date: t };
        s.notes.unshift(row);
        save(s);
        return { success: true, note: row };
      }
      return {
        notes: [
          ...s.notes,
          { id: "note-s1", studentId: "sec-5b-s14", student: "Mahi Garg", classSec: "5th - B", text: "Very good in mental maths. Needs practice in word problems.", parentCanSee: true, date: addDays(t, -5) },
          { id: "note-s2", studentId: "sec-5b-s13", student: "Lokesh Gehlot", classSec: "5th - B", text: "Homework copy not brought for a week. Spoke to father.", parentCanSee: false, date: addDays(t, -9) },
        ],
      };
    }

    if (p === "/homework/options") return { sections: SECTIONS.map((x) => ({ id: x.id, classSec: x.classSec, subjects: x.subjects })) };
    if (p === "/homework") {
      if (method === "POST") {
        const sec = SECTIONS.find((x) => x.id === body?.sectionId);
        const subject = String(body?.subject || "");
        const title = String(body?.title || "").trim();
        if (!sec) throw new DemoError(400, "Choose the class and section.");
        if (!sec.subjects.includes(subject)) throw new DemoError(400, `You can't post ${subject || "this subject"} homework for ${sec.classSec}.`);
        if (title.length < 2) throw new DemoError(400, "Write what the homework is.");
        if (body?.dueDate && body.dueDate < t) throw new DemoError(400, "The due date can't be in the past.");
        const row = { id: `hw-${Date.now()}`, sectionId: sec.id, classSec: sec.classSec, subject, title, details: String(body?.details || "").trim(), assignedOn: t, dueDate: body?.dueDate || null };
        s.hw.unshift(row);
        save(s);
        return { success: true, homework: row };
      }
      const seed = [
        { id: "seed1", sectionId: "sec-5b", classSec: "5th - B", subject: "Maths", title: "Exercise 4.2 — Q 1 to 10", details: "Show all steps.", assignedOn: schoolDay(addDays(t, -1)), dueDate: t },
        { id: "seed2", sectionId: "sec-5a", classSec: "5th - A", subject: "Maths", title: "Table of 13 and 14", details: "", assignedOn: schoolDay(addDays(t, -2)), dueDate: null },
      ];
      const all = [...s.hw, ...seed].filter((h) => !q("section") || h.sectionId === q("section"));
      return { items: all };
    }
    const hdel = /^\/homework\/(.+)$/.exec(p);
    if (hdel && method === "DELETE") {
      s.hw = s.hw.filter((h) => h.id !== hdel[1]);
      save(s);
      return { success: true };
    }

    if (p === "/marks/exams") return { exams: EXAMS.map((e) => ({ id: e.id, title: e.title, locked: e.locked, parts: e.parts })), sections: SECTIONS.map((x) => ({ id: x.id, classSec: x.classSec, subjects: x.subjects })) };
    if (p === "/marks/sheet") {
      if (method === "POST") {
        const exam = EXAMS.find((e) => e.id === body?.exam);
        if (!exam) throw new DemoError(404, "Exam not found.");
        if (exam.locked) throw new DemoError(400, "This exam is locked. Ask the school office to open it.");
        const sheet = marksSheet(body.exam, body.section, body.subject, s);
        const out: Record<string, Record<string, number | null>> = {};
        for (const st of sheet.students) {
          out[st.id] = {};
          for (const part of exam.parts) {
            const v = body?.marks?.[st.id]?.[part.key];
            if (v === null || v === undefined || v === "") {
              out[st.id][part.key] = null;
              continue;
            }
            const n = Number(v);
            if (!Number.isFinite(n) || n < 0 || n > part.max) throw new DemoError(400, `${st.name}: ${part.name} must be between 0 and ${part.max}.`);
            out[st.id][part.key] = n;
          }
        }
        s.marks[`${body.exam}|${body.section}|${body.subject}`] = out;
        save(s);
        return { success: true, saved: sheet.students.length };
      }
      return marksSheet(q("exam"), q("section"), q("subject"), s);
    }

    if (p === "/leave-requests") {
      if (method === "POST") {
        const r = leaveRequestsFor(s).find((x) => x.id === body?.id);
        if (!r || r.status !== "pending") throw new DemoError(400, "This application was already answered.");
        if (!["approved", "rejected"].includes(body?.status)) throw new DemoError(400, "Choose approve or reject.");
        s.decided[r.id] = body.status;
        save(s);
        return { success: true };
      }
      return { requests: leaveRequestsFor(s) };
    }

    throw new DemoError(404, "Not found");
  } catch (e) {
    if (e instanceof DemoError) throw e;
    throw new DemoError(500, "Something went wrong.");
  }
}
