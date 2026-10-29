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

    const maxRotation = Math.min(16, total * 1.5);
    const rotation =
      total > 1 && middle > 0 ? (distance / middle) * maxRotation : 0;

    const verticalOffset = Math.abs(distance) * 1.2;

    return {
      transform:
        "translateY(" + verticalOffset + "px) rotate(" + rotation + "deg)",
      transformOrigin: "50% 115%",
      marginLeft: index === 0 ? "0" : "-30px",
      zIndex: index + 1,
    };
  };

  return (
    <section className="relative z-20 mx-auto w-full min-w-0 px-0 pb-1 sm:px-1 sm:pb-2">
      {cards.length > 0 ? (
        <div className="flex w-full justify-center overflow-x-auto overflow-y-hidden px-1 pb-2 pt-3 sm:overflow-x-visible sm:px-2 sm:pb-3 sm:pt-5">
          <div className="flex min-w-max items-end justify-center px-3 sm:px-5">
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
      ) : (
        <p className="py-4 text-center text-sm text-white/60">
          No cards in your hand.
        </p>
      )}
    </section>
  );
}
