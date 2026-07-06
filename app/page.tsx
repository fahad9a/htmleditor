import Link from "next/link";

// Landing page — public.
export default function Landing() {
  return (
    <main className="min-h-screen flex flex-col bg-white">
      <header className="flex items-center justify-between px-6 md:px-10 py-5 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white text-sm">▦</span>
          ReportCanvas
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="btn-ghost">Log in</Link>
          <Link href="/login?mode=signup" className="btn-primary">Sign up free</Link>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,#eef2ff_0%,transparent_100%)]" />
        <span className="rounded-full border border-indigo-100 bg-indigo-50 text-indigo-600 text-xs font-semibold px-4 py-1.5">
          Built for Claude-generated HTML reports
        </span>
        <h1 className="mt-6 text-4xl md:text-6xl font-extrabold tracking-tight max-w-3xl text-slate-900">
          Edit HTML reports <span className="text-indigo-600">visually.</span>
          <br />No code required.
        </h1>
        <p className="mt-6 text-lg text-slate-500 max-w-2xl leading-relaxed">
          Upload a report or presentation, click any element to change text, colors and
          layout, collaborate live with your team, and export the result — the original
          design stays pixel-perfect.
        </p>
        <div className="mt-9 flex gap-4">
          <Link href="/login?mode=signup" className="btn-primary !text-base !px-7 !py-3">
            Start editing free →
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl text-left w-full">
          {[
            ["🎨", "Click-to-edit", "Headings, KPI cards, tables, images, colors, fonts, spacing — edit everything in place. Undo anything with Ctrl+Z."],
            ["👥", "Live collaboration", "Invite colleagues with owner, editor or viewer roles. See who's online, watch edits appear instantly, restore any version."],
            ["📤", "Present & export", "Slide detection with PowerPoint-style transitions, full-screen present mode, and HTML / ZIP / print-safe PDF export."],
          ].map(([icon, title, body]) => (
            <div key={title} className="card p-6">
              <span className="text-2xl">{icon}</span>
              <h3 className="font-semibold mt-3 text-slate-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center text-xs text-slate-400 py-6 border-t border-slate-100">
        ReportCanvas · Next.js + Supabase + Vercel
      </footer>
    </main>
  );
}
