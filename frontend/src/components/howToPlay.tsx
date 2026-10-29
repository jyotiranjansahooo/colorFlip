"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Ban, Layers, Palette, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const STEPS: {
  title: string;
  text: string;
  icon: LucideIcon;
  stripe: string;
  iconBg: string;
}[] = [
  {
    title: "Match the top card",
    text: "Play a card that matches the color or the value of the card on the discard pile.",
    icon: Layers,
    stripe: "bg-red-500",
    iconBg: "bg-red-600",
  },
  {
    title: "Use action cards",
    text: "Skip, reverse and draw cards shake up the turn order and slow your rivals down.",
    icon: Ban,
    stripe: "bg-yellow-400",
    iconBg: "bg-yellow-400 text-slate-950",
  },
  {
    title: "Go wild",
    text: "Wild cards let you pick the next color. Perfect for changing the game when you're stuck.",
    icon: Palette,
    stripe: "bg-emerald-500",
    iconBg: "bg-emerald-600",
  },
  {
    title: "Empty your hand",
    text: "Be the first player to get rid of every card and you win the round.",
    icon: Trophy,
    stripe: "bg-blue-500",
    iconBg: "bg-blue-700",
  },
];

export default function HowToPlayCards() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        // Heading fades up
        gsap.from("[data-howto-head]", {
          y: 30,
          opacity: 0,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: root.current, start: "top 85%" },
        });

        // Line under the heading draws itself as you scroll (scrubbed)
        gsap.fromTo(
          "[data-howto-line]",
          { scaleX: 0 },
          {
            scaleX: 1,
            transformOrigin: "0% 50%",
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top 85%",
              end: "top 35%",
              scrub: true,
            },
          },
        );

        // Cards flip up one after another
        gsap.from("[data-howto-card]", {
          y: 70,
          opacity: 0,
          rotationX: -40,
          rotation: () => gsap.utils.random(-4, 4),
          transformPerspective: 900,
          transformOrigin: "50% 100%",
          duration: 0.85,
          stagger: 0.15,
          ease: "back.out(1.4)",
          clearProps: "transform,opacity", // lets CSS hover effects work afterwards
          scrollTrigger: {
            trigger: "[data-howto-grid]",
            start: "top 85%",
            toggleActions: "play none none none",
          },
        });

        // Little icon pop when each card lands
        gsap.from("[data-howto-icon]", {
          scale: 0,
          rotation: -90,
          duration: 0.6,
          stagger: 0.15,
          delay: 0.35,
          ease: "back.out(2.2)",
          scrollTrigger: {
            trigger: "[data-howto-grid]",
            start: "top 85%",
          },
        });
      },
      root,
    );

    return () => mm.revert();
  }, []);

  return (
    <section
      ref={root}
      aria-labelledby="how-to-play-title"
      className="mt-16 sm:mt-20 md:mt-28"
    >
      <div data-howto-head className="text-center">
        <p className="text-xs font-bold tracking-[0.3em] text-white/60">
          HOW TO PLAY
        </p>
        <h2
          id="how-to-play-title"
          className="mt-2 text-3xl font-black sm:text-4xl md:text-5xl"
        >
          Four steps to victory
        </h2>
      </div>

      <div
        data-howto-line
        aria-hidden="true"
        className="mx-auto mt-5 h-1 w-24 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 via-50% to-blue-500 sm:w-40"
      />

      <div
        data-howto-grid
        className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4"
      >
        {STEPS.map(({ title, text, icon: Icon, stripe, iconBg }, index) => (
          <article
            key={title}
            data-howto-card
            className="relative overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 p-5 pt-7 transition-transform duration-300 hover:-translate-y-1 sm:p-6 sm:pt-8"
          >
            <span
              aria-hidden="true"
              className={"absolute inset-x-0 top-0 h-1.5 " + stripe}
            />

            <div className="flex items-center justify-between">
              <span
                data-howto-icon
                className={
                  "flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg " +
                  iconBg
                }
              >
                <Icon size={22} aria-hidden="true" />
              </span>

              <span
                aria-hidden="true"
                className="text-4xl font-black text-white/10"
              >
                0{index + 1}
              </span>
            </div>

            <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}