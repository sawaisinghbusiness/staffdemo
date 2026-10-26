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
import "./globals.css";
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
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* ERP login: zoom the page out before the first paint (see applyErpScale in lib/erpMode.ts). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("sa:erp")==="1"){var m=document.querySelector('meta[name="viewport"]');m&&m.setAttribute("content","width=device-width, initial-scale=0.88, viewport-fit=cover")}}catch(e){}`,
          }}
        />
        <LangProvider>
          {children}
          <Toaster />
        </LangProvider>
      </body>
    </html>
  );
}
