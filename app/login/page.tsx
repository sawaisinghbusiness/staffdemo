"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Phone } from "lucide-react";
import { api, ApiError, clearCache } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { phoneText } from "@/lib/format";
import { DEMO, DEMO_CODE } from "@/lib/demo";
import { SchoolMark } from "@/components/ui";

interface PublicSchool {
  name: string;
  address?: string;
  logoUrl: string | null;
  officePhone: string;
}
type Role = "teacher" | "driver" | "peon";

const RESEND_SECONDS = 30;
const ROLES: { key: Role; text: { hi: string; en: string } }[] = [
  { key: "teacher", text: { hi: "अध्यापक", en: "Teacher" } },
  { key: "driver", text: { hi: "ड्राइवर", en: "Driver" } },
  { key: "peon", text: { hi: "सहायक", en: "Attendant" } },
];

export default function LoginPage() {
  const L = useL();
  const { lang, setLang } = useLang();
  const [school, setSchool] = useState<PublicSchool | null>(null);
  const [step, setStep] = useState<"mobile" | "code">("mobile");
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState<Role>("teacher");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<PublicSchool>("/school").then(setSchool).catch(() => null);
  }, []);
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);
  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const fail = (e: unknown) => {
    const err = e instanceof ApiError ? e : new ApiError(0, "");
    setError(err.status === 0 ? L({ hi: "इंटरनेट नहीं है। कनेक्शन आने पर दोबारा कोशिश करें।", en: "No internet. Try again when you are connected." }) : err.message || L({ hi: "कुछ गड़बड़ हुई। दोबारा कोशिश करें।", en: "Something went wrong. Please try again." }));
    setShake((n) => n + 1);
  };

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const digits = mobile.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError(L({ hi: "10 अंकों का मोबाइल नंबर डालें।", en: "Enter your 10-digit mobile number." }));
      setShake((n) => n + 1);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/otp", { body: { mobile: digits } });
      setMobile(digits);
      setCode("");
      setStep("code");
      setWait(RESEND_SECONDS);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function verify(value = code) {
    if (value.length !== 6) {
      setError(L({ hi: "पूरा 6 अंकों का कोड डालें।", en: "Enter the full 6-digit code." }));
      setShake((n) => n + 1);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/verify", { body: { mobile, code: value, role } });
      clearCache();
      window.location.replace("/");
    } catch (err) {
      fail(err);
      setCode("");
      setBusy(false);
    }
  }

  return (
    <main className="pt-safe mx-auto flex min-h-[100dvh] max-w-[440px] flex-col bg-white px-5 pb-6">
      <div className="flex justify-end pt-3">
        <button onClick={() => setLang(lang === "hi" ? "en" : "hi")} className="min-h-[44px] rounded-lg px-3 text-[14px] font-semibold text-brand-600">
          {lang === "hi" ? "English" : "हिंदी"}
        </button>
      </div>

      <div className="flex flex-col items-center pt-4 text-center">
        {school ? <SchoolMark name={school.name} url={school.logoUrl} size={66} /> : <div className="h-[66px] w-[66px] rounded-[18px] bg-ink-100" aria-hidden />}
        <p className="mt-3 text-[16px] font-bold">{school?.name || " "}</p>
        <p className="text-[13px] text-ink-500">{school?.address || L({ hi: "स्टाफ़ ऐप", en: "Staff app" })}</p>
      </div>

      <div className="pb-4 pt-8">
        <h1 className="text-[24px] font-extrabold">{L({ hi: "स्टाफ़ लॉगिन", en: "Staff sign in" })}</h1>
        <p className="mt-1 text-[14px] text-ink-500">{L({ hi: "वही नंबर डालें जो स्कूल में आपके रिकॉर्ड में दर्ज है।", en: "Use the number the school has on your record." })}</p>
      </div>

      <div key={shake} className={clsx(shake > 0 && "animate-shake")}>
        {step === "mobile" ? (
          <form onSubmit={sendCode} noValidate>
            {DEMO && (
              <fieldset className="mb-3">
                <legend className="mb-1 text-[13px] font-medium text-ink-500">{L({ hi: "डेमो: आप कौन हैं?", en: "Demo: who are you?" })}</legend>
                <div className="flex flex-wrap gap-x-5" role="radiogroup">
                  {ROLES.map((r) => (
                    <label key={r.key} className="radio">
                      <input type="radio" name="role" checked={role === r.key} onChange={() => setRole(r.key)} />
                      {L(r.text)}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <label className="field-box">
              <small>{L({ hi: "मोबाइल नंबर", en: "Mobile number" })}</small>
              <span className="pt-4 font-medium text-ink-500">+91</span>
              <input
                id="mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={14}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/[^\d ]/g, ""))}
                className="tnum text-[17px] font-semibold tracking-wide placeholder:font-normal"
                placeholder="98765 43210"
                autoFocus={!DEMO}
              />
            </label>
            {DEMO && <p className="mt-2 text-[13px] text-ink-500">{L({ hi: "डेमो: कोई भी 10 अंकों का मोबाइल नंबर डालें।", en: "Demo: enter any 10-digit mobile number." })}</p>}
            {error && (
              <p className="mt-3 font-medium text-rose-700" role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className="btn-primary mt-5 w-full">
              {busy ? "…" : L({ hi: "WhatsApp पर कोड भेजें", en: "Send code on WhatsApp" })}
            </button>
            <p className="mt-3 text-center text-[13px] text-ink-500">{L({ hi: "6 अंकों का कोड कुछ ही सेकंड में आएगा।", en: "The 6-digit code arrives in a few seconds." })}</p>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verify();
            }}
            noValidate
          >
            <button
              type="button"
              onClick={() => {
                setStep("mobile");
                setError("");
              }}
              className="-ml-1 mb-2 flex min-h-[44px] items-center gap-1 text-[14px] font-semibold text-brand-600"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> {L({ hi: "नंबर बदलें", en: "Change number" })}
            </button>
            {DEMO ? (
              <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-ink-800">
                {L({ hi: "डेमो कोड:", en: "Demo code:" })} <span className="tnum text-lg font-bold tracking-widest text-ink-900">{DEMO_CODE}</span>
              </p>
            ) : (
              <p className="text-ink-600">
                {L({ hi: "कोड WhatsApp पर भेजा गया", en: "Code sent on WhatsApp to" })} <span className="tnum font-semibold text-ink-900">+91 {phoneText(mobile)}</span>
              </p>
            )}
            <label htmlFor="code" className="mb-2 mt-4 block font-semibold text-ink-800">
              {L({ hi: "6 अंकों का कोड", en: "6-digit code" })}
            </label>
            <input
              ref={codeRef}
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d*"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6 && !busy) verify(v);
              }}
              className="field tnum text-center text-[28px] font-bold tracking-[0.5em] placeholder:tracking-[0.5em]"
              placeholder="······"
            />
            {error && (
              <p className="mt-3 font-medium text-rose-700" role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className="btn-primary mt-5 w-full">
              {busy ? "…" : L({ hi: "लॉगिन करें", en: "Sign in" })}
            </button>
            <div className="mt-3 text-center">
              {wait > 0 ? (
                <p className="tnum min-h-[44px] pt-3 text-sm text-ink-500">
                  {L({ hi: "दोबारा भेजें", en: "Resend in" })} 0:{String(wait).padStart(2, "0")}
                </p>
              ) : (
                <button type="button" onClick={() => sendCode()} disabled={busy} className="link text-sm">
                  {L({ hi: "कोड दोबारा भेजें", en: "Resend code" })}
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {school?.officePhone && (
        <div className="mt-auto pt-8 text-center text-sm text-ink-500">
          <p>{L({ hi: "मदद चाहिए? स्कूल ऑफ़िस:", en: "Need help? School office:" })}</p>
          <a href={`tel:${school.officePhone.replace(/\s/g, "")}`} className="link justify-center">
            <Phone className="h-4 w-4" aria-hidden /> {school.officePhone}
          </a>
        </div>
      )}
    </main>
  );
}
