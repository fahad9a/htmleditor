import Link from "next/link";

// Landing page — public.
export default function Landing() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2 font-bold text-lg">
          <span className="text-brand-600">▦</span> ReportCanvas
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="btn-ghost">Log in</Link>
          <Link href="/login?mode=signup" className="btn-primary">Sign up free</Link>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-3xl">
          Edit AI-generated HTML reports <span className="text-brand-600">visually</span>
        </h1>
        <p className="mt-6 text-lg text-gray-600 max-w-2xl">
          Upload an HTML report or presentation made by Claude, click any element to edit
          it — no code required. Collaborate with colleagues in real time, keep version
          history, and export when you&apos;re done.
        </p>
        <div className="mt-8 flex gap-4">
          <Link href="/login?mode=signup" className="btn-primary text-base px-6 py-3">
            Start editing →
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl text-left">
          {[
            ["📤 Upload & preview", "Drop in any Claude-generated HTML file. The original design is preserved exactly."],
            ["🎨 Click-to-edit", "Click headings, KPI cards, tables, images — change text, colors, fonts and spacing without touching code."],
            ["👥 Collaborate live", "Invite colleagues, see who's editing, share with owner / editor / viewer roles, and restore old versions."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-gray-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center text-xs text-gray-400 py-6">
        ReportCanvas · Next.js + Supabase + Vercel
      </footer>
    </main>
  );
}
