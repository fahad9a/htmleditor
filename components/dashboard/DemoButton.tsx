"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEMO_HTML, DEMO_TITLE } from "@/lib/demo";

// Creates a ready-made sample presentation so users can try the editor
// without uploading anything.
export default function DemoButton() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function createDemo() {
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return router.push("/login");

    const { data: proj } = await supabase
      .from("projects")
      .insert({ owner_id: uid, name: DEMO_TITLE })
      .select("id")
      .single();
    if (!proj) return setBusy(false);

    const { data: doc } = await supabase
      .from("documents")
      .insert({
        project_id: proj.id,
        title: DEMO_TITLE,
        html_content: DEMO_HTML,
        updated_by: uid,
      })
      .select("id")
      .single();
    if (!doc) return setBusy(false);

    await supabase.from("document_versions").insert({
      document_id: doc.id,
      html_content: DEMO_HTML,
      label: "Initial (sample)",
      created_by: uid,
    });
    router.push(`/editor/${doc.id}`);
  }

  return (
    <button className="btn-ghost" onClick={createDemo} disabled={busy}>
      {busy ? "Creating…" : "✨ Try a sample"}
    </button>
  );
}
