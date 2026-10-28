"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("ColorFlip route error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#8C2322] px-6 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#8C2322]">
          <AlertTriangle size={32} />
        </div>

        <h1 className="text-2xl font-black">Something went wrong</h1>

        <p className="mt-3 leading-7 text-red-50/90">
          An unexpected error interrupted your game. Try again to continue.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-[#8C2322] transition hover:bg-red-50"
        >
          <RotateCcw size={18} />
          Try Again
        </button>
      </section>
    </main>
  );
}