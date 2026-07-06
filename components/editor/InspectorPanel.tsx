"use client";

import { useEffect, useState } from "react";
import type { SelectedEl } from "@/lib/types";

interface Ops {
  style: (prop: string, value: string) => void;
  text: (value: string) => void;
  attr: (name: string, value: string) => void;
  hide: () => void;
  remove: () => void;
  selectEl: (id: string) => void;
  uploadImage: (file: File) => Promise<string | null>;
  insertImage: (url: string) => void;
}

interface Props {
  selected: SelectedEl | null;
  canEdit: boolean;
  ops: Ops;
}

// Convert "rgb(r, g, b)" from getComputedStyle into "#rrggbb" for color inputs.
function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return rgb.startsWith("#") ? rgb : "#000000";
  return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
}

const FONT_FAMILIES = [
  ["", "Original font"],
  ["system-ui, -apple-system, sans-serif", "System sans"],
  ["Georgia, 'Times New Roman', serif", "Serif"],
  ["'Courier New', monospace", "Monospace"],
  ["Arial, Helvetica, sans-serif", "Arial"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 px-4 py-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

export default function InspectorPanel({ selected, canEdit, ops }: Props) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setText(selected?.text ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  async function replaceWithUpload(file: File) {
    setUploading(true);
    const url = await ops.uploadImage(file);
    if (url) ops.attr("src", url);
    setUploading(false);
  }

  async function insertUpload(file: File) {
    setUploading(true);
    const url = await ops.uploadImage(file);
    if (url) ops.insertImage(url);
    setUploading(false);
  }

  if (!selected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center text-2xl shadow-inner">
          👆
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-700">Select an element</p>
        <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
          Click anything in the document to edit its text, colors and layout.
          Double-click text to edit it in place.
        </p>
      </div>
    );
  }

  const s = selected.styles;
  const disabled = !canEdit;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* breadcrumb path */}
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          {selected.path.map((p, i) => (
            <span key={p.id} className="flex items-center gap-1">
              {i > 0 && <span className="text-slate-300">›</span>}
              <button
                className={
                  p.id === selected.id
                    ? "font-bold text-violet-600"
                    : "text-slate-400 hover:text-slate-700"
                }
                onClick={() => ops.selectEl(p.id)}
              >
                {p.tag}
              </button>
            </span>
          ))}
        </div>
        {!canEdit && <p className="text-[10px] text-amber-600 mt-1">View only — ask the owner for edit access</p>}
      </div>

      {selected.canText && (
        <Section title="Text">
          <textarea
            className="input min-h-[70px] !text-sm"
            value={text}
            disabled={disabled}
            onChange={(e) => {
              setText(e.target.value);
              ops.text(e.target.value);
            }}
          />
        </Section>
      )}

      <Section title="Typography">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Size</label>
            <input
              className="input !py-1.5"
              type="number"
              min={6}
              disabled={disabled}
              value={parseInt(s.fontSize) || 16}
              onChange={(e) => ops.style("fontSize", `${e.target.value}px`)}
            />
          </div>
          <div>
            <label className="label">Weight</label>
            <select
              className="input !py-1.5"
              disabled={disabled}
              value={s.fontWeight}
              onChange={(e) => ops.style("fontWeight", e.target.value)}
            >
              {["300", "400", "500", "600", "700", "800"].map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Font</label>
          <select
            className="input !py-1.5"
            disabled={disabled}
            defaultValue=""
            onChange={(e) => e.target.value && ops.style("fontFamily", e.target.value)}
          >
            {FONT_FAMILIES.map(([v, l]) => (
              <option key={l} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Align</label>
          <div className="flex gap-1">
            {(["left", "center", "right", "justify"] as const).map((a) => (
              <button
                key={a}
                disabled={disabled}
                title={a}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                  s.textAlign === a
                    ? "border-violet-500 bg-violet-50 text-violet-600"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
                onClick={() => ops.style("textAlign", a)}
              >
                {a === "left" ? "⇤" : a === "center" ? "↔" : a === "right" ? "⇥" : "≡"}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Colors">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Text</label>
            <input
              className="h-9 w-full rounded-lg border border-slate-300 cursor-pointer"
              type="color"
              disabled={disabled}
              value={rgbToHex(s.color)}
              onChange={(e) => ops.style("color", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Background</label>
            <input
              className="h-9 w-full rounded-lg border border-slate-300 cursor-pointer"
              type="color"
              disabled={disabled}
              value={rgbToHex(s.backgroundColor)}
              onChange={(e) => ops.style("backgroundColor", e.target.value)}
            />
          </div>
        </div>
      </Section>

      <Section title="Layout">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Padding</label>
            <input
              className="input !py-1.5"
              type="number"
              min={0}
              disabled={disabled}
              value={parseInt(s.padding) || 0}
              onChange={(e) => ops.style("padding", `${e.target.value}px`)}
            />
          </div>
          <div>
            <label className="label">Margin</label>
            <input
              className="input !py-1.5"
              type="number"
              min={0}
              disabled={disabled}
              value={parseInt(s.margin) || 0}
              onChange={(e) => ops.style("margin", `${e.target.value}px`)}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">Border</label>
            <input
              className="input !py-1.5"
              type="number"
              min={0}
              disabled={disabled}
              value={parseInt(s.borderWidth) || 0}
              onChange={(e) => {
                ops.style("borderWidth", `${e.target.value}px`);
                if (parseInt(e.target.value) > 0) ops.style("borderStyle", "solid");
              }}
            />
          </div>
          <div>
            <label className="label">Color</label>
            <input
              className="h-9 w-full rounded-lg border border-slate-300 cursor-pointer"
              type="color"
              disabled={disabled}
              value={rgbToHex(s.borderColor)}
              onChange={(e) => ops.style("borderColor", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Radius</label>
            <input
              className="input !py-1.5"
              type="number"
              min={0}
              disabled={disabled}
              value={parseInt(s.borderRadius) || 0}
              onChange={(e) => ops.style("borderRadius", `${e.target.value}px`)}
            />
          </div>
        </div>
      </Section>

      {selected.tag === "img" && (
        <Section title="Image">
          <div>
            <label className="label">URL</label>
            <input
              className="input !py-1.5"
              disabled={disabled}
              defaultValue={selected.attrs.src}
              onBlur={(e) => ops.attr("src", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Replace with a picture</label>
            <label
              className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-3 text-xs font-semibold transition-colors ${
                disabled || uploading
                  ? "border-slate-200 text-slate-300"
                  : "border-violet-300 text-violet-600 hover:border-violet-500 hover:bg-violet-50 cursor-pointer"
              }`}
            >
              {uploading ? "Uploading…" : "📷 Upload picture"}
              <input
                type="file"
                accept="image/*"
                disabled={disabled || uploading}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) replaceWithUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div>
            <label className="label">Width %</label>
            <input
              className="w-full accent-violet-600"
              type="range"
              min={10}
              max={100}
              disabled={disabled}
              defaultValue={100}
              onChange={(e) => ops.style("width", `${e.target.value}%`)}
            />
          </div>
          <div>
            <label className="label">Alt text</label>
            <input
              className="input !py-1.5"
              disabled={disabled}
              defaultValue={selected.attrs.alt}
              onBlur={(e) => ops.attr("alt", e.target.value)}
            />
          </div>
        </Section>
      )}

      {canEdit && selected.tag !== "img" && (
        <Section title="Insert picture">
          <label
            className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-3 text-xs font-semibold transition-colors ${
              uploading
                ? "border-slate-200 text-slate-300"
                : "border-violet-300 text-violet-600 hover:border-violet-500 hover:bg-violet-50 cursor-pointer"
            }`}
          >
            {uploading ? "Uploading…" : "📷 Upload into selection"}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) insertUpload(f);
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-[10px] text-slate-400">Adds the picture inside the selected element.</p>
        </Section>
      )}

      {selected.tag === "a" && (
        <Section title="Link">
          <input
            className="input !py-1.5"
            disabled={disabled}
            defaultValue={selected.attrs.href}
            onBlur={(e) => ops.attr("href", e.target.value)}
          />
        </Section>
      )}

      {canEdit && (
        <div className="px-4 py-3 flex gap-2">
          <button className="btn-ghost flex-1 !py-1.5 !text-xs" onClick={ops.hide}>
            {selected.hidden ? "Show" : "Hide"}
          </button>
          <button
            className="btn-ghost flex-1 !py-1.5 !text-xs !text-red-600 !border-red-200 hover:!bg-red-50"
            onClick={ops.remove}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
