"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { useApi, type ApiError } from "./api";
import { DEMO, demoSignedIn } from "./demo";
import { isErpMode } from "./erpMode";
import type { Bi } from "./i18n";

export interface MySection {
  id: string;
  classSec: string;
  subjects: string[];
  classTeacher: boolean;
}
export interface Me {
  role: "teacher" | "driver" | "peon";
  name: string;
  roleLabel: Bi;
  empCode: string;
  /** Read fresh from the ERP staff record each time. */
  photoUrl?: string | null;
  phone: string;
  joined: string;
  school: { name: string; shortName: string; logoUrl: string | null; heroUrl?: string | null; officePhone: string; address?: string };
  sections: MySection[];
}

interface State {
  me: Me | undefined;
  stale: boolean;
  error: ApiError | null;
  reload: () => void;
}
const Ctx = createContext<State>({ me: undefined, stale: false, error: null, reload: () => {} });

/** The signed-in staff member. Teachers also get the classes and subjects they take. */
export function StaffProvider({ children }: { children: React.ReactNode }) {
  const { data: raw, stale, error, reload } = useApi<Me>("/me");
  // Only a real answer counts: one without the role or the school is ignored (never crash on it).
  const me = useMemo(() => (raw && raw.role && raw.school ? { ...raw, sections: Array.isArray(raw.sections) ? raw.sections : [] } : undefined), [raw]);
  // The browser tab carries the school's name from ERP Settings.
  useEffect(() => {
    if (me?.school?.name) document.title = `${me.school.name} · Staff`;
  }, [me?.school?.name]);
  useEffect(() => {
    // Signed out: straight to sign-in, without first drawing the home screen.
    if (DEMO && !isErpMode() && !demoSignedIn()) window.location.replace("/login/");
  }, []);
  return <Ctx.Provider value={{ me, stale, error: me ? null : error, reload }}>{children}</Ctx.Provider>;
}

export const useStaff = () => useContext(Ctx);
export const isTeacher = (me?: Me) => me?.role === "teacher";
