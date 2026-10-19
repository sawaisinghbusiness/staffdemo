"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, ChevronRight, Copy, Eye, EyeOff, KeyRound, Lock, Plus, RefreshCw, Search, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import {
  designation,
  lastSeen,
  passwordProblem,
  plainName,
  ROLE_INFO,
  ROLE_ORDER,
  STAFF_ROLES,
  suggestPassword,
  type AppUser,
  type IssuedLogin,
  type UserRole,
} from "@/lib/erpSettings";
import { Empty, ErrorCard, LineTabs, ListSkeleton, Sheet, Status } from "@/components/ui";

/*
 * ERP login → Settings → Users & roles: the ERP's app/settings/users page with UserDrawer, ResetPasswordModal,
 * IssuedLoginModal and ChangePasswordModal. GET/POST/PATCH /api/users, POST /api/users/:id/password are admin-only
 * on the backend; anyone else gets the ERP's "Only an admin…" screen and can still change their own password
 * (POST /api/auth/password).
 */

type Tab = "staff" | "family";

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError && e.message) || fallback;

export default function ErpUsersPage() {
  const L = useL();
  const res = useApi<{ data: AppUser[] }>("/erp/users");
  const me = useApi<{ user: { id: string; role: string } }>("/erp/auth/me");
  const school = useApi<Record<string, string>>("/erp/school");
  const meId = me.data?.user.id || null;
  const [users, setUsers] = useState<AppUser[] | null>(null);
  useEffect(() => {
    if (res.data) setUsers(res.data.data || []);
  }, [res.data]);

  const [tab, setTab] = useState<Tab>("staff");
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState<{ user: AppUser | null } | null>(null);
  const [resetting, setResetting] = useState<AppUser | null>(null);
  const [issued, setIssued] = useState<IssuedLogin | null>(null);
  const [ownOpen, setOwnOpen] = useState(false);

  const counts = useMemo(() => {
    const c = {} as Record<UserRole, number>;
    for (const u of users || []) if (u.is_active) c[u.role] = (c[u.role] || 0) + 1;
    return c;
  }, [users]);
  const staff = (users || []).filter((u) => ROLE_INFO[u.role]?.staff);
  const family = (users || []).filter((u) => !ROLE_INFO[u.role]?.staff);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tab === "staff" ? staff : family).filter((u) => !q || u.full_name.toLowerCase().includes(q) || [u.phone_number, u.employee_code, u.admission_no].some((v) => (v || "").toLowerCase().includes(q)));
  }, [tab, staff, family, query]);

  const upsert = (u: AppUser) => setUsers((prev) => (prev?.some((x) => x.id === u.id) ? prev.map((x) => (x.id === u.id ? u : x)) : [...(prev || []), u]));
  const schoolName = school.data?.school_name || "School";

  if (res.error?.status === 403)
    return (
      <div className="animate-rise space-y-3 pb-4">
        <div className="row-card flex flex-col items-center gap-2 py-6 text-center">
          <Lock className="h-8 w-8 text-ink-300" aria-hidden />
          <p className="text-[16px] font-semibold">{L({ hi: "यूज़र अकाउंट सिर्फ़ एडमिन संभाल सकते हैं", en: "Only an admin can manage user accounts" })}</p>
          <p className="text-[13.5px] text-ink-500">{L({ hi: "आप अपना पासवर्ड फिर भी बदल सकते हैं।", en: "You can still change your own password." })}</p>
          <button type="button" onClick={() => setOwnOpen(true)} className="btn-primary mt-2">
            <KeyRound className="h-4 w-4" aria-hidden /> {L({ hi: "मेरा पासवर्ड बदलें", en: "Change my password" })}
          </button>
        </div>
        {ownOpen && <OwnPasswordSheet onClose={() => setOwnOpen(false)} />}
      </div>
    );

  return (
    <div className="animate-rise space-y-3 pb-4">
      <p className="text-[13px] text-ink-500">{L({ hi: "कौन साइन इन कर सकता है, और क्या खोल सकता है।", en: "Who can sign in, and what they can open." })}</p>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => setOwnOpen(true)} className="btn-line px-3">
          <KeyRound className="h-4 w-4" aria-hidden /> {L({ hi: "मेरा पासवर्ड", en: "My password" })}
        </button>
        <button type="button" onClick={() => setEdit({ user: null })} disabled={!users} className="btn-primary px-3">
          <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "यूज़र जोड़ें", en: "Add user" })}
        </button>
      </div>

      {/* What each staff role can open; folded so the list of people comes first. */}
      <details className="row-card group">
        <summary className="-my-1 flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 text-[14.5px] font-semibold">
          {L({ hi: "हर रोल क्या खोल सकता है", en: "What each role can open" })}
          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-400 transition-transform group-open:rotate-90" aria-hidden />
        </summary>
        <ul className="mt-1 divide-y divide-ink-100">
          {STAFF_ROLES.map((r) => (
            <li key={r} className="py-2.5">
              <div className="flex items-center justify-between gap-2">
                <RoleTag role={r} />
                <span className="tnum text-[12.5px] text-ink-500">{users ? L({ hi: `${counts[r] || 0} चालू`, en: `${counts[r] || 0} active` }) : "…"}</span>
              </div>
              <p className="mt-1 text-[13px] leading-snug text-ink-600">{L(ROLE_INFO[r].can)}</p>
            </li>
          ))}
        </ul>
      </details>

      <LineTabs
        label={L({ hi: "अकाउंट", en: "Accounts" })}
        value={tab}
        onChange={setTab}
        options={[
          { key: "staff", text: `${L({ hi: "स्टाफ़", en: "Staff" })}${users ? ` ${staff.length}` : ""}` },
          { key: "family", text: `${L({ hi: "अभिभावक और बच्चे", en: "Parents & students" })}${users ? ` ${family.length}` : ""}` },
        ]}
      />
      <label className="field-box min-h-[48px]">
        <Search aria-hidden />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L({ hi: "नाम, मोबाइल या ID", en: "Name, mobile or ID" })} aria-label={L({ hi: "यूज़र खोजें", en: "Search users" })} className="text-[16px]" autoComplete="off" />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label={L({ hi: "खोज हटाएँ", en: "Clear search" })} className="-mr-2 grid h-10 w-10 shrink-0 place-items-center text-ink-400">
            <X className="h-[18px] w-[18px]" aria-hidden />
          </button>
        )}
      </label>

      {!users ? (
        res.error && res.error.status !== 401 ? <ErrorCard offline={res.error.status === 0} onRetry={res.reload} /> : <ListSkeleton rows={5} />
      ) : shown.length === 0 ? (
        <Empty>
          {query
            ? L({ hi: "कुछ नहीं मिला। दूसरा नाम या नंबर देखें।", en: "Nothing matches. Try another name or number." })
            : tab === "family"
              ? L({ hi: "अभी कोई अभिभावक या बच्चे का लॉगिन नहीं। ये पेरेंट ऐप में काम आएँगे।", en: "No parent or student logins yet. Parent logins will be used by the parent app." })
              : L({ hi: "अभी कोई स्टाफ़ लॉगिन नहीं। सॉफ़्टवेयर चलाने वाले हर व्यक्ति का एक बनाएँ।", en: "No staff logins yet. Add one for each person who uses the software." })}
        </Empty>
      ) : (
        <ul>
          {shown.map((u) => {
            const ids = [u.phone_number, u.employee_code, u.admission_no].filter(Boolean).join(" · ");
            const desig = designation(u.full_name);
            return (
              <li key={u.id} className={clsx("flex items-center border-b border-ink-100", !u.is_active && "opacity-70")}>
                <button type="button" onClick={() => setEdit({ user: u })} className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 py-2 text-left active:bg-ink-50">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15.5px] font-semibold">{plainName(u.full_name)}</span>
                      {u.id === meId && <span className="shrink-0 rounded bg-ink-100 px-1.5 text-[11px] font-semibold text-ink-500">{L({ hi: "आप", en: "You" })}</span>}
                    </span>
                    <span className="tnum block truncate text-[12.5px] text-ink-500">{[desig, ids].filter(Boolean).join(" · ")}</span>
                    <span className="block text-[12px] text-ink-400">
                      {L({ hi: "आख़िरी लॉगिन:", en: "Last sign-in:" })} {lastSeen(u.last_login, L)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <RoleTag role={u.role} />
                    {!u.is_active && <Status tone="mute">{L({ hi: "बंद", en: "Switched off" })}</Status>}
                  </span>
                </button>
                <button type="button" onClick={() => setResetting(u)} aria-label={L({ hi: `${plainName(u.full_name)} का नया पासवर्ड`, en: `Set a new password for ${plainName(u.full_name)}` })} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-400 active:bg-ink-100">
                  <KeyRound className="h-[18px] w-[18px]" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {edit && (
        <UserSheet
          user={edit.user}
          meId={meId}
          onClose={() => setEdit(null)}
          onSaved={(u, iss) => {
            upsert(u);
            setEdit(null);
            if (iss) setIssued(iss);
            else toast(true, L({ hi: "बदलाव सेव हो गए।", en: "Changes saved." }));
            setTab(ROLE_INFO[u.role].staff ? "staff" : "family");
          }}
        />
      )}
      {resetting && (
        <ResetSheet
          user={resetting}
          onClose={() => setResetting(null)}
          onDone={(iss) => {
            setResetting(null);
            setIssued(iss);
          }}
        />
      )}
      {issued && <IssuedSheet issued={issued} school={schoolName} onClose={() => setIssued(null)} />}
      {ownOpen && <OwnPasswordSheet onClose={() => setOwnOpen(false)} />}
    </div>
  );
}

/** Neutral chip with the role's colour dot (never a same-hue pill). */
function RoleTag({ role }: { role: UserRole }) {
  const L = useL();
  const info = ROLE_INFO[role];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-ink-200 bg-white px-2.5 py-px text-[12px] font-semibold leading-5 text-ink-700">
      <span className={clsx("h-1.5 w-1.5 rounded-full", info?.dot || "bg-ink-400")} aria-hidden />
      {info ? L(info.label) : role}
    </span>
  );
}

function TextField({ label, value, onChange, ...rest }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="field-box">
      <small>{label}</small>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="text-[16px]" autoComplete="off" {...rest} />
    </label>
  );
}

/* ───────────── Add / edit a login (ERP UserDrawer) ───────────── */

function UserSheet({ user, meId, onClose, onSaved }: { user: AppUser | null; meId: string | null; onClose: () => void; onSaved: (u: AppUser, issued?: IssuedLogin) => void }) {
  const L = useL();
  const isNew = !user;
  const isMe = !!user && user.id === meId;
  const [name, setName] = useState(user ? plainName(user.full_name) : "");
  const [role, setRole] = useState<UserRole>(user?.role || "teacher");
  const [phone, setPhone] = useState(user?.phone_number || "");
  const [code, setCode] = useState(user?.employee_code || "");
  const [adm, setAdm] = useState(user?.admission_no || "");
  const [active, setActive] = useState(user ? user.is_active : true);
  const [password, setPassword] = useState(() => (user ? "" : suggestPassword()));
  const [busy, setBusy] = useState(false);
  const family = !ROLE_INFO[role].staff;

  const save = async () => {
    if (name.trim().length < 2) return toast(false, L({ hi: "व्यक्ति का पूरा नाम लिखें।", en: "Enter the person's full name." }));
    if (phone && !/^[6-9]\d{9}$/.test(phone.trim())) return toast(false, L({ hi: "10 अंकों का मोबाइल नंबर लिखें।", en: "Enter a 10-digit mobile number." }));
    if (!phone.trim() && !code.trim() && !adm.trim())
      return toast(false, family ? L({ hi: "साइन इन के लिए एडमिशन नं. या मोबाइल नंबर दें।", en: "Give the admission no. or a mobile number to sign in with." }) : L({ hi: "साइन इन के लिए मोबाइल नंबर या स्टाफ़ कोड दें।", en: "Give a mobile number or staff code to sign in with." }));
    if (isNew) {
      const weak = passwordProblem(password, L);
      if (weak) return toast(false, `${L({ hi: "पासवर्ड", en: "Password" })}: ${weak}`);
    }
    setBusy(true);
    // Keep the full name's old "(Designation)" suffix if the name itself was not changed.
    const keepSuffix = user && plainName(user.full_name) === name.trim() ? user.full_name : name.trim();
    const body = {
      full_name: keepSuffix,
      role,
      phone_number: phone.trim(),
      employee_code: family ? user?.employee_code || "" : code.trim(),
      admission_no: family ? adm.trim() : user?.admission_no || "",
      ...(isNew ? { password } : { is_active: active }),
    };
    try {
      const r = isNew ? await api<{ data: AppUser }>("/erp/users", { body }) : await api<{ data: AppUser }>(`/erp/users/${user!.id}`, { method: "PATCH", body });
      if (!r?.data) throw new ApiError(500, "");
      const loginId = r.data.phone_number || r.data.employee_code || r.data.admission_no || "";
      onSaved(r.data, isNew ? { name: name.trim(), loginId, password, isNew: true } : undefined);
    } catch (e) {
      toast(false, errMsg(e, L({ hi: "सेव नहीं हुआ।", en: "Could not save." })));
      setBusy(false);
    }
  };

  return (
    <Sheet title={isNew ? L({ hi: "यूज़र जोड़ें", en: "Add a user" }) : name || L({ hi: "यूज़र बदलें", en: "Edit user" })} onClose={() => !busy && onClose()}>
      <div className="space-y-3">
        <p className="text-[13px] text-ink-500">{isNew ? L({ hi: "किसी को उसका अपना लॉगिन देता है।", en: "Gives someone their own login." }) : `${L(ROLE_INFO[user!.role].label)} · ${user!.is_active ? L({ hi: "चालू", en: "Active" }) : L({ hi: "बंद", en: "Switched off" })}`}</p>
        <TextField label={L({ hi: "पूरा नाम", en: "Full name" })} value={name} onChange={setName} placeholder={L({ hi: "जैसे सुनीता शर्मा", en: "e.g. Sunita Sharma" })} />

        <p className="mlabel pt-1">{L({ hi: "रोल", en: "Role" })}</p>
        <p className="-mt-2 text-[12.5px] text-ink-500">{isMe ? L({ hi: "आप अपना रोल नहीं बदल सकते। दूसरा एडमिन बदल सकता है।", en: "You can't change your own role. Another admin can." }) : L({ hi: "तय करता है कि वे कौन सी स्क्रीन खोल सकते हैं।", en: "Decides which screens they can open." })}</p>
        <div className="space-y-2" role="radiogroup" aria-label={L({ hi: "रोल", en: "Role" })}>
          {ROLE_ORDER.map((r) => {
            const on = role === r;
            return (
              <label key={r} className={clsx("flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5", on ? "border-[#3099a4] bg-[#3099a4]/5" : "border-ink-200 bg-white", isMe && !on && "cursor-not-allowed opacity-50")}>
                <span className="radio min-h-0 pt-0.5">
                  <input type="radio" name="u-role" checked={on} disabled={isMe} onChange={() => setRole(r)} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold">
                    {L(ROLE_INFO[r].label)}
                    {!ROLE_INFO[r].staff && <span className="ml-1.5 font-normal text-ink-400">· {L({ hi: "परिवार", en: "family" })}</span>}
                  </span>
                  <span className="block text-[12.5px] text-ink-500">{L(ROLE_INFO[r].can)}</span>
                </span>
              </label>
            );
          })}
        </div>

        <p className="mlabel pt-1">{L({ hi: "साइन-इन ID", en: "Sign-in ID" })}</p>
        <p className="-mt-2 text-[12.5px] text-ink-500">{L({ hi: "इनमें से किसी से भी साइन इन कर सकते हैं।", en: "They can sign in with any one of these." })}</p>
        <TextField label={L({ hi: "मोबाइल नंबर", en: "Mobile number" })} value={phone} onChange={(v) => setPhone(v.replace(/\D/g, ""))} inputMode="numeric" maxLength={10} placeholder={L({ hi: "10 अंक", en: "10 digits" })} />
        {family ? (
          <TextField label={L({ hi: "एडमिशन नं.", en: "Admission no." })} value={adm} onChange={(v) => setAdm(v.toUpperCase())} placeholder="e.g. ADM-9102" />
        ) : (
          <TextField label={L({ hi: "स्टाफ़ कोड", en: "Staff code" })} value={code} onChange={(v) => setCode(v.toUpperCase())} placeholder="e.g. EMP-014" />
        )}

        {isNew ? (
          <>
            <p className="mlabel pt-1">{L({ hi: "पहला पासवर्ड", en: "First password" })}</p>
            <div className="flex gap-2">
              <label className="field-box flex-1">
                <input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono text-[16px]" autoComplete="off" aria-label={L({ hi: "पहला पासवर्ड", en: "First password" })} />
              </label>
              <button type="button" onClick={() => setPassword(suggestPassword())} className="btn-line min-h-[54px] px-3.5" aria-label={L({ hi: "दूसरा सुझाएँ", en: "Suggest another" })}>
                <RefreshCw className="h-4 w-4" aria-hidden /> {L({ hi: "नया", en: "New" })}
              </button>
            </div>
            <p className="text-[12.5px] text-ink-500">{L({ hi: "उन्हें यह पासवर्ड बताएँ; वे बाद में अपने प्रोफ़ाइल मेन्यू से बदल सकते हैं।", en: "Tell them this password; they can change it from their profile menu." })}</p>
          </>
        ) : (
          <div className="row-card flex items-start gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold">{L({ hi: "साइन इन कर सकते हैं", en: "Can sign in" })}</span>
              <span className="block text-[12.5px] text-ink-500">
                {isMe
                  ? L({ hi: "आप अपना अकाउंट बंद नहीं कर सकते।", en: "You can't switch off your own account." })
                  : active
                    ? L({ hi: "कोई स्कूल छोड़े तो बंद करें; उनका रिकॉर्ड रहता है।", en: "Switch off when someone leaves; their records stay." })
                    : L({ hi: "बंद: साइन इन नहीं कर सकते, और खुला सत्र भी बंद हो जाता है।", en: "Switched off: they cannot sign in, and any open session stops." })}
              </span>
            </span>
            <Switch on={active} disabled={isMe} label={L({ hi: "साइन इन कर सकते हैं", en: "Can sign in" })} onChange={setActive} />
          </div>
        )}

        <button type="button" onClick={save} disabled={busy} className="btn-primary w-full">
          {busy ? "…" : isNew ? L({ hi: "लॉगिन बनाएँ", en: "Create login" }) : L({ hi: "बदलाव सेव करें", en: "Save changes" })}
        </button>
      </div>
    </Sheet>
  );
}

function Switch({ on, disabled, label, onChange }: { on: boolean; disabled?: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className="-m-2 grid h-11 w-[60px] shrink-0 place-items-center disabled:opacity-50">
      <span className={clsx("relative h-6 w-11 rounded-full transition", on ? "bg-[#28d72a]" : "bg-ink-300")}>
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

/* ───────────── Set a new password for someone (ERP ResetPasswordModal) ───────────── */

function ResetSheet({ user, onClose, onDone }: { user: AppUser; onClose: () => void; onDone: (issued: IssuedLogin) => void }) {
  const L = useL();
  const [password, setPassword] = useState(suggestPassword);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const weak = passwordProblem(password, L);
    if (weak) return toast(false, weak);
    setBusy(true);
    try {
      await api(`/erp/users/${user.id}/password`, { body: { password } });
      onDone({ name: plainName(user.full_name), loginId: user.phone_number || user.employee_code || user.admission_no || "", password, isNew: false });
    } catch (e) {
      toast(false, errMsg(e, L({ hi: "पासवर्ड नहीं बदला।", en: "Could not set the password." })));
      setBusy(false);
    }
  };
  return (
    <Sheet title={L({ hi: "नया पासवर्ड", en: "Set a new password" })} onClose={() => !busy && onClose()}>
      <div className="space-y-3">
        <p className="text-[13.5px] text-ink-500">{plainName(user.full_name)}</p>
        <div className="flex gap-2">
          <label className="field-box flex-1">
            <small>{L({ hi: "नया पासवर्ड", en: "New password" })}</small>
            <input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono text-[16px]" autoComplete="off" />
          </label>
          <button type="button" onClick={() => setPassword(suggestPassword())} className="btn-line min-h-[54px] px-3.5">
            <RefreshCw className="h-4 w-4" aria-hidden /> {L({ hi: "नया", en: "New" })}
          </button>
        </div>
        <p className="text-[12.5px] text-ink-500">{L({ hi: "पुराना पासवर्ड तुरंत बंद हो जाता है।", en: "Their old password stops working at once." })}</p>
        <button type="button" onClick={save} disabled={busy} className="btn-primary w-full">
          {busy ? "…" : L({ hi: "पासवर्ड रखें", en: "Set password" })}
        </button>
      </div>
    </Sheet>
  );
}

/* ───────────── Shown once after creating a login or resetting (ERP IssuedLoginModal) ───────────── */

function IssuedSheet({ issued, school, onClose }: { issued: IssuedLogin; school: string; onClose: () => void }) {
  const L = useL();
  const [copied, setCopied] = useState(false);
  const text = `${school} login\nID: ${issued.loginId}\nPassword: ${issued.password}\nPlease change the password after signing in.`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Sheet title={issued.isNew ? L({ hi: "लॉगिन बन गया", en: "Login created" }) : L({ hi: "पासवर्ड बदल गया", en: "Password changed" })} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[13.5px] text-ink-500">{L({ hi: `${issued.name} को ये दें`, en: `Give these to ${issued.name}` })}</p>
        <dl className="kv row-card">
          <div>
            <dt>{L({ hi: "लॉगिन ID", en: "Login ID" })}</dt>
            <dd className="font-mono">{issued.loginId}</dd>
          </div>
          <div>
            <dt>{L({ hi: "पासवर्ड", en: "Password" })}</dt>
            <dd className="font-mono">{issued.password}</dd>
          </div>
        </dl>
        <p className="text-[12.5px] text-ink-500">{L({ hi: "यह पासवर्ड फिर नहीं दिखेगा। खो जाए तो नया रखें।", en: "This password is not shown again. If it is lost, set a new one." })}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={copy} className="btn-line">
            {copied ? <Check className="h-4 w-4 text-jade-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
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

/* ───────────── Change your own password (ERP ChangePasswordModal) ───────────── */

function OwnPasswordSheet({ onClose }: { onClose: () => void }) {
  const L = useL();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const weak = next ? passwordProblem(next, L) : null;
  const mismatch = again.length > 0 && again !== next;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return toast(false, L({ hi: "अपना अभी का पासवर्ड लिखें।", en: "Enter your current password." }));
    if (weak) return toast(false, weak);
    if (next !== again) return toast(false, L({ hi: "दोनों नए पासवर्ड एक जैसे नहीं।", en: "The two new passwords don't match." }));
    setBusy(true);
    try {
      await api("/erp/auth/password", { body: { current, next } });
      toast(true, L({ hi: "पासवर्ड बदल गया। अगली बार नया इस्तेमाल करें।", en: "Password changed. Use the new one next time you sign in." }));
      onClose();
    } catch (err) {
      toast(false, errMsg(err, L({ hi: "पासवर्ड नहीं बदला।", en: "Could not change the password." })));
      setBusy(false);
    }
  };
  const type = show ? "text" : "password";
  return (
    <Sheet title={L({ hi: "पासवर्ड बदलें", en: "Change password" })} onClose={() => !busy && onClose()}>
      <form onSubmit={save} className="space-y-3" noValidate>
        <p className="text-[13px] text-ink-500">{L({ hi: "कम से कम 8 अक्षर, अक्षर और अंक दोनों।", en: "At least 8 characters, with letters and numbers." })}</p>
        <label className="field-box">
          <small>{L({ hi: "अभी का पासवर्ड", en: "Current password" })}</small>
          <input type={type} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="text-[16px]" />
        </label>
        <label className="field-box">
          <small>{L({ hi: "नया पासवर्ड", en: "New password" })}</small>
          <input type={type} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className="text-[16px]" />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? L({ hi: "पासवर्ड छिपाएँ", en: "Hide passwords" }) : L({ hi: "पासवर्ड दिखाएँ", en: "Show passwords" })} className="-mr-2 grid h-11 w-11 shrink-0 place-items-center text-ink-400">
            {show ? <EyeOff className="h-[18px] w-[18px]" aria-hidden /> : <Eye className="h-[18px] w-[18px]" aria-hidden />}
          </button>
        </label>
        {weak && <p className="text-[12.5px] text-marigold-700">{weak}</p>}
        <label className="field-box">
          <small>{L({ hi: "नया पासवर्ड फिर से", en: "New password again" })}</small>
          <input type={type} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className="text-[16px]" />
        </label>
        {mismatch && <p className="text-[12.5px] text-rose-600">{L({ hi: "नए पासवर्ड से मेल नहीं खाता।", en: "Doesn't match the new password." })}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "…" : L({ hi: "पासवर्ड बदलें", en: "Change password" })}
        </button>
      </form>
    </Sheet>
  );
}
