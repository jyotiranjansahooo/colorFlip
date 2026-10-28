"use client";

const showcaseCards = [
  { color: "showcase-red", value: "7", label: "Red seven" },
  { color: "showcase-blue", value: "2", label: "Blue two" },
  { color: "showcase-green", value: "5", label: "Green five" },
  { color: "showcase-yellow", value: "0", label: "Yellow zero" },
];

export default function CardShowcase() {
  return (
    <div
      className="card-showcase"
      role="img"
      aria-label="Four colorful playing cards: red seven, blue two, green five, and yellow zero"
    >
      {showcaseCards.map((card, index) => (
        <div
          key={card.label}
          className={"showcase-card " + card.color}
          style={{ "--card-index": index } as React.CSSProperties}
          aria-hidden="true"
        >
          <span className="showcase-card-corner">{card.value}</span>
          <span className="showcase-card-center">{card.value}</span>
          <span className="showcase-card-bottom">{card.value}</span>
        </div>
      ))}
    </div>
  );
}