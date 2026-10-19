"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, Camera, Check, Copy, KeyRound, Pencil, Phone, UserX } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { cropPhoto } from "@/components/erp/PhotoCropper";
import { day, LOGIN_ROLES, normClasses, passwordProblem, phone, ROLE_INFO, roleLabel, suggestPassword, todayLocal, yearsSince, type Assignment, type ClassItem, type StaffList, type StaffMember } from "@/lib/erpStaff";
import { Avatar, Empty, ErrorCard, ListSkeleton, SelectBox, Sheet, Status } from "@/components/ui";

/*
 * ERP login → one staff member: the ERP's StaffProfileDrawer. Photo, details, classes and subjects, login,
 * mark as left / rejoined, and remove. Same endpoints (/api/staff/:id/…) and the same role rules: the admin
 * does everything; the admin and the exam cell change classes and subjects.
 */
export default function ErpStaffDetailPage() {
  const L = useL();
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(window.location.search).get("id") || ""), []);
  const { data, error, reload } = useApi<StaffList>("/erp/staff");
  const cls = useApi<{ data: unknown[] }>("/erp/classes");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const [fresh, setFresh] = useState<StaffMember | null>(null);

  const all = useMemo(() => data?.data || [], [data]);
  const classes = useMemo(() => normClasses(cls.data as { data?: any[] } | undefined), [cls.data]);
  const fromList = all.find((x) => x.id === id) || null;
  const s = fresh && fresh.id === id ? fresh : fromList;
  // A fresher list replaces the copy saved here.
  useEffect(() => setFresh(null), [data]);

  if (!s) {
    if (data && id !== null) return <Empty>{L({ hi: "यह स्टाफ़ नहीं मिला।", en: "This staff member was not found." })}</Empty>;
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton rows={4} />;
  }
  const changed = (x: StaffMember) => {
    setFresh(x);
    reload();
  };
  return <Profile key={s.id} s={s} all={all} classes={classes} me={who.data?.user.role || ""} onChanged={changed} />;
}

type SheetKind = null | "work" | "login" | "leave" | "issued" | "remove";

function Profile({ s, all, classes, me, onChanged }: { s: StaffMember; all: StaffMember[]; classes: ClassItem[]; me: string; onChanged: (x: StaffMember) => void }) {
  const L = useL();
  const { lang } = useLang();
  const isAdmin = me === "admin";
  const canAssign = isAdmin || me === "exam_cell";
  const left = s.status === "Relieved";
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ loginId: string; password: string } | null>(null);

  async function run<T>(fn: () => Promise<T>, ok: string, after?: (d: T) => void) {
    setBusy(true);
    try {
      const d = await fn();
      toast(true, ok);
      after?.(d);
      return true;
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const byClass = s.subjects.reduce<Record<string, string[]>>((m, a) => {
    (m[a.classSec] ||= []).push(a.subject);
    return m;
  }, {});

  const rows: [string, string][] = [
    [L({ hi: "कब जुड़े", en: "Joined" }), s.joiningDate ? `${day(s.joiningDate)} · ${yearsSince(s.joiningDate, lang)}` : ""],
    [L({ hi: "योग्यता", en: "Qualification" }), s.qualification],
    [L({ hi: "पहले का अनुभव", en: "Experience before" }), s.experienceYears !== null ? L({ hi: `${s.experienceYears} साल`, en: `${s.experienceYears} years` }) : ""],
    [L({ hi: "लिंग", en: "Gender" }), s.gender],
    [L({ hi: "जन्म तिथि", en: "Date of birth" }), day(s.dob)],
    [L({ hi: "दूसरा मोबाइल", en: "Other mobile" }), s.altMobile ? phone(s.altMobile) : ""],
    [L({ hi: "ईमेल", en: "Email" }), s.email],
    [L({ hi: "पता", en: "Address" }), s.address],
    [L({ hi: "नोट", en: "Notes" }), s.notes],
  ];
  const shownRows = rows.filter(([, v]) => !!v);

  return (
    <div className="animate-rise space-y-4 pb-4">
      <div className="flex items-center gap-3.5">
        <StaffPhoto s={s} canEdit={isAdmin} onChanged={onChanged} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-bold">{s.name}</p>
          <p className="truncate text-[13px] text-ink-500">
            {s.empCode} · {s.designation}
            {s.staffType === "non_teaching" ? L({ hi: " · अन्य स्टाफ़", en: " · non-teaching" }) : ""}
            {s.department ? ` · ${s.department}` : ""}
          </p>
          <span className="mt-1 inline-block">{left ? <Status tone="mute">{L({ hi: `छोड़ गए ${day(s.relievedOn)}`, en: `Left ${day(s.relievedOn)}` })}</Status> : <Status tone="ok">{L({ hi: "स्टाफ़ में", en: "On staff" })}</Status>}</span>
        </div>
      </div>

      <div className={clsx("grid gap-2.5", isAdmin && !left ? "grid-cols-2" : "grid-cols-1")}>
        <a href={`tel:${s.mobile}`} className="btn-line tnum">
          <Phone className="h-4 w-4" aria-hidden /> {phone(s.mobile)}
        </a>
        {isAdmin && !left && (
          <Link href={`/erp/staff/new/?id=${encodeURIComponent(s.id)}`} className="btn-primary">
            <Pencil className="h-4 w-4" aria-hidden /> {L({ hi: "जानकारी बदलें", en: "Edit details" })}
          </Link>
        )}
      </div>

      {shownRows.length > 0 && (
        <section className="space-y-1">
          <h2 className="mlabel">{L({ hi: "जानकारी", en: "Details" })}</h2>
          <dl className="kv">
            {shownRows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd className="whitespace-pre-line">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {s.staffType === "teaching" && !left && (
        <section className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h2 className="mlabel">{L({ hi: "कक्षाएँ और विषय", en: "Classes and subjects" })}</h2>
            {canAssign && (
              <button type="button" onClick={() => setSheet("work")} className="min-h-[40px] px-1 text-[13.5px] font-semibold text-brand-600">
                {L({ hi: "बदलें", en: "Change" })}
              </button>
            )}
          </div>
          {s.classTeacherOf || s.subjects.length ? (
            <dl className="kv">
              {s.classTeacherOf && (
                <div>
                  <dt>{L({ hi: "क्लास टीचर", en: "Class teacher of" })}</dt>
                  <dd>{s.classTeacherOf}</dd>
                </div>
              )}
              {Object.keys(byClass).map((cs) => (
                <div key={cs}>
                  <dt>{cs}</dt>
                  <dd>{byClass[cs].join(", ")}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-[14px] text-ink-500">{L({ hi: "क्लास टीचर नहीं, और अभी कोई विषय नहीं दिया।", en: "Not a class teacher, and no subjects assigned yet." })}</p>
          )}
        </section>
      )}

      <section className="space-y-1.5">
        <h2 className="mlabel">{L({ hi: "लॉगिन", en: "Login" })}</h2>
        {s.login ? (
          <p className="text-[14.5px] text-ink-700">
            {L({ hi: "लॉगिन आईडी", en: "Signs in with" })} <b className="font-mono">{s.empCode}</b> {L({ hi: "या", en: "or" })} <b className="tnum">{s.mobile}</b> · <b>{roleLabel(s.login.role, lang)}</b>
            {!s.login.active && <span className="text-rose-600">{L({ hi: " · बंद है", en: " · switched off" })}</span>}
          </p>
        ) : left ? (
          <p className="text-[14px] text-ink-500">{L({ hi: "लॉगिन नहीं।", en: "No login." })}</p>
        ) : (
          <>
            <p className="text-[14px] text-ink-500">
              {L({ hi: "अभी लॉगिन नहीं।", en: "No login yet." })}
              {s.staffType === "teaching" ? L({ hi: " लॉगिन से वे हाज़िरी लगा सकते हैं और अंक भर सकते हैं।", en: " A login lets them mark attendance and enter marks." }) : ""}
            </p>
            {isAdmin && (
              <button type="button" onClick={() => setSheet("login")} className="btn-line w-full">
                <KeyRound className="h-4 w-4" aria-hidden /> {L({ hi: "लॉगिन बनाएँ", en: "Create login" })}
              </button>
            )}
          </>
        )}
      </section>

      {isAdmin && (
        <section className="space-y-2 pt-2">
          {left ? (
            <button type="button" disabled={busy} onClick={() => run(() => api<{ data: StaffMember }>(`/erp/staff/${s.id}/rejoin`, { method: "POST" }), L({ hi: `${s.name} फिर से स्टाफ़ लिस्ट में हैं।`, en: `${s.name} is back on the staff list.` }), (d) => onChanged(d.data))} className="btn-line w-full">
              {busy ? "…" : L({ hi: "फिर से जुड़े", en: "Rejoined" })}
            </button>
          ) : (
            <button type="button" onClick={() => setSheet("leave")} className="btn-line w-full !text-rose-600">
              <UserX className="h-4 w-4" aria-hidden /> {L({ hi: "छोड़ गए मार्क करें", en: "Mark as left" })}
            </button>
          )}
          {!s.login && (
            <p className="text-center text-[13px] text-ink-400">
              {L({ hi: "गलती से जुड़ गए?", en: "Added by mistake?" })}{" "}
              <button type="button" onClick={() => setSheet("remove")} className="min-h-[40px] font-semibold text-ink-600 underline">
                {L({ hi: "यह एंट्री हटाएँ", en: "Remove this entry" })}
              </button>
            </p>
          )}
        </section>
      )}

      {sheet === "work" && <WorkSheet s={s} all={all} classes={classes} onClose={() => setSheet(null)} onSaved={onChanged} />}
      {sheet === "login" && (
        <LoginSheet
          s={s}
          onClose={() => setSheet(null)}
          onSaved={(d, password) => {
            onChanged(d);
            setIssued({ loginId: s.empCode, password });
            setSheet("issued");
          }}
        />
      )}
      {sheet === "issued" && issued && <IssuedSheet name={s.name} {...issued} onClose={() => setSheet(null)} />}
      {sheet === "leave" && (
        <LeftSheet
          s={s}
          busy={busy}
          onClose={() => setSheet(null)}
          onConfirm={(date) =>
            run(() => api<{ data: StaffMember }>(`/erp/staff/${s.id}/relieve`, { method: "POST", body: { date } }), L({ hi: `${s.name} छोड़ गए मार्क हुए।`, en: `${s.name} marked as left.` }), (d) => {
              onChanged(d.data);
              setSheet(null);
            })
          }
        />
      )}
      {sheet === "remove" && (
        <Sheet title={L({ hi: "एंट्री हटाएँ", en: "Remove entry" })} onClose={() => setSheet(null)}>
          <p className="pb-3 text-[15px] text-ink-700">{L({ hi: `${s.name} (${s.empCode}) को स्टाफ़ से पूरी तरह हटा दें? यह वापस नहीं होगा।`, en: `Remove ${s.name} (${s.empCode}) from staff for good? This cannot be undone.` })}</p>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setSheet(null)} className="btn-line">
              {L({ hi: "रहने दें", en: "Keep" })}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api(`/erp/staff/${s.id}`, { method: "DELETE" }), L({ hi: "हटा दिया।", en: "Removed." }), () => window.location.replace("/erp/staff/"))}
              className="btn bg-rose-600 text-white"
            >
              {busy ? "…" : L({ hi: "हाँ, हटाएँ", en: `Yes, remove` })}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** The photo, with Change / Remove for the admin. Cropped to 3:4 before upload, as on the ERP. */
function StaffPhoto({ s, canEdit, onChanged }: { s: StaffMember; canEdit: boolean; onChanged: (x: StaffMember) => void }) {
  const L = useL();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const image = await cropPhoto(file);
      if (!image) return; // cancelled
      const r = await api<{ success: boolean; url?: string }>(`/erp/staff/${s.id}/photo`, { method: "POST", body: { image } });
      onChanged({ ...s, photoUrl: r.url || null });
      toast(true, L({ hi: "फ़ोटो सेव हुई।", en: "Photo saved." }));
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || (err as Error)?.message || L({ hi: "यह फ़ाइल फ़ोटो की तरह नहीं पढ़ी जा सकी।", en: "That file could not be read as a photo." }));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api(`/erp/staff/${s.id}/photo`, { method: "DELETE" });
      onChanged({ ...s, photoUrl: null });
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "फ़ोटो नहीं हटी।", en: "Could not remove the photo." }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <span className={clsx("relative", busy && "opacity-50")}>
        <Avatar name={s.name} url={s.photoUrl || null} size={72} />
      </span>
      {canEdit && (
        <span className="flex gap-2 text-[12.5px] font-semibold">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex min-h-[36px] items-center gap-1 text-brand-600">
            <Camera className="h-3.5 w-3.5" aria-hidden />
            {s.photoUrl ? L({ hi: "बदलें", en: "Change" }) : L({ hi: "फ़ोटो", en: "Add photo" })}
          </button>
          {s.photoUrl && (
            <button type="button" disabled={busy} onClick={remove} className="min-h-[36px] text-ink-500">
              {L({ hi: "हटाएँ", en: "Remove" })}
            </button>
          )}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </span>
      )}
    </div>
  );
}

/** Class teacher of + subjects taught (ERP "Classes and subjects" edit). PUT /api/staff/:id/assignments. */
function WorkSheet({ s, all, classes, onClose, onSaved }: { s: StaffMember; all: StaffMember[]; classes: ClassItem[]; onClose: () => void; onSaved: (x: StaffMember) => void }) {
  const L = useL();
  const [ct, setCt] = useState(s.classTeacherOf || "");
  const [subs, setSubs] = useState<Assignment[]>(s.subjects);
  const [pickClass, setPickClass] = useState("");
  const [busy, setBusy] = useState(false);
  const sections = useMemo(() => classes.flatMap((c) => c.sections.map((x) => ({ cls: c.name, classSec: `${c.name} - ${x.name}`, subjects: x.subjects }))), [classes]);
  const ctHolder = (cs: string) => all.find((x) => x.id !== s.id && x.classTeacherOf === cs);
  const toggle = (classSec: string, subject: string) =>
    setSubs((xs) => (xs.some((x) => x.classSec === classSec && x.subject === subject) ? xs.filter((x) => !(x.classSec === classSec && x.subject === subject)) : [...xs, { classSec, subject }]));
  const sectionsChosen = new Set(subs.map((x) => x.classSec)).size;
  const noSubjects = classes.every((c) => c.sections.every((x) => !x.subjects.length));

  async function save() {
    setBusy(true);
    try {
      const r = await api<{ success: boolean; staff: StaffMember; movedFrom: string | null }>(`/erp/staff/${s.id}/assignments`, { method: "PUT", body: { classTeacherOf: ct || null, subjects: subs } });
      toast(true, r.movedFrom ? L({ hi: `${ct} पहले ${r.movedFrom} की कक्षा थी; अब ${s.name} की है।`, en: `${ct} was ${r.movedFrom}'s class; it is now ${s.name}'s.` }) : L({ hi: "कक्षाएँ और विषय सेव हुए।", en: "Classes and subjects saved." }));
      onSaved(r.staff);
      onClose();
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={L({ hi: "कक्षाएँ और विषय", en: "Classes and subjects" })} onClose={onClose}>
      <div className="space-y-3">
        <SelectBox label={L({ hi: "क्लास टीचर", en: "Class teacher of" })} value={ct} onChange={setCt}>
          <option value="">{L({ hi: "क्लास टीचर नहीं", en: "Not a class teacher" })}</option>
          {sections.map((x) => {
            const h = ctHolder(x.classSec);
            return (
              <option key={x.classSec} value={x.classSec}>
                {x.classSec}
                {h ? ` (${L({ hi: "अभी", en: "now" })} ${h.name})` : ""}
              </option>
            );
          })}
        </SelectBox>
        <p className="mlabel pt-1">{L({ hi: "पढ़ाए जाने वाले विषय", en: "Subjects taught" })}</p>
        <SelectBox label={L({ hi: "कक्षा", en: "Class" })} value={pickClass} onChange={setPickClass}>
          <option value="">{L({ hi: "कक्षा चुनें…", en: "Choose a class…" })}</option>
          {classes
            .filter((c) => c.sections.some((x) => x.subjects.length))
            .map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
        </SelectBox>
        {noSubjects && <p className="text-[13px] text-marigold-700">{L({ hi: "अभी किसी कक्षा के विषय नहीं। परीक्षा सेटअप में विषय डालें।", en: "No class has subjects yet. Set them in Exam setup." })}</p>}
        {pickClass &&
          sections
            .filter((x) => x.cls === pickClass)
            .map((x) => (
              <div key={x.classSec} className="space-y-1.5">
                <p className="text-[13.5px] font-semibold text-ink-600">{x.classSec}</p>
                {x.subjects.length === 0 ? (
                  <p className="text-[13px] text-ink-400">{L({ hi: "कोई विषय नहीं", en: "no subjects" })}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {x.subjects.map((sub) => {
                      const on = subs.some((a) => a.classSec === x.classSec && a.subject === sub);
                      return (
                        <button key={sub} type="button" aria-pressed={on} onClick={() => toggle(x.classSec, sub)} className={clsx("inline-flex min-h-[40px] items-center gap-1 rounded-full border bg-white px-3 text-[14px]", on ? "border-[#3099a4] font-semibold text-[#3099a4]" : "border-ink-200 text-ink-700")}>
                          {on && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
                          {sub}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
        {subs.length > 0 && (
          <p className="text-[13px] text-ink-500">
            {L({ hi: `${sectionsChosen} सेक्शन में ${subs.length} विषय चुने।`, en: `${subs.length} subject${subs.length === 1 ? "" : "s"} chosen across ${sectionsChosen} section${sectionsChosen === 1 ? "" : "s"}.` })}
          </p>
        )}
        <button type="button" onClick={save} disabled={busy} className="btn-primary w-full">
          {busy ? "…" : L({ hi: "सेव करें", en: "Save" })}
        </button>
      </div>
    </Sheet>
  );
}

/** Role + first password (ERP "Create login"). POST /api/staff/:id/login. */
function LoginSheet({ s, onClose, onSaved }: { s: StaffMember; onClose: () => void; onSaved: (d: StaffMember, password: string) => void }) {
  const L = useL();
  const { lang } = useLang();
  const [role, setRole] = useState(s.staffType === "teaching" ? "teacher" : "accountant");
  const [password, setPassword] = useState(suggestPassword);
  const [busy, setBusy] = useState(false);

  async function save() {
    const weak = passwordProblem(password);
    if (weak) return toast(false, `${L({ hi: "पासवर्ड", en: "Password" })}: ${L(weak)}`);
    setBusy(true);
    try {
      const r = await api<{ success: boolean; data: StaffMember }>(`/erp/staff/${s.id}/login`, { method: "POST", body: { role, password } });
      toast(true, L({ hi: "लॉगिन बन गया।", en: "Login created." }));
      onSaved(r.data, password);
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={L({ hi: "लॉगिन बनाएँ", en: "Create login" })} onClose={onClose}>
      <div className="space-y-3">
        <SelectBox label={L({ hi: "रोल", en: "Role" })} value={role} onChange={setRole}>
          {LOGIN_ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r, lang)}
            </option>
          ))}
        </SelectBox>
        <label className="field-box">
          <small>{L({ hi: "पहला पासवर्ड", en: "First password" })}</small>
          <input id="lg-pass" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" className="font-mono" />
        </label>
        <p className="text-[13px] text-ink-500">
          {L(ROLE_INFO[role].can)} {L({ hi: `वे ${s.empCode} या ${s.mobile} से लॉगिन करेंगे।`, en: `They sign in with ${s.empCode} or ${s.mobile}.` })}
        </p>
        <button type="button" onClick={save} disabled={busy} className="btn-primary w-full">
          {busy ? "…" : L({ hi: "लॉगिन बनाएँ", en: "Create login" })}
        </button>
      </div>
    </Sheet>
  );
}

/** ERP IssuedLoginModal: the ID and password to hand over, shown once. */
function IssuedSheet({ name, loginId, password, onClose }: { name: string; loginId: string; password: string; onClose: () => void }) {
  const L = useL();
  const { data: p } = useApi<Record<string, string>>("/erp/school");
  const [copied, setCopied] = useState(false);
  const text = `${p?.school_name || "School"} login\nID: ${loginId}\nPassword: ${password}\nPlease change the password after signing in.`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <Sheet title={L({ hi: "लॉगिन बन गया", en: "Login created" })} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[14px] text-ink-600">{L({ hi: `यह ${name} को दें`, en: `Give these to ${name}` })}</p>
        <dl className="kv">
          <div>
            <dt>{L({ hi: "लॉगिन आईडी", en: "Login ID" })}</dt>
            <dd className="font-mono">{loginId}</dd>
          </div>
          <div>
            <dt>{L({ hi: "पासवर्ड", en: "Password" })}</dt>
            <dd className="font-mono">{password}</dd>
          </div>
        </dl>
        <p className="text-[13px] text-ink-500">{L({ hi: "यह पासवर्ड दोबारा नहीं दिखेगा। खो जाए तो नया बनाएँ।", en: "This password is not shown again. If it is lost, set a new one." })}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={copy} className="btn-line">
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? L({ hi: "कॉपी हुआ", en: "Copied" }) : L({ hi: "कॉपी", en: "Copy" })}
          </button>
          <button type="button" onClick={onClose} className="btn-primary">
            {L({ hi: "हो गया", en: "Done" })}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** ERP "Mark as left": the date they left, not after today. */
function LeftSheet({ s, busy, onClose, onConfirm }: { s: StaffMember; busy: boolean; onClose: () => void; onConfirm: (date: string) => void }) {
  const L = useL();
  const today = todayLocal();
  const [date, setDate] = useState(today);
  return (
    <Sheet title={L({ hi: "छोड़ गए मार्क करें", en: "Mark as left" })} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[14px] text-ink-600">{s.name}</p>
        <label className="field-box">
          <small>{L({ hi: "किस दिन छोड़ा", en: "Left on" })}</small>
          <input id="st-left" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          <CalendarDays aria-hidden />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onClose} className="btn-line">
            {L({ hi: "रद्द करें", en: "Cancel" })}
          </button>
          <button type="button" disabled={busy} onClick={() => onConfirm(date)} className="btn bg-rose-600 text-white">
            {busy ? "…" : L({ hi: "पक्का करें", en: "Confirm" })}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
