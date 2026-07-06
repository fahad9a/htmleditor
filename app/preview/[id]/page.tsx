import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { injectPresentRuntime } from "@/lib/presentRuntime";
import type { TransitionCfg } from "@/lib/types";

export const dynamic = "force-dynamic";

// Full-screen presentation/preview mode. Saved edit patches are replayed onto
// the original document; multi-slide decks get transitions + navigation.
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("title, html_content, patches, transitions")
    .eq("id", id)
    .single();
  if (!doc) notFound();

  const srcDoc = injectPresentRuntime(
    doc.html_content,
    doc.transitions as TransitionCfg,
    doc.patches ?? []
  );

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <header className="flex items-center gap-3 px-4 py-2 text-sm text-slate-300">
        <Link href={`/editor/${id}`} className="hover:text-white transition-colors">← Back to editor</Link>
        <span className="text-slate-600">·</span>
        <span className="truncate">{doc.title}</span>
        <span className="ml-auto text-xs text-slate-500">← → keys to navigate</span>
      </header>
      <iframe
        sandbox="allow-scripts allow-modals"
        srcDoc={srcDoc}
        className="flex-1 w-full bg-white"
        title="Presentation preview"
      />
    </div>
  );
}
