/**
 * Our own flat drawings: Barmer school life, one style, brand violet plus a few warm tones.
 * Kept as plain SVG text so the same drawing can be shown and also saved as a file (event albums).
 */

const SKIN = "#D9966B";
const SKIN2 = "#C98258";
const HAIR = "#2A2033";
const MARI = "#F5A524";
const V600 = "#6C4FE0";
const V700 = "#5A3CC9";
const V100 = "#E7E1FD";

export const ART = {
  child: `<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg"><circle cx="82" cy="66" r="48" fill="${V100}"/>
<rect x="88" y="56" width="27" height="35" rx="8" fill="${V600}"/><rect x="92" y="72" width="19" height="10" rx="3" fill="${V700}"/>
<rect x="68" y="92" width="8" height="18" rx="3" fill="${SKIN}"/><rect x="82" y="92" width="8" height="18" rx="3" fill="${SKIN}"/>
<rect x="64" y="107" width="14" height="6" rx="3" fill="${HAIR}"/><rect x="80" y="107" width="14" height="6" rx="3" fill="${HAIR}"/>
<path d="M61 84h36l4 13H57z" fill="#2E3A63"/><rect x="61" y="56" width="36" height="32" rx="10" fill="#fff"/>
<path d="M91 59 95 85" stroke="${V700}" stroke-width="4" stroke-linecap="round"/>
<rect x="53" y="60" width="9" height="25" rx="4.5" fill="${SKIN}"/><rect x="74" y="51" width="9" height="8" fill="${SKIN2}"/>
<circle cx="79" cy="42" r="14" fill="${SKIN}"/>
<path d="M65 41a14 14 0 0 1 28 0c-4-6-9-8-14-8s-10 2-14 8z" fill="${HAIR}"/>
<circle cx="64" cy="47" r="4" fill="${HAIR}"/><circle cx="94" cy="47" r="4" fill="${HAIR}"/>
<circle cx="64" cy="53" r="3" fill="${MARI}"/><circle cx="94" cy="53" r="3" fill="${MARI}"/>
<circle cx="74" cy="43" r="1.5" fill="${HAIR}"/><circle cx="84" cy="43" r="1.5" fill="${HAIR}"/>
<path d="M75 49q4 3 8 0" stroke="${HAIR}" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`,

  teacher: `<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg"><circle cx="76" cy="66" r="48" fill="${V100}"/>
<path d="M53 120 59 70q17-9 34 0l6 50z" fill="${MARI}"/><path d="M59 70q17-9 34 0l-5 14q-16-7-31 3z" fill="#DD8A0E"/>
<rect x="70" y="52" width="12" height="11" fill="${SKIN2}"/><circle cx="76" cy="42" r="14" fill="${SKIN}"/>
<path d="M62 42a14 14 0 0 1 28 0c-3-6-8-9-14-9s-11 3-14 9z" fill="${HAIR}"/><circle cx="89" cy="31" r="6.5" fill="${HAIR}"/>
<circle cx="76" cy="36.5" r="1.4" fill="#DC2626"/><circle cx="71" cy="43" r="1.5" fill="${HAIR}"/><circle cx="81" cy="43" r="1.5" fill="${HAIR}"/>
<path d="M72 49q4 2.6 8 0" stroke="${HAIR}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
<g transform="rotate(-8 76 92)"><rect x="54" y="78" width="44" height="30" rx="3" fill="${V600}"/><rect x="58" y="82" width="36" height="22" rx="1.5" fill="#fff"/>
<path d="M62 87h22M62 92h22M62 97h14" stroke="#CFC6F8" stroke-width="2" stroke-linecap="round"/><path d="m82 96 3 3 6-7" stroke="#16A34A" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
<circle cx="56" cy="98" r="5" fill="${SKIN}"/><circle cx="97" cy="90" r="5" fill="${SKIN}"/></svg>`,

  bus: `<svg viewBox="0 0 170 110" xmlns="http://www.w3.org/2000/svg"><ellipse cx="85" cy="96" rx="72" ry="6" fill="#E3DDF6"/>
<rect x="14" y="24" width="140" height="58" rx="11" fill="${MARI}"/><rect x="14" y="62" width="140" height="6" fill="${HAIR}"/>
<rect x="24" y="33" width="22" height="20" rx="3" fill="#CFE3F7"/><rect x="52" y="33" width="22" height="20" rx="3" fill="#CFE3F7"/><rect x="80" y="33" width="22" height="20" rx="3" fill="#CFE3F7"/>
<rect x="110" y="33" width="18" height="40" rx="3" fill="#E08E12"/><rect x="113" y="36" width="12" height="16" rx="2" fill="#CFE3F7"/>
<rect x="134" y="33" width="14" height="20" rx="3" fill="#CFE3F7"/><rect x="148" y="70" width="8" height="6" rx="2" fill="#fff"/>
<text x="30" y="78" font-family="Figtree,sans-serif" font-size="8" font-weight="800" fill="${HAIR}" letter-spacing="1">SCHOOL BUS</text>
<circle cx="44" cy="84" r="11" fill="${HAIR}"/><circle cx="44" cy="84" r="4.5" fill="#8E8AA3"/><circle cx="126" cy="84" r="11" fill="${HAIR}"/><circle cx="126" cy="84" r="4.5" fill="#8E8AA3"/>
<circle cx="35" cy="45" r="5" fill="${SKIN}"/><path d="M30 44a5 5 0 0 1 10 0z" fill="${HAIR}"/><circle cx="63" cy="45" r="5" fill="${SKIN}"/><path d="M58 44a5 5 0 0 1 10 0z" fill="${HAIR}"/></svg>`,

  notebook: `<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg"><circle cx="78" cy="64" r="48" fill="${V100}"/>
<path d="M30 40q22-8 44 2v58q-22-9-44-2z" fill="#fff"/><path d="M118 40q-22-8-44 2v58q22-9 44-2z" fill="#fff"/>
<path d="M74 42v58" stroke="#CFC6F8" stroke-width="2"/>
<path d="M38 52q15-4 28 1M38 62q15-4 28 1M38 72q15-4 28 1M38 82q15-4 28 1" stroke="#CFC6F8" stroke-width="2" fill="none"/>
<path d="M82 53q13-5 28-1M82 63q13-5 28-1M82 73q8-3 16-2" stroke="${V600}" stroke-width="2" fill="none" stroke-linecap="round"/>
<g transform="rotate(38 104 74)"><rect x="98" y="40" width="10" height="52" rx="2" fill="${MARI}"/><rect x="98" y="40" width="10" height="7" fill="#E97A8A"/><path d="m98 92 5 10 5-10z" fill="#F2D3B5"/><path d="m101.5 99 1.5 3 1.5-3z" fill="${HAIR}"/></g></svg>`,

  paper: `<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg"><circle cx="72" cy="64" r="48" fill="${V100}"/>
<rect x="38" y="20" width="62" height="84" rx="5" fill="#fff"/><rect x="38" y="20" width="62" height="14" rx="5" fill="${V600}"/><rect x="38" y="29" width="62" height="5" fill="${V600}"/>
<path d="M47 46h34M47 58h40M47 70h30M47 82h36" stroke="#E3DEF2" stroke-width="3" stroke-linecap="round"/>
<path d="m86 43 3 3 5-6M90 55l3 3 5-6M80 67l3 3 5-6" stroke="#16A34A" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="92" cy="92" r="12" fill="none" stroke="#DC2626" stroke-width="2.4"/><text x="92" y="97" text-anchor="middle" font-family="Figtree,sans-serif" font-weight="800" font-size="13" fill="#DC2626">A</text>
<g transform="rotate(-30 112 60)"><rect x="107" y="30" width="9" height="46" rx="2" fill="${MARI}"/><path d="m107 76 4.5 9 4.5-9z" fill="#F2D3B5"/></g></svg>`,

  calflag: `<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg"><circle cx="72" cy="64" r="48" fill="${V100}"/>
<rect x="34" y="30" width="72" height="70" rx="8" fill="#fff"/><rect x="34" y="30" width="72" height="18" rx="8" fill="${V600}"/><rect x="34" y="40" width="72" height="8" fill="${V600}"/>
<rect x="48" y="24" width="5" height="13" rx="2.5" fill="${HAIR}"/><rect x="87" y="24" width="5" height="13" rx="2.5" fill="${HAIR}"/>
<g fill="#EAE6F5"><rect x="42" y="56" width="10" height="9" rx="2"/><rect x="56" y="56" width="10" height="9" rx="2"/><rect x="70" y="56" width="10" height="9" rx="2"/><rect x="84" y="56" width="10" height="9" rx="2"/>
<rect x="42" y="70" width="10" height="9" rx="2"/><rect x="70" y="70" width="10" height="9" rx="2"/><rect x="84" y="70" width="10" height="9" rx="2"/><rect x="42" y="84" width="10" height="9" rx="2"/><rect x="56" y="84" width="10" height="9" rx="2"/></g>
<rect x="56" y="70" width="10" height="9" rx="2" fill="${MARI}"/>
<path d="M104 44v50" stroke="${HAIR}" stroke-width="2.5" stroke-linecap="round"/><path d="M104 46h22l-6 7 6 7h-22z" fill="#16A34A"/></svg>`,
} as const;

export type ArtName = keyof typeof ART;

const range = (n: number) => Array.from({ length: n }, (_, k) => k);

/** Event pictures for the demo; a real school's events carry their own photos instead. */
export const SCENES: Record<string, string> = {
  sports: `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="110" fill="#CFE8C6"/><ellipse cx="80" cy="96" rx="96" ry="40" fill="none" stroke="#fff" stroke-width="3"/><ellipse cx="80" cy="96" rx="78" ry="28" fill="none" stroke="#fff" stroke-width="3"/>
<path d="M0 14q40 10 80 0t80 0" stroke="#5B5670" stroke-width="1" fill="none"/><path d="m10 16 5 9 5-8z" fill="${V600}"/><path d="m30 19 5 9 5-9z" fill="${MARI}"/><path d="m50 18 5 9 5-9z" fill="#DC2626"/><path d="m70 15 5 9 5-9z" fill="#16A34A"/><path d="m90 14 5 9 5-8z" fill="${V600}"/><path d="m110 17 5 9 5-9z" fill="${MARI}"/><path d="m130 18 5 9 5-9z" fill="#DC2626"/>
<circle cx="62" cy="58" r="6" fill="${SKIN}"/><rect x="56" y="64" width="12" height="16" rx="5" fill="#fff"/><path d="M58 80l-4 12M66 80l5 11" stroke="${SKIN}" stroke-width="4" stroke-linecap="round"/>
<circle cx="98" cy="54" r="6" fill="${SKIN2}"/><rect x="92" y="60" width="12" height="16" rx="5" fill="#fff"/><path d="M94 76l-6 11M102 76l3 12" stroke="${SKIN2}" stroke-width="4" stroke-linecap="round"/></svg>`,

  mela: `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="110" fill="#FDEBCB"/><path d="M0 30h160" stroke="#5B5670"/>
${range(8).map((k) => `<circle cx="${10 + k * 20}" cy="${36 + (k % 2) * 4}" r="5" fill="${["#DC2626", MARI, V600][k % 3]}"/>`).join("")}
<path d="M14 62h56l-6-12H20z" fill="#DC2626"/><path d="M14 62h56" stroke="#fff" stroke-width="2" stroke-dasharray="7 7"/><rect x="20" y="62" width="44" height="34" fill="#fff"/><rect x="26" y="70" width="32" height="6" rx="2" fill="${MARI}"/>
<path d="M88 62h56l-6-12H94z" fill="${V600}"/><path d="M88 62h56" stroke="#fff" stroke-width="2" stroke-dasharray="7 7"/><rect x="94" y="62" width="44" height="34" fill="#fff"/><circle cx="108" cy="76" r="5" fill="#E97A8A"/><circle cx="122" cy="76" r="5" fill="${MARI}"/>
<rect y="96" width="160" height="14" fill="#E9C99A"/></svg>`,

  flag: `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="110" fill="#E4EEFA"/><rect y="90" width="160" height="20" fill="#CFE8C6"/>
<path d="M56 16v78" stroke="#5B5670" stroke-width="3" stroke-linecap="round"/><rect x="57" y="18" width="54" height="12" fill="#F39233"/><rect x="57" y="30" width="54" height="12" fill="#fff"/><rect x="57" y="42" width="54" height="12" fill="#2F8F46"/>
<circle cx="84" cy="36" r="4.5" fill="none" stroke="#1E3A8A" stroke-width="1.4"/><circle cx="84" cy="36" r="1" fill="#1E3A8A"/>
${range(6).map((k) => `<circle cx="${20 + k * 24}" cy="84" r="5" fill="${k % 2 ? SKIN2 : SKIN}"/><rect x="${15 + k * 24}" y="89" width="10" height="12" rx="4" fill="#fff"/>`).join("")}</svg>`,

  teach: `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="110" fill="#EDE8FE"/><rect x="30" y="18" width="100" height="60" rx="4" fill="#2F4A3A"/><rect x="26" y="78" width="108" height="5" rx="2" fill="#B98A5B"/>
<text x="80" y="47" text-anchor="middle" font-family="Figtree,sans-serif" font-size="13" font-weight="700" fill="#F1F5EE">Thank you</text><text x="80" y="64" text-anchor="middle" font-family="Figtree,sans-serif" font-size="9" fill="#C9D9CC">5 September</text>
<circle cx="40" cy="96" r="7" fill="${MARI}"/><circle cx="52" cy="98" r="6" fill="#E97A8A"/><circle cx="118" cy="97" r="7" fill="#DC2626"/><path d="M118 90q2-5 6-6" stroke="#2F8F46" stroke-width="2" fill="none"/></svg>`,

  stage: `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="110" fill="${HAIR}"/><path d="M48 0h64l20 110H28z" fill="#3A2F4F"/><path d="M0 0h52q-6 40 4 110H0z" fill="#B23A48"/><path d="M160 0h-52q6 40-4 110h56z" fill="#B23A48"/>
<path d="M0 0h160v12H0z" fill="#8F2B39"/><ellipse cx="80" cy="96" rx="34" ry="8" fill="#F5D58A" opacity=".55"/>
<circle cx="70" cy="70" r="5" fill="${SKIN}"/><path d="M64 76h12l3 18H61z" fill="${MARI}"/><circle cx="90" cy="70" r="5" fill="${SKIN2}"/><path d="M84 76h12l3 18H81z" fill="${V600}"/></svg>`,

  diya: `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="110" fill="${HAIR}"/>${range(4)
    .map((k) => `<g transform="translate(${18 + k * 36} 0)"><path d="M0 78q14 14 28 0z" fill="#C2410C"/><path d="M0 78h28" stroke="${MARI}" stroke-width="2"/><path d="M14 74q-6-8 0-18q6 10 0 18z" fill="${MARI}"/><path d="M14 72q-3-4 0-9q3 5 0 9z" fill="#FDE68A"/></g>`)
    .join("")}
${range(7).map((k) => `<circle cx="${12 + k * 23}" cy="${20 + (k % 3) * 8}" r="1.4" fill="#F5D58A"/>`).join("")}</svg>`,

  march: `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="110" fill="#D7EBCF"/>${range(3)
    .map((r) =>
      range(6)
        .map((k) => `<circle cx="${18 + k * 25 + r * 4}" cy="${34 + r * 24}" r="5" fill="${(k + r) % 2 ? SKIN2 : SKIN}"/><rect x="${13 + k * 25 + r * 4}" y="${39 + r * 24}" width="10" height="13" rx="4" fill="#fff"/>`)
        .join("")
    )
    .join("")}</svg>`,
};

/** One of our drawings, sized by its box. Decorative: screen readers skip it. */
export function Art({ name, className }: { name: ArtName; className?: string }) {
  return <span aria-hidden className={`art block [&>svg]:h-full [&>svg]:w-full ${className || ""}`} dangerouslySetInnerHTML={{ __html: ART[name] }} />;
}

/** An event picture: the school's photo when there is one, else one of our scenes. */
export function EventPicture({ url, scene, alt, className }: { url?: string | null; scene?: string | null; alt: string; className?: string }) {
  if (url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className={`block aspect-[16/11] w-full object-cover ${className || ""}`} loading="lazy" />;
  return (
    <span
      role="img"
      aria-label={alt}
      className={`block aspect-[16/11] w-full overflow-hidden bg-ink-100 [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: (scene && SCENES[scene]) || "" }}
    />
  );
}
