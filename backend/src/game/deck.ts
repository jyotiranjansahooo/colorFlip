import { randomInt, randomUUID } from "node:crypto";
import type { Card, CardColor, CardValue } from "./types.js";

const COLORS: CardColor[] = [
  "red",
  "blue",
  "green",
  "yellow",
];

export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const color of COLORS) {
    deck.push({
      id: randomUUID(),
      color,
      value: "0",
    });

    for (let number = 1; number <= 9; number++) {
      for (let copy = 0; copy < 2; copy++) {
        deck.push({
          id: randomUUID(),
          color,
          value: String(number) as CardValue,
        });
      }
    }

    const actions: CardValue[] = [
      "skip",
      "reverse",
      "draw-two",
    ];

    for (const action of actions) {
      for (let copy = 0; copy < 2; copy++) {
        deck.push({
          id: randomUUID(),
          color,
          value: action,
        });
      }
    }
  }

  for (let copy = 0; copy < 4; copy++) {
    deck.push({
      id: randomUUID(),
      color: null,
      value: "wild",
    });

    deck.push({
      id: randomUUID(),
      color: null,
      value: "wild-draw-four",
    });
  }

  return shuffleDeck(deck);
}

export function shuffleDeck<T>(cards: T[]): T[] {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index--) {
    const randomIndex = randomInt(index + 1);

    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}
