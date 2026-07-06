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
  onSave: () => void;
  onShare: () => void;
  onVersions: () => void;
  onExportHtml: () => void;
  onExportZip: () => void;
  onExportPdf: () => void;
}

export default function TopBar(p: Props) {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2 z-10">
      <Link href="/dashboard" className="text-gray-400 hover:text-gray-900 text-sm shrink-0">
        ← Dashboard
      </Link>
      <div className="min-w-0">
        <h1 className="font-semibold text-sm truncate">{p.title}</h1>
        <p className="text-[11px] text-gray-400 truncate">
          {p.saving
            ? "Saving…"
            : p.dirty
              ? "Unsaved changes"
              : p.lastSaved
                ? `Saved ${new Date(p.lastSaved.at).toLocaleTimeString()}${p.lastSaved.name ? ` by ${p.lastSaved.name}` : ""}`
                : "All changes saved"}
          {!p.canEdit && " · view only"}
        </p>
      </div>

      <div className="flex-1" />

      {/* live collaborators */}
      <div className="flex -space-x-2 mr-1">
        {p.collaborators.map((c) => (
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
      {p.collaborators.length > 0 && (
        <span className="text-xs text-gray-400 mr-2 hidden md:block">
          {p.collaborators.length} online
        </span>
      )}

      <a href={`/preview/${p.docId}`} target="_blank" className="btn-ghost !px-3 !py-1.5 text-xs">
        ▶ Preview
      </a>

      <div className="relative">
        <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setExportOpen(!exportOpen)}>
          Export ▾
        </button>
        {exportOpen && (
          <div
            className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-sm z-20"
            onMouseLeave={() => setExportOpen(false)}
          >
            {[
              ["HTML file", p.onExportHtml],
              ["ZIP package", p.onExportZip],
              ["PDF (via print dialog)", p.onExportPdf],
            ].map(([label, fn]) => (
              <button
                key={label as string}
                className="w-full text-left px-4 py-2 hover:bg-gray-50"
                onClick={() => {
                  setExportOpen(false);
                  (fn as () => void)();
                }}
              >
                {label as string}
              </button>
            ))}
            <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">
              PPTX isn&apos;t supported — export PDF and import it into PowerPoint instead.
            </p>
          </div>
        )}
      </div>

      <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={p.onVersions}>
        History
      </button>
      {p.myRole === "owner" && (
        <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={p.onShare}>
          Share
        </button>
      )}
      {p.canEdit && (
        <button className="btn-primary !px-4 !py-1.5 text-xs" onClick={p.onSave} disabled={p.saving}>
          Save
        </button>
      )}
    </header>
  );
}
