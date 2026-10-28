import { Gamepad2 } from "lucide-react";

const cards = [
  { color: "bg-red-500", label: "R" },
  { color: "bg-yellow-400", label: "Y" },
  { color: "bg-green-500", label: "G" },
  { color: "bg-blue-500", label: "B" },
];

export default function Loading() {
  return (
    <main
      role="status"
      aria-label="Loading ColorFlip"
      className="flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#8C2322] px-6 text-white"
    >
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#8C2322] shadow-lg">
          <Gamepad2 size={27} />
        </div>

        <span className="text-3xl font-black tracking-tight">
          ColorFlip
        </span>
      </div>

      <div className="mb-10 flex items-center justify-center gap-3">
        {cards.map((card, index) => (
          <div
            key={card.label}
            className={`flex h-24 w-16 items-center justify-center rounded-xl border-[3px] border-white text-3xl font-black text-white shadow-xl sm:h-28 sm:w-20 ${card.color} animate-bounce`}
            style={{
              animationDelay: `${index * 150}ms`,
              animationDuration: "900ms",
            }}
          >
            {card.label}
          </div>
        ))}
      </div>

      <h1 className="text-xl font-extrabold sm:text-2xl">
        Shuffling the deck...
      </h1>

      <p className="mt-3 text-center text-sm text-red-100 sm:text-base">
        Getting your next game ready.
      </p>

      <div className="mt-8 h-1.5 w-48 overflow-hidden rounded-full bg-white/20">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-white" />
      </div>
    </main>
  );
}