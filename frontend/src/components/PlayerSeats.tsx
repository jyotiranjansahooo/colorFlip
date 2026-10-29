import { Layers, RotateCcw, Wifi, WifiOff } from "lucide-react";
import type { RoomPlayer } from "@/types/game";

interface PlayerSeatsProps {
  players: RoomPlayer[];
  playerId: string;
  hostId: string;
  currentPlayerIndex: number;
}

export default function PlayerSeats({
  players,
  playerId,
  hostId,
  currentPlayerIndex,
}: PlayerSeatsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {players.map((player, index) => {
        const isCurrentPlayer = currentPlayerIndex === index;
        const isYou = player.id === playerId;

        const opponentIndex = players
          .filter((candidate) => candidate.id !== playerId)
          .findIndex((candidate) => candidate.id === player.id);

        let seatPosition = "";

        if (isYou) {
          seatPosition =
            "bottom-36 left-1/2 w-[min(76%,240px)] -translate-x-1/2 sm:bottom-32";
        } else if (players.length === 2) {
          seatPosition = "left-1/2 top-20 w-[min(76%,260px)] -translate-x-1/2";
        } else if (players.length === 3) {
          seatPosition =
            opponentIndex === 0
              ? "left-3 top-1/2 w-[min(30%,170px)] -translate-y-1/2 sm:left-5 sm:w-[min(26%,200px)]"
              : "right-3 top-1/2 w-[min(30%,170px)] -translate-y-1/2 sm:right-5 sm:w-[min(26%,200px)]";
        } else {
          seatPosition =
            opponentIndex === 0
              ? "left-1/2 top-20 w-[min(58%,220px)] -translate-x-1/2"
              : opponentIndex === 1
                ? "left-3 top-[42%] w-[min(27%,170px)] -translate-y-1/2 sm:left-5"
                : "right-3 top-[42%] w-[min(27%,170px)] -translate-y-1/2 sm:right-5";
        }

        return (
          <div
            key={player.id}
            data-token-active={isCurrentPlayer ? "true" : undefined}
            className={
              "pointer-events-auto absolute rounded-2xl border-0 bg-transparent p-3 shadow-none transition-all duration-200 " +
              seatPosition +
              " " +
              (isCurrentPlayer
                ? "border-transparent bg-transparent text-[#541414] ring-0 shadow-none"
                : "border-transparent bg-transparent text-[#541414] ring-0 shadow-none")
            }
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#8C2322] text-white">
                {!isYou && <Layers size={17} aria-hidden="true" />}
              </div>

              <div className="min-w-0">
                {!isYou && (
                  <p className="truncate text-sm font-extrabold">
                    {player.name}
                  </p>
                )}

                {!isYou && (
                  <div
                    className="mt-3 flex min-h-16 items-center overflow-visible"
                    aria-label="Opponent cards"
                    title="Opponent's cards"
                  >
                    {Array.from({ length: player.cardCount }).map(
                      (_, cardIndex) => (
                        <div
                          key={cardIndex}
                          className="relative -ml-3 first:ml-0 h-12 w-8 shrink-0 overflow-hidden rounded-md border-2 border-white bg-[#F5C56B] shadow-md sm:h-16 sm:w-11"
                          style={{
                            transform:
                              "rotate(" + ((cardIndex % 5) - 2) * 3 + "deg)",
                            zIndex: cardIndex + 1,
                          }}
                        >
                          <div className="absolute inset-1 rounded-sm border border-dashed border-[#8C2322]/70" />

                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="rounded-full border border-[#8C2322]/60 bg-[#8C2322] px-1 py-0.5 text-[6px] font-black tracking-tighter text-[#F5C56B] sm:text-[8px]">
                              CF
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <span
                className={
                  "text-[10px] font-bold uppercase tracking-wider " +
                  (isCurrentPlayer ? "text-yellow-200" : "text-red-50/60")
                }
              >
                {isCurrentPlayer ? "Current turn" : "In game"}
              </span>

              {!player.connected && (
                <WifiOff
                  size={13}
                  className="text-red-200"
                  aria-label="Disconnected"
                />
              )}

              {player.connected && (
                <Wifi
                  size={13}
                  className="text-green-200"
                  aria-label="Connected"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
