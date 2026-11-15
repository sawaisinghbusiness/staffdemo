"use client";

/**
 * Session close: every current student's unpaid balance moves into the next session as "dues from last
 * session" (collected first, in the first instalment). Always a preview first, then confirm.
 * Running it again only moves the difference. (Student profile 360; Codex owns the look.)
 */
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { rupees } from "@/lib/format";
import { toast } from "@/lib/toast";
import { Empty, SelectBox } from "@/components/ui";

interface Carry {
  from: string;
  to: string;
  students: number;
  total: number;
  rows: { studentId: string; name: string; classSec: string; due: number; already: number }[];
  applied: boolean;
}
const SESSIONS = (() => {
  const y = new Date().getFullYear();
  return [y - 2, y - 1, y].map((a) => `${a}-${a + 1}`);
})();

export default function ErpCarryForwardPage() {
  const L = useL();
  const [from, setFrom] = useState(SESSIONS[1]);
  const [preview, setPreview] = useState<Carry | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(dryRun: boolean) {
    if (!dryRun && preview) {
      const ok = window.confirm(L({ hi: `${preview.students} बच्चों का कुल ${rupees(preview.total)} बकाया ${preview.to} में जोड़ें?`, en: `Move ${rupees(preview.total)} of dues for ${preview.students} students into ${preview.to}?` }));
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await api<Carry & { success: boolean }>("/erp/fee-setup/carry-forward", { body: { from, dryRun } });
      setPreview(r);
      if (r.applied) toast(true, L({ hi: "बकाया अगले सत्र में जुड़ गया।", en: "Dues moved into the next session." }));
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "नहीं हो पाया।", en: "Could not do it." }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise space-y-4">
      <p className="text-[13.5px] leading-relaxed text-ink-700">
        {L({
          hi: "सत्र बंद करते समय हर पढ़ रहे बच्चे की बाकी फ़ीस अगले सत्र में \"पिछले सत्र का बकाया\" बनकर जुड़ जाती है और पहली किस्त में सबसे पहले ली जाती है। पहले देखें, फिर पक्का करें। दोबारा चलाने पर बस फ़र्क जुड़ता है, दोगुना नहीं होता।",
          en: "When a session closes, each current student's unpaid fee moves into the next session as \"dues from last session\", collected first in the first instalment. Preview first, then confirm. Running it again only moves the difference; it never doubles.",
        })}
      </p>
      <SelectBox label={L({ hi: "कौन-सा सत्र बंद करें", en: "Session to close" })} value={from} onChange={(v) => (setFrom(v), setPreview(null))}>
        {SESSIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </SelectBox>
      <button type="button" className="btn-line w-full" disabled={busy} onClick={() => run(true)}>
        {L({ hi: "पहले देखें", en: "Preview" })}
      </button>

      {preview &&
        (preview.students === 0 ? (
          <Empty>{preview.applied ? L({ hi: "हो गया।", en: "Done." }) : L({ hi: "आगे ले जाने को कोई नया बकाया नहीं।", en: "No new dues to move forward." })}</Empty>
        ) : (
          <section className="space-y-3">
            <div className="today-card pb-4">
              <p className="text-[12px] text-ink-500">
                {preview.from} → {preview.to}
              </p>
              <p className="tnum text-[20px] font-bold">{rupees(preview.total)}</p>
              <p className="text-[13px] text-ink-500">{L({ hi: `${preview.students} बच्चे`, en: `${preview.students} students` })}</p>
            </div>
            <ul className="row-card !py-1">
              {preview.rows.map((r) => (
                <li key={r.studentId} className="flex min-h-[52px] items-center gap-3 border-b border-ink-100 py-1.5 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{r.name}</span>
                    <span className="block truncate text-[12.5px] text-ink-500">
                      {r.classSec}
                      {r.already ? ` · ${L({ hi: "पहले जुड़ा", en: "already moved" })} ${rupees(r.already)}` : ""}
                    </span>
                  </span>
                  <span className="tnum text-[14.5px] font-semibold">{rupees(r.due)}</span>
                </li>
              ))}
            </ul>
            {!preview.applied && (
              <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => run(false)}>
                {L({ hi: `${rupees(preview.total)} अगले सत्र में जोड़ें`, en: `Move ${rupees(preview.total)} into ${preview.to}` })}
              </button>
            )}
          </section>
        ))}
    </div>
  );
}
