"use client";

import { useEffect, useState } from "react";
import type { SelectedEl } from "@/lib/types";

interface Ops {
  style: (prop: string, value: string) => void;
  text: (value: string) => void;
  attr: (name: string, value: string) => void;
  hide: () => void;
  remove: () => void;
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
  return (
    "#" +
    [m[1], m[2], m[3]]
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")
  );
}

const FONT_FAMILIES = [
  ["", "Original"],
  ["system-ui, -apple-system, sans-serif", "System sans"],
  ["Georgia, 'Times New Roman', serif", "Serif"],
  ["'Courier New', monospace", "Monospace"],
  ["Arial, Helvetica, sans-serif", "Arial"],
];

export default function InspectorPanel({ selected, canEdit, ops }: Props) {
  const [text, setText] = useState("");

  useEffect(() => {
    setText(selected?.text ?? "");
  }, [selected?.id, selected?.text]);

  if (!selected) {
    return (
      <aside className="w-72 shrink-0 border-l border-gray-200 bg-white p-6 text-center">
        <p className="text-3xl mt-8">👆</p>
        <p className="mt-3 text-sm text-gray-500">
          Click any element in the document to edit it.
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Double-click text to edit it in place.
        </p>
      </aside>
    );
  }

  const s = selected.styles;
  const disabled = !canEdit;

  return (
    <aside className="w-72 shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          &lt;{selected.tag}&gt; selected
        </h2>
        {!canEdit && <span className="text-[10px] text-gray-400">view only</span>}
      </div>

      <div className="p-4 space-y-4 text-sm">
        {/* text content */}
        {selected.canText && (
          <div>
            <label className="label">Text</label>
            <textarea
              className="input min-h-[70px]"
              value={text}
              disabled={disabled}
              onChange={(e) => {
                setText(e.target.value);
                ops.text(e.target.value);
              }}
            />
          </div>
        )}

        {/* typography */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Font size</label>
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
          <label className="label">Font family</label>
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
          <label className="label">Alignment</label>
          <div className="flex gap-1">
            {(["left", "center", "right", "justify"] as const).map((a) => (
              <button
                key={a}
                disabled={disabled}
                className={`flex-1 rounded border px-2 py-1.5 text-xs ${
                  s.textAlign === a
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
                onClick={() => ops.style("textAlign", a)}
              >
                {a === "left" ? "⇤" : a === "center" ? "↔" : a === "right" ? "⇥" : "≡"}
              </button>
            ))}
          </div>
        </div>

        {/* colors */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Text color</label>
            <input
              className="h-9 w-full rounded-lg border border-gray-300 cursor-pointer"
              type="color"
              disabled={disabled}
              value={rgbToHex(s.color)}
              onChange={(e) => ops.style("color", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Background</label>
            <input
              className="h-9 w-full rounded-lg border border-gray-300 cursor-pointer"
              type="color"
              disabled={disabled}
              value={rgbToHex(s.backgroundColor)}
              onChange={(e) => ops.style("backgroundColor", e.target.value)}
            />
          </div>
        </div>

        {/* spacing */}
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

        {/* border */}
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
            <label className="label">B. color</label>
            <input
              className="h-9 w-full rounded-lg border border-gray-300 cursor-pointer"
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

        {/* image attributes */}
        {selected.tag === "img" && (
          <>
            <div>
              <label className="label">Image URL</label>
              <input
                className="input !py-1.5"
                disabled={disabled}
                defaultValue={selected.attrs.src}
                onBlur={(e) => ops.attr("src", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Replace with file</label>
              <input
                type="file"
                accept="image/*"
                disabled={disabled}
                className="text-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  // Embedded as a data URL so the export stays a single file.
                  reader.onload = () => ops.attr("src", String(reader.result));
                  reader.readAsDataURL(f);
                }}
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
          </>
        )}

        {/* link attribute */}
        {selected.tag === "a" && (
          <div>
            <label className="label">Link URL</label>
            <input
              className="input !py-1.5"
              disabled={disabled}
              defaultValue={selected.attrs.href}
              onBlur={(e) => ops.attr("href", e.target.value)}
            />
          </div>
        )}

        {/* visibility + delete */}
        {canEdit && (
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button className="btn-ghost flex-1 justify-center !py-1.5 text-xs" onClick={ops.hide}>
              {selected.hidden ? "👁 Show" : "🚫 Hide"}
            </button>
            <button
              className="btn-ghost flex-1 justify-center !py-1.5 text-xs !text-red-600 !border-red-200 hover:!bg-red-50"
              onClick={() => confirm("Delete this element?") && ops.remove()}
            >
              🗑 Delete
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
