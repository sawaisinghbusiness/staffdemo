"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { LEAVE_TYPES, type LeaveType } from "@/lib/leave";
import { ErrorCard, ListSkeleton, SelectBox } from "@/components/ui";

interface Data {
  rules: { today: string; minFrom: string; maxFrom: string };
}

/** Own leave: type, from, to, full or half day (one choice), reason. */
export default function ApplyLeavePage() {
  const L = useL();
  const router = useRouter();
  const { data, error, reload } = useApi<Data>("/my/leave");
  const [type, setType] = useState<LeaveType>("casual");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [half, setHalf] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    if (data && !from) {
      setFrom(data.rules.today);
      setTo(data.rules.today);
    }
  }, [data, from]);
  const oneDay = !!from && (!to || to === from);
  useEffect(() => {
    if (!oneDay) setHalf(false);
  }, [oneDay]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (to && to < from) return setProblem(L({ hi: "आख़िरी दिन पहले दिन से पहले नहीं हो सकता।", en: "The last day cannot be before the first day." }));
    if (reason.trim().length < 3) return setProblem(L({ hi: "छुट्टी का कारण लिखें।", en: "Write the reason for leave." }));
    setBusy(true);
    setProblem("");
    try {
      await api("/my/leave", { body: { from, to: to || from, type, halfDay: half && oneDay, reason: reason.trim() } });
      router.replace("/leave/?sent=1");
    } catch (err) {
      setProblem(err instanceof ApiError && err.message ? err.message : L({ hi: "भेजा नहीं जा सका।", en: "Could not send." }));
      setBusy(false);
    }
  }

  if (!data) {
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton />;
  }

  return (
    <form onSubmit={send} className="animate-rise space-y-3.5" noValidate>
      <SelectBox label={L({ hi: "छुट्टी का प्रकार", en: "Type" })} value={type} onChange={(v) => setType(v as LeaveType)}>
        {(Object.keys(LEAVE_TYPES) as LeaveType[]).map((k) => (
          <option key={k} value={k}>
            {L(LEAVE_TYPES[k])}
          </option>
        ))}
      </SelectBox>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="field-box">
          <small>{L({ hi: "किस दिन से", en: "From" })}</small>
          <input
            type="date"
            value={from}
            min={data.rules.minFrom}
            max={data.rules.maxFrom}
            onChange={(e) => {
              setFrom(e.target.value);
              if (!to || to < e.target.value) setTo(e.target.value);
            }}
          />
          <CalendarDays aria-hidden />
        </label>
        <label className="field-box">
          <small>{L({ hi: "किस दिन तक", en: "To" })}</small>
          <input type="date" value={to} min={from} max={data.rules.maxFrom} onChange={(e) => setTo(e.target.value)} />
          <CalendarDays aria-hidden />
        </label>
      </div>
      <div className="flex gap-6" role="radiogroup" aria-label={L({ hi: "कितना दिन", en: "Day" })}>
        <label className="radio">
          <input type="radio" name="span" checked={!half} onChange={() => setHalf(false)} />
          {L({ hi: "पूरा दिन", en: "Full day" })}
        </label>
        <label className="radio">
          <input type="radio" name="span" checked={half} disabled={!oneDay} onChange={() => setHalf(true)} />
          <span className={oneDay ? "" : "text-ink-400"}>{L({ hi: "आधा दिन", en: "Half day" })}</span>
        </label>
      </div>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={300} className="textarea-box" placeholder={L({ hi: "छुट्टी का कारण", en: "Reason for leave" })} />
      <p className="text-[13px] text-ink-500">{L({ hi: "स्कूल ऑफ़िस इसे देखकर यहीं जवाब देगा।", en: "The school office will see this and reply here." })}</p>
      {problem && (
        <p role="alert" className="text-[14px] text-rose-700">
          {problem}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "…" : L({ hi: "अर्ज़ी भेजें", en: "Apply" })}
      </button>
    </form>
  );
}
