import Link from "next/link";
import { ArrowLeft, Gamepad2, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#8C2322] px-6 py-12 text-white">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-red-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-orange-300/20 blur-3xl" />

      <section className="relative w-full max-w-lg rounded-[2rem] border border-white/20 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-12">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-[#8C2322] shadow-lg">
          <SearchX size={42} strokeWidth={1.8} />
        </div>

        <p className="mb-3 text-sm font-extrabold uppercase tracking-[0.35em] text-red-100">
          ColorFlip
        </p>

        <h1 className="text-7xl font-black tracking-tight sm:text-8xl">
          404
        </h1>

        <h2 className="mt-5 text-2xl font-bold sm:text-3xl">
          Looks like you flipped the wrong card!
        </h2>

        <p className="mx-auto mt-4 max-w-sm leading-7 text-red-50/90">
          This page doesn&apos;t exist or may have moved. Let&apos;s get you back
          into the game.
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-bold text-[#8C2322] transition hover:-translate-y-0.5 hover:bg-red-50"
          >
            <ArrowLeft size={18} />
            Back to Home
          </Link>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 font-bold text-white transition hover:bg-white/20"
          >
            <Gamepad2 size={18} />
            Play ColorFlip
          </Link>
        </div>
      </section>
    </main>
  );
}