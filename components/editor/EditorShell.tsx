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

const AUTOSAVE_MS = 1500;

export default function EditorShell({ document: doc, projectId, projectName, members, me, myRole }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const canEdit = myRole === "owner" || myRole === "editor";
  const token = useMemo(() => makeToken(), []);

  // ---- document state ----
  const [html, setHtml] = useState(doc.html_content);
  const [srcDoc, setSrcDoc] = useState(() => injectEditorRuntime(doc.html_content, token));
  const [transitions, setTransitions] = useState<TransitionCfg>(doc.transitions);
  const [slides, setSlides] = useState<SlideInfo[]>([]);
  const [selected, setSelected] = useState<SelectedEl | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<{ at: string; name: string } | null>(
    doc.updated_by ? { at: doc.updated_at, name: "" } : null
  );
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [toast, setToast] = useState("");

  // ---- refs for use inside stable callbacks ----
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const htmlRef = useRef(html);
  const dirtyRef = useRef(false);
  const transitionsRef = useRef(transitions);
  const scrollYRef = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reqsRef = useRef(new Map<string, (h: string) => void>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const remoteSelsRef = useRef<{ id: string; color: string }[]>([]);

  htmlRef.current = html;
  transitionsRef.current = transitions;

  const postToFrame = useCallback(
    (msg: Record<string, unknown>) => {
      iframeRef.current?.contentWindow?.postMessage({ ...msg, token }, "*");
    },
    [token]
  );

  // Ask the iframe for the current, cleaned HTML.
  const getHtml = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const reqId = Math.random().toString(36).slice(2);
      const timeout = setTimeout(() => {
        reqsRef.current.delete(reqId);
        resolve(htmlRef.current); // fallback: last known state
      }, 3000);
      reqsRef.current.set(reqId, (h) => {
        clearTimeout(timeout);
        resolve(h);
      });
      postToFrame({ t: "getHtml", reqId });
    });
  }, [postToFrame]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  // ---- saving ----
  const doSave = useCallback(
    async (withVersion: boolean, label = "") => {
      if (!canEdit) return;
      setSaving(true);
      const fresh = await getHtml();
      setHtml(fresh);
      htmlRef.current = fresh;
      const { error } = await supabase
        .from("documents")
        .update({
          html_content: fresh,
          transitions: transitionsRef.current,
          updated_at: new Date().toISOString(),
          updated_by: me.id,
        })
        .eq("id", doc.id);
      if (!error) {
        if (withVersion) {
          await supabase.from("document_versions").insert({
            document_id: doc.id,
            html_content: fresh,
            label: label || "Manual save",
            created_by: me.id,
          });
          await supabase.from("activity_log").insert({
            project_id: projectId,
            user_id: me.id,
            action: "saved_version",
            details: { label },
          });
        }
        setDirty(false);
        dirtyRef.current = false;
        setLastSaved({ at: new Date().toISOString(), name: me.full_name || me.email });
        // Tell collaborators to refetch (payload stays tiny — html lives in the DB).
        channelRef.current?.send({
          type: "broadcast",
          event: "saved",
          payload: { by: me.id, name: me.full_name || me.email },
        });
      } else {
        showToast(`Save failed: ${error.message}`);
      }
      setSaving(false);
    },
    [canEdit, doc.id, getHtml, me, projectId, showToast, supabase]
  );

  const scheduleAutosave = useCallback(() => {
    if (!canEdit) return;
    setDirty(true);
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(false), AUTOSAVE_MS);
  }, [canEdit, doSave]);

  // Apply HTML arriving from a collaborator (reloads the sandboxed iframe).
  const applyRemoteHtml = useCallback(
    (remoteHtml: string, remoteTransitions?: TransitionCfg) => {
      setHtml(remoteHtml);
      htmlRef.current = remoteHtml;
      if (remoteTransitions) setTransitions(remoteTransitions);
      setSrcDoc(injectEditorRuntime(remoteHtml, token));
    },
    [token]
  );

  // ---- messages from the iframe ----
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const m = e.data;
      if (!m || m.token !== token) return;
      switch (m.t) {
        case "ready":
          // restore scroll + remote selections after a reload
          if (scrollYRef.current) postToFrame({ t: "scrollTo", y: scrollYRef.current });
          if (remoteSelsRef.current.length)
            postToFrame({ t: "remoteSel", sels: remoteSelsRef.current });
          break;
        case "slides":
          setSlides(m.slides ?? []);
          break;
        case "selected":
          setSelected(m.el ?? null);
          selectedIdRef.current = m.el?.id ?? null;
          channelRef.current?.track({
            name: me.full_name || me.email,
            color: userColor(me.id),
            selectedId: m.el?.id ?? null,
          });
          break;
        case "changed":
          scheduleAutosave();
          break;
        case "html": {
          const resolve = reqsRef.current.get(m.reqId);
          if (resolve) {
            reqsRef.current.delete(m.reqId);
            resolve(m.html);
          }
          break;
        }
        case "scroll":
          scrollYRef.current = m.y ?? 0;
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [me, postToFrame, scheduleAutosave, token]);

  // ---- realtime: presence + save notifications ----
  useEffect(() => {
    const channel = supabase.channel(`doc:${doc.id}`, {
      config: { presence: { key: me.id } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{
          name: string;
          color: string;
          selectedId: string | null;
        }>();
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
      .on("broadcast", { event: "saved" }, async ({ payload }) => {
        if (payload.by === me.id) return;
        setLastSaved({ at: new Date().toISOString(), name: payload.name });
        if (dirtyRef.current) {
          // We have unsaved local edits — last write wins; ours saves shortly.
          showToast(`${payload.name} saved changes (yours will overwrite)`);
          return;
        }
        const { data } = await supabase
          .from("documents")
          .select("html_content, transitions")
          .eq("id", doc.id)
          .single();
        if (data) {
          applyRemoteHtml(data.html_content, data.transitions);
          showToast(`Updated by ${payload.name}`);
        }
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
  }, [applyRemoteHtml, doc.id, me, postToFrame, showToast, supabase]);

  // Warn before closing with unsaved changes.
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (dirtyRef.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  // ---- edit operations (forwarded to the iframe) ----
  const ops = useMemo(
    () => ({
      style: (prop: string, value: string) =>
        selected && postToFrame({ t: "style", id: selected.id, prop, value }),
      text: (value: string) => selected && postToFrame({ t: "text", id: selected.id, value }),
      attr: (name: string, value: string) =>
        selected && postToFrame({ t: "attr", id: selected.id, name, value }),
      hide: () => selected && postToFrame({ t: "hide", id: selected.id }),
      remove: () => selected && postToFrame({ t: "remove", id: selected.id }),
      slide: (op: string, id?: string, name?: string) =>
        postToFrame({ t: "slide", op, id, name }),
      focusSlide: (id: string) => postToFrame({ t: "focusSlide", id }),
    }),
    [postToFrame, selected]
  );

  // ---- export ----
  const exportHtml = useCallback(async () => {
    const fresh = await getHtml();
    const blob = new Blob([fresh], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.title || "document"}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [doc.title, getHtml]);

  const exportZip = useCallback(async () => {
    const fresh = await getHtml();
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("index.html", fresh);
    zip.file(
      "README.txt",
      "Exported from ReportCanvas. Open index.html in any browser.\n"
    );
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.title || "document"}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [doc.title, getHtml]);

  const exportPdf = useCallback(async () => {
    // Practical V1 approach: open a print window — users pick "Save as PDF".
    const fresh = await getHtml();
    const w = window.open("", "_blank");
    if (!w) return showToast("Pop-up blocked — allow pop-ups to export PDF");
    w.document.write(fresh);
    w.document.close();
    setTimeout(() => w.print(), 600);
  }, [getHtml, showToast]);

  const restoreVersion = useCallback(
    async (versionHtml: string, label: string) => {
      applyRemoteHtml(versionHtml);
      setDirty(true);
      dirtyRef.current = true;
      await doSave(true, `Restored: ${label}`);
      setVersionsOpen(false);
      showToast("Version restored");
    },
    [applyRemoteHtml, doSave, showToast]
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
    <div className="h-screen flex flex-col bg-gray-100">
      <TopBar
        docId={doc.id}
        title={projectName}
        dirty={dirty}
        saving={saving}
        lastSaved={lastSaved}
        collaborators={collaborators}
        canEdit={canEdit}
        myRole={myRole}
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

        <div className="flex-1 min-w-0 p-4">
          <iframe
            ref={iframeRef}
            // allow-scripts only: opaque origin, cannot touch our app/session.
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            className="w-full h-full rounded-xl border border-gray-300 bg-white shadow-sm"
            title="Document editor"
          />
        </div>

        <InspectorPanel selected={selected} canEdit={canEdit} ops={ops} />
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-gray-900 text-white text-sm px-4 py-2 shadow-lg z-50">
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
