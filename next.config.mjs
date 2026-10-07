/**
 * /api/* is always forwarded to the backend, so the sign-in cookie stays on this site's own domain.
 *  - Vercel and `next dev`: Next's own rewrite below (set BACKEND_URL in Vercel's environment variables).
 *  - Render Static Site: built as plain files in `out/`, with a Render rewrite rule doing the forwarding.
 */
const BACKEND = (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");
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
