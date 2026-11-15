"use client";
import { Settings2 } from "lucide-react";
import { useL, type Bi } from "@/lib/i18n";
/** Setup status for school staff; technical migration paths belong in administrator documentation. */
export function SetupNeeded({ what }: { file: string; what: Bi }) {
  const L = useL();
  return <section className="row-card flex items-start gap-3 p-4" role="status"><Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden/><div><h2 className="text-[15px] font-semibold">{L(what)}</h2><p className="mt-1 text-[14px] leading-relaxed text-ink-600">{L({hi:'\u092f\u0939 \u0938\u0941\u0935\u093f\u0927\u093e \u0905\u092d\u0940 \u091a\u093e\u0932\u0942 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964 \u0938\u0947\u091f\u0905\u092a \u092a\u0942\u0930\u093e \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u0938\u094d\u0915\u0942\u0932 \u092a\u094d\u0930\u0936\u093e\u0938\u0915 \u0938\u0947 \u0938\u0902\u092a\u0930\u094d\u0915 \u0915\u0930\u0947\u0902\u0964',en:'This feature is not enabled yet. Ask your school administrator to complete setup.'})}</p></div></section>;
}
