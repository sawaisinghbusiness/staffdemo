"use client";
import { clearEditorDrafts } from "@/lib/editorDrafts";
import { setResourceFailure } from "@/lib/resourceStatus";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO, demoApi } from "./demo";
import { erpApi, isErpMode } from "./erpMode";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** A server that does not answer in this time counts as unreachable, so no screen waits forever. */
const TIMEOUT_MS = 15_000;

/** Calls the backend through this site's own /api (same domain, so the sign-in cookie just works). */
export async function api<T>(path: string, init?: { method?: string; body?: unknown; timeoutMs?: number }): Promise<T> {
  const method = init?.method || (init?.body ? "POST" : "GET");
  // ERP login: the teacher app's screens, empty (see lib/erpMode.ts). Sign-in itself still goes to staff-app.
  if (isErpMode() && path !== "/otp" && path !== "/verify") {
    try {
      return (await erpApi(path, method, init?.body, init?.timeoutMs)) as T;
    } catch (e: any) {
      throw new ApiError(e?.status ?? 500, e?.message || "");
    }
  }
  if (DEMO) {
    try {
      return (await demoApi(path, method, init?.body)) as T;
    } catch (e: any) {
      throw new ApiError(e?.status ?? 500, e?.message || "");
    }
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`/api/staff-app${path}`, {
      method,
      credentials: "include",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: ctrl.signal,
    });
  } catch {
    // Our own timer firing means the server was slow, not that the phone is offline.
    throw new ApiError(0, ctrl.signal.aborted ? "timeout" : "offline");
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as any)?.error || "");
  return data as T;
}

/* ── Last good answer kept on the phone, so slow or no network still shows something ── */

const KEY = "sa:cache:";
export function readCache<T>(path: string): T | undefined {
  // Identity decides which application may render. Never reuse another session's role.
  if (path === "/me" || path === "/bus/route") return undefined;
  if(isErpMode())return undefined; // ERP financial and administrative views always load current server data.
  try {
    const raw = localStorage.getItem(KEY + path);
    return raw ? (JSON.parse(raw).v as T) : undefined;
  } catch {
    return undefined;
  }
}
/**
 * Answers kept in memory for this visit only (gone on reload or sign-out, never written to the phone).
 * They let a screen you come back to open filled at once, including /bus/route, which is never saved to the
 * phone because it decides which app the person sees. Not used in ERP mode: those views always load fresh.
 */
const memory = new Map<string, unknown>();
function recall<T>(path: string): T | undefined {
  const saved = readCache<T>(path);
  if (saved !== undefined) return saved;
  return path === "/me" || isErpMode() ? undefined : (memory.get(path) as T | undefined);
}
/** Changes the in-memory answer for a path (for example: the trip has just ended, so Home must not show it running). */
export function patchMemory<T>(path: string, change: (old: T) => T) {
  const old = memory.get(path) as T | undefined;
  if (old !== undefined) memory.set(path, change(old));
}
function writeCache(path: string, v: unknown) {
  if (path !== "/me" && !isErpMode()) memory.set(path, v);
  if (path === "/me" || path === "/bus/route") return;
  if(isErpMode())return;
  try {
    localStorage.setItem(KEY + path, JSON.stringify({ at: Date.now(), v }));
  } catch {
    /* storage full or blocked: fine, we just won't have an offline copy */
  }
}
const SIGNED = "sa:signed-in";
/** Remembered on this phone after a sign-in, so the app can go straight to sign-in when it's missing. */
export function markSignedIn(on: boolean) {
  try {
    if (on) localStorage.setItem(SIGNED, "1");
    else localStorage.removeItem(SIGNED);
  } catch {
    /* storage blocked: the server's 401 still sends them to sign-in */
  }
}
export function hasSignInMark() {
  try {
    return localStorage.getItem(SIGNED) === "1";
  } catch {
    return false;
  }
}

export function clearCache() {
  clearEditorDrafts();
  memory.clear();
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(KEY)) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/**
 * Shows the saved copy at once, then the fresh one. `stale` is true while only the saved copy is
 * on screen and the network failed, so the page can say "purani jaankari".
 */
export function useApi<T>(path: string | null) {
  // What was saved last time shows in the very first frame, so a screen opens filled, not as grey boxes.
  const [data, setData] = useState<T | undefined>(() => (path && typeof window !== "undefined" ? recall<T>(path) : undefined));
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [stale, setStale] = useState(false);
  const live = useRef(path);
  const resourceKey = useRef(Symbol("resource"));
  const requestId=useRef(0);

  const load = useCallback(async () => {
    if (!path) return false;
    live.current = path;
    const id=++requestId.current;
    setLoading(true);
    try {
      const fresh = await api<T>(path);
      if (live.current !== path || requestId.current!==id) return;
      setData(fresh);
      setError(null);
      setStale(false);
      writeCache(path, fresh);
      return true;
    } catch (e) {
      if (live.current !== path || requestId.current!==id) return;
      const err = e instanceof ApiError ? e : new ApiError(0, "offline");
      setError(err);
      setStale(true);
      if (err.status === 401) {
        markSignedIn(false);
        window.location.replace("/login/");
      }
      return false;
    } finally {
      if (live.current === path&&requestId.current===id) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (!path) {
      // No path (yet, or any more): show nothing, not the previous screen's answer.
      setData(undefined);
      setError(null);
      setStale(false);
      setLoading(false);
      return;
    }
    setData(recall<T>(path));
    setError(null);
    setStale(false);
    load();
    return()=>{requestId.current++;live.current=null;};
  }, [path, load]);

  useEffect(() => {
    const key = resourceKey.current;
    setResourceFailure(key, path && error ? {path,hasData:data!==undefined,status:error.status,retry:load} : null);
    return () => setResourceFailure(key,null);
  }, [path,error,data,load]);
  return { data, error, loading, stale, reload: load };
}
