import type { Bi } from "./i18n";

/** The admission form's document list; keys match backend documentService.DOC_KEYS and the ERP website. */
export const DOCS: { key: string; text: Bi; note?: Bi }[] = [
  { key: "birth", text: { hi: "जन्म प्रमाण पत्र", en: "Birth certificate" } },
  { key: "aadhaar", text: { hi: "बच्चे का आधार कार्ड", en: "Child's Aadhaar card" } },
  { key: "tc", text: { hi: "TC (पिछले स्कूल की)", en: "Transfer certificate (TC)" }, note: { hi: "पिछले स्कूल से", en: "From the last school" } },
  { key: "marksheet", text: { hi: "पिछले साल की मार्कशीट", en: "Last year's marksheet" } },
  { key: "caste", text: { hi: "जाति प्रमाण पत्र", en: "Caste certificate" }, note: { hi: "SC / ST / OBC / MBC के लिए", en: "Needed for SC / ST / OBC / MBC" } },
  { key: "jan_aadhaar", text: { hi: "जन आधार कार्ड", en: "Jan Aadhaar card" } },
  { key: "parent_aadhaar", text: { hi: "माता-पिता का आधार", en: "Parent's Aadhaar card" } },
  { key: "income", text: { hi: "आय प्रमाण पत्र", en: "Income certificate" }, note: { hi: "सिर्फ़ RTE या छात्रवृत्ति के लिए", en: "Only for RTE or scholarship" } },
  { key: "photos", text: { hi: "4 पासपोर्ट फ़ोटो", en: "4 passport photos" } },
];

/**
 * A phone photo of a paper document, made small enough to send but still readable: longest side
 * 1600 px, JPEG, under about 1 MB (the backend takes up to 1.5 MB).
 */
export async function shrinkScan(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("This is not a photo.");
  if (file.size > 25 * 1024 * 1024) throw new Error("This photo is too big (over 25 MB).");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file); // honours the phone's rotation
  } catch {
    throw new Error("This photo format can't be used. Save it as JPG or PNG.");
  }
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the photo on this device.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  let q = 0.82;
  let out = canvas.toDataURL("image/jpeg", q);
  while (out.length > 1_350_000 && q > 0.35) {
    q -= 0.12;
    out = canvas.toDataURL("image/jpeg", q);
  }
  return out;
}
