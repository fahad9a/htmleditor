import type { TransitionCfg } from "./types";

// Injected into the document for presentation/preview mode. Detects slides
// (same heuristics as the editor runtime), shows one at a time and applies
// the configured PowerPoint-style transition between them.
const PRESENT_SOURCE = String.raw`
(function () {
  var CFG = __VHE_CFG__;

  function findSlides() {
    var els = [].slice.call(document.querySelectorAll("[data-vhe-slide]"));
    if (!els.length) els = [].slice.call(document.querySelectorAll("body > section"));
    if (!els.length) {
      els = [].slice.call(document.querySelectorAll("*")).filter(function (el) {
        var c = typeof el.className === "string" ? el.className : "";
        return /(^|[\s_-])slide/i.test(c) && !el.closest('[class*="slide"] [class*="slide"]');
      });
    }
    return els;
  }

  var slides = findSlides();
  if (slides.length < 2) return; // plain report: leave as a scrollable page

  var style = document.createElement("style");
  style.textContent =
    "@keyframes vheFade{from{opacity:0}to{opacity:1}}" +
    "@keyframes vheSlideL{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}}" +
    "@keyframes vheSlideR{from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:none}}" +
    "@keyframes vheZoom{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}" +
    ".vhe-nav{position:fixed;bottom:16px;right:16px;z-index:99999;display:flex;gap:8px;font-family:sans-serif}" +
    ".vhe-nav button{border:none;border-radius:8px;padding:10px 16px;background:rgba(17,24,39,.85);color:#fff;cursor:pointer;font-size:14px}" +
    ".vhe-count{position:fixed;bottom:22px;left:16px;z-index:99999;color:rgba(17,24,39,.6);font:13px sans-serif;background:rgba(255,255,255,.7);padding:4px 10px;border-radius:8px}";
  document.head.appendChild(style);

  var current = 0;
  var ANIM = { fade: "vheFade", "slide-left": "vheSlideL", "slide-right": "vheSlideR", zoom: "vheZoom" };

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
    count.textContent = current + 1 + " / " + slides.length;
    window.scrollTo(0, 0);
  }

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

  prev.addEventListener("click", function () { show(current - 1, true); });
  next.addEventListener("click", function () { show(current + 1, true); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") show(current + 1, true);
    if (e.key === "ArrowLeft" || e.key === "PageUp") show(current - 1, true);
  });

  show(0, false);
})();
`;

export function injectPresentRuntime(html: string, cfg: TransitionCfg): string {
  const script =
    '<script id="__vhe_present">' +
    PRESENT_SOURCE.replace("__VHE_CFG__", JSON.stringify(cfg)) +
    "</" +
    "script>";
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, script + "</body>");
  return html + script;
}
