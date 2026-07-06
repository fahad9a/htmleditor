// The "editor runtime" is a vanilla-JS script injected into the uploaded HTML
// before it is rendered inside a sandboxed iframe. It turns the document into
// a click-to-edit surface and talks to the editor shell via postMessage.
//
// Security model: the iframe is sandboxed with allow-scripts only (opaque
// origin), so the uploaded document cannot touch our app's origin, cookies or
// Supabase session. Every message is tagged with a per-mount random token that
// both sides verify.

const RUNTIME_SOURCE = String.raw`
(function () {
  var TOKEN = "__VHE_TOKEN__";
  var selectedId = null;

  function post(msg) {
    msg.token = TOKEN;
    parent.postMessage(msg, "*");
  }

  // ---------- id assignment ----------
  function assignIds() {
    var n = 0;
    document.body.setAttribute("data-vhe-id", "vhe-body");
    var all = document.body.getElementsByTagName("*");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.id === "__vhe_style") continue;
      el.setAttribute("data-vhe-id", "vhe-" + n++);
    }
  }

  function byId(id) {
    if (id === "vhe-body") return document.body;
    return document.querySelector('[data-vhe-id="' + id + '"]');
  }

  // ---------- editor chrome styles ----------
  function injectStyle() {
    var s = document.createElement("style");
    s.id = "__vhe_style";
    s.textContent =
      "[data-vhe-id]:hover{outline:1px dashed rgba(59,130,246,.6)!important;outline-offset:-1px;}" +
      ".__vhe-sel{outline:2px solid #3b82f6!important;outline-offset:-2px;}" +
      ".__vhe-remote{outline:2px solid var(--vhe-rc,#f59e0b)!important;outline-offset:-2px;}" +
      "[data-vhe-hidden]{display:revert!important;opacity:.3!important;outline:1px dashed #ef4444!important;}" +
      "body{cursor:default;}";
    document.head.appendChild(s);
  }

  // ---------- slide detection ----------
  // Heuristics, in priority order:
  //  1. elements explicitly marked with data-vhe-slide
  //  2. <section> elements that are direct children of body
  //  3. elements whose class name contains "slide"
  // Reports without slide structure fall back to a single "Document" entry.
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

  function slideName(el, i) {
    if (el.getAttribute("data-vhe-name")) return el.getAttribute("data-vhe-name");
    var h = el.querySelector("h1,h2,h3,h4");
    var t = h ? (h.textContent || "").trim() : "";
    return t ? t.slice(0, 40) : "Slide " + (i + 1);
  }

  function sendSlides() {
    var slides = findSlides();
    if (!slides.length) {
      post({ t: "slides", slides: [{ id: "vhe-body", name: "Document" }] });
      return;
    }
    post({
      t: "slides",
      slides: slides.map(function (el, i) {
        return { id: el.getAttribute("data-vhe-id"), name: slideName(el, i) };
      }),
    });
  }

  // ---------- selection ----------
  function describe(el) {
    var cs = getComputedStyle(el);
    var hasChildEls = el.children.length > 0;
    return {
      id: el.getAttribute("data-vhe-id"),
      tag: el.tagName.toLowerCase(),
      text: hasChildEls ? "" : el.textContent || "",
      canText: !hasChildEls,
      hidden: el.hasAttribute("data-vhe-hidden"),
      styles: {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        fontFamily: cs.fontFamily,
        textAlign: cs.textAlign,
        padding: cs.paddingTop,
        margin: cs.marginTop,
        borderRadius: cs.borderRadius,
        borderWidth: cs.borderTopWidth,
        borderColor: cs.borderTopColor,
      },
      attrs: {
        src: el.getAttribute("src") || "",
        href: el.getAttribute("href") || "",
        alt: el.getAttribute("alt") || "",
      },
    };
  }

  function select(el) {
    var prev = document.querySelector(".__vhe-sel");
    if (prev) prev.classList.remove("__vhe-sel");
    if (!el) {
      selectedId = null;
      post({ t: "selected", el: null });
      return;
    }
    el.classList.add("__vhe-sel");
    selectedId = el.getAttribute("data-vhe-id");
    post({ t: "selected", el: describe(el) });
  }

  function refreshSelected() {
    var el = selectedId ? byId(selectedId) : null;
    if (el) post({ t: "selected", el: describe(el) });
  }

  function changed(structural) {
    post({ t: "changed" });
    if (structural) sendSlides();
  }

  // ---------- event wiring ----------
  document.addEventListener(
    "click",
    function (e) {
      var t = e.target;
      if (t && t.isContentEditable) return; // allow clicks while inline-editing
      e.preventDefault();
      e.stopPropagation();
      var el = t && t.closest ? t.closest("[data-vhe-id]") : null;
      select(el);
    },
    true
  );

  document.addEventListener(
    "dblclick",
    function (e) {
      var el = e.target && e.target.closest ? e.target.closest("[data-vhe-id]") : null;
      if (!el || el.children.length > 0) return;
      e.preventDefault();
      el.setAttribute("contenteditable", "true");
      el.focus();
      var done = function () {
        el.removeAttribute("contenteditable");
        el.removeEventListener("blur", done);
        refreshSelected();
        changed(false);
      };
      el.addEventListener("blur", done);
    },
    true
  );

  document.addEventListener("submit", function (e) { e.preventDefault(); }, true);

  var scrollTimer = null;
  window.addEventListener("scroll", function () {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      post({ t: "scroll", y: window.scrollY });
    }, 200);
  });

  // ---------- serialization ----------
  function serialize() {
    var clone = document.documentElement.cloneNode(true);
    var kill = clone.querySelectorAll("#__vhe_style, #__vhe_runtime");
    for (var i = 0; i < kill.length; i++) kill[i].parentNode.removeChild(kill[i]);
    var els = clone.querySelectorAll("[data-vhe-id]");
    for (var j = 0; j < els.length; j++) {
      var el = els[j];
      el.removeAttribute("data-vhe-id");
      el.removeAttribute("contenteditable");
      el.classList.remove("__vhe-sel");
      el.classList.remove("__vhe-remote");
      if (!el.getAttribute("class")) el.removeAttribute("class");
      // Hidden elements are faded in the editor but truly hidden on export.
      if (el.hasAttribute("data-vhe-hidden")) el.style.display = "none";
    }
    return "<!DOCTYPE html>\n" + clone.outerHTML;
  }

  // ---------- slide operations ----------
  function slideOp(op, id, name) {
    var el = id ? byId(id) : null;
    if (op === "mark" && el) {
      if (el.hasAttribute("data-vhe-slide")) el.removeAttribute("data-vhe-slide");
      else el.setAttribute("data-vhe-slide", "1");
    } else if (op === "rename" && el) {
      el.setAttribute("data-vhe-name", name || "");
    } else if (op === "del" && el && el !== document.body) {
      el.parentNode.removeChild(el);
      select(null);
    } else if (op === "dup" && el && el !== document.body) {
      var copy = el.cloneNode(true);
      copy.classList.remove("__vhe-sel");
      el.parentNode.insertBefore(copy, el.nextSibling);
      assignIds();
    } else if ((op === "up" || op === "down") && el && el !== document.body) {
      var slides = findSlides();
      var idx = slides.indexOf(el);
      if (op === "up" && idx > 0) {
        slides[idx - 1].parentNode.insertBefore(el, slides[idx - 1]);
      } else if (op === "down" && idx > -1 && idx < slides.length - 1) {
        var after = slides[idx + 1];
        after.parentNode.insertBefore(el, after.nextSibling);
      }
    } else if (op === "add") {
      var slidesNow = findSlides();
      var fresh;
      if (slidesNow.length && slidesNow[0] !== document.body) {
        // Clone the last slide's shell to inherit the deck's styling.
        fresh = slidesNow[slidesNow.length - 1].cloneNode(false);
        fresh.innerHTML = "<h2>New slide</h2><p>Double-click any text to edit it.</p>";
        var last = slidesNow[slidesNow.length - 1];
        last.parentNode.insertBefore(fresh, last.nextSibling);
      } else {
        fresh = document.createElement("section");
        fresh.setAttribute("data-vhe-slide", "1");
        fresh.style.padding = "48px";
        fresh.innerHTML = "<h2>New section</h2><p>Double-click any text to edit it.</p>";
        document.body.appendChild(fresh);
      }
      assignIds();
    }
    changed(true);
  }

  // ---------- inbound messages ----------
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.token !== TOKEN) return;
    var el;
    if (m.t === "style") {
      el = byId(m.id);
      if (el) {
        el.style[m.prop] = m.value;
        refreshSelected();
        changed(false);
      }
    } else if (m.t === "text") {
      el = byId(m.id);
      if (el && el.children.length === 0) {
        el.textContent = m.value;
        changed(false);
      }
    } else if (m.t === "attr") {
      el = byId(m.id);
      if (el) {
        if (m.value) el.setAttribute(m.name, m.value);
        else el.removeAttribute(m.name);
        changed(false);
      }
    } else if (m.t === "hide") {
      el = byId(m.id);
      if (el) {
        if (el.hasAttribute("data-vhe-hidden")) {
          el.removeAttribute("data-vhe-hidden");
          el.style.display = "";
        } else {
          el.setAttribute("data-vhe-hidden", "1");
        }
        refreshSelected();
        changed(false);
      }
    } else if (m.t === "remove") {
      el = byId(m.id);
      if (el && el !== document.body) {
        el.parentNode.removeChild(el);
        select(null);
        changed(true);
      }
    } else if (m.t === "slide") {
      slideOp(m.op, m.id, m.name);
    } else if (m.t === "focusSlide") {
      el = byId(m.id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (m.t === "getHtml") {
      post({ t: "html", html: serialize(), reqId: m.reqId });
    } else if (m.t === "remoteSel") {
      var olds = document.querySelectorAll(".__vhe-remote");
      for (var i = 0; i < olds.length; i++) olds[i].classList.remove("__vhe-remote");
      (m.sels || []).forEach(function (s) {
        var rel = byId(s.id);
        if (rel) {
          rel.classList.add("__vhe-remote");
          rel.style.setProperty("--vhe-rc", s.color);
        }
      });
    } else if (m.t === "scrollTo") {
      window.scrollTo(0, m.y || 0);
    }
  });

  // ---------- boot ----------
  function boot() {
    injectStyle();
    assignIds();
    sendSlides();
    post({ t: "ready" });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
`;

/**
 * Insert a script tag right before the closing </body> of a document.
 *
 * Important: we use the LAST occurrence, not the first — documents that embed
 * JS libraries (e.g. SheetJS) can contain the literal string "</body>" inside
 * their script code, and injecting there would corrupt both scripts. String
 * slicing (not String.replace) also avoids "$"-pattern substitution quirks.
 */
export function insertBeforeBodyClose(html: string, script: string): string {
  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx === -1) return html + script;
  return html.slice(0, idx) + script + html.slice(idx);
}

/**
 * Inject the editor runtime into an uploaded HTML document.
 * The original markup is left untouched — we only add a script tag.
 */
export function injectEditorRuntime(html: string, token: string): string {
  const script =
    '<script id="__vhe_runtime">' +
    RUNTIME_SOURCE.replace("__VHE_TOKEN__", token) +
    "</" +
    "script>";
  return insertBeforeBodyClose(html, script);
}

export function makeToken(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
