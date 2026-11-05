import type { CSSProperties } from "react";
import type { GameCard } from "@/types/game";
import PlayingCard from "@/components/PlayingCard";

interface PlayerHandProps {
  cards: GameCard[];
  onPlayCard: (card: GameCard) => void;
  disabled: boolean;
  getCardColorClass: (card: GameCard) => string;
}

export default function PlayerHand({
  cards,
  onPlayCard,
  disabled,
  getCardColorClass,
}: PlayerHandProps) {
  const getFanStyle = (index: number): CSSProperties => {
    const total = cards.length;
    const middle = (total - 1) / 2;
    const distance = index - middle;

    const maxRotation = Math.min(12, total * 1.2);
    const rotation =
      total > 1 && middle > 0 ? (distance / middle) * maxRotation : 0;

    const verticalOffset = Math.min(Math.abs(distance) * 0.8, 12);

    return {
      transform:
        "translateY(" + verticalOffset + "px) rotate(" + rotation + "deg)",
      transformOrigin: "50% 115%",
      marginLeft: index === 0 ? "0px" : "-24px",
      zIndex: index + 1,
    };
  };

  return (
    <section className="relative z-20 mx-auto w-full min-w-0 px-0 pb-2">
      {cards.length > 0 ? (
        <>
          <div
            className="w-full max-w-full overflow-x-auto overflow-y-visible overscroll-x-contain touch-pan-x px-2 pb-6 pt-5 sm:px-5 sm:pb-6"
            style={{
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "thin",
            }}
          >
            <div className="flex min-w-max items-end justify-start px-4 sm:justify-center sm:px-6">
              {cards.map((card, index) => (
                <div
                  key={card.id}
                  data-hand-card
                  data-card-id={card.id}
                  style={getFanStyle(index)}
                  className="relative shrink-0 transition-transform duration-200 hover:z-[100] hover:-translate-y-4"
                >
                  <PlayingCard
                    card={card}
                    onPlay={onPlayCard}
                    disabled={disabled}
                    colorClass={getCardColorClass(card)}
                  />
                </div>
              ))}
            </div>
          </div>

          <p className="mt-1 text-center text-[10px] font-semibold text-white/60 sm:hidden">
            Swipe horizontally to see all {cards.length} cards
          </p>
        </>
      ) : (
        <p className="py-4 text-center text-sm text-white/60">
          No cards in your hand.
        </p>
      )}
    </section>
  );
}
