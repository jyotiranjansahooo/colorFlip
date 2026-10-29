"use client";

import type { CardColor, GameCard } from "@/types/game";

interface GameTableProps {
  drawPileCount: number;
  topCard: GameCard | null;
  currentColor: CardColor;
  onDrawCard: () => void;
  isMyTurn: boolean;
  isPlaying: boolean;
}

const cardColors: Record<CardColor, string> = {
  red: "bg-red-600 border-red-200 text-white",
  blue: "bg-blue-600 border-blue-200 text-white",
  green: "bg-emerald-600 border-emerald-200 text-white",
  yellow: "bg-yellow-300 border-yellow-100 text-red-950",
};

export default function GameTable({
  drawPileCount,
  topCard,
  currentColor,
  onDrawCard,
  isMyTurn,
  isPlaying,
}: GameTableProps) {
  return (
    <div className="absolute left-1/2 top-1/2 z-10 flex min-h-44 w-[min(66%,500px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-5 rounded-[999px] border-2 border-yellow-400/80 bg-[#741B1B]/45 px-3 py-6 shadow-[0_0_0_10px_rgba(245,197,107,0.07),inset_0_0_40px_rgba(0,0,0,0.12)] sm:min-h-56 sm:gap-10 sm:py-8">
      <div className="game-pile">
        <p className="mb-3 text-[10px] font-black tracking-[0.2em] text-red-50/80 sm:text-xs">
          DRAW PILE
        </p>

        <button
          type="button"
          data-draw-pile
          onClick={onDrawCard}
          disabled={!isMyTurn || !isPlaying}
          aria-label={
            "Draw a card. " + drawPileCount + " cards remaining"
          }
          className="relative flex h-28 w-[4.5rem] items-center justify-center overflow-hidden rounded-2xl border-[5px] border-white bg-[#F5C56B] text-[#541414] shadow-xl transition hover:-translate-y-1 hover:shadow-2xl sm:h-36 sm:w-24 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex h-[calc(100%-10px)] w-[calc(100%-10px)] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#8C2322]/55 bg-[#F5C56B]">
            <span className="text-2xl font-black italic sm:text-3xl">
              CF
            </span>

            <span className="mt-1 text-[8px] font-black tracking-[0.18em] sm:text-[9px]">
              COLORFLIP
            </span>
          </span>
        </button>

        <p className="mt-3 text-center text-xs font-semibold text-red-50/85">
          {drawPileCount} cards
        </p>
      </div>

      <div className="game-pile">
        {/* <p className="mb-3 text-[10px] font-black tracking-[0.2em] text-red-50/80 sm:text-xs">
          DISCARD PILE
        </p> */}

        {topCard ? (
          <div
            data-top-card
            className={
              "relative flex h-28 w-[4.5rem] items-center justify-center overflow-hidden rounded-2xl border-[5px] border-white shadow-xl sm:h-36 sm:w-24 " +
              cardColors[topCard.color ?? currentColor]
            }
            aria-label={
              (topCard.color ?? currentColor) + " " + topCard.value
            }
          >
            <span className="absolute left-2 top-2 text-[10px] font-black uppercase sm:text-xs">
              {topCard.value.toUpperCase()}
            </span>

            <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/80 bg-white/20 text-xl font-black italic drop-shadow sm:h-16 sm:w-16 sm:text-2xl">
              {topCard.value.toUpperCase()}
            </span>
          </div>
        ) : (
          <div className="flex h-28 w-[4.5rem] items-center justify-center rounded-2xl border-2 border-dashed border-red-100/40 bg-[#741B1B] text-xs text-red-50/65 sm:h-36 sm:w-24">
            Empty
          </div>
        )}

        <p className="mt-3 text-center text-xs font-semibold text-red-50/85">
          Top card
        </p>
      </div>
    </div>
  );
}