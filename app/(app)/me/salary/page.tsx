"use client";

import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { rupees } from "@/lib/format";
import { BackLink, ErrorCard, Skeleton } from "@/components/ui";

interface Slip {
  month: string;
  basic: number;
  allowances: number;
  deductions: { name: string; amount: number }[];
  net: number;
  paidOn: string;
}

export default function SalaryPage() {
  const L = useL();
  const { lang } = useLang();
  const { data, error, reload } = useApi<{ slips: Slip[] }>("/my/salary");

  return (
    <div className="animate-rise space-y-3">
      <BackLink href="/me/" text={L({ hi: "मेरा", en: "Me" })} />
      <h1 className="text-xl font-bold">{L({ hi: "सैलरी स्लिप", en: "Salary slips" })}</h1>
      {!data ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <Skeleton className="h-40 w-full" />
      ) : data.slips.length === 0 ? (
        <p className="card p-4 text-ink-600">{L({ hi: "अभी कोई सैलरी स्लिप नहीं है।", en: "No salary slips yet." })}</p>
      ) : (
        data.slips.map((s) => (
          <section key={s.month} className="card p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-lg font-bold text-ink-900">{new Date(s.month + "-01T00:00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { month: "long", year: "numeric" })}</p>
              <p className="tnum text-xl font-extrabold text-ink-900">{rupees(s.net)}</p>
            </div>
            <dl className="tnum mt-2 divide-y divide-ink-100 text-[15px]">
              <div className="flex justify-between py-2">
                <dt className="text-ink-600">{L({ hi: "मूल वेतन", en: "Basic" })}</dt>
                <dd className="font-medium">{rupees(s.basic)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-ink-600">{L({ hi: "भत्ते", en: "Allowances" })}</dt>
                <dd className="font-medium">{rupees(s.allowances)}</dd>
              </div>
              {s.deductions.map((d) => (
                <div key={d.name} className="flex justify-between py-2">
                  <dt className="text-ink-600">− {d.name}</dt>
                  <dd className="font-medium">{rupees(d.amount)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-1 text-sm text-ink-500">
              {L({ hi: "भुगतान की तारीख", en: "Paid on" })}: {new Date(s.paidOn + "T00:00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" })}
            </p>
          </section>
        ))
      )}
    </div>
  );
}
