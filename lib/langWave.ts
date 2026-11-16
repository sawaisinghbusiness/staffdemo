"use client";

/**
 * Language switch (EN ⇄ हि): the new words don't just pop in. Every piece of text on screen re-forms from a
 * light blur, a few px low, in a wave that runs from the top of the screen to the bottom (about 0.5 s in all),
 * so the switch is felt as "the screen re-wrote itself". Only text inside the visible screen moves; nothing
 * changes size or place. Off when the phone asks for reduced motion.
 */
const TEXT = "h1,h2,h3,h4,p,strong,b,span,a,button,label,li,time,small,dt,dd,td,th";
const WAVE_MS = 220; // top of the screen starts at 0, bottom at this
const RUN_MS = 340;

const ownText = (el: Element) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent!.trim() !== "");

export function langWave(root: ParentNode = document.body) {
  if (typeof window === "undefined" || !("animate" in Element.prototype)) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const vh = window.innerHeight;
  const chosen: Element[] = [];
  root.querySelectorAll(TEXT).forEach((el) => {
    if (!ownText(el) || el.closest("[data-no-lang-wave]")) return;
    if (chosen.some((p) => p.contains(el))) return; // the parent already moves it
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > vh) return;
    chosen.push(el);
    const inline = getComputedStyle(el).display === "inline";
    (el as HTMLElement).animate(
      [
        { opacity: 0, filter: "blur(4px)", transform: inline ? "none" : "translateY(5px)" },
        { opacity: 1, filter: "blur(0)", transform: "none" },
      ],
      { duration: RUN_MS, delay: (Math.max(0, r.top) / vh) * WAVE_MS, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }
    );
  });
}
