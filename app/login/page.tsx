"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">(
    params.get("mode") === "signup" ? "signup" : "login"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setBusy(false);
      if (error) return setError(error.message);
      if (!data.session) {
        return setNotice("Check your email to confirm your account, then log in.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setError(error.message);
    }
    router.push(params.get("next") || "/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-white">
      <div className="absolute inset-0 -z-10 aurora" />
      <div className="w-full max-w-sm animate-fade-up">
        <Link href="/" className="flex items-center justify-center gap-2 font-bold text-xl mb-8">
          <span className="logo-chip">▦</span> ReportCanvas
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur p-6 shadow-xl shadow-violet-100/60">
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6 text-sm font-medium">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg py-1.5 transition-all ${
                  mode === m
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow text-white font-semibold"
                    : "text-slate-500"
                }`}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="label">Full name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {notice && <p className="text-sm text-green-600">{notice}</p>}
            <button className="btn-primary w-full justify-center" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
