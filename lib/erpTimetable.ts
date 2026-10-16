/** ERP timetable shapes (ERP lib/services/timetableService.ts). Backend /api/timetable is the authority. */
export interface TTPeriod {
  id: string;
  seq: number;
  label: string;
  start: string;
  end: string;
  isBreak: boolean;
}
export interface TTSection {
  id: string;
  name: string;
  subjects: string[];
}
export interface TTClass {
  id: string;
  name: string;
  sections: TTSection[];
}
export interface TTTeacher {
  id: string;
  name: string;
  designation: string;
  userId: string | null;
  teaching: boolean;
  assigned: { classSec: string; subject: string }[];
}
export interface TTOverview {
  setupNeeded: boolean;
  periods: TTPeriod[];
  classes: TTClass[];
  teachers: TTTeacher[];
  /** The viewer's own staff id, when they are on the staff list. */
  me: string | null;
}
export interface TTEntry {
  id: string;
  day: number;
  periodId: string;
  subject: string;
  staffId: string | null;
}
export interface TTBusy {
  day: number;
  periodId: string;
  staffId: string;
  classSec: string;
}
export interface TTTeacherEntry {
  day: number;
  periodId: string;
  subject: string;
  classSec: string;
}
