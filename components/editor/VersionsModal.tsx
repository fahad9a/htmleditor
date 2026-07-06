"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PatchOp, VersionRow } from "@/lib/types";

interface Props {
  documentId: string;
  canEdit: boolean;
  onRestore: (version: { patches: PatchOp[]; label: string }) => void;
  onClose: () => void;
}

export default function VersionsModal({ documentId, canEdit, onRestore, onClose }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("document_versions")
      .select("id, label, created_at, created_by, html_content, patches, profiles:created_by(id, email, full_name, avatar_url)")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setVersions((data as unknown as VersionRow[]) ?? []);
        setLoading(false);
      });
  }, [documentId, supabase]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">Version history</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : versions.length === 0 ? (
          <p className="mt-6 text-sm text-slate-400">
            No saved versions yet. Press <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">Ctrl+S</kbd> or
            the Save button to create one.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {versions.map((v, i) => (
              <li key={v.id} className="py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {v.label || "Version"}
                    {i === 0 && (
                      <span className="ml-2 rounded-full bg-emerald-50 text-emerald-600 text-[10px] px-2 py-0.5 font-semibold">
                        latest
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(v.created_at).toLocaleString()}
                    {v.profiles && ` · ${v.profiles.full_name || v.profiles.email}`}
                  </p>
                </div>
                <button
                  className="btn-ghost !px-3 !py-1 !text-xs"
                  onClick={() => {
                    const w = window.open("", "_blank");
                    if (w) {
                      w.document.write(v.html_content);
                      w.document.close();
                    }
                  }}
                >
                  View
                </button>
                {canEdit && i > 0 && (
                  <button
                    className="btn-primary !px-3 !py-1 !text-xs"
                    onClick={() =>
                      confirm("Restore this version? The current state is saved as a new version first.") &&
                      onRestore({
                        patches: v.patches ?? [],
                        label: v.label || new Date(v.created_at).toLocaleString(),
                      })
                    }
                  >
                    Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
