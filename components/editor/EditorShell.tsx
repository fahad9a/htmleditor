"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { injectEditorRuntime, makeToken } from "@/lib/editorRuntime";
import { userColor } from "@/lib/colors";
import type {
  Collaborator,
  DocumentRow,
  Member,
  PatchOp,
  Profile,
  Role,
  SelectedEl,
  SlideInfo,
  TransitionCfg,
} from "@/lib/types";
import TopBar from "./TopBar";
import SlidesSidebar from "./SlidesSidebar";
import InspectorPanel from "./InspectorPanel";
import ShareModal from "./ShareModal";
import VersionsModal from "./VersionsModal";

interface Props {
  document: DocumentRow;
  projectId: string;
  projectName: string;
  members: Member[];
  me: Profile;
  myRole: Role;
}

interface UndoEntry {
  op: PatchOp;
  inverse: PatchOp;
  at: number;
}

const AUTOSAVE_MS = 1200;

/**
 * Editing model: the uploaded HTML is immutable. Every change is a small op
 * applied in the iframe, appended to a patch log, broadcast to collaborators
 * live (no reload), and autosaved as compact JSON. Undo/redo replays inverse
 * ops. See lib/editorRuntime.ts for the iframe side.
 */
export default function EditorShell({ document: doc, projectId, projectName, members, me, myRole }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const canEdit = myRole === "owner" || myRole === "editor";
  const token = useMemo(() => makeToken(), []);
  const srcDoc = useMemo(() => injectEditorRuntime(doc.html_content, token), [doc.html_content, token]);

  const [transitions, setTransitions] = useState<TransitionCfg>(doc.transitions);
  const [slides, setSlides] = useState<SlideInfo[]>([]);
  const [selected, setSelected] = useState<SelectedEl | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [booted, setBooted] = useState(false);
  const [lastSaved, setLastSaved] = useState<{ at: string; name: string } | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [shareOpen, setShareOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [toast, setToast] = useState("");

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const patchesRef = useRef<PatchOp[]>(doc.patches ?? []);
  const undoRef = useRef<UndoEntry[]>([]);
  const redoRef = useRef<UndoEntry[]>([]);
  const dirtyRef = useRef(false);
  const transitionsRef = useRef(transitions);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reqsRef = useRef(new Map<string, (h: string) => void>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteSelsRef = useRef<{ id: string; color: string }[]>([]);

  transitionsRef.current = transitions;

  const postToFrame = useCallback(
    (msg: Record<string, unknown>) => {
      iframeRef.current?.contentWindow?.postMessage({ ...msg, token }, "*");
    },
    [token]
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }, []);

  // ---- saving (compact patch log, not the document) ----
  const doSave = useCallback(
    async (withVersion: boolean, label = "") => {
      if (!canEdit) return;
      setSaving(true);
      const { error } = await supabase
        .from("documents")
        .update({
          patches: patchesRef.current,
          transitions: transitionsRef.current,
          updated_at: new Date().toISOString(),
          updated_by: me.id,
        })
        .eq("id", doc.id);
      if (!error) {
        if (withVersion) {
          const snapshot = await getHtml(false);
          await supabase.from("document_versions").insert({
            document_id: doc.id,
            html_content: snapshot,
            patches: patchesRef.current,
            label: label || "Manual save",
            created_by: me.id,
          });
        }
        setDirty(false);
        dirtyRef.current = false;
        setLastSaved({ at: new Date().toISOString(), name: me.full_name || me.email });
      } else {
        showToast(`Save failed: ${error.message}`);
      }
      setSaving(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, doc.id, me, showToast, supabase]
  );

  const scheduleAutosave = useCallback(() => {
    if (!canEdit) return;
    setDirty(true);
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(false), AUTOSAVE_MS);
  }, [canEdit, doSave]);

  const getHtml = useCallback(
    (print: boolean): Promise<string> => {
      return new Promise((resolve) => {
        const reqId = Math.random().toString(36).slice(2);
        const timeout = setTimeout(() => {
          reqsRef.current.delete(reqId);
          resolve(doc.html_content);
        }, 5000);
        reqsRef.current.set(reqId, (h) => {
          clearTimeout(timeout);
          resolve(h);
        });
        postToFrame({ t: "getHtml", reqId, print });
      });
    },
    [doc.html_content, postToFrame]
  );

  // Append an op to the patch log, coalescing repeated edits of the same
  // property (typing, color dragging) into one entry.
  const appendPatch = useCallback((op: PatchOp) => {
    const log = patchesRef.current;
    const last = log[log.length - 1];
    if (
      last &&
      last.op === op.op &&
      last.id === op.id &&
      ((op.op === "style" && last.prop === op.prop) ||
        op.op === "text" ||
        (op.op === "attr" && last.name === op.name))
    ) {
      log[log.length - 1] = op;
    } else {
      log.push(op);
    }
  }, []);

  // ---- send an op to the iframe (the single edit entry point) ----
  const sendOp = useCallback(
    (op: PatchOp, meta: Record<string, unknown> = {}) => {
      if (!canEdit && !meta.remote) return;
      postToFrame({ t: "op", o: op, meta });
    },
    [canEdit, postToFrame]
  );

  const undo = useCallback(() => {
    const entry = undoRef.current.pop();
    setCanUndo(undoRef.current.length > 0);
    if (!entry) return;
    redoRef.current.push(entry);
    setCanRedo(true);
    sendOp(entry.inverse, { history: true });
  }, [sendOp]);

  const redo = useCallback(() => {
    const entry = redoRef.current.pop();
    setCanRedo(redoRef.current.length > 0);
    if (!entry) return;
    undoRef.current.push(entry);
    setCanUndo(true);
    sendOp(entry.op, { history: true });
  }, [sendOp]);

  // ---- messages from the iframe ----
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const m = e.data;
      if (!m || m.token !== token) return;
      switch (m.t) {
        case "ready":
          postToFrame({ t: "init", patches: patchesRef.current, canEdit });
          break;
        case "inited":
          setBooted(true);
          if (remoteSelsRef.current.length)
            postToFrame({ t: "remoteSel", sels: remoteSelsRef.current });
          break;
        case "slides":
          setSlides(m.slides ?? []);
          break;
        case "selected":
          setSelected(m.el ?? null);
          channelRef.current?.track({
            name: me.full_name || me.email,
            color: userColor(me.id),
            selectedId: m.el?.id ?? null,
          });
          break;
        case "applied": {
          const { op, inverse, meta } = m as { op: PatchOp; inverse: PatchOp; meta: Record<string, unknown> };
          if (meta?.remote) {
            // A collaborator's edit — record it, don't rebroadcast or undo-track.
            appendPatch(op);
            return;
          }
          appendPatch(op);
          if (!meta?.history) {
            // merge rapid edits of the same target into one undo step
            const lastU = undoRef.current[undoRef.current.length - 1];
            if (
              lastU &&
              Date.now() - lastU.at < 900 &&
              lastU.op.op === op.op &&
              lastU.op.id === op.id &&
              (op.op !== "style" || lastU.op.prop === op.prop) &&
              (op.op !== "attr" || lastU.op.name === op.name)
            ) {
              lastU.op = op;
              lastU.at = Date.now();
            } else {
              undoRef.current.push({ op, inverse, at: Date.now() });
              if (undoRef.current.length > 200) undoRef.current.shift();
            }
            redoRef.current = [];
            setCanRedo(false);
            setCanUndo(true);
          }
          channelRef.current?.send({
            type: "broadcast",
            event: "op",
            payload: { by: me.id, op },
          });
          scheduleAutosave();
          break;
        }
        case "html": {
          const resolve = reqsRef.current.get(m.reqId);
          if (resolve) {
            reqsRef.current.delete(m.reqId);
            resolve(m.html);
          }
          break;
        }
        case "key":
          if (m.k === "s") doSave(true);
          else if (m.k === "z" && m.shift) redo();
          else if (m.k === "z") undo();
          else if (m.k === "y") redo();
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [appendPatch, canEdit, doSave, me, postToFrame, redo, scheduleAutosave, token, undo]);

  // ---- realtime: presence + live ops ----
  useEffect(() => {
    const channel = supabase.channel(`doc:${doc.id}`, {
      config: { presence: { key: me.id } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ name: string; color: string; selectedId: string | null }>();
        const others: Collaborator[] = Object.entries(state)
          .filter(([key]) => key !== me.id)
          .map(([key, metas]) => ({
            key,
            name: metas[0]?.name ?? "Someone",
            color: metas[0]?.color ?? "#888",
            selectedId: metas[0]?.selectedId ?? null,
          }));
        setCollaborators(others);
        const sels = others
          .filter((c) => c.selectedId)
          .map((c) => ({ id: c.selectedId!, color: c.color }));
        remoteSelsRef.current = sels;
        postToFrame({ t: "remoteSel", sels });
      })
      .on("broadcast", { event: "op" }, ({ payload }) => {
        if (payload.by === me.id) return;
        // Apply the collaborator's edit directly — no reload, no flicker.
        postToFrame({ t: "op", o: payload.op, meta: { remote: true } });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            name: me.full_name || me.email,
            color: userColor(me.id),
            selectedId: null,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [doc.id, me, postToFrame, supabase]);

  // parent-window keyboard shortcuts (iframe forwards its own)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (k === "s") { e.preventDefault(); doSave(true); }
      else if (k === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      else if (k === "z") { e.preventDefault(); undo(); }
      else if (k === "y") { e.preventDefault(); redo(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSave, redo, undo]);

  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (dirtyRef.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  // ---- edit operations (used by inspector + sidebar) ----
  const ops = useMemo(
    () => ({
      style: (prop: string, value: string) =>
        selected && sendOp({ op: "style", id: selected.id, prop, value }),
      text: (value: string) => selected && sendOp({ op: "text", id: selected.id, value }),
      attr: (name: string, value: string) =>
        selected && sendOp({ op: "attr", id: selected.id, name, value }),
      hide: () => selected && sendOp({ op: "hide", id: selected.id, on: !selected.hidden }),
      remove: () => selected && sendOp({ op: "remove", id: selected.id }),
      slide: (sub: PatchOp["sub"], id?: string, name?: string) => {
        if (sub === "del" && id) sendOp({ op: "remove", id });
        else if (sub === "mark" && id)
          sendOp({ op: "slide", sub: "mark", id, on: !slides.some((s) => s.id === id) });
        else sendOp({ op: "slide", sub, id, name });
      },
      selectEl: (id: string) => postToFrame({ t: "select", id }),
      focusSlide: (id: string) => postToFrame({ t: "focusSlide", id }),
    }),
    [postToFrame, selected, sendOp, slides]
  );

  // ---- export ----
  const download = useCallback((data: Blob, filename: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(data);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  const exportHtml = useCallback(async () => {
    const fresh = await getHtml(false);
    download(new Blob([fresh], { type: "text/html" }), `${doc.title || "document"}.html`);
    showToast("HTML exported");
  }, [doc.title, download, getHtml, showToast]);

  const exportZip = useCallback(async () => {
    const fresh = await getHtml(false);
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("index.html", fresh);
    zip.file("README.txt", "Exported from ReportCanvas. Open index.html in any browser.\n");
    download(await zip.generateAsync({ type: "blob" }), `${doc.title || "document"}.zip`);
    showToast("ZIP exported");
  }, [doc.title, download, getHtml, showToast]);

  const exportPdf = useCallback(async () => {
    // Print-safe snapshot: charts frozen to images, scripts removed.
    const fresh = await getHtml(true);
    const w = window.open("", "_blank");
    if (!w) return showToast("Pop-up blocked — allow pop-ups to export PDF");
    w.document.write(fresh);
    w.document.close();
    setTimeout(() => w.print(), 700);
  }, [getHtml, showToast]);

  const restoreVersion = useCallback(
    async (version: { patches: PatchOp[]; label: string }) => {
      patchesRef.current = version.patches ?? [];
      undoRef.current = [];
      redoRef.current = [];
      setCanUndo(false);
      setCanRedo(false);
      await doSave(true, `Restored: ${version.label}`);
      setVersionsOpen(false);
      // reload the iframe so the restored patch set replays cleanly
      window.location.reload();
    },
    [doSave]
  );

  const onTransitionsChange = useCallback(
    (cfg: TransitionCfg) => {
      setTransitions(cfg);
      transitionsRef.current = cfg;
      scheduleAutosave();
    },
    [scheduleAutosave]
  );

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <TopBar
        docId={doc.id}
        title={projectName}
        dirty={dirty}
        saving={saving}
        lastSaved={lastSaved}
        collaborators={collaborators}
        canEdit={canEdit}
        myRole={myRole}
        canUndo={canUndo}
        canRedo={canRedo}
        zoom={zoom}
        onZoom={setZoom}
        onUndo={undo}
        onRedo={redo}
        onSave={() => doSave(true)}
        onShare={() => setShareOpen(true)}
        onVersions={() => setVersionsOpen(true)}
        onExportHtml={exportHtml}
        onExportZip={exportZip}
        onExportPdf={exportPdf}
      />

      <div className="flex-1 flex min-h-0">
        <SlidesSidebar
          slides={slides}
          selectedId={selected?.id ?? null}
          canEdit={canEdit}
          transitions={transitions}
          onTransitionsChange={onTransitionsChange}
          ops={ops}
        />

        <div className="flex-1 min-w-0 p-4 overflow-auto relative">
          {!booted && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-3 shadow-lg border border-slate-200">
                <span className="h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <span className="text-sm text-slate-600">Loading document…</span>
              </div>
            </div>
          )}
          <div
            style={{
              width: `${10000 / zoom}%`,
              height: `${10000 / zoom}%`,
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top left",
            }}
          >
            <iframe
              ref={iframeRef}
              // allow-scripts only: opaque origin — uploaded code can't touch the app.
              sandbox="allow-scripts"
              srcDoc={srcDoc}
              className="w-full h-full rounded-xl border border-slate-300 bg-white shadow-sm"
              title="Document editor"
            />
          </div>
        </div>

        <InspectorPanel selected={selected} canEdit={canEdit} ops={ops} />
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-slate-900 text-white text-sm px-4 py-2.5 shadow-xl z-50">
          {toast}
        </div>
      )}

      {shareOpen && (
        <ShareModal
          projectId={projectId}
          initialMembers={members}
          me={me}
          myRole={myRole}
          onClose={() => setShareOpen(false)}
        />
      )}
      {versionsOpen && (
        <VersionsModal
          documentId={doc.id}
          canEdit={canEdit}
          onRestore={restoreVersion}
          onClose={() => setVersionsOpen(false)}
        />
      )}
    </div>
  );
}
