"use client";

import { useEffect } from "react";

/** Old address kept working (bookmarks, installed shortcuts): sends the phone to where the screen lives now. */
export function Redirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to.includes("?") ? to : to + window.location.search);
  }, [to]);
  return null;
}
