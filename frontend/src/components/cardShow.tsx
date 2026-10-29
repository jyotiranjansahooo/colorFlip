"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * x / y are % of the card's own size, so the fan scales automatically
 * on mobile and laptop screens without any breakpoint maths.
 */
const FAN = [
  { cls: "card-red", value: "7", x: -110, r: -24, y: 14 },
  { cls: "card-yellow", value: "SKIP", x: -55, r: -12, y: 4 },
  { cls: "card-wild", value: "WILD", x: 0, r: 0, y: 0 },
  { cls: "card-green", value: "+2", x: 55, r: 12, y: 4 },
  { cls: "card-blue", value: "9", x: 110, r: 24, y: 14 },
];

export default function CardShowcase() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        const cards = gsap.utils.toArray<HTMLElement>("[data-fan-card]");

        // Start as a neat stack, hidden below
        gsap.set(cards, {
          xPercent: 0,
          yPercent: 40,
          rotation: 0,
          scale: 0.6,
          opacity: 0,
          transformOrigin: "50% 100%",
        });

        // Idle floating (created paused, started after the deal finishes)
        const floats = cards.map((card, i) =>
          gsap.to(card, {
            y: i % 2 === 0 ? -8 : 8,
            duration: 1.3 + i * 0.12,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
            paused: true,
          }),
        );

        // 1. Deal the cards into a fan when the section scrolls into view
        const deal = gsap.timeline({
          scrollTrigger: {
            trigger: root.current,
            start: "top 90%",
            toggleActions: "play none none none",
          },
          onComplete: () => floats.forEach((f) => f.play()),
        });

        cards.forEach((card, i) => {
          const c = FAN[i];
          deal.to(
            card,
            {
              xPercent: c.x,
              yPercent: c.y,
              rotation: c.r,
              scale: 1,
              opacity: 1,
              duration: 0.9,
              ease: "back.out(1.6)",
            },
            i * 0.1,
          );
        });

        // 2. Scroll-scrubbed parallax: the whole fan drifts as you scroll
        gsap.to("[data-fan]", {
          y: -50,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.6,
          },
        });
      },
      root,
    );

    // Reduced motion: show the final fan, no movement
    mm.add(
      "(prefers-reduced-motion: reduce)",
      () => {
        gsap.utils
          .toArray<HTMLElement>("[data-fan-card]")
          .forEach((card, i) => {
            gsap.set(card, {
              xPercent: FAN[i].x,
              yPercent: FAN[i].y,
              rotation: FAN[i].r,
              transformOrigin: "50% 100%",
            });
          });
      },
      root,
    );

    return () => mm.revert();
  }, []);

  return (
    <section
      ref={root}
      aria-label="Card showcase"
      className="mt-8 w-full max-w-md sm:mt-10"
    >
      <div data-fan className="grid place-items-center py-8 sm:py-10">
        {FAN.map((card) => (
          <div
            key={card.value}
            data-fan-card
            className={"flip-card col-start-1 row-start-1 " + card.cls}
          >
            <span className="flip-card-corner">{card.value}</span>
            <span className="flip-card-value">{card.value}</span>
            <span className="flip-card-corner flip-card-corner-bottom">
              {card.value}
            </span>
          </div>
        ))}
      </div>

      <p className="text-center text-[11px] font-bold uppercase tracking-[0.25em] text-white/60 sm:text-xs md:text-left">
        Your deck is ready to flip
      </p>
    </section>
  );
}
