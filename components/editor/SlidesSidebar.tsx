"use client";

import { useState } from "react";
import type { PatchOp, SlideInfo, TransitionCfg, TransitionType } from "@/lib/types";

interface Ops {
  slide: (sub: PatchOp["sub"], id?: string, name?: string) => void;
  focusSlide: (id: string) => void;
  selectEl: (id: string) => void;
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
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {isDeck ? "Slides" : "Sections"}
        </h2>
        {canEdit && (
          <button
            className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
            onClick={() => ops.slide("add")}
          >
            + Add
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {slides.length === 0 && (
          <p className="px-4 py-3 text-xs text-slate-400">Detecting sections…</p>
        )}
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={`group mx-2 mb-1 rounded-xl px-3 py-2 cursor-pointer text-sm transition-colors ${
              active === s.id
                ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100"
                : "hover:bg-slate-50"
            }`}
            onClick={() => {
              setActive(s.id);
              ops.focusSlide(s.id);
              ops.selectEl(s.id);
            }}
          >
            {renaming === s.id ? (
              <input
                autoFocus
                className="input !py-1 !text-xs"
                value={renameValue}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => {
                  ops.slide("rename", s.id, renameValue);
                  setRenaming(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setRenaming(null);
                }}
              />
            ) : (
              <div className="flex items-center gap-2">
                <span className={`text-[10px] w-4 ${active === s.id ? "text-indigo-400" : "text-slate-300"}`}>
                  {i + 1}
                </span>
                <span className="truncate flex-1 font-medium">{s.name}</span>
              </div>
            )}

            {canEdit && s.id !== "vhe-body" && renaming !== s.id && (
              <div className="hidden group-hover:flex gap-2 mt-1.5 pl-6 text-[11px] text-slate-400">
                <button title="Move up" className="hover:text-slate-900" onClick={(e) => { e.stopPropagation(); ops.slide("up", s.id); }}>↑</button>
                <button title="Move down" className="hover:text-slate-900" onClick={(e) => { e.stopPropagation(); ops.slide("down", s.id); }}>↓</button>
                <button title="Duplicate" className="hover:text-slate-900" onClick={(e) => { e.stopPropagation(); ops.slide("dup", s.id); }}>⧉</button>
                <button
                  title="Rename"
                  className="hover:text-slate-900"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenaming(s.id);
                    setRenameValue(s.name);
                  }}
                >
                  ✎
                </button>
                <button
                  title="Delete (undo with Ctrl+Z)"
                  className="hover:text-red-600 ml-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    ops.slide("del", s.id);
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {canEdit && selectedId && selectedId !== "vhe-body" && !slides.some((s) => s.id === selectedId) && (
        <div className="border-t border-slate-100 px-4 py-3">
          <button
            className="btn-ghost w-full !py-1.5 !text-xs"
            onClick={() => ops.slide("mark", selectedId)}
            title="Treat the selected element as a slide/section"
          >
            ⊞ Mark selection as slide
          </button>
        </div>
      )}

      {/* PowerPoint-style transition controls */}
      <div className="border-t border-slate-200 px-4 py-3 space-y-2.5 bg-slate-50/50">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Transitions</h3>
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
            <label className="label">Duration s</label>
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
            <label className="label">Delay s</label>
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
        <p className="text-[11px] text-slate-400">Play with the Present button ▶</p>
      </div>
    </aside>
  );
}
