/**
 * Excel round trip without a library (2026-10-26): lists download as CSV, which Excel opens directly (a UTF-8
 * mark keeps Hindi names right), and the filled sheet comes back as CSV ("Save As → CSV" in Excel).
 */

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // A cell starting with = + - @ would run as a formula in Excel: keep it text.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Saves rows as a .csv file on the phone or computer. */
export function downloadCsv(name: string, header: string[], rows: unknown[][]) {
  const text = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** CSV text → rows of cells (quotes, commas and line breaks inside quotes handled). Tabs work too. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const sep = (src.split(/\r?\n/, 1)[0].match(/\t/g)?.length || 0) > (src.split(/\r?\n/, 1)[0].match(/,/g)?.length || 0) ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.replace(/^'(?=[=+\-@])/, "").trim()));
}

/** "25-03-2015", "25/03/2015" or "2015-03-25" → "2015-03-25"; anything else as it is (the server says it's wrong). */
export function isoDate(v: string) {
  const s = v.trim();
  let m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return s;
}
/** "2015-03-25" → "25-03-2015", the way schools write dates. */
export const dmy = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? iso.split("-").reverse().join("-") : iso || "");
