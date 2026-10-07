import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/noto-sans-devanagari";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "School Staff",
  description: "Attendance, homework, marks and your own details, from your phone.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Staff", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141519",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi">
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
