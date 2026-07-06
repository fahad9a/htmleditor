import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import { initials, userColor } from "@/lib/colors";

export const dynamic = "force-dynamic";

interface Membership {
  role: string;
  projects: {
    id: string;
    name: string;
    owner_id: string;
    updated_at: string;
    documents: { id: string; title: string; updated_at: string }[];
  } | null;
}

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware redirects

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const { data } = await supabase
    .from("project_members")
    .select("role, projects(id, name, owner_id, updated_at, documents(id, title, updated_at))")
    .eq("user_id", user.id);

  const memberships = ((data as unknown as Membership[]) ?? []).filter((m) => m.projects);
  const mine = memberships.filter((m) => m.projects!.owner_id === user.id);
  const shared = memberships.filter((m) => m.projects!.owner_id !== user.id);

  const name = profile?.full_name || profile?.email || "You";

  function Card({ m }: { m: Membership }) {
    const p = m.projects!;
    const doc = p.documents?.[0];
    return (
      <Link
        href={doc ? `/editor/${doc.id}` : "#"}
        className="rounded-xl border border-gray-200 bg-white p-5 hover:border-brand-500 hover:shadow-sm transition-all block"
      >
        <div className="flex items-start justify-between">
          <h3 className="font-semibold truncate">{p.name}</h3>
          <span className="text-[10px] uppercase tracking-wide rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">
            {m.role}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500 truncate">{doc?.title ?? "No document"}</p>
        <p className="mt-3 text-xs text-gray-400">
          Edited {doc ? new Date(doc.updated_at).toLocaleString() : "—"}
        </p>
      </Link>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold">
            <span className="text-brand-600">▦</span> ReportCanvas
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: userColor(user.id) }}
                title={name}
              >
                {initials(profile?.full_name ?? "", profile?.email ?? "")}
              </span>
              <span className="text-sm text-gray-600 hidden sm:block">{name}</span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Your projects</h1>
          <Link href="/upload" className="btn-primary">+ Upload HTML file</Link>
        </div>

        {mine.length === 0 ? (
          <div className="mt-8 rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-500">No projects yet.</p>
            <Link href="/upload" className="btn-primary mt-4">Upload your first HTML report</Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mine.map((m) => <Card key={m.projects!.id} m={m} />)}
          </div>
        )}

        {shared.length > 0 && (
          <>
            <h2 className="mt-12 text-xl font-bold">Shared with you</h2>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shared.map((m) => <Card key={m.projects!.id} m={m} />)}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
