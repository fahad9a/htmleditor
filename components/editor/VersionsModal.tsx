"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VersionRow } from "@/lib/types";

interface Props {
  documentId: string;
  canEdit: boolean;
  onRestore: (html: string, label: string) => void;
  onClose: () => void;
}

export default function VersionsModal({ documentId, canEdit, onRestore, onClose }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("document_versions")
      .select("id, label, created_at, created_by, html_content, profiles:created_by(id, email, full_name, avatar_url)")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setVersions((data as unknown as VersionRow[]) ?? []);
        setLoading(false);
      });
  }, [documentId, supabase]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Version history</h2>
          <button className="text-gray-400 hover:text-gray-900" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-gray-400">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="mt-6 text-sm text-gray-400">No saved versions yet. Press Save to create one.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {versions.map((v) => (
              <li key={v.id} className="py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{v.label || "Version"}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(v.created_at).toLocaleString()}
                    {v.profiles && ` · ${v.profiles.full_name || v.profiles.email}`}
                  </p>
                </div>
                <button
                  className="btn-ghost !px-3 !py-1 text-xs"
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
                {canEdit && (
                  <button
                    className="btn-primary !px-3 !py-1 text-xs"
                    onClick={() =>
                      confirm("Restore this version? Current content will be saved as a new version first.") &&
                      onRestore(v.html_content, v.label || new Date(v.created_at).toLocaleString())
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
