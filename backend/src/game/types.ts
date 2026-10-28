export type CardColor = "red" | "blue" | "green" | "yellow";

export type ActionType = "skip" | "reverse" | "draw-two";

export type CardValue =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | ActionType
  | "wild"
  | "wild-draw-four";

export interface Card {
  id: string;
  color: CardColor | null;
  value: CardValue;
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  connected: boolean;
  isComputer?: boolean;
}

export interface GameState {
  roomId: string;
  players: Player[];
  drawPile: Card[];
  discardPile: Card[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  currentColor: CardColor;
  status: "waiting" | "playing" | "finished";
  winnerId: string | null;
  drawnCardId: string | null;
}
