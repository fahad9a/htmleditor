import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditorShell from "@/components/editor/EditorShell";
import type { DocumentRow, Member, Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware redirects

  // RLS guarantees this only returns documents the user can access.
  const { data: doc } = await supabase
    .from("documents")
    .select("*, projects(id, name, owner_id)")
    .eq("id", id)
    .single();
  if (!doc) notFound();

  const { data: members } = await supabase
    .from("project_members")
    .select("user_id, role, profiles(id, email, full_name, avatar_url)")
    .eq("project_id", doc.project_id);

  const { data: me } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  const memberList = (members ?? []) as unknown as Member[];
  const myRole = (memberList.find((m) => m.user_id === user.id)?.role ?? "viewer") as Role;

  return (
    <EditorShell
      document={doc as unknown as DocumentRow}
      projectName={(doc as { projects?: { name?: string } }).projects?.name ?? "Project"}
      projectId={doc.project_id}
      members={memberList}
      me={me!}
      myRole={myRole}
    />
  );
}
