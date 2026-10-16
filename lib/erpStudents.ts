/** A student as the ERP backend's /api/students returns it (ERP lib/services/studentService mapDbToStudent). */
export interface ErpStudent {
  id: string;
  name: string;
  photoUrl?: string;
  srNo: string;
  admissionNo: string;
  rollNo: string;
  class: string;
  section: string;
  classSec: string;
  fatherName: string;
  motherName: string;
  guardianName: string;
  contact: string;
  mobile: string;
  address: string;
  penNo: string;
  gender: string;
  dob: string;
  category: string;
  house: string;
  transportOpted: boolean;
  busRoute?: string | null;
  status: string;
  totalFee: number;
  paidFee: number;
  balanceFee: number;
}

/** Same class order as the ERP's students page. */
const CLASS_ORDER = ["Nursery", "LKG", "UKG", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
export const classRank = (c: string) => {
  const i = CLASS_ORDER.indexOf(c);
  return i === -1 ? 100 + (parseInt(c, 10) || 0) : i;
};

/** "S/o Ramesh Kumar" or "D/o …" from the gender on record, as the ERP writes it. */
export const parentLine = (s: ErpStudent) => (s.fatherName ? `${s.gender === "Female" ? "D/o" : "S/o"} ${s.fatherName}` : "—");

/** The ERP's "Any field" search: name, SR no., admission no., parents, mobile, PEN; roll no. must match exactly. */
export function matchesStudent(s: ErpStudent, q: string) {
  const has = (v?: string | null) => !!v && v.toLowerCase().includes(q);
  return has(s.name) || has(s.srNo) || has(s.admissionNo) || has(s.fatherName) || has(s.motherName) || has(s.mobile) || has(s.contact) || has(s.penNo) || (s.rollNo || "").toLowerCase() === q;
}
