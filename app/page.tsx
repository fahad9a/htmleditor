import Link from "next/link";

// Landing page — public.
export default function Landing() {
  return (
    <main className="min-h-screen flex flex-col bg-white relative overflow-hidden">
      <div className="absolute inset-0 -z-10 aurora" />

      <header className="flex items-center justify-between px-6 md:px-10 py-5 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
          <span className="logo-chip">▦</span>
          ReportCanvas
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="btn-ghost">Log in</Link>
          <Link href="/login?mode=signup" className="btn-primary">Sign up free</Link>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
        <span className="animate-fade-up rounded-full border border-fuchsia-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 text-fuchsia-700 text-xs font-semibold px-4 py-1.5">
          ✨ Built for Claude-generated HTML reports
        </span>
        <h1 className="animate-fade-up mt-6 text-4xl md:text-6xl font-extrabold tracking-tight max-w-3xl text-slate-900 [animation-delay:80ms]">
          Edit HTML reports <span className="text-gradient">visually.</span>
          <br />No code required.
        </h1>
        <p className="animate-fade-up mt-6 text-lg text-slate-500 max-w-2xl leading-relaxed [animation-delay:160ms]">
          Upload a report or presentation, click any element to change text, pictures,
          colors and layout, collaborate live with your team, drop comments right on
          the page, and export the result — the original design stays pixel-perfect.
        </p>
        <div className="animate-fade-up mt-9 flex gap-4 [animation-delay:240ms]">
          <Link href="/login?mode=signup" className="btn-primary !text-base !px-7 !py-3">
            Start editing free →
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl text-left w-full">
          {[
            ["🎨", "Click-to-edit", "Headings, KPI cards, tables, colors, fonts, spacing — edit everything in place. Undo anything with Ctrl+Z.", "from-violet-500 to-fuchsia-500"],
            ["🖼️", "Pictures", "Upload photos and figures straight into the page, replace any image, resize with a slider.", "from-fuchsia-500 to-pink-500"],
            ["👥", "Live collaboration", "Invite your team with roles, watch edits appear instantly, and leave comments pinned to any element.", "from-amber-500 to-orange-500"],
            ["📤", "Present & export", "Slide transitions, full-screen present mode, and HTML / ZIP / print-safe PDF export.", "from-emerald-500 to-teal-500"],
          ].map(([icon, title, body, grad], i) => (
            <div
              key={title}
              className="animate-fade-up card p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-100 transition-all duration-300"
              style={{ animationDelay: `${320 + i * 90}ms` }}
            >
              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${grad} text-xl shadow-md`}>
                {icon}
              </span>
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
