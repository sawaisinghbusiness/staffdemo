"use client";

import { useApi } from "./api";
import { useStaff } from "./staff";

/* ── Notices this phone has already shown, so only the unseen ones get the red count ── */

const SEEN = "sa:seen-notices";

export function seenNotices(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function markNoticesSeen(ids: string[]) {
  try {
    const all = seenNotices();
    ids.forEach((id) => all.add(id));
    // Only the latest few hundred are worth keeping.
    localStorage.setItem(SEEN, JSON.stringify(Array.from(all).slice(-300)));
  } catch {
    /* storage blocked: the count just stays until it works */
  }
}

/** How many school notices haven't been opened on this phone yet. */
export function useUnseenNotices() {
  const { me } = useStaff();
  const { data } = useApi<{ notices: { id: string }[] }>(me ? "/notices" : null);
  if (!data) return 0;
  const seen = seenNotices();
  return data.notices.filter((n) => !seen.has(n.id)).length;
}

/** Every red count in the app: parent messages not read, notices not seen, leave requests not answered. */
export function useCounts() {
  const { me } = useStaff();
  const teacher = me?.role === "teacher";
  const chats = useApi<{ unread: number }>(teacher ? "/chats/unread" : null);
  const home = useApi<{ pendingLeaves: number }>(teacher ? "/home" : null);
  const notices = useUnseenNotices();
  return { chats: chats.data?.unread || 0, leaves: home.data?.pendingLeaves || 0, notices };
}
