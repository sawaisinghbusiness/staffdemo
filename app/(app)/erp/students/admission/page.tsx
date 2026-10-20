"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, Camera, Check, CheckCircle2, Plus, Search, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { rupees } from "@/lib/format";
import { toast } from "@/lib/toast";
import { classRank, matchesStudent, parentLine, type ErpStudent, type ErpStudentFull } from "@/lib/erpStudents";
import type { Enquiry } from "@/lib/erpEnquiry";
import { dateInWords } from "@/lib/erpWords";
import { planFor, type FeeConfig } from "@/lib/erpFeeEngine";
import type { TransportList } from "@/lib/erpTransport";
import { DOCS, shrinkScan } from "@/lib/erpDocs";
import { cropPhoto } from "@/components/erp/PhotoCropper";
import { Avatar, ErrorCard, ListSkeleton, SelectBox, Sheet } from "@/components/ui";

/*
 * ERP login → New admission / Edit student: the full admission form in 7 steps (preview approved 2026-10-20,
 * artifact 8d1V8rM2gSuxgyoeKyxJFL). POST /api/students or PATCH /api/students/:id — the backend makes the
 * fee ledger from the fee setup. The extra details need backend migration 20261020_student_admission_details.sql;
 * before it is run the backend still saves the old fields and says so (detailsSaved: false).
 */

type Say = (b: { hi: string; en: string }) => string;

const GENDERS = ["Male", "Female", "Other"] as const;
const CATEGORIES = ["General", "OBC", "MBC", "SC", "ST", "EWS"];
const RELIGIONS = ["Hindu", "Muslim", "Sikh", "Jain", "Christian", "Buddhist", "Other"];
const TONGUES = ["Hindi", "Marwari", "Sindhi", "Punjabi", "Urdu", "English", "Other"];
const BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const EDUCATION = ["Below 10th", "10th", "12th", "Graduate", "Post graduate", "Doctorate"];
const INCOME = ["Below ₹1 lakh", "₹1–2.5 lakh", "₹2.5–5 lakh", "₹5–10 lakh", "Above ₹10 lakh"];
const BOARDS = ["RBSE", "CBSE", "Other"];
const PREV_CLASSES = ["Nursery", "LKG", "UKG", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th"];

const STEPS = [
  { key: "student", text: { hi: "बच्चा", en: "Student" } },
  { key: "class", text: { hi: "कक्षा", en: "Class" } },
  { key: "old", text: { hi: "पिछला स्कूल", en: "Last school" } },
  { key: "family", text: { hi: "परिवार", en: "Family" } },
  { key: "address", text: { hi: "पता और बस", en: "Address & bus" } },
  { key: "docs", text: { hi: "कागज़", en: "Documents" } },
  { key: "check", text: { hi: "जाँचें और सेव", en: "Check & save" } },
] as const;
type StepKey = (typeof STEPS)[number]["key"];
/** Steps with required boxes: their tick shows live, the moment those boxes are right. */
const HAS_REQUIRED = new Set<StepKey>(["student", "class", "family", "address"]);

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function nextNumber(ids: string[], fallback: number) {
  const nums = ids.map((v) => parseInt(String(v).match(/(\d+)\s*$/)?.[1] || "", 10)).filter((n) => Number.isFinite(n));
  return (nums.length ? Math.max(...nums) : fallback - 1) + 1;
}

function blank(cls = "1st") {
  return {
    // Student
    name: "", nameHi: "", gender: "Male" as string, dob: "", birthPlace: "", aadhaarNo: "", religion: "Hindu", caste: "",
    category: "General", nationality: "Indian", motherTongue: "Hindi", bloodGroup: "", healthNotes: "", cwsn: false, idMark: "",
    // Class
    class: cls, section: "", medium: "English", rollNo: "", house: "", srNo: "", admissionNo: "", admissionDate: todayIso(),
    penNo: "", shalaDarpanId: "", admissionType: "New admission" as string, rte: false,
    // Last school
    prevSchool: "", prevBoard: "RBSE", prevClass: "", prevYear: "", prevResult: "", tcNo: "", tcDate: "", leavingReason: "",
    // Family
    fatherName: "", mobile: "", fatherOccupation: "", fatherEducation: "", fatherAadhaar: "", fatherEmail: "",
    motherName: "", motherMobile: "", motherOccupation: "", motherEducation: "", motherAadhaar: "", whatsappTo: "Father",
    familyIncome: "", janAadhaar: "", bpl: false, guardianName: "", guardianRelation: "", guardianMobile: "",
    // Address & bus
    address: "", city: "Barmer", tehsil: "Barmer", district: "Barmer", pincode: "", sameLetters: true, lettersAddress: "",
    transport: false, busRoute: "", busStop: "", emergencyName: "", emergencyRelation: "", emergencyMobile: "",
    // Documents & bank
    documents: {} as Record<string, boolean>, bankHolder: "", bankAccount: "", bankIfsc: "",
  };
}
type Form = ReturnType<typeof blank>;
type Key = keyof Form;
type Errors = Partial<Record<Key, string>>;

function fromStudent(s: ErpStudentFull): Form {
  const b = blank(s.class);
  const pick = <T extends string>(v: string | undefined, list: readonly T[], dflt: T) => ((list as readonly string[]).includes(v || "") ? (v as T) : dflt);
  const digits = (v?: string) => (v || "").replace(/\D/g, "").slice(-10);
  return {
    ...b,
    name: s.name || "", nameHi: s.nameHi || "", gender: pick(s.gender, GENDERS, "Male"), dob: (s.dob || "").slice(0, 10), birthPlace: s.birthPlace || "",
    aadhaarNo: s.aadhaarNo || "", religion: s.religion || b.religion, caste: s.caste || "", category: s.category || "General",
    nationality: s.nationality || b.nationality, motherTongue: s.motherTongue || b.motherTongue, bloodGroup: s.bloodGroup || "", healthNotes: s.healthNotes || "",
    cwsn: !!s.cwsn, idMark: s.idMark || "",
    class: s.class, section: s.section, medium: s.medium || b.medium, rollNo: s.rollNo || "", house: s.house || "", srNo: s.srNo || "", admissionNo: s.admissionNo || "",
    admissionDate: s.admissionDate || "", penNo: s.penNo || "", shalaDarpanId: s.shalaDarpanId || "", admissionType: s.admissionType || b.admissionType, rte: !!s.rte,
    prevSchool: s.prevSchool || "", prevBoard: s.prevBoard || b.prevBoard, prevClass: s.prevClass || "", prevYear: s.prevYear || "", prevResult: s.prevResult || "",
    tcNo: s.tcNo || "", tcDate: s.tcDate || "", leavingReason: s.leavingReason || "",
    fatherName: s.fatherName || "", mobile: digits(s.mobile), fatherOccupation: s.fatherOccupation || "", fatherEducation: s.fatherEducation || "",
    fatherAadhaar: s.fatherAadhaar || "", fatherEmail: s.fatherEmail || "",
    motherName: s.motherName || "", motherMobile: digits(s.motherMobile || (s.contact && s.contact !== s.mobile ? s.contact : "")), motherOccupation: s.motherOccupation || "",
    motherEducation: s.motherEducation || "", motherAadhaar: s.motherAadhaar || "", whatsappTo: s.whatsappTo || "Father",
    familyIncome: s.familyIncome || "", janAadhaar: s.janAadhaar || "", bpl: !!s.bpl,
    guardianName: s.guardianName && s.guardianName !== s.fatherName ? s.guardianName : "", guardianRelation: s.guardianRelation || "", guardianMobile: digits(s.guardianMobile),
    address: s.address || "", city: s.city || "", tehsil: s.tehsil || "", district: s.district || "", pincode: s.pincode || "",
    sameLetters: !s.lettersAddress, lettersAddress: s.lettersAddress || "",
    transport: !!s.transportOpted, busRoute: s.transportOpted ? s.busRoute || "" : "", busStop: s.busStop || "",
    emergencyName: s.emergencyName || "", emergencyRelation: s.emergencyRelation || "", emergencyMobile: digits(s.emergencyMobile),
    documents: s.documents || {}, bankHolder: s.bankHolder || "", bankAccount: s.bankAccount || "", bankIfsc: s.bankIfsc || "",
  };
}

const MOBILE = /^[6-9]\d{9}$/;
/** The checks for one step; "check" runs them all. */
function validate(step: StepKey, f: Form, takenSr: Set<string>, L: Say): Errors {
  const e: Errors = {};
  const all = step === "check";
  const optMobile = (k: Key) => {
    const v = f[k] as string;
    if (v && !MOBILE.test(v)) e[k] = L({ hi: "10 अंकों का नंबर लिखें, या खाली छोड़ें।", en: "Enter a 10-digit number, or leave it empty." });
  };
  const optDigits = (k: Key, n: number) => {
    const v = (f[k] as string).replace(/\s/g, "");
    if (v && !new RegExp(`^\\d{${n}}$`).test(v)) e[k] = L({ hi: `${n} अंक लिखें, या खाली छोड़ें।`, en: `Enter ${n} digits, or leave it empty.` });
  };
  if (all || step === "student") {
    if (!f.name.trim()) e.name = L({ hi: "बच्चे का पूरा नाम लिखें।", en: "Enter the student's full name." });
    if (!f.dob) e.dob = L({ hi: "जन्म तिथि चुनें।", en: "Choose the date of birth." });
    else if (f.dob > todayIso()) e.dob = L({ hi: "जन्म तिथि आगे की नहीं हो सकती।", en: "Date of birth can't be in the future." });
    optDigits("aadhaarNo", 12);
  }
  if (all || step === "class") {
    if (!f.section) e.section = L({ hi: "सेक्शन चुनें।", en: "Choose a section." });
    if (!f.srNo.trim()) e.srNo = L({ hi: "SR नंबर लिखें।", en: "Enter the SR number." });
    else if (takenSr.has(f.srNo.trim())) e.srNo = L({ hi: "यह SR नंबर पहले से है।", en: "This SR number is already used." });
    if (!f.admissionDate) e.admissionDate = L({ hi: "प्रवेश की तारीख़ चुनें।", en: "Choose the admission date." });
    optDigits("penNo", 11);
  }
  if (all || step === "family") {
    if (!f.fatherName.trim()) e.fatherName = L({ hi: "पिता या अभिभावक का नाम लिखें।", en: "Enter the father's or guardian's name." });
    if (!MOBILE.test(f.mobile)) e.mobile = L({ hi: "6, 7, 8 या 9 से शुरू होने वाला 10 अंकों का नंबर लिखें।", en: "Enter a 10-digit mobile number starting with 6, 7, 8 or 9." });
    if (!f.motherName.trim()) e.motherName = L({ hi: "माता का नाम लिखें।", en: "Enter the mother's name." });
    optMobile("motherMobile");
    optMobile("guardianMobile");
    optDigits("fatherAadhaar", 12);
    optDigits("motherAadhaar", 12);
    optDigits("janAadhaar", 10);
    if (f.fatherEmail && !/^\S+@\S+\.\S+$/.test(f.fatherEmail)) e.fatherEmail = L({ hi: "सही ईमेल लिखें, या खाली छोड़ें।", en: "Enter a valid email, or leave it empty." });
  }
  if (all || step === "address") {
    if (!f.address.trim()) e.address = L({ hi: "घर का पता लिखें।", en: "Enter the home address." });
    optDigits("pincode", 6);
    if (f.transport && !f.busRoute) e.busRoute = L({ hi: "बस रूट चुनें, या बस बंद करें।", en: "Choose a bus route, or turn the bus off." });
    optMobile("emergencyMobile");
  }
  if (all || step === "docs") {
    if (f.bankIfsc && !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(f.bankIfsc.trim())) e.bankIfsc = L({ hi: "IFSC 11 अक्षर का होता है, जैसे SBIN0001234।", en: "IFSC has 11 characters, like SBIN0001234." });
  }
  return e;
}
/** Which step an error belongs to, to jump there from "Check & save". */
const STEP_OF: Partial<Record<Key, StepKey>> = {
  name: "student", dob: "student", aadhaarNo: "student", section: "class", srNo: "class", admissionDate: "class", penNo: "class",
  fatherName: "family", mobile: "family", motherName: "family", motherMobile: "family", guardianMobile: "family", fatherAadhaar: "family",
  motherAadhaar: "family", janAadhaar: "family", fatherEmail: "family", address: "address", pincode: "address", busRoute: "address",
  emergencyMobile: "address", bankIfsc: "docs",
};

function ageOn1April(dob: string) {
  if (!dob) return "";
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [y, m, d] = dob.split("-").map(Number);
  let months = (year - y) * 12 + (4 - m);
  if (1 < d) months -= 1;
  if (months < 0) return "";
  return `${Math.floor(months / 12)} yrs ${months % 12} mo`;
}

type Sibling = NonNullable<ErpStudentFull["siblings"]>[number];

export default function ErpAdmissionPage() {
  const L = useL();
  const [editId, setEditId] = useState<string | null>(null);
  const [enquiryId, setEnquiryId] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setEnquiryId(p.get("enquiry") || "");
    setEditId(p.get("id") || "");
  }, []);
  const list = useApi<{ data: ErpStudent[] }>("/erp/students");
  const one = useApi<{ data: ErpStudentFull }>(editId ? `/erp/students/${encodeURIComponent(editId)}` : null);
  // Admitting from an admission enquiry: its details fill the form (ERP enquiries page → AdmissionDrawer prefill).
  const enquiries = useApi<{ data: Enquiry[] }>(enquiryId ? "/erp/enquiries" : null);
  const feeSetup = useApi<{ config: FeeConfig }>(editId === "" ? "/erp/fee-setup" : null);
  // Routes and their stops as Transport keeps them; children already on a route fill in any the list lacks.
  const transport = useApi<TransportList>("/erp/transport");
  const enquiry = enquiryId ? enquiries.data?.data.find((x) => x.id === enquiryId) || null : null;
  const students = useMemo(() => list.data?.data || [], [list.data]);
  const editing = editId ? one.data?.data || null : null;

  const lookups = useMemo(() => {
    const sectionsByClass = new Map<string, Set<string>>();
    const stopsByRoute = new Map<string, Set<string>>();
    const houses = new Set<string>();
    for (const s of students) {
      if (!sectionsByClass.has(s.class)) sectionsByClass.set(s.class, new Set());
      sectionsByClass.get(s.class)!.add(s.section);
      if (s.transportOpted && s.busRoute) {
        if (!stopsByRoute.has(s.busRoute)) stopsByRoute.set(s.busRoute, new Set());
        if (s.busStop) stopsByRoute.get(s.busRoute)!.add(s.busStop);
      }
      if (s.house) houses.add(s.house);
    }
    for (const r of transport.data?.routes || []) {
      if (!stopsByRoute.has(r.name)) stopsByRoute.set(r.name, new Set());
      for (const st of r.stops || []) if (st?.name) stopsByRoute.get(r.name)!.add(st.name);
    }
    return {
      classes: Array.from(sectionsByClass.keys()).sort((a, b) => classRank(a) - classRank(b)),
      sectionsOf: (c: string) => Array.from(sectionsByClass.get(c) || new Set(["A"])).sort(),
      routes: Array.from(stopsByRoute.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      stopsOf: (r: string) => Array.from(stopsByRoute.get(r) || []).sort(),
      houses: Array.from(houses).sort(),
      takenSr: new Set(students.filter((s) => s.id !== editId).map((s) => s.srNo)),
      nextSr: `SR-2026-${nextNumber(students.map((s) => s.srNo), 1001)}`,
      nextAdm: `ADM-${nextNumber(students.map((s) => s.admissionNo), 1)}`,
      nextRoll: (c: string, sec: string) => String(nextNumber(students.filter((s) => s.class === c && s.section === sec).map((s) => s.rollNo || ""), 1)),
    };
  }, [students, editId, transport.data]);

  const [form, setForm] = useState<Form | null>(null);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0); // furthest step opened, for the ticks
  const [errors, setErrors] = useState<Errors>({});
  const [tried, setTried] = useState<Set<StepKey>>(new Set());
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<(ErpStudent & { detailsSaved?: boolean }) | null>(null);
  const [closedEnquiry, setClosedEnquiry] = useState(false);
  const [siblings, setSiblings] = useState<Sibling[]>([]);
  const [findSibling, setFindSibling] = useState(false);
  const [photo, setPhoto] = useState<string>(""); // a new photo (data URL) waiting to be saved
  const photoInput = useRef<HTMLInputElement>(null);
  // Document scans picked in the form; they go up after the student is saved (a new child has no id before).
  const [scans, setScans] = useState<Record<string, string>>({});
  const scanInput = useRef<HTMLInputElement>(null);
  const scanFor = useRef("");
  const stepNav = useRef<HTMLElement>(null);
  // Keep the current step chip in the middle of the strip (sideways only, the page itself doesn't move).
  useEffect(() => {
    const nav = stepNav.current;
    const chip = nav?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    if (nav && chip) nav.scrollTo({ left: chip.offsetLeft - nav.clientWidth / 2 + chip.offsetWidth / 2, behavior: "smooth" });
  }, [step, form === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (keepClass?: string) => {
    const cls = keepClass || lookups.classes[0] || "1st";
    const sec = lookups.sectionsOf(cls)[0] || "";
    const fresh = { srNo: lookups.nextSr, admissionNo: lookups.nextAdm };
    if (enquiry && !keepClass) {
      const pc = lookups.classes.includes(enquiry.class_wanted) ? enquiry.class_wanted : cls;
      const ps = lookups.sectionsOf(pc)[0] || "";
      setForm({
        ...blank(pc),
        name: enquiry.student_name,
        gender: enquiry.gender === "Female" ? "Female" : "Male",
        dob: enquiry.dob || "",
        fatherName: enquiry.father_name || "",
        motherName: enquiry.mother_name || "",
        mobile: enquiry.mobile,
        motherMobile: enquiry.alt_mobile || "",
        address: enquiry.area || "",
        prevSchool: enquiry.previous_school || "",
        section: ps,
        rollNo: lookups.nextRoll(pc, ps),
        ...fresh,
      });
    } else setForm({ ...blank(cls), section: sec, rollNo: lookups.nextRoll(cls, sec), ...fresh });
    setErrors({});
    setTried(new Set());
    setSaved(null);
    setSiblings([]);
    setPhoto("");
    setScans({});
    setStep(0);
    setReached(0);
    window.scrollTo(0, 0);
  };
  // Fill the form once what it needs has arrived: the student for an edit, the register for a new admission.
  useEffect(() => {
    if (form || editId === null || !list.data) return;
    if (editId) {
      if (editing) {
        setForm(fromStudent(editing));
        setSiblings(editing.siblings || []);
        setReached(STEPS.length - 1); // a saved student: every filled step shows its tick
      }
    } else if (!enquiryId || enquiries.data) start();
  }, [editId, list.data, editing, enquiryId, enquiries.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const stepKey = STEPS[step].key;
  const plan = useMemo(() => {
    const cfg = feeSetup.data?.config;
    if (!cfg || !form || editing) return null;
    try {
      return planFor(cfg, { cls: form.class, bus: form.transport, newAdmission: true });
    } catch {
      return null;
    }
  }, [feeSetup.data, form, editing]);

  const err = list.error || one.error;
  if (!form) return err && err.status !== 401 ? <ErrorCard offline={err.status === 0} onRetry={() => (list.reload(), one.reload())} /> : <ListSkeleton rows={5} />;

  const set = <K extends Key>(key: K, value: Form[K]) =>
    setForm((prev) => {
      const next = { ...prev!, [key]: value };
      if (key === "class") {
        next.section = lookups.sectionsOf(value as string)[0] || "";
        if (!editing) next.rollNo = lookups.nextRoll(next.class, next.section);
      }
      if (key === "section" && !editing) next.rollNo = lookups.nextRoll(next.class, value as string);
      if (key === "busRoute") next.busStop = "";
      if (key === "transport" && !value) next.busStop = "";
      const checks = Array.from(tried);
      if (checks.length) setErrors(Object.assign({}, ...checks.map((s) => validate(s, next, lookups.takenSr, L))));
      return next;
    });

  const go = (i: number) => {
    const to = Math.max(0, Math.min(STEPS.length - 1, i));
    setStep(to);
    setReached((r) => Math.max(r, to));
    window.scrollTo(0, 0);
  };
  const stepOk = STEPS.map((s) => Object.keys(validate(s.key, form, lookups.takenSr, L)).length === 0);
  /**
   * Moving forward (Next, or a step chip further on): every step on the way must pass its checks.
   * The first step with a mistake opens instead and its first wrong box gets the focus. Going back is always free.
   */
  const goTo = (target: number) => {
    if (target <= step) return go(target);
    for (let i = step; i < target; i++) {
      const key = STEPS[i].key;
      const found = validate(key, form, lookups.takenSr, L);
      setTried((t) => new Set(t).add(key));
      setErrors((e) => ({ ...e, ...found }));
      const firstBad = Object.keys(found)[0] as Key | undefined;
      if (firstBad) {
        if (i !== step) go(i);
        setTimeout(() => document.getElementById(`adm-${firstBad}`)?.focus(), i !== step ? 350 : 0);
        return toast(false, found[firstBad]!);
      }
    }
    go(target);
  };
  const next = () => goTo(step + 1);

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const image = await cropPhoto(file);
      if (image) setPhoto(image);
    } catch (er) {
      toast(false, (er as Error)?.message || L({ hi: "फ़ोटो नहीं लगी।", en: "Could not use this photo." }));
    }
  }

  async function pickScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const key = scanFor.current;
    e.target.value = "";
    if (!file || !key) return;
    try {
      const image = await shrinkScan(file);
      setScans((x) => ({ ...x, [key]: image }));
      set("documents", { ...form!.documents, [key]: true });
    } catch (er) {
      toast(false, (er as Error)?.message || L({ hi: "फ़ोटो नहीं लगी।", en: "Could not use this photo." }));
    }
  }

  async function submit() {
    const f = form!;
    const found = validate("check", f, lookups.takenSr, L);
    setTried(new Set(STEPS.map((s) => s.key)));
    setErrors(found);
    const firstBad = Object.keys(found)[0] as Key | undefined;
    if (firstBad) {
      const at = STEPS.findIndex((s) => s.key === STEP_OF[firstBad]);
      if (at >= 0) go(at);
      return toast(false, found[firstBad]!);
    }
    setBusy(true);
    const t = (v: string) => v.trim();
    const body = {
      srNo: t(f.srNo), penNo: t(f.penNo), name: t(f.name), gender: f.gender, category: f.category, class: f.class, section: f.section,
      classSec: `${f.class} - ${f.section}`, rollNo: f.rollNo, house: f.house, admissionNo: t(f.admissionNo) || t(f.srNo), dob: f.dob,
      fatherName: t(f.fatherName), motherName: t(f.motherName), guardianName: t(f.guardianName) || t(f.fatherName),
      mobile: f.mobile, contact: f.motherMobile || f.mobile, address: t(f.address),
      transportOpted: f.transport, busRoute: f.transport ? f.busRoute : undefined, busStop: f.transport ? f.busStop : "",
      nameHi: f.nameHi, birthPlace: f.birthPlace, aadhaarNo: f.aadhaarNo.replace(/\s/g, ""), religion: f.religion, caste: f.caste,
      nationality: f.nationality, motherTongue: f.motherTongue, bloodGroup: f.bloodGroup, healthNotes: f.healthNotes, cwsn: f.cwsn, idMark: f.idMark,
      medium: f.medium, admissionDate: f.admissionDate, shalaDarpanId: f.shalaDarpanId, admissionType: f.admissionType, rte: f.rte,
      prevSchool: f.prevSchool, prevBoard: f.prevSchool ? f.prevBoard : "", prevClass: f.prevClass, prevYear: f.prevYear, prevResult: f.prevResult,
      tcNo: f.tcNo, tcDate: f.tcDate, leavingReason: f.leavingReason,
      fatherOccupation: f.fatherOccupation, fatherEducation: f.fatherEducation, fatherAadhaar: f.fatherAadhaar.replace(/\s/g, ""), fatherEmail: f.fatherEmail,
      motherMobile: f.motherMobile, motherOccupation: f.motherOccupation, motherEducation: f.motherEducation, motherAadhaar: f.motherAadhaar.replace(/\s/g, ""),
      whatsappTo: f.whatsappTo, familyIncome: f.familyIncome, janAadhaar: f.janAadhaar.replace(/\s/g, ""), bpl: f.bpl,
      guardianRelation: f.guardianRelation, guardianMobile: f.guardianMobile,
      city: f.city, tehsil: f.tehsil, district: f.district, pincode: f.pincode, lettersAddress: f.sameLetters ? "" : f.lettersAddress,
      emergencyName: f.emergencyName, emergencyRelation: f.emergencyRelation, emergencyMobile: f.emergencyMobile,
      documents: f.documents, bankHolder: f.bankHolder, bankAccount: f.bankAccount, bankIfsc: f.bankIfsc.toUpperCase(),
      siblingIds: siblings.map((s) => s.id),
      ...(editing ? {} : { status: "Active" }),
    };
    try {
      const res = editing
        ? await api<{ success: boolean; data: ErpStudent & { detailsSaved?: boolean } }>(`/erp/students/${encodeURIComponent(editing.id)}`, { method: "PATCH", body })
        : await api<{ success: boolean; data: ErpStudent & { detailsSaved?: boolean } }>("/erp/students", { body });
      const id = res.data.id;
      if (photo) {
        await api(`/erp/student-photos/${id}`, { body: { image: photo } }).catch(() =>
          toast(false, L({ hi: "बच्चा सेव हो गया, पर फ़ोटो नहीं लगी। Students → Photos से लगाएँ।", en: "Saved, but the photo didn't go up. Add it from Students → Photos." }))
        );
      }
      const scanKeys = Object.keys(scans);
      if (scanKeys.length) {
        const failed: string[] = [];
        for (const key of scanKeys) {
          await api(`/erp/student-documents/${id}`, { body: { key, image: scans[key] } }).catch(() => failed.push(key));
        }
        if (failed.length)
          toast(false, L({ hi: `${failed.length} कागज़ की फ़ोटो नहीं गई। प्रोफ़ाइल → कागज़ से दोबारा लगाएँ।`, en: `${failed.length} document scans didn't go up. Add them again from the profile → Documents.` }));
        else setScans({});
      }
      if (res.data.detailsSaved === false)
        toast(false, L({ hi: "नाम, कक्षा, माता-पिता सेव हुए; बाकी जानकारी के लिए सर्वर पर नई SQL चलानी है।", en: "Name, class and parents are saved; the other details need the new SQL on the server." }));
      if (editing) {
        toast(true, L({ hi: `${res.data.name} की जानकारी सेव हो गई।`, en: `${res.data.name}'s details are saved.` }));
        window.location.replace(`/erp/students/detail/?id=${encodeURIComponent(id)}`);
        return;
      }
      setSaved(res.data);
      list.reload();
      window.scrollTo(0, 0);
      // As the ERP does: the first admission from an enquiry closes it, with a note ("Admit another" is a different child).
      if (enquiry && enquiry.status !== "admitted" && !closedEnquiry) {
        setClosedEnquiry(true);
        api(`/erp/enquiries/${enquiry.id}`, { method: "PATCH", body: { status: "admitted", next_follow_up: null, admitted_student_id: id } })
          .then(() => api(`/erp/enquiries/${enquiry.id}/notes`, { body: { text: `Admitted to ${res.data.classSec} with SR no. ${res.data.srNo}.` } }))
          .catch(() => toast(false, L({ hi: "प्रवेश हो गया, पर पूछताछ अपने-आप बंद नहीं हुई। उसे खोलकर बदलें।", en: "Admitted, but the enquiry was not closed. Open it and update it." })));
      }
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "सेव नहीं हुआ। दोबारा कोशिश करें।", en: "Could not save. Please try again." }));
    } finally {
      setBusy(false);
    }
  }

  if (saved)
    return (
      <div className="animate-rise pt-2">
        <div className="row-card flex flex-col items-center gap-2 px-4 py-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-jade-600" aria-hidden />
          <p className="font-title text-[20px] font-extrabold">{L({ hi: `${saved.name} का प्रवेश हो गया`, en: `${saved.name} is admitted` })}</p>
          <p className="text-[14px] text-ink-500">
            {saved.classSec} · SR {saved.srNo} · {L({ hi: "सत्र की फ़ीस", en: "fee for the session" })} {rupees(saved.totalFee)}
          </p>
          <Link href={`/erp/fees/collect/?student=${encodeURIComponent(saved.id)}`} className="btn mt-2 w-full bg-[#3099a4] text-white">
            {L({ hi: "पहली फ़ीस जमा करें", en: "Collect first fee" })}
          </Link>
          <Link href={`/erp/students/detail/?id=${encodeURIComponent(saved.id)}`} className="btn w-full border-[1.5px] border-ink-900 bg-white text-ink-900">
            {L({ hi: "प्रोफ़ाइल खोलें", en: "Open profile" })}
          </Link>
          <button type="button" onClick={() => start(saved.class)} className="btn w-full border-[1.5px] border-ink-900 bg-white text-ink-900">
            <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "एक और प्रवेश", en: "Admit another" })}
          </button>
        </div>
      </div>
    );

  const f = form;
  const msg = (k: Key) => errors[k] && <p className="-mt-1 text-[13px] font-medium text-rose-700">{errors[k]}</p>;
  const req = <b className="text-rose-600"> *</b>;
  const text = (k: Key, label: string, o: { required?: boolean; ph?: string; num?: boolean; max?: number; type?: string; note?: string; upper?: boolean } = {}) => (
    <div className="min-w-0 space-y-1.5">
      <label className={clsx("field-box", errors[k] && "!border-rose-400")}>
        <small>
          {label}
          {o.required && req}
        </small>
        {o.note && <span className="pointer-events-none absolute right-3 top-1.5 text-[10.5px] font-bold text-[#3099a4]">{o.note}</span>}
        <input
          id={`adm-${k}`}
          type={o.type || "text"}
          inputMode={o.num ? "numeric" : undefined}
          maxLength={o.max}
          placeholder={o.ph}
          value={f[k] as string}
          onChange={(e) => set(k, (o.num ? e.target.value.replace(/[^\d ]/g, "") : o.upper ? e.target.value.toUpperCase() : e.target.value) as never)}
          className={clsx("text-[16px]", o.num && "tnum")}
          autoComplete="off"
        />
        {o.type === "date" && <CalendarDays aria-hidden />}
      </label>
      {msg(k)}
    </div>
  );
  const phone = (k: Key, label: string, required?: boolean) => (
    <div className="min-w-0 space-y-1.5">
      <label className={clsx("field-box", errors[k] && "!border-rose-400")}>
        <small>
          {label}
          {required && req}
        </small>
        <span className="pt-4 font-medium text-ink-500">+91</span>
        <input id={`adm-${k}`} type="tel" inputMode="numeric" maxLength={10} value={f[k] as string} onChange={(e) => set(k, e.target.value.replace(/\D/g, "") as never)} className="tnum text-[16px]" />
      </label>
      {msg(k)}
    </div>
  );
  const select = (k: Key, label: string, options: string[], empty?: string) => (
    <SelectBox label={label} value={f[k] as string} onChange={(v) => set(k, v as never)}>
      {empty !== undefined && <option value="">{empty}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </SelectBox>
  );
  const chips = (k: Key, label: string, options: { value: string; text: string }[], required?: boolean) => (
    <div className="space-y-1.5">
      <p className="text-[12.5px] font-semibold text-ink-500">
        {label}
        {required && req}
      </p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const on = f[k] === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => set(k, (on && !required ? "" : o.value) as never)}
              className={clsx("min-h-[40px] rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold transition-colors", on ? "border-[#3099a4] bg-[#3099a4] text-white" : "border-ink-200 bg-white text-ink-900")}
            >
              {o.text}
            </button>
          );
        })}
      </div>
    </div>
  );
  const toggle = (k: Key, title: string, note?: string) => (
    <div className="flex min-h-[48px] items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{title}</span>
        {note && <span className="block text-[12.5px] text-ink-500">{note}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={!!f[k]}
        aria-label={title}
        onClick={() => set(k, !f[k] as never)}
        className={clsx("relative h-7 w-12 shrink-0 rounded-full transition-colors", f[k] ? "bg-[#3099a4]" : "bg-ink-200")}
      >
        <span className={clsx("absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-all", f[k] ? "left-[23px]" : "left-[3px]")} />
      </button>
    </div>
  );
  const card = (title: string | null, children: React.ReactNode, sub?: string) => (
    <section className="row-card space-y-3 !p-3.5">
      {title && (
        <div>
          <h3 className="font-title text-[15.5px] font-bold">{title}</h3>
          {sub && <p className="text-[12.5px] text-ink-500">{sub}</p>}
        </div>
      )}
      {children}
    </section>
  );
  const more = (title: string, children: React.ReactNode, open?: boolean) => (
    <details className="group border-t border-dashed border-ink-200 pt-2" open={open}>
      <summary className="flex min-h-[40px] cursor-pointer list-none items-center gap-1.5 text-[14px] font-semibold text-[#3099a4]">
        <Plus className="h-4 w-4 transition-transform group-open:rotate-45" aria-hidden />
        {title}
      </summary>
      <div className="space-y-3 pt-2">{children}</div>
    </details>
  );
  const head = (title: string, hint?: string) => (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-title text-[21px] font-extrabold leading-tight">{title}</h2>
        <span className="shrink-0 text-[12.5px] text-ink-500">{L({ hi: `चरण ${step + 1} / ${STEPS.length}`, en: `Step ${step + 1} of ${STEPS.length}` })}</span>
      </div>
      {hint && <p className="mt-0.5 text-[13px] text-ink-500">{hint}</p>}
    </div>
  );
  const photoUrl = photo || editing?.photoUrl || "";
  const stops = lookups.stopsOf(f.busRoute);
  const missingDocs = DOCS.filter((d) => !f.documents[d.key]);
  const row = (k: string, v: React.ReactNode) =>
    v ? (
      <div className="flex justify-between gap-3 border-b border-ink-100 py-1.5 text-[14px] last:border-0">
        <span className="shrink-0 text-ink-500">{k}</span>
        <b className="min-w-0 text-right font-semibold">{v}</b>
      </div>
    ) : null;

  const VIEWS: Record<StepKey, () => React.ReactNode> = {
    student: () => (
      <>
        {head(L({ hi: "बच्चा", en: "Student" }), L({ hi: "सब कुछ जन्म प्रमाण पत्र के अनुसार लिखें।", en: "Write everything as on the birth certificate." }))}
        {card(
          null,
          <div className="flex items-center gap-3.5">
            <button type="button" onClick={() => photoInput.current?.click()} className="grid h-[104px] w-[84px] shrink-0 place-items-center overflow-hidden rounded-xl border-[1.5px] border-dashed border-ink-900 bg-white text-center text-[11.5px] text-ink-500">
              {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : <span>{L({ hi: "पासपोर्ट फ़ोटो", en: "Passport photo" })}</span>}
            </button>
            <div className="min-w-0 space-y-2">
              <p className="text-[13px] text-ink-500">{L({ hi: "साफ़ चेहरा, सादा पीछे। ID कार्ड, रिपोर्ट कार्ड और पेरेंट ऐप में दिखेगी।", en: "Clear face, plain background. It shows on the ID card, report card and the parent app." })}</p>
              <button type="button" onClick={() => photoInput.current?.click()} className="btn min-h-[44px] border-[1.5px] border-ink-900 bg-white px-3 text-[14px] text-ink-900">
                <Camera className="h-4 w-4" aria-hidden /> {photoUrl ? L({ hi: "फ़ोटो बदलें", en: "Change photo" }) : L({ hi: "फ़ोटो लें या चुनें", en: "Take or choose photo" })}
              </button>
              <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
            </div>
          </div>
        )}
        {card(
          L({ hi: "नाम और जन्म", en: "Name and birth" }),
          <>
            {text("name", L({ hi: "पूरा नाम (English)", en: "Full name (English)" }), { required: true, ph: "Aarav Singh Rathore" })}
            {text("nameHi", L({ hi: "नाम हिंदी में", en: "Name in Hindi" }), { ph: "आरव सिंह राठौड़", note: L({ hi: "TC और सर्टिफ़िकेट के लिए", en: "for TC & certificates" }) })}
            {chips("gender", L({ hi: "लिंग", en: "Gender" }), [
              { value: "Male", text: L({ hi: "लड़का", en: "Boy" }) },
              { value: "Female", text: L({ hi: "लड़की", en: "Girl" }) },
              { value: "Other", text: L({ hi: "अन्य", en: "Other" }) },
            ], true)}
            <div className="grid grid-cols-2 gap-2.5">
              {text("dob", L({ hi: "जन्म तिथि", en: "Date of birth" }), { required: true, type: "date" })}
              <label className="field-box bg-ink-50">
                <small>{L({ hi: "1 अप्रैल को उम्र", en: "Age on 1 April" })}</small>
                <input readOnly tabIndex={-1} value={ageOn1April(f.dob)} className="text-[16px]" />
              </label>
            </div>
            {f.dob && <p className="-mt-1 text-[12.5px] font-semibold text-[#3099a4]">{dateInWords(f.dob)}</p>}
            {text("birthPlace", L({ hi: "जन्म स्थान", en: "Place of birth" }), { ph: "Barmer" })}
          </>
        )}
        {card(
          L({ hi: "पहचान", en: "Identity" }),
          <>
            {text("aadhaarNo", L({ hi: "आधार नंबर", en: "Aadhaar number" }), { num: true, max: 14, ph: "12 digits" })}
            <div className="grid grid-cols-2 gap-2.5">
              {select("religion", L({ hi: "धर्म", en: "Religion" }), RELIGIONS)}
              {text("caste", L({ hi: "जाति", en: "Caste" }))}
            </div>
            {chips("category", L({ hi: "श्रेणी", en: "Category" }), CATEGORIES.map((c) => ({ value: c, text: c })), true)}
            <div className="grid grid-cols-2 gap-2.5">
              {text("nationality", L({ hi: "राष्ट्रीयता", en: "Nationality" }))}
              {select("motherTongue", L({ hi: "मातृभाषा", en: "Mother tongue" }), TONGUES)}
            </div>
          </>
        )}
        {card(
          L({ hi: "सेहत", en: "Health" }),
          <>
            {chips("bloodGroup", L({ hi: "ब्लड ग्रुप", en: "Blood group" }), BLOOD.map((b) => ({ value: b, text: b })))}
            {more(
              L({ hi: "सेहत की जानकारी (एलर्जी, बीमारी, विशेष ज़रूरत)", en: "Health details (allergy, illness, special needs)" }),
              <>
                {text("healthNotes", L({ hi: "एलर्जी या बीमारी", en: "Allergy or illness to know about" }), { ph: L({ hi: "जैसे अस्थमा", en: "e.g. asthma, peanut allergy" }) })}
                {toggle("cwsn", L({ hi: "विशेष ज़रूरत वाला बच्चा (CWSN)", en: "Child with special needs (CWSN)" }), L({ hi: "UDISE+ में गिना जाता है", en: "Counted in UDISE+" }))}
                {text("idMark", L({ hi: "पहचान चिह्न", en: "Identification mark" }), { ph: L({ hi: "जैसे बाएँ गाल पर तिल", en: "e.g. mole on left cheek" }) })}
              </>,
              !!(f.healthNotes || f.cwsn || f.idMark)
            )}
          </>
        )}
      </>
    ),

    class: () => (
      <>
        {head(L({ hi: "कक्षा और रजिस्टर", en: "Class & register" }))}
        {card(
          L({ hi: "कक्षा", en: "Class" }),
          <>
            <div className="grid grid-cols-2 gap-2.5">
              {select("class", L({ hi: "कक्षा", en: "Class" }), lookups.classes)}
              <div className="space-y-1.5">
                {select("section", L({ hi: "सेक्शन", en: "Section" }), lookups.sectionsOf(f.class))}
                {msg("section")}
              </div>
            </div>
            {chips("medium", L({ hi: "माध्यम", en: "Medium" }), [
              { value: "Hindi", text: L({ hi: "हिंदी", en: "Hindi" }) },
              { value: "English", text: L({ hi: "अंग्रेज़ी", en: "English" }) },
            ])}
            <div className="grid grid-cols-2 gap-2.5">
              {text("rollNo", L({ hi: "रोल नं.", en: "Roll no." }), { num: true, max: 4, note: editing ? undefined : L({ hi: "अगला", en: "next free" }) })}
              {select("house", L({ hi: "हाउस", en: "House" }), lookups.houses, L({ hi: "अभी नहीं", en: "Not yet" }))}
            </div>
          </>
        )}
        {card(
          L({ hi: "रजिस्टर नंबर", en: "Register numbers" }),
          <>
            <div className="grid grid-cols-2 gap-2.5">
              {text("srNo", L({ hi: "SR नं.", en: "SR no." }), { required: true, note: editing ? undefined : L({ hi: "अपने-आप", en: "auto" }) })}
              {text("admissionNo", L({ hi: "प्रवेश नं.", en: "Admission no." }), { note: editing ? undefined : L({ hi: "अपने-आप", en: "auto" }) })}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {text("admissionDate", L({ hi: "प्रवेश तिथि", en: "Admission date" }), { required: true, type: "date" })}
              <label className="field-box bg-ink-50">
                <small>{L({ hi: "सत्र", en: "Session" })}</small>
                <input readOnly tabIndex={-1} value="2026-27" className="text-[16px]" />
              </label>
            </div>
            {text("penNo", "PEN (UDISE+)", { num: true, max: 11, ph: L({ hi: "11 अंक, अगर हो", en: "11 digits, if the child has one" }) })}
            {text("shalaDarpanId", L({ hi: "शाला दर्पण ID", en: "Shala Darpan ID" }), { ph: L({ hi: "पिछले स्कूल से, अगर हो", en: "From the old school, if any" }) })}
          </>
        )}
        {card(
          L({ hi: "प्रवेश का प्रकार", en: "Admission type" }),
          <>
            {chips("admissionType", L({ hi: "प्रकार", en: "Type" }), [
              { value: "New admission", text: L({ hi: "नया प्रवेश", en: "New admission" }) },
              { value: "Re-admission", text: L({ hi: "दोबारा प्रवेश", en: "Re-admission" }) },
              { value: "Transfer", text: L({ hi: "दूसरे स्कूल से", en: "Transfer from other school" }) },
            ], true)}
            {toggle("rte", L({ hi: "RTE (25% सीट) में प्रवेश", en: "Admitted under RTE (25% seat)" }), L({ hi: "फ़ीस सेटअप में RTE छूट अलग से दें", en: "Give the RTE concession in Fee setup" }))}
          </>
        )}
      </>
    ),

    old: () => (
      <>
        {head(L({ hi: "पिछला स्कूल", en: "Last school" }), L({ hi: "नर्सरी या पहले स्कूल के लिए खाली छोड़ें।", en: "Leave this empty for Nursery or a first school." }))}
        {card(
          null,
          <>
            {text("prevSchool", L({ hi: "स्कूल का नाम", en: "School name" }), { ph: "Saraswati Vidya Mandir, Barmer" })}
            <div className="grid grid-cols-2 gap-2.5">
              {select("prevBoard", L({ hi: "बोर्ड", en: "Board" }), BOARDS)}
              {select("prevClass", L({ hi: "पास कक्षा", en: "Last class passed" }), PREV_CLASSES, "—")}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {text("prevYear", L({ hi: "पास साल", en: "Year passed" }), { num: true, max: 4 })}
              {text("prevResult", L({ hi: "परिणाम / %", en: "Result / %" }), { ph: "Pass, 82%" })}
            </div>
          </>
        )}
        {card(
          L({ hi: "स्थानांतरण प्रमाण पत्र (TC)", en: "Transfer certificate (TC)" }),
          <>
            <div className="grid grid-cols-2 gap-2.5">
              {text("tcNo", L({ hi: "TC नंबर", en: "TC number" }))}
              {text("tcDate", L({ hi: "TC तिथि", en: "TC date" }), { type: "date" })}
            </div>
            {text("leavingReason", L({ hi: "स्कूल छोड़ने का कारण", en: "Reason for leaving" }), { ph: L({ hi: "जैसे परिवार बाड़मेर आ गया", en: "e.g. family moved to Barmer" }) })}
          </>
        )}
      </>
    ),

    family: () => (
      <>
        {head(L({ hi: "परिवार", en: "Family" }), L({ hi: "फ़ीस रसीद, गैरहाज़िरी की सूचना और पेरेंट ऐप मुख्य मोबाइल पर जाते हैं।", en: "Fee receipts, absence alerts and the parent app use the main mobile." }))}
        {card(
          L({ hi: "पिता", en: "Father" }),
          <>
            {text("fatherName", L({ hi: "पिता का नाम", en: "Father's name" }), { required: true })}
            {phone("mobile", L({ hi: "मुख्य मोबाइल", en: "Main mobile" }), true)}
            <div className="grid grid-cols-2 gap-2.5">
              {text("fatherOccupation", L({ hi: "काम", en: "Occupation" }))}
              {select("fatherEducation", L({ hi: "पढ़ाई", en: "Education" }), EDUCATION, "—")}
            </div>
            {more(
              L({ hi: "पिता का आधार और ईमेल", en: "Father's Aadhaar and email" }),
              <>
                {text("fatherAadhaar", L({ hi: "आधार नंबर", en: "Aadhaar number" }), { num: true, max: 14 })}
                {text("fatherEmail", L({ hi: "ईमेल", en: "Email" }), { type: "email" })}
              </>,
              !!(f.fatherAadhaar || f.fatherEmail || errors.fatherAadhaar || errors.fatherEmail)
            )}
          </>
        )}
        {card(
          L({ hi: "माता", en: "Mother" }),
          <>
            {text("motherName", L({ hi: "माता का नाम", en: "Mother's name" }), { required: true })}
            {phone("motherMobile", L({ hi: "मोबाइल", en: "Mobile" }))}
            <div className="grid grid-cols-2 gap-2.5">
              {text("motherOccupation", L({ hi: "काम", en: "Occupation" }))}
              {select("motherEducation", L({ hi: "पढ़ाई", en: "Education" }), EDUCATION, "—")}
            </div>
            {more(L({ hi: "माता का आधार", en: "Mother's Aadhaar" }), text("motherAadhaar", L({ hi: "आधार नंबर", en: "Aadhaar number" }), { num: true, max: 14 }), !!(f.motherAadhaar || errors.motherAadhaar))}
          </>
        )}
        {card(
          L({ hi: "WhatsApp किस नंबर पर?", en: "Which number gets WhatsApp?" }),
          chips("whatsappTo", L({ hi: "मैसेज जाएँगे", en: "Messages go to" }), [
            { value: "Father", text: L({ hi: "पिता", en: "Father" }) },
            { value: "Mother", text: L({ hi: "माता", en: "Mother" }) },
            { value: "Both", text: L({ hi: "दोनों", en: "Both" }) },
          ], true)
        )}
        {card(
          L({ hi: "परिवार की जानकारी", en: "Family details" }),
          <>
            {select("familyIncome", L({ hi: "सालाना आय", en: "Yearly income" }), INCOME, "—")}
            {text("janAadhaar", L({ hi: "जन आधार (परिवार ID)", en: "Jan Aadhaar (family ID)" }), { num: true, max: 12, ph: L({ hi: "10 अंक", en: "10 digits" }) })}
            {toggle("bpl", L({ hi: "BPL परिवार", en: "BPL family" }))}
            {more(
              L({ hi: "अभिभावक (अगर बच्चा माता-पिता के साथ नहीं रहता)", en: "Guardian (if the child doesn't live with parents)" }),
              <>
                {text("guardianName", L({ hi: "अभिभावक का नाम", en: "Guardian's name" }))}
                <div className="grid grid-cols-2 gap-2.5">
                  {text("guardianRelation", L({ hi: "रिश्ता", en: "Relation" }), { ph: L({ hi: "जैसे चाचा", en: "e.g. Uncle" }) })}
                  {phone("guardianMobile", L({ hi: "मोबाइल", en: "Mobile" }))}
                </div>
              </>,
              !!(f.guardianName || f.guardianMobile || errors.guardianMobile)
            )}
          </>
        )}
        {card(
          L({ hi: "इसी स्कूल में भाई या बहन?", en: "Brother or sister in this school?" }),
          <>
            {siblings.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-white p-2.5">
                <Avatar name={s.name} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">
                    {s.name} <span className="font-normal text-ink-500">({s.classSec.replace(" - ", " ")})</span>
                  </span>
                  <span className="block truncate text-[12.5px] text-ink-500">{s.srNo}</span>
                </span>
                <button type="button" onClick={() => setSiblings((x) => x.filter((y) => y.id !== s.id))} className="grid h-10 w-10 shrink-0 place-items-center text-ink-500" aria-label={L({ hi: `${s.name} हटाएँ`, en: `Remove ${s.name}` })}>
                  <X className="h-[18px] w-[18px]" aria-hidden />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setFindSibling(true)} className="btn min-h-[44px] w-full border-[1.5px] border-ink-900 bg-white text-[14px] text-ink-900">
              <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "भाई या बहन खोजें", en: "Find brother or sister" })}
            </button>
          </>,
          L({ hi: "रजिस्टर में भाई-बहन एक परिवार में जुड़ जाते हैं।", en: "Links brothers and sisters as one family in the register." })
        )}
      </>
    ),

    address: () => (
      <>
        {head(L({ hi: "पता और बस", en: "Address & bus" }))}
        {card(
          L({ hi: "घर का पता", en: "Home address" }),
          <>
            <div className="space-y-1.5">
              <textarea
                id="adm-address"
                value={f.address}
                onChange={(e) => set("address", e.target.value)}
                rows={2}
                className={clsx("textarea-box !min-h-[76px] text-[16px]", errors.address && "!border-rose-400")}
                placeholder={L({ hi: "मकान नं., गली, मोहल्ला *", en: "House no., street, area *" })}
              />
              {msg("address")}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {text("city", L({ hi: "गाँव / शहर", en: "Village / city" }))}
              {text("tehsil", L({ hi: "तहसील", en: "Tehsil" }))}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {text("district", L({ hi: "ज़िला", en: "District" }))}
              {text("pincode", L({ hi: "पिन कोड", en: "PIN code" }), { num: true, max: 6 })}
            </div>
            {toggle("sameLetters", L({ hi: "चिट्ठी का पता भी यही", en: "Address for letters is the same" }), L({ hi: "दूसरा पता लिखने के लिए बंद करें", en: "Turn off to add a second address" }))}
            {!f.sameLetters && <textarea id="adm-lettersAddress" value={f.lettersAddress} onChange={(e) => set("lettersAddress", e.target.value)} rows={2} className="textarea-box !min-h-[76px] text-[16px]" placeholder={L({ hi: "चिट्ठी का पता", en: "Address for letters" })} />}
          </>
        )}
        {card(
          L({ hi: "स्कूल बस", en: "School bus" }),
          <>
            {toggle("transport", L({ hi: "बच्चा स्कूल बस से आएगा", en: "Child will use the school bus" }), editing ? L({ hi: "यहाँ बदलने से फ़ीस नहीं बदलती", en: "Changing this here does not change the fee" }) : L({ hi: "सत्र की बस फ़ीस जुड़ेगी", en: "The session's bus fee is added" }))}
            {f.transport && (
              <>
                <div className="space-y-1.5">
                  {select("busRoute", L({ hi: "रूट", en: "Route" }), lookups.routes, L({ hi: "रूट चुनें", en: "Choose a route" }))}
                  {msg("busRoute")}
                </div>
                {f.busRoute && (stops.length ? select("busStop", L({ hi: "स्टॉप", en: "Stop" }), stops, L({ hi: "स्टॉप चुनें", en: "Choose a stop" })) : text("busStop", L({ hi: "स्टॉप", en: "Stop" })))}
              </>
            )}
          </>
        )}
        {card(
          L({ hi: "इमरजेंसी में किसे फ़ोन करें", en: "In an emergency, call" }),
          <>
            <div className="grid grid-cols-2 gap-2.5">
              {text("emergencyName", L({ hi: "नाम", en: "Name" }))}
              {text("emergencyRelation", L({ hi: "रिश्ता", en: "Relation" }))}
            </div>
            {phone("emergencyMobile", L({ hi: "मोबाइल", en: "Mobile" }))}
          </>
        )}
      </>
    ),

    docs: () => (
      <>
        {head(L({ hi: "कागज़", en: "Documents" }), L({ hi: "जो कागज़ मिले उन पर टिक करें। बाकी बाद में जोड़ सकते हैं।", en: "Tick what the parent gave. You can add the rest later." }))}
        {card(
          null,
          <ul className="-my-1">
            {DOCS.map((d) => {
              const on = !!f.documents[d.key];
              const scanned = !!scans[d.key] || !!editing?.documentScans?.includes(d.key);
              return (
                <li key={d.key} className="flex items-center gap-2 border-b border-ink-100 last:border-0">
                  <button type="button" role="checkbox" aria-checked={on} onClick={() => set("documents", { ...f.documents, [d.key]: !on })} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 py-1.5 text-left">
                    <span className={clsx("grid h-6 w-6 shrink-0 place-items-center rounded-md border-[1.5px]", on ? "border-[#3099a4] bg-[#3099a4] text-white" : "border-ink-300 bg-white")}>{on && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}</span>
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-medium">{L(d.text)}</span>
                      {d.note && <span className="block text-[12px] text-ink-500">{L(d.note)}</span>}
                    </span>
                  </button>
                  {d.key !== "photos" && (
                    <button
                      type="button"
                      onClick={() => {
                        scanFor.current = d.key;
                        scanInput.current?.click();
                      }}
                      className={clsx("flex min-h-[38px] shrink-0 items-center gap-1 rounded-lg border-[1.5px] px-2.5 text-[12.5px] font-semibold", scanned ? "border-jade-600 text-jade-700" : "border-ink-200 text-ink-900")}
                    >
                      {scanned ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : <Camera className="h-3.5 w-3.5" aria-hidden />}
                      {scanned ? L({ hi: "फ़ोटो लगी", en: "Scanned" }) : L({ hi: "फ़ोटो", en: "Add photo" })}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <input ref={scanInput} type="file" accept="image/*" className="hidden" onChange={pickScan} />
        {Object.keys(scans).length > 0 && <p className="-mt-1 text-[12.5px] text-ink-500">{L({ hi: "फ़ोटो सेव करने पर अपलोड होंगी।", en: "Photos go up when you save." })}</p>}
        {card(
          null,
          more(
            L({ hi: "छात्रवृत्ति के लिए बैंक खाता", en: "Bank account for scholarship" }),
            <>
              {text("bankHolder", L({ hi: "खाताधारक", en: "Account holder" }))}
              <div className="grid grid-cols-2 gap-2.5">
                {text("bankAccount", L({ hi: "खाता नं.", en: "Account no." }), { num: true, max: 20 })}
                {text("bankIfsc", "IFSC", { max: 11, upper: true })}
              </div>
            </>,
            !!(f.bankHolder || f.bankAccount || f.bankIfsc)
          )
        )}
      </>
    ),

    check: () => {
      const editStep = (k: StepKey) => (
        <button type="button" onClick={() => go(STEPS.findIndex((s) => s.key === k))} className="min-h-[36px] px-1 text-[13.5px] font-semibold text-[#3099a4]">
          {L({ hi: "बदलें", en: "Edit" })}
        </button>
      );
      const box = (title: string, k: StepKey, rows: React.ReactNode) => (
        <section className="row-card !p-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-title text-[15.5px] font-bold">{title}</h3>
            {editStep(k)}
          </div>
          <div className="mt-1">{rows}</div>
        </section>
      );
      const g = f.gender === "Female" ? "D/o" : "S/o";
      return (
        <>
          {head(L({ hi: "जाँचें और सेव करें", en: "Check & save" }))}
          {missingDocs.length > 0 && (
            <p className="rounded-xl border-[1.5px] border-marigold-300 bg-marigold-50 px-3 py-2.5 text-[13px] text-ink-700">
              {L({
                hi: `${missingDocs.length} कागज़ अभी नहीं मिले: ${missingDocs.map((d) => L(d.text)).join(", ")}। फिर भी सेव कर सकते हैं।`,
                en: `${missingDocs.length} documents not given yet: ${missingDocs.map((d) => L(d.text)).join(", ")}. You can still save.`,
              })}
            </p>
          )}
          <section className="row-card flex items-center gap-3.5 !p-3.5">
            <span className="grid h-[88px] w-[70px] shrink-0 place-items-center overflow-hidden rounded-xl border-[1.5px] border-dashed border-ink-900 bg-white text-[11px] text-ink-500">
              {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : L({ hi: "फ़ोटो", en: "Photo" })}
            </span>
            <span className="min-w-0">
              <span className="block font-title text-[18px] font-extrabold leading-tight">{f.name || "—"}</span>
              <span className="block text-[13px] text-ink-500">
                {f.class} {f.section} · {L({ hi: "रोल", en: "Roll" })} {f.rollNo || "—"} · {f.srNo}
              </span>
              <span className="block text-[13px] text-ink-500">
                {g} {f.fatherName} · +91 {f.mobile}
              </span>
            </span>
          </section>
          {box(
            L({ hi: "बच्चा", en: "Student" }),
            "student",
            <>
              {row(L({ hi: "जन्म तिथि", en: "Date of birth" }), f.dob)}
              {row(L({ hi: "लिंग", en: "Gender" }), f.gender === "Male" ? L({ hi: "लड़का", en: "Boy" }) : f.gender === "Female" ? L({ hi: "लड़की", en: "Girl" }) : L({ hi: "अन्य", en: "Other" }))}
              {row(L({ hi: "श्रेणी", en: "Category" }), [f.category, f.caste].filter(Boolean).join(" · "))}
              {row(L({ hi: "आधार", en: "Aadhaar" }), f.aadhaarNo)}
              {row(L({ hi: "ब्लड ग्रुप", en: "Blood group" }), f.bloodGroup)}
            </>
          )}
          {box(
            L({ hi: "कक्षा", en: "Class" }),
            "class",
            <>
              {row(L({ hi: "कक्षा", en: "Class" }), `${f.class} ${f.section} · ${f.medium}`)}
              {row(L({ hi: "प्रवेश तिथि", en: "Admission date" }), f.admissionDate)}
              {row(L({ hi: "प्रकार", en: "Type" }), [f.admissionType, f.rte ? "RTE" : ""].filter(Boolean).join(" · "))}
              {row(L({ hi: "पिछला स्कूल", en: "Last school" }), f.prevSchool)}
            </>
          )}
          {box(
            L({ hi: "परिवार", en: "Family" }),
            "family",
            <>
              {row(L({ hi: "माता", en: "Mother" }), [f.motherName, f.motherMobile && `+91 ${f.motherMobile}`].filter(Boolean).join(" · "))}
              {row("WhatsApp", f.whatsappTo === "Father" ? L({ hi: "पिता", en: "Father" }) : f.whatsappTo === "Mother" ? L({ hi: "माता", en: "Mother" }) : L({ hi: "दोनों", en: "Both" }))}
              {row(L({ hi: "भाई-बहन", en: "Siblings" }), siblings.map((s) => `${s.name} (${s.classSec.replace(" - ", " ")})`).join(", "))}
            </>
          )}
          {box(
            L({ hi: "पता और बस", en: "Address & bus" }),
            "address",
            <>
              {row(L({ hi: "पता", en: "Address" }), [f.address, f.city, f.pincode].filter(Boolean).join(", "))}
              {row(L({ hi: "बस", en: "Bus" }), f.transport ? [f.busRoute, f.busStop].filter(Boolean).join(" · ") : L({ hi: "बस नहीं", en: "No bus" }))}
            </>
          )}
          {!editing && (
            <section className="row-card tnum !p-3.5">
              <h3 className="font-title text-[15.5px] font-bold">{L({ hi: "सत्र 2026-27 की फ़ीस", en: "Fee for session 2026-27" })}</h3>
              <p className="text-[12.5px] text-ink-500">{L({ hi: `${f.class} कक्षा के फ़ीस सेटअप से। सेव के बाद फ़ीस जमा कर सकते हैं।`, en: `From the ${f.class} class fee setup. Fees can be collected after saving.` })}</p>
              {plan ? (
                <div className="mt-1.5">
                  {plan.lines.map((l) => row(l.name, rupees(l.total)))}
                  <div className="mt-1 flex items-baseline justify-between border-t-[1.5px] border-ink-900 pt-2">
                    <span className="text-[14px] text-ink-500">{L({ hi: "कुल", en: "Total" })}</span>
                    <b className="font-title text-[24px] font-extrabold">{rupees(plan.gross)}</b>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[13.5px] text-ink-500">{feeSetup.error ? L({ hi: "फ़ीस सेटअप नहीं खुला; सेव के बाद प्रोफ़ाइल में फ़ीस दिखेगी।", en: "Couldn't open the fee setup; the fee will show on the profile after saving." }) : "…"}</p>
              )}
            </section>
          )}
        </>
      );
    },
  };

  return (
    <div className="pb-24">
      {/* Steps: tap any to jump; done ones get a tick. */}
      <div className="-mx-4 -mt-1 bg-[#f7f7f7]/95 pb-0 pt-1 backdrop-blur-sm">
        <nav ref={stepNav} className="flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none]" aria-label={L({ hi: "फ़ॉर्म के चरण", en: "Form steps" })}>
          {STEPS.map((s, i) => {
            const on = i === step;
            // Ticked as soon as the step's details pass: live on steps with required boxes, once passed on the others.
            const done = s.key !== "check" && stepOk[i] && (i < reached || (on && HAS_REQUIRED.has(s.key)));
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => goTo(i)}
                aria-current={on ? "step" : undefined}
                data-step={i}
                className={clsx(
                  "flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border-[1.5px] pl-1.5 pr-3 text-[13px] font-semibold transition-colors duration-200",
                  on ? "border-[#3099a4] bg-[#3099a4] text-white" : done ? "border-ink-900 bg-white text-ink-900" : "border-ink-200 bg-white text-ink-500"
                )}
              >
                <span className={clsx("grid h-6 w-6 place-items-center rounded-full text-[12px] transition-colors duration-200", done ? "bg-jade-600 text-white" : on ? "bg-white text-[#3099a4]" : "bg-ink-100 text-ink-900")}>
                  {done ? <Check className="step-tick h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                {L(s.text)}
              </button>
            );
          })}
        </nav>
        <div className="h-[3px] bg-ink-100">
          <div className="h-full origin-left bg-[#3099a4] transition-transform duration-300 ease-out" style={{ transform: `scaleX(${(step + 1) / STEPS.length})` }} />
        </div>
      </div>

      <div key={stepKey} className="form-flow animate-rise space-y-3 pt-3.5">
        {editing && <p className="text-[13px] text-ink-500">{L({ hi: "बदल रहे हैं:", en: "Editing:" })} {editing.name} · {editing.srNo}</p>}
        {VIEWS[stepKey]()}
      </div>

      {/* Back / Next at the end of the step (not floating). */}
      <div className="mt-4 flex gap-2.5">
        {step > 0 && (
          <button type="button" onClick={() => go(step - 1)} className="btn min-h-[50px] border-[1.5px] border-ink-900 bg-white px-5 text-ink-900">
            {L({ hi: "पीछे", en: "Back" })}
          </button>
        )}
        {stepKey === "check" ? (
          <button type="button" onClick={submit} disabled={busy} className="btn min-h-[50px] flex-1 bg-[#3099a4] text-[16px] text-white disabled:opacity-60">
            {busy ? "…" : editing ? L({ hi: "बदलाव सेव करें", en: "Save changes" }) : L({ hi: "प्रवेश सेव करें", en: "Save admission" })}
          </button>
        ) : (
          <button type="button" onClick={next} className="btn min-h-[50px] min-w-0 flex-1 bg-[#3099a4] text-[16px] text-white">
            <span className="truncate">
              {L({ hi: "आगे", en: "Next" })}: {L(STEPS[step + 1].text)}
            </span>
          </button>
        )}
      </div>

      {findSibling && (
        <SiblingSheet
          students={students}
          skip={new Set([editId || "", ...siblings.map((s) => s.id)])}
          father={f.fatherName}
          onPick={(s) => {
            setSiblings((x) => [...x, { id: s.id, name: s.name, classSec: s.classSec, fatherName: s.fatherName, srNo: s.srNo }]);
            setFindSibling(false);
          }}
          onClose={() => setFindSibling(false)}
        />
      )}
    </div>
  );
}

/** Find a brother or sister already in the school; the father's name is the first search. */
function SiblingSheet({ students, skip, father, onPick, onClose }: { students: ErpStudent[]; skip: Set<string>; father: string; onPick: (s: ErpStudent) => void; onClose: () => void }) {
  const L = useL();
  const [q, setQ] = useState(father.trim());
  const term = q.trim().toLowerCase();
  const found = term.length >= 2 ? students.filter((s) => !skip.has(s.id) && matchesStudent(s, term)).slice(0, 30) : [];
  return (
    <Sheet title={L({ hi: "भाई या बहन खोजें", en: "Find brother or sister" })} onClose={onClose}>
      <label className="field-box min-h-[48px]">
        <Search aria-hidden />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "नाम, SR नं., पिता या मोबाइल", en: "Name, SR no., father or mobile" })} className="text-[16px]" />
      </label>
      <ul className="mt-2 max-h-[50vh] space-y-2 overflow-y-auto">
        {found.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onPick(s)} className="row-card flex min-h-[60px] items-center gap-2.5 !py-2">
              <Avatar name={s.name} url={s.photoUrl || null} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">
                  {s.name} <span className="text-[12.5px] font-normal text-ink-500">({s.class} {s.section})</span>
                </span>
                <span className="block truncate text-[12.5px] text-ink-400">{parentLine(s)}</span>
              </span>
              <Plus className="h-5 w-5 shrink-0 text-[#3099a4]" aria-hidden />
            </button>
          </li>
        ))}
        {term.length >= 2 && !found.length && <li className="py-4 text-center text-[14px] text-ink-500">{L({ hi: "कोई बच्चा नहीं मिला।", en: "No student found." })}</li>}
      </ul>
    </Sheet>
  );
}
