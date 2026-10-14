/** Small touch effects, the same as the parent app. Each does nothing for "Reduce motion". */

const still = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Ink spreading from where the finger landed. Use as onPointerDown on an element that is
 * `relative overflow-hidden`; the drop removes itself when done.
 */
export function ripple(e: React.PointerEvent<HTMLElement>) {
  if (still()) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const d = Math.max(r.width, r.height) * 2.2;
  const drop = document.createElement("span");
  drop.className = "ripple-ink";
  drop.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  el.appendChild(drop);
  drop.addEventListener("animationend", () => drop.remove());
}
