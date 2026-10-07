"use client";

import { createContext, useContext, useEffect } from "react";
import { useApi, type ApiError } from "./api";
import { DEMO, demoSignedIn } from "./demo";
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
  phone: string;
  joined: string;
  school: { name: string; shortName: string; logoUrl: string | null; officePhone: string };
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
  const { data: me, stale, error, reload } = useApi<Me>("/me");
  useEffect(() => {
    // Signed out: straight to sign-in, without first drawing the home screen.
    if (DEMO && !demoSignedIn()) window.location.replace("/login/");
  }, []);
  return <Ctx.Provider value={{ me, stale, error: me ? null : error, reload }}>{children}</Ctx.Provider>;
}

export const useStaff = () => useContext(Ctx);
export const isTeacher = (me?: Me) => me?.role === "teacher";
