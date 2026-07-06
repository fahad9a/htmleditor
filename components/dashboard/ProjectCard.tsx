"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface ProjectCardData {
  projectId: string;
  docId: string | null;
  name: string;
  docTitle: string;
  role: string;
  updatedAt: string | null;
  isOwner: boolean;
}

export default function ProjectCard({ p }: { p: ProjectCardData }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function rename() {
    const name = prompt("Project name", p.name);
    if (!name || name === p.name) return;
    await supabase.from("projects").update({ name }).eq("id", p.projectId);
    router.refresh();
  }

  async function duplicate() {
    setBusy(true);
    const { data: user } = await supabase.auth.getUser();
    const uid = user.user?.id;
    const { data: doc } = await supabase
      .from("documents")
      .select("title, html_content, patches, transitions")
      .eq("project_id", p.projectId)
      .limit(1)
      .single();
    const { data: proj } = await supabase
      .from("projects")
      .insert({ owner_id: uid, name: `${p.name} (copy)` })
      .select("id")
      .single();
    if (doc && proj) {
      await supabase.from("documents").insert({
        project_id: proj.id,
        title: doc.title,
        html_content: doc.html_content,
        patches: doc.patches,
        transitions: doc.transitions,
        updated_by: uid,
      });
    }
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete "${p.name}" permanently? This cannot be undone.`)) return;
    await supabase.from("projects").delete().eq("id", p.projectId);
    router.refresh();
  }

  async function leave() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    if (!confirm(`Leave "${p.name}"?`)) return;
    await supabase
      .from("project_members")
      .delete()
      .eq("project_id", p.projectId)
      .eq("user_id", user.user.id);
    router.refresh();
  }

  // Deterministic per-project accent so the dashboard feels colorful but stable.
  const GRADS = [
    "from-violet-500 to-fuchsia-500",
    "from-fuchsia-500 to-pink-500",
    "from-amber-500 to-orange-500",
    "from-emerald-500 to-teal-500",
    "from-sky-500 to-indigo-500",
    "from-rose-500 to-red-500",
  ];
  let h = 0;
  for (let i = 0; i < p.projectId.length; i++) h = (h * 31 + p.projectId.charCodeAt(i)) >>> 0;
  const grad = GRADS[h % GRADS.length];

  return (
    <div
      className={`card overflow-hidden p-0 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-100 transition-all duration-300 relative ${busy ? "opacity-50" : ""}`}
    >
      <div className={`h-1.5 bg-gradient-to-r ${grad}`} />
      <div className="p-5">
      <div className="flex items-start justify-between gap-2">
        <Link href={p.docId ? `/editor/${p.docId}` : "#"} className="min-w-0 flex-1">
          <h3 className="font-semibold truncate text-slate-900">{p.name}</h3>
          <p className="mt-0.5 text-sm text-slate-400 truncate">{p.docTitle}</p>
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] uppercase tracking-wide rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 font-semibold">
            {p.role}
          </span>
          <div className="relative">
            <button className="btn-icon !h-7 !w-7" onClick={() => setMenuOpen(!menuOpen)} aria-label="Project menu">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-slate-200 bg-white shadow-xl py-1 text-sm z-20"
                onMouseLeave={() => setMenuOpen(false)}
              >
                {p.isOwner ? (
                  <>
                    <button className="w-full text-left px-4 py-2 hover:bg-slate-50" onClick={rename}>Rename</button>
                    <button className="w-full text-left px-4 py-2 hover:bg-slate-50" onClick={duplicate}>Duplicate</button>
                    <button className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600" onClick={remove}>Delete</button>
                  </>
                ) : (
                  <button className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600" onClick={leave}>Leave project</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <Link href={p.docId ? `/editor/${p.docId}` : "#"} className="block mt-4">
        <p className="text-xs text-slate-400">
          Edited {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "—"}
        </p>
      </Link>
      </div>
    </div>
  );
}
