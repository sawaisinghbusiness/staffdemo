"use client";
import { useState, useSyncExternalStore } from "react";
import { RefreshCw } from "lucide-react";
import { resourceFailures, resourceRevision, subscribeResources } from "@/lib/resourceStatus";
import { useL } from "@/lib/i18n";

export function ResourceStatus() {
  useSyncExternalStore(subscribeResources, resourceRevision, () => 0);
  const L = useL(); const [busy, setBusy] = useState(false);
  const failures = resourceFailures();
  if (!failures.length) return null;
  const offline = failures.some(f => f.status === 0);
  return <div role="status" className="resource-status flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#D5DAD5] bg-white px-4 py-2 text-[14px] leading-relaxed text-[#454D48]">
    <span className="min-w-0 flex-1">{offline ? L({hi:"कनेक्शन उपलब्ध नहीं है। सेव की हुई जानकारी दिख रही है।",en:"Connection unavailable. Showing saved information."}) : L({hi:"नई जानकारी नहीं मिल सकी। सेव की हुई जानकारी दिख रही है।",en:"Could not refresh. Showing saved information."})}</span>
    <button type="button" disabled={busy} aria-busy={busy} className="inline-flex min-h-[44px] items-center gap-2 px-2 font-semibold disabled:opacity-60" onClick={async()=>{setBusy(true);try{await Promise.allSettled(failures.map(f=>f.retry()))}finally{setBusy(false)}}}><RefreshCw size={16} aria-hidden className={busy?"animate-spin":""}/>{busy?L({hi:"कोशिश हो रही है…",en:"Trying…"}):L({hi:"फिर कोशिश करें",en:"Try again"})}</button>
  </div>;
}
