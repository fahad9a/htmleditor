"use client";

import { useState } from "react";
import type { SlideInfo, TransitionCfg, TransitionType } from "@/lib/types";

interface Ops {
  slide: (op: string, id?: string, name?: string) => void;
  focusSlide: (id: string) => void;
}

interface Props {
  slides: SlideInfo[];
  selectedId: string | null;
  canEdit: boolean;
  transitions: TransitionCfg;
  onTransitionsChange: (cfg: TransitionCfg) => void;
  ops: Ops;
}

const TRANSITION_TYPES: { value: TransitionType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "slide-left", label: "Slide left" },
  { value: "slide-right", label: "Slide right" },
  { value: "zoom", label: "Zoom" },
];

export default function SlidesSidebar({ slides, selectedId, canEdit, transitions, onTransitionsChange, ops }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [active, setActive] = useState<string | null>(null);

  const isDeck = slides.length > 1 || (slides.length === 1 && slides[0].id !== "vhe-body");

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {isDeck ? "Slides" : "Sections"}
        </h2>
        {canEdit && (
          <button
            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            onClick={() => ops.slide("add")}
          >
            + Add
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={`group mx-2 mb-1 rounded-lg px-3 py-2 cursor-pointer text-sm ${
              active === s.id ? "bg-brand-50 text-brand-700" : "hover:bg-gray-50"
            }`}
            onClick={() => {
              setActive(s.id);
              ops.focusSlide(s.id);
            }}
          >
            {renaming === s.id ? (
              <input
                autoFocus
                className="input !py-1 !text-xs"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => {
                  ops.slide("rename", s.id, renameValue);
                  setRenaming(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-4">{i + 1}</span>
                <span className="truncate flex-1">{s.name}</span>
              </div>
            )}

            {canEdit && s.id !== "vhe-body" && renaming !== s.id && (
              <div className="hidden group-hover:flex gap-1 mt-1.5 text-[11px] text-gray-400">
                <button title="Move up" className="hover:text-gray-900" onClick={(e) => { e.stopPropagation(); ops.slide("up", s.id); }}>↑</button>
                <button title="Move down" className="hover:text-gray-900" onClick={(e) => { e.stopPropagation(); ops.slide("down", s.id); }}>↓</button>
                <button title="Duplicate" className="hover:text-gray-900" onClick={(e) => { e.stopPropagation(); ops.slide("dup", s.id); }}>⧉</button>
                <button
                  title="Rename"
                  className="hover:text-gray-900"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenaming(s.id);
                    setRenameValue(s.name);
                  }}
                >
                  ✎
                </button>
                <button
                  title="Delete"
                  className="hover:text-red-600 ml-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${s.name}"?`)) ops.slide("del", s.id);
                  }}
                >
                  🗑
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {canEdit && selectedId && selectedId !== "vhe-body" && (
        <div className="border-t border-gray-100 px-4 py-3">
          <button
            className="btn-ghost w-full justify-center !py-1.5 text-xs"
            onClick={() => ops.slide("mark", selectedId)}
            title="Toggle whether the selected element is treated as a slide/section"
          >
            ⊞ Mark selection as slide
          </button>
        </div>
      )}

      {/* PowerPoint-style transition controls */}
      <div className="border-t border-gray-200 px-4 py-3 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Transitions</h3>
        <div>
          <label className="label">Effect</label>
          <select
            className="input !py-1.5"
            disabled={!canEdit}
            value={transitions.type}
            onChange={(e) => onTransitionsChange({ ...transitions, type: e.target.value as TransitionType })}
          >
            {TRANSITION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Duration (s)</label>
            <input
              className="input !py-1.5"
              type="number"
              min={0}
              step={0.1}
              disabled={!canEdit}
              value={transitions.duration}
              onChange={(e) => onTransitionsChange({ ...transitions, duration: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Delay (s)</label>
            <input
              className="input !py-1.5"
              type="number"
              min={0}
              step={0.1}
              disabled={!canEdit}
              value={transitions.delay}
              onChange={(e) => onTransitionsChange({ ...transitions, delay: Number(e.target.value) })}
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-400">Applied between slides in Preview mode.</p>
      </div>
    </aside>
  );
}
