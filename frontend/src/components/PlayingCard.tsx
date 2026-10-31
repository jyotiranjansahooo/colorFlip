import type { GameCard } from "@/types/game";

interface PlayingCardProps {
  card: GameCard;
  onPlay: (card: GameCard) => void;
  disabled?: boolean;
  colorClass: string;
}

function getCardColor(color: GameCard["color"]): string {
  switch (color) {
    case "red":
      return "#ED1C2E";
    case "blue":
      return "#0878F9";
    case "green":
      return "#35AD50";
    case "yellow":
      return "#FFD928";
    default:
      return "#171717";
  }
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
  const isWild = isWildCard(value);
  const isNumber = /^[0-9]+$/.test(value);

  const isDrawFour =
    normalized === "draw4" ||
    normalized === "+4" ||
    normalized === "wild4" ||
    normalized === "wilddraw4";

  const cornerLabel = isDrawFour ? "+4" : label;

  const background = isDrawFour
    ? "linear-gradient(145deg, #172554 0%, #1D4ED8 55%, #60A5FA 100%)"
    : isWild
      ? "linear-gradient(135deg, #ED1C2E 0%, #ED1C2E 25%, #0878F9 25%, #0878F9 50%, #35AD50 50%, #35AD50 75%, #FFD928 75%, #FFD928 100%)"
      : getCardColor(card.color);
  return (
    <button
      data-playing-card
      type="button"
      onClick={() => onPlay(card)}
      disabled={disabled}
      title={value}
      aria-label={(card.color ? card.color + " " : "Wild ") + value}
      className={
        "relative flex h-28 w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-[11px] border-[3px] border-white p-[2px] shadow-lg transition duration-200 hover:z-50 hover:-translate-y-3 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 sm:h-32 sm:w-[5.25rem] " +
        colorClass
      }
      style={{
        background: background,
      }}
    >
      <span className="absolute inset-[3px] rounded-[7px] border border-white/90" />

      <span
        className="absolute left-[8%] top-[12%] h-[76%] w-[84%] rounded-[50%] bg-white"
        style={{ transform: "rotate(-32deg) scale(1.05)" }}
      />

      {isWild ? (
        <>
          <span className="absolute left-1.5 top-1.5 z-20 text-[10px] font-black leading-none text-white sm:text-xs">
            {cornerLabel}
          </span>

          <span
            className={
              "absolute left-[8%] top-[12%] h-[76%] w-[84%] rounded-[50%] " +
              (isDrawFour
                ? "bg-gradient-to-br from-white via-slate-100 to-blue-100"
                : "bg-white")
            }
            style={{ transform: "rotate(-32deg) scale(1.05)" }}
          />

          <span className="relative z-10 flex flex-col items-center justify-center gap-1.5">
            <span className="text-center text-sm font-black leading-none tracking-tight sm:text-base">
              {isDrawFour ? "DRAW FOUR" : "WILD"}
            </span>

            {isDrawFour && (
              <span className="text-3xl font-black leading-none tracking-tighter text-blue-700 sm:text-4xl">
                +4
              </span>
            )}

            <span className="flex items-center justify-center gap-1">
              <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-red-500 sm:h-3 sm:w-3" />
              <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-yellow-400 sm:h-3 sm:w-3" />
              <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-green-500 sm:h-3 sm:w-3" />
              <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-blue-500 sm:h-3 sm:w-3" />
            </span>
          </span>

          <span className="absolute bottom-1.5 right-1.5 z-20 rotate-180 text-[10px] font-black leading-none text-white sm:text-xs">
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
              (isNumber ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl")
            }
            style={{
              color: getCardColor(card.color),
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
