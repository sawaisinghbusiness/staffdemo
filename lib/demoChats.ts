/**
 * Demo answers for the teacher's parent messages (/chats*), shaped like the backend's chatService.
 * Kept in this browser's memory only: a page reload starts the demo conversations again.
 */

type Msg = {
  id: string;
  from: "parent" | "teacher";
  text: string;
  at: string;
  meeting: { date: string; time: string; minutes: number; place: "school" | "call" | "online"; placeText: string; status: "waiting" | "yes" | "other"; meetingId: string | null } | null;
};
type Chat = { id: string; student: string; classSec: string; rollNo: string; attendance: number; readAt: string; messages: Msg[] };

const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
const PLACE = { school: "In school", call: "Phone call", online: "Online" } as const;
let n = 0;
const id = () => `m${Date.now()}${n++}`;

let chats: Chat[] | null = null;
function seed(): Chat[] {
  return [
    {
      id: "c1",
      student: "Laxman Singh",
      classSec: "5th - B",
      rollNo: "12",
      attendance: 92,
      readAt: ago(30),
      messages: [{ id: "a1", from: "parent", text: "Ma'am, Laxman is finding fractions hard. How can we practise at home?", at: ago(14), meeting: null }],
    },
    {
      id: "c2",
      student: "Kavya Purohit",
      classSec: "5th - A",
      rollNo: "7",
      attendance: 85,
      readAt: ago(30),
      messages: [
        { id: "b1", from: "parent", text: "She has fever since last night.", at: ago(3.2), meeting: null },
        { id: "b2", from: "parent", text: "Can she give the Maths test on Monday?", at: ago(3), meeting: null },
      ],
    },
    {
      id: "c3",
      student: "Aarav Mali",
      classSec: "5th - B",
      rollNo: "3",
      attendance: 97,
      readAt: ago(1),
      messages: [
        { id: "d1", from: "parent", text: "Is the picnic form needed by Friday?", at: ago(50), meeting: null },
        { id: "d2", from: "teacher", text: "Yes, please send the form tomorrow.", at: ago(48), meeting: null },
      ],
    },
  ];
}

const err = (status: number, message: string) => Object.assign(new Error(message), { status });
const last = (c: Chat) => c.messages[c.messages.length - 1];
const preview = (m?: Msg) => (m ? { from: m.from, text: m.meeting ? `Meeting time: ${m.meeting.date} ${m.meeting.time}` : m.text, at: m.at } : null);

function thread(c: Chat, today: string) {
  c.readAt = new Date().toISOString();
  return { id: c.id, student: { name: c.student, classSec: c.classSec, rollNo: c.rollNo, photoUrl: null, attendance: c.attendance }, today, messages: c.messages };
}

/** Periods of a demo school day; the teacher has a class in some of them. */
const PERIODS = [
  ["1", "08:00", "08:40"],
  ["2", "08:40", "09:20"],
  ["3", "09:20", "10:00"],
  ["Lunch", "10:00", "10:30"],
  ["4", "10:30", "11:10"],
  ["5", "11:10", "11:50"],
  ["6", "11:50", "12:30"],
  ["7", "12:30", "13:10"],
] as const;

export function demoChats(p: string, method: string, body: any, q: (k: string) => string, today: string, isTeacher: boolean): unknown {
  if (!isTeacher) throw err(403, "Only teachers have parent messages.");
  chats ||= seed();

  if (p === "/chats/unread") return { unread: chats.reduce((a, c) => a + c.messages.filter((m) => m.from === "parent" && m.at > c.readAt).length, 0) };

  if (p === "/chats/day") {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(q("date")) ? q("date") : today;
    const day = new Date(date + "T00:00:00Z").getUTCDay();
    const busy = new Set(day % 2 ? ["1", "3", "5"] : ["2", "4", "7"]);
    return { date, sunday: day === 0, periods: PERIODS.map(([label, start, end]) => ({ label, start, end, state: label === "Lunch" ? "break" : busy.has(label) ? "class" : "free" })) };
  }

  if (p === "/chats") {
    const rows = chats.map((c) => {
      const l = last(c);
      let i = c.messages.length - 1;
      while (i > 0 && c.messages[i - 1].from === "parent") i--;
      return { id: c.id, student: c.student, classSec: c.classSec, last: preview(l), unread: c.messages.filter((m) => m.from === "parent" && m.at > c.readAt).length, waitingSince: l?.from === "parent" ? c.messages[i].at : null };
    });
    return {
      classes: ["5th - A", "5th - B"],
      waiting: rows.filter((r) => r.waitingSince).sort((a, b) => a.waitingSince!.localeCompare(b.waitingSince!)),
      replied: rows.filter((r) => !r.waitingSince).sort((a, b) => (b.last?.at || "").localeCompare(a.last?.at || "")),
    };
  }

  const m = p.match(/^\/chats\/([^/]+)(\/send|\/meet)?$/);
  const c = m && chats.find((x) => x.id === m[1]);
  if (!m || !c) throw err(404, "Conversation not found.");
  if (!m[2]) return thread(c, today);
  if (method !== "POST") throw err(405, "Not allowed.");

  if (m[2] === "/send") {
    const text = String(body?.text || "").trim().slice(0, 1000);
    if (!text) throw err(400, "Write a reply first.");
    c.messages.push({ id: id(), from: "teacher", text, at: new Date().toISOString(), meeting: null });
    return thread(c, today);
  }

  const date = String(body?.date || "");
  const time = String(body?.time || "");
  const place = String(body?.place || "") as keyof typeof PLACE;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) throw err(400, "Pick a day in the next 30 days.");
  if (!/^\d{2}:\d{2}$/.test(time)) throw err(400, "Pick a time.");
  if (!(place in PLACE)) throw err(400, "Choose where to meet.");
  for (const x of c.messages) if (x.meeting?.status === "waiting") x.meeting.status = "other";
  c.messages.push({ id: id(), from: "teacher", text: "", at: new Date().toISOString(), meeting: { date, time, minutes: 10, place, placeText: PLACE[place], status: "waiting", meetingId: null } });
  // The demo parent says Okay a few seconds later, so the green "coming" can be seen.
  const sent = c.messages[c.messages.length - 1];
  setTimeout(() => {
    if (sent.meeting?.status === "waiting") sent.meeting.status = "yes";
  }, 6000);
  return thread(c, today);
}
