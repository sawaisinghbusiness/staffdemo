"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO, demoApi } from "./demo";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** A server that does not answer in this time counts as unreachable, so no screen waits forever. */
const TIMEOUT_MS = 15_000;

/** Calls the backend through this site's own /api (same domain, so the sign-in cookie just works). */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const method = init?.method || (init?.body ? "POST" : "GET");
  if (DEMO) {
    try {
      return (await demoApi(path, method, init?.body)) as T;
    } catch (e: any) {
      throw new ApiError(e?.status ?? 500, e?.message || "");
    }
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
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
    throw new ApiError(0, "offline");
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
  try {
    const raw = localStorage.getItem(KEY + path);
    return raw ? (JSON.parse(raw).v as T) : undefined;
  } catch {
    return undefined;
  }
}
function writeCache(path: string, v: unknown) {
  try {
    localStorage.setItem(KEY + path, JSON.stringify({ at: Date.now(), v }));
  } catch {
    /* storage full or blocked: fine, we just won't have an offline copy */
  }
}
export function clearCache() {
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
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [stale, setStale] = useState(false);
  const live = useRef(path);

  const load = useCallback(async () => {
    if (!path) return;
    live.current = path;
    setLoading(true);
    try {
      const fresh = await api<T>(path);
      if (live.current !== path) return;
      setData(fresh);
      setError(null);
      setStale(false);
      writeCache(path, fresh);
    } catch (e) {
      if (live.current !== path) return;
      const err = e instanceof ApiError ? e : new ApiError(0, "offline");
      setError(err);
      setStale(true);
      if (err.status === 401) window.location.replace("/login/");
    } finally {
      if (live.current === path) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (!path) return;
    setData(readCache<T>(path));
    setError(null);
    setStale(false);
    load();
  }, [path, load]);

  return { data, error, loading, stale, reload: load };
}
