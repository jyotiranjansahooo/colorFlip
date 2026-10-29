"use client";

import { lazy, Suspense, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { Layers } from "lucide-react";


const UnoCardFan = lazy(() => import("../components/unoCard"));

const MESSAGES = [
  "Shuffling the deck…",
  "Dealing the cards…",
  "Picking who goes first…",
  "Don't forget to say UNO!",
];

/** Shown while the lazy card fan is still being downloaded. */
function CardFanSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-40 w-full items-center justify-center gap-2 sm:h-48 md:h-60 md:gap-4"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-24 w-16 animate-pulse rounded-xl border-[3px] border-white/40 bg-white/10 sm:h-28 sm:w-20 md:h-40 md:w-28 md:rounded-2xl"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

export default function Loading() {
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const message = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Title letters bounce in
        gsap.from("[data-letter]", {
          y: -60,
          opacity: 0,
          rotation: () => gsap.utils.random(-25, 25),
          duration: 0.8,
          stagger: 0.12,
          ease: "bounce.out",
        });

        // Spinning deck icon
        gsap.to("[data-spinner]", {
          rotation: 360,
          duration: 2.4,
          repeat: -1,
          ease: "none",
        });

        // Indeterminate progress bar sliding across the track
        gsap.fromTo(
          bar.current,
          { xPercent: -100 },
          { xPercent: 250, duration: 1.4, repeat: -1, ease: "power1.inOut" },
        );

        // Cycle through the loading messages
        const tl = gsap.timeline({ repeat: -1, delay: 0.6 });
        MESSAGES.forEach((text) => {
          tl.call(() => {
            if (message.current) message.current.textContent = text;
          })
            .fromTo(
              message.current,
              { opacity: 0, y: 8 },
              { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
            )
            .to(message.current, {
              opacity: 0,
              y: -8,
              duration: 0.4,
              ease: "power2.in",
              delay: 1.1,
            });
        });
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <main
      ref={root}
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-screen w-full flex-col items-center justify-center gap-6 overflow-hidden px-4 py-8 text-white sm:gap-8 md:gap-10"
      style={{ backgroundColor: "#8C2322" }}
    >
      <span className="sr-only">Loading game…</span>

      {/* Title */}
      <h1
        aria-hidden="true"
        className="flex gap-1 text-6xl font-black italic tracking-tight sm:text-7xl md:gap-2 md:text-9xl"
        style={{
          color: "#FFD600",
          textShadow: "0 4px 0 #000, 0 8px 16px rgba(0,0,0,.45)",
        }}
      >
        {"UNO".split("").map((letter, i) => (
          <span key={i} data-letter className="inline-block">
            {letter}
          </span>
        ))}
      </h1>

      {/* Lazy-loaded animated card fan */}
      <div className="w-full max-w-xl md:max-w-3xl">
        <Suspense fallback={<CardFanSkeleton />}>
          <UnoCardFan />
        </Suspense>
      </div>

      {/* Status + progress */}
      <div className="flex w-full max-w-[18rem] flex-col items-center gap-3 sm:max-w-xs md:max-w-sm md:gap-4">
        <div className="flex items-center gap-2 md:gap-3">
          <Layers
            data-spinner
            className="h-5 w-5 md:h-7 md:w-7"
            style={{ color: "#FFD600" }}
            aria-hidden="true"
          />
          <p
            ref={message}
            className="min-h-[1.75rem] text-center text-base font-semibold sm:text-lg md:text-xl"
          >
            {MESSAGES[0]}
          </p>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-black/30 md:h-3">
          <div
            ref={bar}
            className="h-full w-2/5 rounded-full"
            style={{ backgroundColor: "#FFD600" }}
          />
        </div>
      </div>
    </main>
  );
}
