export interface Period {
  id: string;
  label: string;
  start: string;
  end: string;
  isBreak: boolean;
}
/** /my/timetable: the teacher's week. Day 1 = Monday … 6 = Saturday; todayDay is 0 on Sunday. */
export interface Week {
  periods: Period[];
  days: Record<string, Record<string, { classSec: string; subject: string }>>;
  todayDay: number;
}

export const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Today in India as YYYY-MM-DD. */
export const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

export const DAYS = {
  hi: ["सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};
export const DAYS_FULL = {
  hi: ["सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
