import type { TransitionCfg } from "./types";
import { insertBeforeBodyClose, PRELUDE } from "./editorRuntime";

// Presentation/preview runtime: replays the saved edit patches onto the
// original document, then (for multi-slide decks) shows one slide at a time
// with the configured PowerPoint-style transition.
const PRESENT_SOURCE = String.raw`
(function () {
  var CFG = __VHE_CFG__;
  var PATCHES = __VHE_PATCHES__;

  ${"__PRELUDE__"}

  // IDs + patch replay run synchronously at parse time — before the report's
  // own scripts generate content — so IDs match the editor's numbering.
  ensureIds();
  for (var pi = 0; pi < PATCHES.length; pi++) {
    try { applyOp(PATCHES[pi]); } catch (e) {}
  }
  var hiddenEls = document.querySelectorAll("[data-vhe-hidden]");
  for (var hi = 0; hi < hiddenEls.length; hi++) hiddenEls[hi].style.display = "none";

  function boot() {
    var slides = findSlides();
    if (slides.length < 2) return; // plain report: scrollable page

    var style = document.createElement("style");
    style.id = "__vhe_style";
    style.textContent =
      "@keyframes vheFade{from{opacity:0}to{opacity:1}}" +
      "@keyframes vheSlideL{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}}" +
      "@keyframes vheSlideR{from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:none}}" +
      "@keyframes vheZoom{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}" +
      ".vhe-nav{position:fixed;bottom:16px;right:16px;z-index:99999;display:flex;gap:8px;font-family:sans-serif}" +
      ".vhe-nav button{border:none;border-radius:10px;padding:10px 18px;background:rgba(15,23,42,.85);color:#fff;cursor:pointer;font-size:14px}" +
      ".vhe-nav button:hover{background:rgba(15,23,42,1)}" +
      ".vhe-count{position:fixed;bottom:22px;left:16px;z-index:99999;color:rgba(15,23,42,.65);font:13px sans-serif;background:rgba(255,255,255,.75);padding:4px 12px;border-radius:10px}";
    document.head.appendChild(style);

    var current = 0;
    var ANIM = { fade: "vheFade", "slide-left": "vheSlideL", "slide-right": "vheSlideR", zoom: "vheZoom" };

    var nav = document.createElement("div");
    nav.className = "vhe-nav";
    var prev = document.createElement("button");
    prev.textContent = "← Prev";
    var next = document.createElement("button");
    next.textContent = "Next →";
    nav.appendChild(prev);
    nav.appendChild(next);
    document.body.appendChild(nav);
    var count = document.createElement("div");
    count.className = "vhe-count";
    document.body.appendChild(count);

    function show(i, animate) {
      current = Math.max(0, Math.min(slides.length - 1, i));
      slides.forEach(function (el, j) {
        el.style.display = j === current ? "" : "none";
        el.style.animation = "";
      });
      var el = slides[current];
      if (animate && CFG.type !== "none" && ANIM[CFG.type]) {
        el.style.animation =
          ANIM[CFG.type] + " " + (CFG.duration || 0.5) + "s ease " + (CFG.delay || 0) + "s both";
      }
      count.textContent = (current + 1) + " / " + slides.length;
      window.scrollTo(0, 0);
    }

    prev.addEventListener("click", function () { show(current - 1, true); });
    next.addEventListener("click", function () { show(current + 1, true); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") show(current + 1, true);
      if (e.key === "ArrowLeft" || e.key === "PageUp") show(current - 1, true);
    });

    show(0, false);
  }

  // Run after the report's own scripts have generated their content.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); });
  } else {
    setTimeout(boot, 0);
  }
})();
`;

export function injectPresentRuntime(
  html: string,
  cfg: TransitionCfg,
  patches: unknown[] = []
): string {
  const source = PRESENT_SOURCE.replace("__PRELUDE__", () => PRELUDE)
    .replace("__VHE_CFG__", () => JSON.stringify(cfg))
    .replace("__VHE_PATCHES__", () => JSON.stringify(patches).replace(/<\//g, "<\\/"));
  const script = '<script id="__vhe_present">' + source + "</" + "script>";
  return insertBeforeBodyClose(html, script);
}
