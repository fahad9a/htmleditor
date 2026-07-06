import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { injectPresentRuntime } from "@/lib/presentRuntime";
import type { TransitionCfg } from "@/lib/types";

export const dynamic = "force-dynamic";

// Full-screen presentation/preview mode. Slides are shown one at a time with
// the configured transition; plain reports render as a scrollable page.
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("title, html_content, transitions")
    .eq("id", id)
    .single();
  if (!doc) notFound();

  const srcDoc = injectPresentRuntime(doc.html_content, doc.transitions as TransitionCfg);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <header className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300">
        <Link href={`/editor/${id}`} className="hover:text-white">← Back to editor</Link>
        <span className="text-gray-500">·</span>
        <span className="truncate">{doc.title} — preview</span>
        <span className="ml-auto text-xs text-gray-500">Use ← → keys to navigate slides</span>
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
