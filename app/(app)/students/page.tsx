"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { useApi } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useL } from "@/lib/i18n";
import { Avatar, Empty, ErrorCard, ListSkeleton, SelectBox } from "@/components/ui";

interface Roster {
  id: string;
  classSec: string;
  students: { id: string; name: string; rollNo: string }[];
}

/** Pick one of your classes, then a student. Search by name or roll number. */
export default function StudentsPage() {
  const { me } = useStaff();
  const L = useL();
  const sections = me?.sections || [];
  const [id, setId] = useState("");
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!id && sections.length) setId(sections.find((s) => s.classTeacher)?.id || sections[0].id);
  }, [sections, id]);
  useEffect(() => setFocus(new URLSearchParams(window.location.search).get("search") === "1"), []);
  const { data, error, reload } = useApi<Roster>(id ? `/students?section=${id}` : null);

  const term = q.trim().toLowerCase();
  const list = (data?.students || []).filter((s) => !term || s.name.toLowerCase().includes(term) || s.rollNo.replace(/^0+/, "") === term.replace(/^0+/, ""));

  return (
    <div className="animate-rise space-y-3">
      <SelectBox label={L({ hi: "कक्षा", en: "Class" })} value={id} onChange={setId}>
        {sections.map((s) => (
          <option key={s.id} value={s.id}>
            {s.classSec}
            {s.classTeacher ? ` · ${L({ hi: "क्लास टीचर", en: "class teacher" })}` : ""}
          </option>
        ))}
      </SelectBox>
      <label className="field-box min-h-[48px]">
        <Search aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "नाम या रोल नंबर से खोजें", en: "Search by name or roll" })} autoFocus={focus} enterKeyHint="search" />
      </label>

      {!data ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={5} />
      ) : list.length === 0 ? (
        <Empty>{L({ hi: "कोई बच्चा नहीं मिला।", en: "No student found." })}</Empty>
      ) : (
        <>
          <p className="mlabel">
            {data.classSec} · {data.students.length} {L({ hi: "बच्चे", en: "students" })}
          </p>
          <ul>
            {list.map((s) => (
              <li key={s.id}>
                <Link href={`/students/detail/?id=${encodeURIComponent(s.id)}`} className="flex min-h-[60px] items-center gap-3 border-b border-ink-100 active:bg-ink-50">
                  <Avatar name={s.name} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-medium">{s.name}</span>
                    <span className="block text-[12.5px] text-ink-400">
                      {L({ hi: "रोल", en: "Roll" })} {s.rollNo}
                    </span>
                  </span>
                  <ChevronRight className="h-[18px] w-[18px] text-ink-300" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
