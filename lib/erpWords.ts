/* Copied from the ERP (lib/words.ts). Keep in step. */
/** Words for certificates: dates and classes "in figures and words", as the TC format asks. */

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const ORDINAL_ONES = ["", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth", "Seventeenth", "Eighteenth", "Nineteenth"];
const ORDINAL_TENS = ["", "", "Twentieth", "Thirtieth"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function under100(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}

function ordinal(n: number): string {
  if (n < 20) return ORDINAL_ONES[n];
  if (n % 10 === 0) return ORDINAL_TENS[n / 10];
  return TENS[Math.floor(n / 10)] + " " + ORDINAL_ONES[n % 10];
}

function yearWords(y: number): string {
  if (y >= 2000 && y < 2100) return "Two Thousand" + (y % 100 ? " " + under100(y % 100) : "");
  return under100(Math.floor(y / 100)) + " Hundred" + (y % 100 ? " " + under100(y % 100) : "");
}

/** "2018-03-15" -> "Fifteenth March Two Thousand Eighteen" */
export function dateInWords(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return "";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!mo || mo > 12 || !d || d > 31) return "";
  return `${ordinal(d)} ${MONTHS[mo - 1]} ${yearWords(y)}`;
}

/** "2018-03-15" -> "15/03/2018" */
export function dateFigures(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

const CLASS_WORDS: Record<string, string> = {
  "Pre Nursery": "Pre Nursery",
  Nursery: "Nursery",
  LKG: "Lower Kindergarten",
  UKG: "Upper Kindergarten",
};

/** "3rd" -> "Third", "11th" -> "Eleventh", "UKG" -> "Upper Kindergarten" */
export function classInWords(cls: string): string {
  if (CLASS_WORDS[cls]) return CLASS_WORDS[cls];
  const n = parseInt(cls, 10);
  return n >= 1 && n <= 12 ? ordinal(n) : cls;
}

const ORDER = ["Pre Nursery", "Nursery", "LKG", "UKG", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

/** The class a pupil moves up to, or "" after 12th. */
export function nextClass(cls: string): string {
  const i = ORDER.indexOf(cls);
  return i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : "";
}

/** Pronouns and relation words for certificate sentences. */
export function genderWords(gender?: string) {
  if (gender === "Female") return { child: "daughter", he: "She", his: "Her", him: "her" };
  if (gender === "Male") return { child: "son", he: "He", his: "His", him: "him" };
  return { child: "ward", he: "They", his: "Their", him: "them" };
}
