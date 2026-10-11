"use client";

import { useEffect, useState } from "react";

/** How the drop / pickup alert closes: on its own after 3 seconds, or by the driver. Kept on this phone. */
export type AlertClose = "auto" | "manual";
const KEY = "sa:drv-alert-close";

export const AUTO_CLOSE_MS = 3000;

export function readAlertClose(): AlertClose {
  try {
    return localStorage.getItem(KEY) === "manual" ? "manual" : "auto";
  } catch {
    return "auto";
  }
}

export function useAlertClose() {
  const [v, setV] = useState<AlertClose>("auto");
  useEffect(() => setV(readAlertClose()), []);
  const set = (x: AlertClose) => {
    setV(x);
    try {
      localStorage.setItem(KEY, x);
    } catch {
      /* private mode: this session only */
    }
  };
  return [v, set] as const;
}
