import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-5xl">🔍</p>
      <h1 className="text-xl font-bold">Not found</h1>
      <p className="text-sm text-gray-500">
        This document doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link href="/dashboard" className="btn-primary">Go to dashboard</Link>
    </main>
  );
}
