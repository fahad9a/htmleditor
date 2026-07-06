"use client";

import Link from "next/link";
import { useState } from "react";
import type { Collaborator, Role } from "@/lib/types";
import { initials } from "@/lib/colors";

interface Props {
  docId: string;
  title: string;
  dirty: boolean;
  saving: boolean;
  lastSaved: { at: string; name: string } | null;
  collaborators: Collaborator[];
  canEdit: boolean;
  myRole: Role;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoom: (z: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onShare: () => void;
  onVersions: () => void;
  onExportHtml: () => void;
  onExportZip: () => void;
  onExportPdf: () => void;
}

const ZOOMS = [50, 75, 100, 125, 150];

export default function TopBar(p: Props) {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 z-20">
      <Link
        href="/dashboard"
        className="btn-icon shrink-0"
        title="Back to dashboard"
        aria-label="Back to dashboard"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      </Link>

      <div className="min-w-0 mr-2">
        <h1 className="font-semibold text-sm truncate leading-tight">{p.title}</h1>
        <p className="text-[11px] text-slate-400 truncate leading-tight">
          {p.saving ? (
            <span className="text-indigo-500">Saving…</span>
          ) : p.dirty ? (
            "Unsaved changes"
          ) : p.lastSaved ? (
            `Saved ${new Date(p.lastSaved.at).toLocaleTimeString()}`
          ) : (
            "All changes saved"
          )}
          {!p.canEdit && " · view only"}
        </p>
      </div>

      {p.canEdit && (
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5">
          <button className="btn-icon !h-7 !w-7" onClick={p.onUndo} disabled={!p.canUndo} title="Undo (Ctrl+Z)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
          </button>
          <button className="btn-icon !h-7 !w-7" onClick={p.onRedo} disabled={!p.canRedo} title="Redo (Ctrl+Y)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
          </button>
        </div>
      )}

      <select
        className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600 focus:outline-none"
        value={p.zoom}
        onChange={(e) => p.onZoom(Number(e.target.value))}
        title="Zoom"
      >
        {ZOOMS.map((z) => (
          <option key={z} value={z}>{z}%</option>
        ))}
      </select>

      <div className="flex-1" />

      {/* live collaborators */}
      {p.collaborators.length > 0 && (
        <div className="flex items-center mr-1" title={p.collaborators.map((c) => c.name).join(", ")}>
          <div className="flex -space-x-2">
            {p.collaborators.slice(0, 4).map((c) => (
              <span
                key={c.key}
                title={c.name}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white"
                style={{ backgroundColor: c.color }}
              >
                {initials(c.name, c.name)}
              </span>
            ))}
          </div>
          <span className="ml-2 flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            live
          </span>
        </div>
      )}

      <a href={`/preview/${p.docId}`} target="_blank" className="btn-ghost !px-3 !py-1.5 !text-xs">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        Present
      </a>

      <div className="relative">
        <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => setExportOpen(!exportOpen)}>
          Export
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {exportOpen && (
          <div
            className="absolute right-0 top-full mt-1 w-60 rounded-xl border border-slate-200 bg-white shadow-xl py-1.5 text-sm z-30"
            onMouseLeave={() => setExportOpen(false)}
          >
            {[
              ["HTML file", "Single self-contained file", p.onExportHtml],
              ["ZIP package", "HTML + readme, ready to share", p.onExportZip],
              ["PDF", "Print-safe: charts frozen as images", p.onExportPdf],
            ].map(([label, desc, fn]) => (
              <button
                key={label as string}
                className="w-full text-left px-4 py-2 hover:bg-slate-50"
                onClick={() => {
                  setExportOpen(false);
                  (fn as () => void)();
                }}
              >
                <span className="font-medium text-slate-800">{label as string}</span>
                <span className="block text-[11px] text-slate-400">{desc as string}</span>
              </button>
            ))}
            <p className="px-4 pt-2 pb-1 text-[11px] text-slate-400 border-t border-slate-100 mt-1">
              PPTX isn&apos;t supported — export PDF and import it into PowerPoint.
            </p>
          </div>
        )}
      </div>

      <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={p.onVersions}>
        History
      </button>
      {p.myRole === "owner" && (
        <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={p.onShare}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" /></svg>
          Share
        </button>
      )}
      {p.canEdit && (
        <button className="btn-primary !px-4 !py-1.5 !text-xs" onClick={p.onSave} disabled={p.saving} title="Save version (Ctrl+S)">
          Save
        </button>
      )}
    </header>
  );
}
