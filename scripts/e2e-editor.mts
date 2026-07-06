/**
 * E2E harness for the visual editor runtime v2 (patch/overlay architecture).
 * No auth/Supabase needed — tests the iframe runtime exactly as EditorShell
 * wires it, in a real browser.
 *
 * Covers:
 *  1. Injection safety with embedded JS libraries containing "</body>" strings
 *  2. Synchronous boot: IDs assigned BEFORE report scripts generate content
 *  3. Click → select, op application with inverses (undo)
 *  4. Patch replay on a fresh load (persistence model)
 *  5. Slide detection + structural ops
 *  6. Serialization: clean export, print variant strips scripts
 *
 * Run: npx tsx scripts/e2e-editor.mts
 */
import puppeteer from "puppeteer-core";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { injectEditorRuntime } from "../lib/editorRuntime";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const TOKEN = "testtoken";

// Claude-style report: slides + a generator script + the SheetJS booby trap.
const FIXTURE =
  "<!DOCTYPE html>\n<html><head><title>Test Report</title></head>\n<body>\n" +
  '<section class="slide"><h1 id="title">Quarterly Report</h1><p>Some intro text.</p></section>\n' +
  '<section class="slide"><h2>KPIs</h2><div id="mount"></div></section>\n' +
  "<script>\n" +
  'var Wm="</body></html>";\n' + // literal </body> inside JS (SheetJS does this)
  "document.addEventListener('DOMContentLoaded', function(){\n" +
  "  document.getElementById('mount').innerHTML = '<div class=\"generated\">chart placeholder</div>';\n" +
  "});\n" +
  "</" +
  "script>\n</body></html>";

function fail(msg: string): never {
  console.error("FAIL:", msg);
  process.exit(1);
}

function makeHarness(patches: unknown[]): string {
  const injected = injectEditorRuntime(FIXTURE, TOKEN);
  return (
    "<!DOCTYPE html><html><body style='margin:0'>" +
    "<iframe id='f' sandbox='allow-scripts' style='width:800px;height:600px;border:0'></iframe>" +
    "<script>" +
    "window.__msgs=[];" +
    "window.addEventListener('message',function(e){window.__msgs.push(e.data);" +
    // auto-init like EditorShell does on 'ready'
    "if(e.data&&e.data.t==='ready'){window.__send({t:'init',patches:" +
    JSON.stringify(patches).replace(/<\//g, "<\\/") +
    ",canEdit:true})}});" +
    "window.__send=function(m){m.token='" + TOKEN + "';" +
    "document.getElementById('f').contentWindow.postMessage(m,'*')};" +
    "document.getElementById('f').srcdoc=" +
    JSON.stringify(injected).replace(/<\//g, "<\\/") +
    ";" +
    "</" +
    "script></body></html>"
  );
}

const dir = mkdtempSync(join(tmpdir(), "vhe-e2e-"));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

type Msg = Record<string, unknown> & { t?: string };

async function openHarness(patches: unknown[]) {
  const file = join(dir, `harness-${Math.random().toString(36).slice(2)}.html`);
  writeFileSync(file, makeHarness(patches));
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(pathToFileURL(file).href);

  const msgs = async (): Promise<Msg[]> => (await page.evaluate("window.__msgs")) as Msg[];
  async function waitFor(t: string, after = 0, timeout = 5000): Promise<Msg> {
    const start = Date.now();
    for (;;) {
      const list = (await msgs()).filter((m) => m.t === t);
      if (list.length > after) return list[list.length - 1];
      if (Date.now() - start > timeout) fail(`timed out waiting for "${t}"`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const send = (m: object) => page.evaluate((mm) => (window as never as { __send: (x: object) => void }).__send(mm), m);
  return { page, msgs, waitFor, send, pageErrors };
}

try {
  // ---------- session 1: fresh document, make edits ----------
  const s1 = await openHarness([]);
  await s1.waitFor("inited");
  console.log("✓ runtime booted + inited (patches: none)");

  const slides = (await s1.waitFor("slides")) as { slides: { id: string; name: string }[] };
  if (slides.slides.length !== 2) fail(`expected 2 slides, got ${slides.slides.length}`);
  console.log("✓ slides detected:", slides.slides.map((s) => s.name).join(" | "));

  // click the h1
  await s1.page.mouse.click(60, 30);
  const sel = (await s1.waitFor("selected")) as { el: { id: string; tag: string; path: unknown[] } | null };
  if (!sel.el) fail("click did not select an element");
  if (!Array.isArray(sel.el.path) || sel.el.path.length < 2) fail("selected element missing breadcrumb path");
  console.log(`✓ click selected <${sel.el.tag}> with breadcrumb (${sel.el.path.length} ancestors)`);

  // apply ops like the inspector does
  await s1.send({ t: "op", o: { op: "text", id: sel.el.id, value: "EDITED TITLE" }, meta: {} });
  const applied1 = (await s1.waitFor("applied")) as { op: { op: string }; inverse: { op: string; value: string } };
  if (applied1.inverse.op !== "text" || applied1.inverse.value !== "Quarterly Report")
    fail("text op inverse incorrect: " + JSON.stringify(applied1.inverse));
  console.log("✓ text op applied with correct inverse (undo data)");

  await s1.send({ t: "op", o: { op: "style", id: sel.el.id, prop: "color", value: "rgb(255, 0, 0)" }, meta: {} });
  await s1.waitFor("applied", 1);

  // structural: duplicate slide 2
  await s1.send({ t: "op", o: { op: "slide", sub: "dup", id: slides.slides[1].id }, meta: {} });
  const applied3 = (await s1.waitFor("applied", 2)) as { inverse: { op: string } };
  if (applied3.inverse.op !== "remove") fail("dup inverse should be remove");
  const slides2 = (await s1.waitFor("slides", 1)) as { slides: unknown[] };
  if (slides2.slides.length !== 3) fail(`expected 3 slides after dup, got ${slides2.slides.length}`);
  console.log("✓ slide duplicated (3 slides), inverse is remove");

  // undo the dup (EditorShell sends the inverse back)
  await s1.send({ t: "op", o: applied3.inverse, meta: { history: true } });
  const slides3 = (await s1.waitFor("slides", 2)) as { slides: unknown[] };
  if (slides3.slides.length !== 2) fail("undo (inverse remove) did not restore 2 slides");
  console.log("✓ undo works (inverse op restored 2 slides)");

  // serialize
  await s1.send({ t: "getHtml", reqId: "r1", print: false });
  const out1 = ((await s1.waitFor("html")) as { html: string }).html;
  if (!out1.includes("EDITED TITLE")) fail("export missing text edit");
  if (!/color:\s*rgb\(255,\s*0,\s*0\)/.test(out1)) fail("export missing style edit");
  if (out1.includes("__vhe_runtime") || out1.includes("data-vhe-id")) fail("export not clean");
  if (!out1.includes('var Wm="</body></html>"')) fail("report's own script corrupted");
  console.log("✓ export clean: edits kept, runtime stripped, embedded lib intact");

  // print variant: scripts removed
  await s1.send({ t: "getHtml", reqId: "r2", print: true });
  const out2 = ((await s1.waitFor("html", 1)) as { html: string }).html;
  if (/<script/i.test(out2)) fail("print export should strip scripts");
  if (!out2.includes("EDITED TITLE")) fail("print export missing edits");
  console.log("✓ print export strips scripts, keeps edits");

  if (s1.pageErrors.length) fail("page errors: " + s1.pageErrors.join("; "));
  await s1.page.close();

  // ---------- session 2: reload with saved patches (persistence) ----------
  const savedPatches = [
    { op: "text", id: sel.el.id, value: "EDITED TITLE" },
    { op: "style", id: sel.el.id, prop: "color", value: "rgb(255, 0, 0)" },
  ];
  const s2 = await openHarness(savedPatches);
  const inited = (await s2.waitFor("inited")) as { applied: number };
  if (inited.applied !== 2) fail(`expected 2 patches replayed, got ${inited.applied}`);

  await s2.send({ t: "getHtml", reqId: "r3", print: false });
  const out3 = ((await s2.waitFor("html")) as { html: string }).html;
  if (!out3.includes("EDITED TITLE")) fail("patch replay lost the text edit on reload");
  if (!/color:\s*rgb\(255,\s*0,\s*0\)/.test(out3)) fail("patch replay lost the style edit on reload");
  // the report's own generator script must still have produced its content
  if (!out3.includes("chart placeholder")) fail("report script did not run after patch replay");
  console.log("✓ session 2: patches replayed onto fresh document — edits persist, report script ran");

  // IDs must be stable across sessions: selecting the same coordinates gives the same id
  await s2.page.mouse.click(60, 30);
  const sel2 = (await s2.waitFor("selected")) as { el: { id: string } | null };
  if (sel2.el?.id !== sel.el.id) fail(`ID instability: ${sel.el.id} vs ${sel2.el?.id}`);
  console.log("✓ element IDs stable across sessions (collab/undo-safe)");

  if (s2.pageErrors.length) fail("page errors: " + s2.pageErrors.join("; "));
  await s2.page.close();

  console.log("\nALL CHECKS PASSED");
} finally {
  await browser.close();
}
