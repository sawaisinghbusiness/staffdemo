"use client";

import { Database } from "lucide-react";
import { useL, type Bi } from "@/lib/i18n";

/** A screen whose tables are not in the database yet: says which SQL file the school must run once. */
export function SetupNeeded({ file, what }: { file: string; what: Bi }) {
  const L = useL();
  return (
    <div className="animate-rise row-card flex gap-3 p-4">
      <Database className="mt-0.5 h-5 w-5 shrink-0 text-marigold-600" aria-hidden />
      <p className="text-[14px] text-ink-700">
        {L({ hi: `${what.hi} के लिए डेटाबेस में एक बार की सेटिंग बाकी है। Supabase में यह SQL चलाएँ:`, en: `${what.en} needs a one-time database update. Run this SQL in Supabase:` })}
        <code className="mt-1.5 block break-all rounded-lg bg-ink-100 px-2 py-1 text-[12.5px]">supabase/migrations/{file}</code>
      </p>
    </div>
  );
}
