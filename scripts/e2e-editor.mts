/**
 * E2E harness for the visual editor runtime (no auth/Supabase needed).
 *
 * Reproduces the real-world failure: a report embedding a JS library that
 * contains the literal string "</body></html>" inside script code (SheetJS
 * does this), then verifies the full click → select → edit → serialize flow
 * inside a sandboxed iframe, exactly as EditorShell wires it.
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

// --- fixture: Claude-style report with the SheetJS booby trap ---
const FIXTURE =
  "<!DOCTYPE html>\n<html><head><title>Test Report</title></head>\n<body>\n" +
  '<section class="slide"><h1 id="title">Quarterly Report</h1><p>Some intro text.</p></section>\n' +
  '<section class="slide"><h2>KPIs</h2><div class="kpi">42</div></section>\n' +
  "<script>\n" +
  'var Wm="</body></html>";\n' + // ← the booby trap: literal </body> inside JS
  "window.__reportScriptRan = true;\n" +
  "</" +
  "script>\n</body></html>";

const injected = injectEditorRuntime(FIXTURE, TOKEN);

// sanity: runtime must land AFTER the report's own script
const trapPos = injected.indexOf('var Wm="</body>');
const runtimePos = injected.indexOf("__vhe_runtime");
if (runtimePos < trapPos) {
  console.error("FAIL: runtime injected before the report script (old bug)");
  process.exit(1);
}
console.log("✓ injection lands after the embedded library string");

// --- parent harness page (mimics EditorShell's iframe wiring) ---
const harness =
  "<!DOCTYPE html><html><body style='margin:0'>" +
  "<iframe id='f' sandbox='allow-scripts' style='width:800px;height:600px;border:0'></iframe>" +
  "<script>" +
  "window.__msgs=[];" +
  "window.addEventListener('message',function(e){window.__msgs.push(e.data)});" +
  "document.getElementById('f').srcdoc=" +
  JSON.stringify(injected).replace(/<\//g, "<\\/") +
  ";" +
  "window.__send=function(m){m.token='" + TOKEN + "';" +
  "document.getElementById('f').contentWindow.postMessage(m,'*')};" +
  "</" +
  "script></body></html>";

const dir = mkdtempSync(join(tmpdir(), "vhe-e2e-"));
const file = join(dir, "harness.html");
writeFileSync(file, harness);

function fail(msg: string): never {
  console.error("FAIL:", msg);
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
try {
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(pathToFileURL(file).href);

  type Msg = Record<string, unknown> & { t?: string };
  const msgs = async (): Promise<Msg[]> => (await page.evaluate("window.__msgs")) as Msg[];
  async function waitFor(t: string, timeout = 5000): Promise<Msg> {
    const start = Date.now();
    for (;;) {
      const found = (await msgs()).filter((m) => m.t === t).pop();
      if (found) return found;
      if (Date.now() - start > timeout) fail(`timed out waiting for "${t}" message`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  await waitFor("ready");
  console.log("✓ editor runtime booted inside sandboxed iframe");

  const slides = (await waitFor("slides")) as { slides: { id: string; name: string }[] };
  if (slides.slides.length !== 2) fail(`expected 2 slides, got ${slides.slides.length}`);
  console.log("✓ slides detected:", slides.slides.map((s) => s.name).join(" | "));

  // real mouse click on the h1 inside the iframe
  await page.mouse.click(60, 30);
  const sel = (await waitFor("selected")) as { el: { id: string; tag: string } | null };
  if (!sel.el) fail("click did not select an element");
  console.log(`✓ click selected <${sel.el.tag}>`);

  // edit text + style through the same messages the inspector sends
  await page.evaluate(
    (id) => (window as never as { __send: (m: object) => void }).__send({ t: "text", id, value: "EDITED TITLE" }),
    sel.el.id
  );
  await page.evaluate(
    (id) => (window as never as { __send: (m: object) => void }).__send({ t: "style", id, prop: "color", value: "rgb(255, 0, 0)" }),
    sel.el.id
  );
  await waitFor("changed");
  console.log("✓ text + style edits applied ('changed' emitted → autosave path)");

  // serialize and verify
  await page.evaluate(() =>
    (window as never as { __send: (m: object) => void }).__send({ t: "getHtml", reqId: "r1" })
  );
  const htmlMsg = (await waitFor("html")) as { html: string };
  const out = htmlMsg.html;
  if (!out.includes("EDITED TITLE")) fail("serialized HTML missing text edit");
  if (!out.includes("color: rgb(255, 0, 0)") && !out.includes("color:rgb(255, 0, 0)"))
    fail("serialized HTML missing style edit");
  if (out.includes("__vhe_runtime")) fail("serialized HTML still contains editor runtime");
  if (!out.includes('var Wm="</body></html>"')) fail("report's own script was corrupted");
  if (out.includes("data-vhe-id")) fail("serialized HTML still contains editor ids");
  console.log("✓ serialize: edits kept, runtime stripped, report script intact");

  if (pageErrors.length) fail("page errors: " + pageErrors.join("; "));
  console.log("\nALL CHECKS PASSED");
} finally {
  await browser.close();
}
