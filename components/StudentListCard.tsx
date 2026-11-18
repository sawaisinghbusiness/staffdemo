"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar, Status } from "@/components/ui";
import { useL } from "@/lib/i18n";
import "./student-list-card.css";

export function StudentListCard({ href, name, classLabel, subtitle, photoUrl, feeStatus, inactive = false }: {
  href: string; name: string; classLabel: string; subtitle: string; photoUrl?: string | null;
  feeStatus?: "paid" | "due" | "overdue"; inactive?: boolean;
}) {
  const L = useL();
  return <Link href={href} className="row-card student-list-card">
    <Avatar name={name} url={photoUrl} size={44} />
    <span className="student-list-copy">
      <span className="student-list-title" title={`${name} (${classLabel})`}>
        <span className="student-list-name">{name}{inactive ? ` (${L({ hi: "छोड़ गया", en: "Left" })})` : ""}</span>
      </span>
      <span className="student-list-parent" title={`${classLabel} · ${subtitle}`}><span className="student-list-class">{classLabel}</span>{subtitle ? ` · ${subtitle}` : ""}</span>
    </span>
    {feeStatus && <span className="student-list-fee"><Status tone={feeStatus === "paid" ? "ok" : "bad"}>{feeStatus === "paid" ? L({ hi: "जमा", en: "Paid" }) : feeStatus === "overdue" ? L({ hi: "देरी", en: "Overdue" }) : L({ hi: "बाकी", en: "Due" })}</Status></span>}
    <ChevronRight className="student-list-chevron" size={17} aria-hidden />
  </Link>;
}
