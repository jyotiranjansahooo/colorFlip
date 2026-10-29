import type { GameCard } from "@/types/game";

interface PlayingCardProps {
  card: GameCard;
  onPlay: (card: GameCard) => void;
  disabled?: boolean;
  colorClass: string;
}

function getCardColor(color: GameCard["color"]): string {
  if (color === "red") return "#ED1C2E";
  if (color === "blue") return "#0878B9";
  if (color === "green") return "#35AD50";
  if (color === "yellow") return "#FFD928";

  return "#171717";
}

function getCardLabel(value: string): string {
  const normalized = value.toLowerCase().replace(/[\s_-]/g, "");

  if (normalized === "skip") return "⊘";
  if (normalized === "reverse") return "⇄";
  if (normalized === "draw2" || normalized === "+2") return "+2";
  if (
    normalized === "draw4" ||
    normalized === "+4" ||
    normalized === "wild4" ||
    normalized === "wilddraw4"
  ) {
    return "+4";
  }
  if (normalized === "wild") return "WILD";

  return value;
}

function isWildCard(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[\s_-]/g, "");

  return (
    normalized === "wild" ||
    normalized === "wild4" ||
    normalized === "wilddraw4" ||
    normalized === "draw4" ||
    normalized === "+4"
  );
}

export default function PlayingCard({
  card,
  onPlay,
  disabled = false,
  colorClass,
}: PlayingCardProps) {
  const value = String(card.value);
  const normalized = value.toLowerCase().replace(/[\s_-]/g, "");
  const label = getCardLabel(value);
  const background = getCardColor(card.color);
  const isWild = isWildCard(value);
  const isNumber = /^[0-9]+$/.test(value);
  const isDrawFour =
    normalized === "draw4" ||
    normalized === "+4" ||
    normalized === "wild4" ||
    normalized === "wilddraw4";

  const cornerLabel = isDrawFour ? "+4" : label;

  return (
    <button
      type="button"
      onClick={() => onPlay(card)}
      disabled={disabled}
      title={value}
      aria-label={
        (card.color ? card.color + " " : "Wild ") + value
      }
      className={
        "relative flex h-28 w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-[11px] border-[3px] border-white p-[2px] shadow-lg transition duration-200 hover:z-50 hover:-translate-y-3 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 sm:h-32 sm:w-[5.25rem] " +
        colorClass
      }
      style={{ backgroundColor: background }}
    >
      <span className="absolute inset-[3px] rounded-[7px] border border-white/90" />

      <span
        className="absolute left-[8%] top-[12%] h-[76%] w-[84%] rounded-[50%] bg-white"
        style={{ transform: "rotate(-32deg) scale(1.05)" }}
      />

      {isWild ? (
        <>
          <span className="absolute left-1 top-1 z-20 text-[9px] font-black leading-none text-white sm:text-[10px]">
            {cornerLabel}
          </span>

          <span className="relative z-10 flex flex-col items-center justify-center gap-1">
            <span className="text-center text-[15px] font-black leading-none tracking-tight text-gray-900 sm:text-lg">
              WILD
            </span>

            {isDrawFour && (
              <span className="text-2xl font-black leading-none text-gray-900 sm:text-3xl">
                +4
              </span>
            )}

            <span className="flex -space-x-1">
              <span className="h-3 w-3 rotate-12 rounded-sm bg-yellow-400 sm:h-3.5 sm:w-3.5" />
              <span className="h-3 w-3 rotate-12 rounded-sm bg-blue-500 sm:h-3.5 sm:w-3.5" />
              <span className="h-3 w-3 rotate-12 rounded-sm bg-red-500 sm:h-3.5 sm:w-3.5" />
              <span className="h-3 w-3 rotate-12 rounded-sm bg-green-500 sm:h-3.5 sm:w-3.5" />
            </span>
          </span>

          <span className="absolute bottom-1 right-1 z-20 rotate-180 text-[9px] font-black leading-none text-white sm:text-[10px]">
            {cornerLabel}
          </span>
        </>
      ) : (
        <>
          <span className="absolute left-1 top-1 z-20 text-[13px] font-black leading-none text-white sm:text-sm">
            {label}
          </span>

          <span
            className={
              "relative z-10 flex max-w-full items-center justify-center px-1 text-center font-black leading-none " +
              (isNumber
                ? "text-4xl sm:text-5xl"
                : "text-2xl sm:text-3xl")
            }
            style={{
              color: background,
              WebkitTextStroke: "0.5px white",
              textShadow: "1px 1px 0 white",
            }}
          >
            {label}
          </span>

          <span className="absolute bottom-1 right-1 z-20 rotate-180 text-[13px] font-black leading-none text-white sm:text-sm">
            {label}
          </span>
        </>
      )}
    </button>
  );
}