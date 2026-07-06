"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CommentRow, Profile, Role, SelectedEl } from "@/lib/types";
import { initials, userColor } from "@/lib/colors";

interface Props {
  comments: CommentRow[];
  me: Profile;
  myRole: Role;
  selected: SelectedEl | null;
  focusElementId: string | null;
  onAdd: (body: string, elementId: string | null, parentId: string | null) => Promise<void>;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onJump: (elementId: string) => void;
}

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function Avatar({ p }: { p?: Profile | null }) {
  const name = p?.full_name || p?.email || "?";
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm"
      style={{ backgroundColor: p ? userColor(p.id) : "#94a3b8" }}
      title={name}
    >
      {initials(p?.full_name ?? "", p?.email ?? "?")}
    </span>
  );
}

export default function CommentsPanel({
  comments,
  me,
  myRole,
  selected,
  focusElementId,
  onAdd,
  onResolve,
  onDelete,
  onJump,
}: Props) {
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const threads = useMemo(() => {
    const roots = comments.filter((c) => !c.parent_id);
    const replies = new Map<string, CommentRow[]>();
    for (const c of comments) {
      if (!c.parent_id) continue;
      const arr = replies.get(c.parent_id) ?? [];
      arr.push(c);
      replies.set(c.parent_id, arr);
    }
    return roots
      .filter((r) => (tab === "open" ? !r.resolved : r.resolved))
      .map((r) => ({ root: r, replies: replies.get(r.id) ?? [] }));
  }, [comments, tab]);

  const openCount = comments.filter((c) => !c.parent_id && !c.resolved).length;
  const resolvedCount = comments.filter((c) => !c.parent_id && c.resolved).length;

  // When a pin in the document is clicked, scroll its thread into view.
  useEffect(() => {
    if (!focusElementId) return;
    setTab("open");
    const el = listRef.current?.querySelector(`[data-thread-el="${focusElementId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusElementId]);

  async function submit() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    await onAdd(body, selected?.id ?? null, null);
    setDraft("");
    setBusy(false);
  }

  async function submitReply(parentId: string, elementId: string | null) {
    const body = replyDraft.trim();
    if (!body || busy) return;
    setBusy(true);
    await onAdd(body, elementId, parentId);
    setReplyDraft("");
    setReplyTo(null);
    setBusy(false);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* composer */}
      <div className="p-3 border-b border-slate-100">
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 mb-1.5">
            <span>📍</span>
            {selected ? (
              <span>
                Commenting on <code className="rounded bg-amber-100 px-1 py-0.5">&lt;{selected.tag}&gt;</code>
              </span>
            ) : (
              <span>Commenting on the whole document</span>
            )}
          </div>
          <textarea
            className="input !text-sm min-h-[60px] !border-amber-200 focus:!border-amber-400 focus:!ring-amber-400/20"
            placeholder={selected ? "Add a comment on this element…" : "Select an element first, or comment on the document…"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
            }}
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-amber-600/70">Ctrl+Enter to send</span>
            <button
              className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:brightness-110 disabled:opacity-40 transition-all"
              disabled={!draft.trim() || busy}
              onClick={submit}
            >
              Comment
            </button>
          </div>
        </div>
      </div>

      {/* open / resolved tabs */}
      <div className="flex gap-1 px-3 pt-2.5 pb-1 text-xs font-semibold">
        {(
          [
            ["open", `Open (${openCount})`],
            ["resolved", `Resolved (${resolvedCount})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`rounded-full px-3 py-1 transition-colors ${
              tab === key ? "bg-amber-100 text-amber-800" : "text-slate-400 hover:text-slate-600"
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* thread list */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 pb-4 space-y-2.5 pt-1.5">
        {threads.length === 0 && (
          <div className="text-center py-10">
            <p className="text-3xl">💬</p>
            <p className="mt-2 text-sm font-medium text-slate-500">
              {tab === "open" ? "No open comments" : "Nothing resolved yet"}
            </p>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed px-4">
              Select an element in the document and leave a note for your team.
            </p>
          </div>
        )}

        {threads.map(({ root, replies }) => {
          const canModerate = myRole === "owner" || root.author_id === me.id;
          const isFocused = focusElementId && root.element_id === focusElementId;
          return (
            <div
              key={root.id}
              data-thread-el={root.element_id ?? ""}
              className={`rounded-xl border p-3 transition-all ${
                isFocused
                  ? "border-amber-400 bg-amber-50/70 shadow-md shadow-amber-100"
                  : "border-slate-200 bg-white hover:border-slate-300"
              } ${root.resolved ? "opacity-70" : ""}`}
            >
              <div className="flex items-start gap-2">
                <Avatar p={root.profiles} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {root.profiles?.full_name || root.profiles?.email || "Someone"}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(root.created_at)}</span>
                  </div>
                  {root.element_id && (
                    <button
                      className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                      onClick={() => onJump(root.element_id!)}
                      title="Jump to this element in the document"
                    >
                      📍 Show in document
                    </button>
                  )}
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">{root.body}</p>
                </div>
              </div>

              {replies.map((r) => (
                <div key={r.id} className="mt-2 ml-6 flex items-start gap-2 border-l-2 border-slate-100 pl-2.5">
                  <Avatar p={r.profiles} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {r.profiles?.full_name || r.profiles?.email || "Someone"}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-700 whitespace-pre-wrap break-words">{r.body}</p>
                  </div>
                  {(myRole === "owner" || r.author_id === me.id) && (
                    <button
                      className="text-slate-300 hover:text-red-500 text-xs transition-colors"
                      title="Delete reply"
                      onClick={() => onDelete(r.id)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              {replyTo === root.id ? (
                <div className="mt-2 ml-6">
                  <textarea
                    autoFocus
                    className="input !text-sm min-h-[48px]"
                    placeholder="Reply…"
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submitReply(root.id, root.element_id);
                      if (e.key === "Escape") setReplyTo(null);
                    }}
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
                      disabled={!replyDraft.trim() || busy}
                      onClick={() => submitReply(root.id, root.element_id)}
                    >
                      Reply
                    </button>
                    <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => setReplyTo(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold">
                  <button
                    className="text-slate-400 hover:text-slate-700 transition-colors"
                    onClick={() => {
                      setReplyTo(root.id);
                      setReplyDraft("");
                    }}
                  >
                    ↩ Reply
                  </button>
                  <button
                    className={`transition-colors ${
                      root.resolved ? "text-slate-400 hover:text-slate-700" : "text-emerald-600 hover:text-emerald-700"
                    }`}
                    onClick={() => onResolve(root.id, !root.resolved)}
                  >
                    {root.resolved ? "↺ Reopen" : "✓ Resolve"}
                  </button>
                  {canModerate && (
                    <button
                      className="text-slate-300 hover:text-red-500 ml-auto transition-colors"
                      onClick={() => onDelete(root.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
