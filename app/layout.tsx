import type { Metadata, Viewport } from "next";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "@fontsource/figtree/800.css";
import "@fontsource/hind/400.css";
import "@fontsource/hind/500.css";
import "@fontsource/hind/600.css";
import "@fontsource/hind/700.css";
import "@fontsource/baloo-2/400.css";
import "@fontsource/baloo-2/500.css";
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";
import "@fontsource/baloo-2/800.css";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/noto-sans-devanagari/wght.css";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import "./staff-workspace.css";
import "./erp-interface.css";
import "./action-palette.css";
import "./driver-interface.css";
import "./driver-dispatch.css";
import "./status-badges.css";
import { LangProvider } from "@/lib/i18n";
import { Toaster } from "@/lib/toast";

export const metadata: Metadata = {
  title: "School Staff",
  description: "Attendance, homework, marks and your own details, from your phone.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Staff", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  // The whole app is drawn zoomed out (user, 2026-10-26: "sab bada lagta hai"): laid out wider, drawn smaller.
  initialScale: 0.88,
  // No pinch or double-tap zoom (user, 2026-11-16): it stays at this size.
  minimumScale: 0.88,
  maximumScale: 0.88,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LangProvider>
          {children}
          <Toaster />
        </LangProvider>
      </body>
    </html>
  );
}
