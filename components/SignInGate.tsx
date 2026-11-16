"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, hasSignInMark, markSignedIn } from "@/lib/api";
import { DEMO, demoSignedIn } from "@/lib/demo";
import { isErpMode } from "@/lib/erpMode";
import { useL } from "@/lib/i18n";

/**
 * Opening the app when not signed in goes straight to the sign-in page: no screen of the app is
 * drawn first. A phone that signed in before shows the app at once (the server's 401 still sends
 * it to sign-in if the session has run out). A phone without the mark (signed in before this
 * check existed) asks the server once, showing only a blank screen meanwhile. If that check
 * cannot reach the server (no internet, server slow), it says so with "Try again" instead of
 * sending a signed-in person to the sign-in page.
 */
export function SignInGate({ children }: { children: React.ReactNode }) {
  const L = useL();
  const [ok, setOk] = useState(false);
  const [down, setDown] = useState<"offline" | "slow" | null>(null);

  const check = useCallback(() => {
    const out = () => window.location.replace("/login/");
    if (isErpMode()) return hasSignInMark() ? setOk(true) : out();
    if (DEMO) return demoSignedIn() ? setOk(true) : out();
    if (hasSignInMark()) return setOk(true);
    setDown(null);
    api("/me")
      .then(() => {
        markSignedIn(true);
        setOk(true);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 0) setDown(e.message === "timeout" ? "slow" : "offline");
        else out();
      });
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  if (ok) return <>{children}</>;
  if (down)
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-white px-6 text-center" role="alert">
        <div className="space-y-4">
          <p className="text-[16px] text-ink-700">
            {down === "slow"
              ? L({ hi: "सर्वर जवाब देने में देर कर रहा है। थोड़ी देर में दोबारा कोशिश करें।", en: "The server is taking too long to answer. Please try again in a moment." })
              : L({ hi: "इंटरनेट नहीं है। कनेक्शन आने पर दोबारा कोशिश करें।", en: "No internet. Try again when you are connected." })}
          </p>
          <button type="button" onClick={check} className="btn-primary w-full">
            {L({ hi: "दोबारा कोशिश करें", en: "Try again" })}
          </button>
        </div>
      </div>
    );
  return <div className="min-h-[100dvh] bg-white" aria-busy="true" />;
}
