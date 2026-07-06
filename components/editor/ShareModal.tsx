"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { initials, userColor } from "@/lib/colors";
import type { Member, Profile, Role } from "@/lib/types";

interface Props {
  projectId: string;
  initialMembers: Member[];
  me: Profile;
  myRole: Role;
  onClose: () => void;
}

export default function ShareModal({ projectId, initialMembers, me, myRole, onClose }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isOwner = myRole === "owner";

  async function refresh() {
    const { data } = await supabase
      .from("project_members")
      .select("user_id, role, profiles(id, email, full_name, avatar_url)")
      .eq("project_id", projectId);
    if (data) setMembers(data as unknown as Member[]);
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    // Find the profile for this email — the colleague must have an account.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (!profile) {
      setBusy(false);
      return setError("No account found with that email. Ask them to sign up first.");
    }
    if (members.some((m) => m.user_id === profile.id)) {
      setBusy(false);
      return setError("That person is already a member.");
    }
    const { error: iErr } = await supabase.from("project_members").insert({
      project_id: projectId,
      user_id: profile.id,
      role,
      invited_by: me.id,
    });
    if (iErr) {
      setBusy(false);
      return setError(iErr.message);
    }
    await supabase.from("activity_log").insert({
      project_id: projectId,
      user_id: me.id,
      action: "invited",
      details: { email, role },
    });
    setEmail("");
    setBusy(false);
    refresh();
  }

  async function changeRole(userId: string, newRole: Role) {
    await supabase
      .from("project_members")
      .update({ role: newRole })
      .eq("project_id", projectId)
      .eq("user_id", userId);
    refresh();
  }

  async function removeMember(userId: string) {
    await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);
    refresh();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="w-full max-w-md card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">Share project</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {isOwner && (
          <form onSubmit={invite} className="mt-4 flex gap-2">
            <input
              className="input flex-1"
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <select className="input !w-28" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="btn-primary" disabled={busy}>Invite</button>
          </form>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <ul className="mt-5 space-y-2">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: userColor(m.user_id) }}
              >
                {initials(m.profiles?.full_name ?? "", m.profiles?.email ?? "")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {m.profiles?.full_name || m.profiles?.email}
                  {m.user_id === me.id && <span className="text-gray-400"> (you)</span>}
                </p>
                <p className="text-xs text-gray-400 truncate">{m.profiles?.email}</p>
              </div>
              {isOwner && m.role !== "owner" ? (
                <>
                  <select
                    className="input !w-24 !py-1 !text-xs"
                    value={m.role}
                    onChange={(e) => changeRole(m.user_id, e.target.value as Role)}
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    className="text-gray-400 hover:text-red-600 text-sm"
                    title="Remove"
                    onClick={() => removeMember(m.user_id)}
                  >
                    ✕
                  </button>
                </>
              ) : (
                <span className="text-[10px] uppercase tracking-wide rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">
                  {m.role}
                </span>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-5 text-xs text-gray-400">
          Editors can change the document. Viewers can open and preview it.
        </p>
      </div>
    </div>
  );
}
