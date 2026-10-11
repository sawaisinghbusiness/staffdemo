"use client";

import { useEffect, useState } from "react";
import { api, hasSignInMark, markSignedIn } from "@/lib/api";
import { DEMO, demoSignedIn } from "@/lib/demo";

/**
 * Opening the app when not signed in goes straight to the sign-in page: no screen of the app is
 * drawn first. A phone that signed in before shows the app at once (the server's 401 still sends
 * it to sign-in if the session has run out). A phone without the mark (signed in before this
 * check existed) asks the server once, showing only a blank screen meanwhile.
 */
export function SignInGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const out = () => window.location.replace("/login/");
    if (DEMO) return demoSignedIn() ? setOk(true) : out();
    if (hasSignInMark()) return setOk(true);
    api("/me")
      .then(() => {
        markSignedIn(true);
        setOk(true);
      })
      .catch(out);
  }, []);
  return ok ? <>{children}</> : <div className="min-h-[100dvh] bg-white" aria-busy="true" />;
}
