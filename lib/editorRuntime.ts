// ============================================================================
// Editor runtime v2 — patch/overlay architecture.
//
// The uploaded HTML is IMMUTABLE. Every edit is a small operation ("op") with
// a computed inverse (for undo). Ops are replayed on load, broadcast live to
// collaborators, and persisted as a compact JSON list — the original document
// is never rewritten, so embedded report scripts (charts, tables) keep
// working exactly as authored.
//
// The runtime script is injected before the LAST </body> and boots
// SYNCHRONOUSLY at parse time. That means element IDs are assigned to the
// authored/static DOM *before* the report's own DOMContentLoaded scripts
// generate content — so IDs are deterministic across sessions and clients,
// and script-generated content (which regenerates every load) is deliberately
// not directly editable (clicks select its authored container instead).
//
// Security: the iframe is sandboxed (allow-scripts, opaque origin); all
// postMessage traffic carries a per-mount random token verified on both ends.
// ============================================================================

// ---------- shared prelude: ids + op application (used by editor & preview) ----------
const PRELUDE = String.raw`
  var counter = 0;
  function byId(id) {
    if (id === "vhe-body") return document.body;
    return document.querySelector('[data-vhe-id="' + id + '"]');
  }
  // Assign ids only to elements that don't have one yet (stable, monotonic).
  function ensureIds() {
    if (!document.body.getAttribute("data-vhe-id"))
      document.body.setAttribute("data-vhe-id", "vhe-body");
    var all = document.body.getElementsByTagName("*");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.id === "__vhe_style" || el.id === "__vhe_runtime" || el.id === "__vhe_present") continue;
      if (!el.getAttribute("data-vhe-id")) el.setAttribute("data-vhe-id", "vhe-" + counter++);
    }
  }
  function stripIds(root) {
    root.removeAttribute("data-vhe-id");
    var all = root.getElementsByTagName("*");
    for (var i = 0; i < all.length; i++) all[i].removeAttribute("data-vhe-id");
  }
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
  // Apply one op to the DOM. Returns the inverse op (or null if it no-oped).
  function applyOp(o) {
    var el, inv = null, parent, idx, tmp, node, slides, other;
    if (o.op === "style") {
      el = byId(o.id);
      if (!el) return null;
      inv = { op: "style", id: o.id, prop: o.prop, value: el.style[o.prop] || "" };
      el.style[o.prop] = o.value;
    } else if (o.op === "text") {
      el = byId(o.id);
      if (!el || el.children.length > 0) return null;
      inv = { op: "text", id: o.id, value: el.textContent || "" };
      el.textContent = o.value;
    } else if (o.op === "attr") {
      el = byId(o.id);
      if (!el) return null;
      inv = { op: "attr", id: o.id, name: o.name, value: el.getAttribute(o.name) || "" };
      if (o.value) el.setAttribute(o.name, o.value);
      else el.removeAttribute(o.name);
    } else if (o.op === "hide") {
      el = byId(o.id);
      if (!el) return null;
      inv = { op: "hide", id: o.id, on: !o.on };
      if (o.on) el.setAttribute("data-vhe-hidden", "1");
      else el.removeAttribute("data-vhe-hidden");
    } else if (o.op === "remove") {
      el = byId(o.id);
      if (!el || el === document.body || !el.parentNode) return null;
      parent = el.parentNode;
      if (parent.nodeType === 1 && !parent.getAttribute("data-vhe-id")) ensureIds();
      idx = Array.prototype.indexOf.call(parent.children, el);
      inv = {
        op: "restore",
        parentId: parent === document.body ? "vhe-body" : parent.getAttribute("data-vhe-id"),
        index: idx,
        html: el.outerHTML
      };
      parent.removeChild(el);
    } else if (o.op === "restore") {
      parent = byId(o.parentId);
      if (!parent) return null;
      tmp = document.createElement("div");
      tmp.innerHTML = o.html;
      node = tmp.firstElementChild;
      if (!node) return null;
      parent.insertBefore(node, parent.children[o.index] || null);
      ensureIds();
      inv = { op: "remove", id: node.getAttribute("data-vhe-id") };
    } else if (o.op === "slide") {
      if (o.sub === "rename") {
        el = byId(o.id);
        if (!el) return null;
        inv = { op: "slide", sub: "rename", id: o.id, name: el.getAttribute("data-vhe-name") || "" };
        if (o.name) el.setAttribute("data-vhe-name", o.name);
        else el.removeAttribute("data-vhe-name");
      } else if (o.sub === "mark") {
        el = byId(o.id);
        if (!el) return null;
        inv = { op: "slide", sub: "mark", id: o.id, on: !o.on };
        if (o.on) el.setAttribute("data-vhe-slide", "1");
        else el.removeAttribute("data-vhe-slide");
      } else if (o.sub === "dup") {
        el = byId(o.id);
        if (!el || el === document.body) return null;
        node = el.cloneNode(true);
        stripIds(node);
        node.removeAttribute("data-vhe-hidden");
        el.parentNode.insertBefore(node, el.nextSibling);
        ensureIds();
        inv = { op: "remove", id: node.getAttribute("data-vhe-id") };
      } else if (o.sub === "add") {
        slides = findSlides();
        if (slides.length && slides[0] !== document.body) {
          node = slides[slides.length - 1].cloneNode(false);
          stripIds(node);
          node.innerHTML = "<h2>New slide</h2><p>Double-click any text to edit it.</p>";
          el = slides[slides.length - 1];
          el.parentNode.insertBefore(node, el.nextSibling);
        } else {
          node = document.createElement("section");
          node.setAttribute("data-vhe-slide", "1");
          node.style.padding = "48px";
          node.innerHTML = "<h2>New section</h2><p>Double-click any text to edit it.</p>";
          document.body.appendChild(node);
        }
        ensureIds();
        inv = { op: "remove", id: node.getAttribute("data-vhe-id") };
      } else if (o.sub === "up" || o.sub === "down") {
        el = byId(o.id);
        if (!el) return null;
        slides = findSlides();
        idx = slides.indexOf(el);
        if (o.sub === "up" && idx > 0) {
          other = slides[idx - 1];
          other.parentNode.insertBefore(el, other);
          inv = { op: "slide", sub: "down", id: o.id };
        } else if (o.sub === "down" && idx > -1 && idx < slides.length - 1) {
          other = slides[idx + 1];
          other.parentNode.insertBefore(el, other.nextSibling);
          inv = { op: "slide", sub: "up", id: o.id };
        } else return null;
      }
    }
    return inv;
  }
  function isStructural(o) {
    return o.op === "remove" || o.op === "restore" || o.op === "slide";
  }
`;

// ---------- editor runtime ----------
const EDITOR_SOURCE = String.raw`
(function () {
  var TOKEN = "__VHE_TOKEN__";
  var selectedId = null;
  var canEdit = true;

  ${"__PRELUDE__"}

  function post(msg) {
    msg.token = TOKEN;
    parent.postMessage(msg, "*");
  }

  function injectStyle() {
    var s = document.createElement("style");
    s.id = "__vhe_style";
    s.textContent =
      "[data-vhe-id]:hover{outline:1px dashed rgba(99,102,241,.65)!important;outline-offset:-1px;}" +
      ".__vhe-sel{outline:2px solid #6366f1!important;outline-offset:-2px;}" +
      ".__vhe-remote{outline:2px solid var(--vhe-rc,#f59e0b)!important;outline-offset:-2px;}" +
      "[data-vhe-hidden]{opacity:.3!important;outline:1px dashed #ef4444!important;}" +
      "[contenteditable=true]{outline:2px solid #10b981!important;outline-offset:-2px;cursor:text;}";
    document.head.appendChild(s);
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
      })
    });
  }

  function describe(el) {
    var cs = getComputedStyle(el);
    var hasChildEls = el.children.length > 0;
    var path = [];
    var p = el;
    while (p && p !== document.documentElement && path.length < 5) {
      if (p.getAttribute("data-vhe-id"))
        path.unshift({ id: p.getAttribute("data-vhe-id"), tag: p.tagName.toLowerCase() });
      p = p.parentElement;
    }
    return {
      id: el.getAttribute("data-vhe-id"),
      tag: el.tagName.toLowerCase(),
      text: hasChildEls ? "" : el.textContent || "",
      canText: !hasChildEls,
      hidden: el.hasAttribute("data-vhe-hidden"),
      path: path,
      styles: {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        textAlign: cs.textAlign,
        padding: cs.paddingTop,
        margin: cs.marginTop,
        borderRadius: cs.borderRadius,
        borderWidth: cs.borderTopWidth,
        borderColor: cs.borderTopColor
      },
      attrs: {
        src: el.getAttribute("src") || "",
        href: el.getAttribute("href") || "",
        alt: el.getAttribute("alt") || ""
      }
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
    else if (selectedId) { selectedId = null; post({ t: "selected", el: null }); }
  }

  // ---------- serialization ----------
  function serialize(print) {
    var clone = document.documentElement.cloneNode(true);
    var i, kill = clone.querySelectorAll("#__vhe_style, #__vhe_runtime");
    for (i = 0; i < kill.length; i++) kill[i].parentNode.removeChild(kill[i]);
    if (print) {
      // Freeze canvases into images and drop scripts so the file prints
      // correctly without re-running report code.
      var liveCanvases = document.querySelectorAll("canvas");
      var cloneCanvases = clone.querySelectorAll("canvas");
      for (i = 0; i < cloneCanvases.length; i++) {
        try {
          var img = document.createElement("img");
          img.src = liveCanvases[i].toDataURL("image/png");
          img.style.cssText = "width:" + liveCanvases[i].offsetWidth + "px;height:auto;";
          cloneCanvases[i].parentNode.replaceChild(img, cloneCanvases[i]);
        } catch (e) {}
      }
      var scripts = clone.querySelectorAll("script");
      for (i = 0; i < scripts.length; i++) scripts[i].parentNode.removeChild(scripts[i]);
    }
    var els = clone.querySelectorAll("[data-vhe-id]");
    for (i = 0; i < els.length; i++) {
      var el = els[i];
      el.removeAttribute("data-vhe-id");
      el.removeAttribute("contenteditable");
      el.classList.remove("__vhe-sel");
      el.classList.remove("__vhe-remote");
      if (!el.getAttribute("class")) el.removeAttribute("class");
      if (el.hasAttribute("data-vhe-hidden")) {
        el.removeAttribute("data-vhe-hidden");
        el.style.display = "none";
      }
    }
    return "<!DOCTYPE html>\n" + clone.outerHTML;
  }

  // ---------- events ----------
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.isContentEditable) return;
    e.preventDefault();
    e.stopPropagation();
    var el = t && t.closest ? t.closest("[data-vhe-id]") : null;
    select(el);
  }, true);

  document.addEventListener("dblclick", function (e) {
    if (!canEdit) return;
    var el = e.target && e.target.closest ? e.target.closest("[data-vhe-id]") : null;
    if (!el || el.children.length > 0) return;
    e.preventDefault();
    var before = el.textContent || "";
    el.setAttribute("contenteditable", "true");
    el.focus();
    var done = function () {
      el.removeAttribute("contenteditable");
      el.removeEventListener("blur", done);
      var after = el.textContent || "";
      if (after !== before) {
        post({
          t: "applied",
          op: { op: "text", id: el.getAttribute("data-vhe-id"), value: after },
          inverse: { op: "text", id: el.getAttribute("data-vhe-id"), value: before },
          meta: { origin: "local" }
        });
      }
      refreshSelected();
    };
    el.addEventListener("blur", done);
  }, true);

  document.addEventListener("submit", function (e) { e.preventDefault(); }, true);

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.target.isContentEditable) {
      var k = e.key.toLowerCase();
      if (k === "z" || k === "y" || k === "s") {
        e.preventDefault();
        post({ t: "key", k: k, shift: e.shiftKey });
      }
    }
  });

  var scrollTimer = null;
  window.addEventListener("scroll", function () {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () { post({ t: "scroll", y: window.scrollY }); }, 200);
  });

  // ---------- inbound messages ----------
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.token !== TOKEN) return;
    if (m.t === "init") {
      canEdit = m.canEdit !== false;
      var ps = m.patches || [];
      for (var i = 0; i < ps.length; i++) {
        try { applyOp(ps[i]); } catch (err) {}
      }
      sendSlides();
      post({ t: "inited", applied: ps.length });
    } else if (m.t === "op") {
      var inv = applyOp(m.o);
      if (inv !== null) {
        post({ t: "applied", op: m.o, inverse: inv, meta: m.meta || {} });
        if (isStructural(m.o)) { sendSlides(); }
        refreshSelected();
      }
    } else if (m.t === "select") {
      select(byId(m.id));
    } else if (m.t === "focusSlide") {
      var el = byId(m.id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (m.t === "getHtml") {
      post({ t: "html", html: serialize(!!m.print), reqId: m.reqId });
    } else if (m.t === "remoteSel") {
      var olds = document.querySelectorAll(".__vhe-remote");
      for (var j = 0; j < olds.length; j++) olds[j].classList.remove("__vhe-remote");
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

  // ---------- boot (synchronous: before the report's own init scripts) ----------
  injectStyle();
  ensureIds();
  post({ t: "ready" });
})();
`;

/**
 * Insert a script tag right before the closing </body> of a document.
 * Uses the LAST occurrence — embedded JS libraries (e.g. SheetJS) contain the
 * literal string "</body>" inside their code, and injecting at the first
 * match would corrupt them. String slicing avoids String.replace "$" quirks.
 */
export function insertBeforeBodyClose(html: string, script: string): string {
  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx === -1) return html + script;
  return html.slice(0, idx) + script + html.slice(idx);
}

export function buildEditorRuntime(token: string): string {
  return EDITOR_SOURCE.replace("__PRELUDE__", () => PRELUDE).replace("__VHE_TOKEN__", token);
}

/** Inject the editor runtime into an uploaded HTML document. */
export function injectEditorRuntime(html: string, token: string): string {
  const script = '<script id="__vhe_runtime">' + buildEditorRuntime(token) + "</" + "script>";
  return insertBeforeBodyClose(html, script);
}

export function makeToken(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export { PRELUDE };
