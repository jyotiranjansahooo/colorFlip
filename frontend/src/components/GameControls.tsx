"use client";

interface GameControlsProps {
  onDrawCard: () => void;
  onPassTurn: () => void;
  isMyTurn: boolean;
  isPlaying: boolean;
  hasDrawnCard: boolean;
}

export default function GameControls({
  onDrawCard,
  onPassTurn,
  isMyTurn,
  isPlaying,
  hasDrawnCard,
}: GameControlsProps) {
  const controlsDisabled = !isMyTurn || !isPlaying;

  return (
    <div className="absolute bottom-[155px] left-1/2 z-30 flex w-[92%] max-w-md -translate-x-1/2 items-center justify-center gap-2 sm:bottom-[175px] sm:gap-3">
      <button
        type="button"
        onClick={onDrawCard}
        disabled={controlsDisabled || hasDrawnCard}
        className="min-h-11 flex-1 rounded-xl border border-yellow-200 bg-[#FFF3E8] px-3 py-3 text-sm font-black text-[#7B1E1E] shadow-md transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Draw Card
      </button>
      <button
        type="button"
        onClick={onPassTurn}
        disabled={controlsDisabled || !hasDrawnCard}
        className="min-h-11 flex-1 rounded-xl border border-yellow-300 bg-yellow-400 px-3 py-3 text-sm font-black text-[#541414] shadow-md transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Pass Turn
      </button>
    </div>
  );
}
