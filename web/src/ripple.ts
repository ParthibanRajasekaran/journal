// A soft ripple from the point of each press on anything interactive.
// The ripple is decorative: it is hidden from assistive technology and skipped for reduced motion.
const TARGETS = "button, a, .meal-item, .day-tile, input[type='checkbox']";

export function installRipple(root: HTMLElement = document.body): () => void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return () => undefined;

  const onPointerDown = (event: PointerEvent) => {
    const target = (event.target as Element | null)?.closest<HTMLElement>(TARGETS);
    if (!target || target.hasAttribute("disabled") || target.getAttribute("aria-disabled") === "true") return;
    if (getComputedStyle(target).position === "static") target.style.position = "relative";
    target.style.overflow = "hidden";

    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const dot = document.createElement("span");
    dot.className = "ripple";
    dot.setAttribute("aria-hidden", "true");
    dot.style.width = dot.style.height = `${size}px`;
    dot.style.left = `${event.clientX - rect.left - size / 2}px`;
    dot.style.top = `${event.clientY - rect.top - size / 2}px`;
    target.appendChild(dot);
    dot.addEventListener("animationend", () => dot.remove());
  };

  root.addEventListener("pointerdown", onPointerDown);
  return () => root.removeEventListener("pointerdown", onPointerDown);
}
