/**
 * /api/* is always forwarded to the backend, so the sign-in cookie stays on this site's own domain.
 *  - Vercel and `next dev`: Next's own rewrite below (set BACKEND_URL in Vercel's environment variables).
 *  - Render Static Site: built as plain files in `out/`, with a Render rewrite rule doing the forwarding.
 */
// The live backend, built in so a missing Vercel setting can't send /api to localhost.
const LIVE_BACKEND = "https://sms-backend-6szn.onrender.com";
// On Vercel only a public https address counts (a localhost value there is a mistake).
const SET = (process.env.BACKEND_URL || "").trim();
const BACKEND = (process.env.VERCEL ? (/^https:\/\//.test(SET) ? SET : LIVE_BACKEND) : SET || "http://localhost:4000").replace(/\/+$/, "");
const staticExport = process.env.NODE_ENV === "production" && !process.env.VERCEL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  ...(staticExport
    ? { output: "export", trailingSlash: true }
    : { rewrites: async () => [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }] }),
  images: { unoptimized: true },
};

export default nextConfig;
