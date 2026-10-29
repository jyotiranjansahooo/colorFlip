"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { Ban, RefreshCw, Sparkles, Plus, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type UnoCard = {
  color: string; // card face colour
  icon: LucideIcon; // lucide icon in the centre oval
  label: string;
  angle: number; // fan rotation in degrees
  x: number; // horizontal offset, % of card width (scales with screen size)
  y: number; // vertical offset, % of card height
};

const CARDS: UnoCard[] = [
  { color: "#E53935", icon: Ban, label: "Skip", angle: -32, x: -150, y: 14 },
  { color: "#FBC02D", icon: RefreshCw, label: "Reverse", angle: -16, x: -75, y: 4 },
  { color: "#1A1A1A", icon: Sparkles, label: "Wild", angle: 0, x: 0, y: 0 },
  { color: "#2E9E4F", icon: Plus, label: "Draw", angle: 16, x: 75, y: 4 },
  { color: "#1E64C8", icon: Layers, label: "Stack", angle: 32, x: 150, y: 14 },
];

export default function UnoCardFan() {
  const wrapper = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const cards = gsap.utils.toArray<HTMLElement>("[data-card]");

        // Start: all cards stacked in the middle like a fresh deck
        gsap.set(cards, {
          xPercent: 0,
          yPercent: 0,
          rotation: 0,
          scale: 0.6,
          opacity: 0,
          transformOrigin: "50% 100%",
        });

        // Deal / fan out
        const tl = gsap.timeline();
        cards.forEach((card, i) => {
          const c = CARDS[i];
          tl.to(
            card,
            {
              xPercent: c.x,
              yPercent: c.y,
              rotation: c.angle,
              scale: 1,
              opacity: 1,
              duration: 0.9,
              ease: "back.out(1.6)",
            },
            i * 0.12
          );
        });

        // Gentle floating loop once dealt
        tl.add(() => {
          cards.forEach((card, i) => {
            gsap.to(card, {
              y: i % 2 === 0 ? -10 : 10,
              duration: 1.2 + i * 0.1,
              yoyo: true,
              repeat: -1,
              ease: "sine.inOut",
            });
          });
        });

        return () => tl.kill();
      });

      // Reduced motion: just show the fanned cards, no movement
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.utils.toArray<HTMLElement>("[data-card]").forEach((card, i) => {
          gsap.set(card, {
            xPercent: CARDS[i].x,
            yPercent: CARDS[i].y,
            rotation: CARDS[i].angle,
            transformOrigin: "50% 100%",
          });
        });
      });
    }, wrapper);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={wrapper}
      aria-hidden="true"
      className="relative flex h-40 w-full items-center justify-center sm:h-48 md:h-60"
    >
      {CARDS.map(({ color, icon: Icon, label }) => (
        <div
          key={label}
          data-card
          className="absolute h-24 w-16 select-none rounded-xl border-[3px] border-white shadow-xl shadow-black/40 sm:h-28 sm:w-20 md:h-40 md:w-28 md:rounded-2xl md:border-4"
          style={{ backgroundColor: color }}
        >
          {/* corner icons */}
          <Icon className="absolute left-1 top-1 h-3 w-3 text-white md:left-2 md:top-2 md:h-4 md:w-4" />
          <Icon className="absolute bottom-1 right-1 h-3 w-3 rotate-180 text-white md:bottom-2 md:right-2 md:h-4 md:w-4" />

          {/* centre oval, tilted like a real UNO card */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-[72%] w-[70%] -rotate-[24deg] items-center justify-center rounded-[50%] bg-white">
              <Icon
                className="h-6 w-6 rotate-[24deg] md:h-10 md:w-10"
                style={{ color }}
                strokeWidth={2.75}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}