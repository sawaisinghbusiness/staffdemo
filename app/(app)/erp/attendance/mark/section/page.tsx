"use client";

import { useEffect } from "react";
import { ListSkeleton } from "@/components/ui";

/*
 * Old address of one section's roll call. The roll call now lives on Mark attendance itself (2026-10-26),
 * so old links (?date=&class=&section=) land there with the same section chosen.
 */
export default function ErpRollCallRedirect() {
  useEffect(() => {
    window.location.replace(`/erp/attendance/mark/${window.location.search}`);
  }, []);
  return <ListSkeleton rows={6} />;
}
