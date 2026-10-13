import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useL } from "@/lib/i18n";

/** Ask Teacher's maroon header with the block-print band at its foot. */
export function AjrakhHeader({ back, children }: { back: string; children: React.ReactNode }) {
  const L = useL();
  return (
    <header className="pt-safe sticky top-0 z-20 bg-ajk-m text-white">
      <div className="flex items-center gap-1.5 pb-3 pl-1.5 pr-4 pt-2">
        <Link href={back} className="grid h-11 w-11 shrink-0 place-items-center rounded-full active:bg-white/10" aria-label={L({ hi: "वापस", en: "Back" })}>
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <div className="ajk-band" aria-hidden />
    </header>
  );
}
