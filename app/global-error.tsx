"use client";

import { useEffect } from "react";

/**
 * Last-resort screen for an error the app could not handle (instead of Next's bare "Application error").
 * The usual cause right after an update: the phone still had the old app open, and a screen it asks for
 * no longer exists on the server (a "chunk" from the old version). Then the page reloads itself once, which
 * fetches the new version; anything else shows a short message with a Reload button.
 */
const STALE = /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed/i;
const KEY = "app:auto-reload-at";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
    if (!STALE.test(`${error?.name} ${error?.message}`)) return;
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(KEY) || 0);
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* storage blocked: still reload once */
    }
    // Once per 30 seconds at most, so a real fault cannot reload the page forever.
    if (Date.now() - last > 30_000) window.location.reload();
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F7F9FC", color: "#16213A" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 320 }}>
            <p style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>Please reload the app</p>
            <p style={{ fontSize: 14, lineHeight: 1.5, margin: "0 0 20px", color: "#56627A" }}>
              Something went wrong, usually because the app was updated while it was open. Reload to get the new version. ऐप अपडेट हुआ है, दोबारा खोलें।
            </p>
            {/* The error itself, small, so a screenshot tells us what broke. */}
            <p style={{ fontSize: 11, lineHeight: 1.4, margin: "0 0 16px", color: "#8A94A6", wordBreak: "break-word", textAlign: "left", whiteSpace: "pre-wrap" }}>
              {`${error?.name || "Error"}: ${error?.message || ""}${error?.digest ? ` (${error.digest})` : ""}\n${String(error?.stack || "").split("\n").slice(1, 4).join("\n")}`}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ minHeight: 48, padding: "0 24px", borderRadius: 12, border: 0, background: "#0D2A5E", color: "#fff", fontSize: 16, fontWeight: 600 }}
            >
              Reload / दोबारा खोलें
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
