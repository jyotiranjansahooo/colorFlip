export type CardColor = "red" | "blue" | "green" | "yellow";

export type OpponentMode = "friends" | "computers" | "mixed";

export interface RoomSettings {
  maxPlayers: 2 | 3 | 4;
  opponentMode: OpponentMode;
}

export interface RoomPlayer {
  id: string;
  name: string;
  cardCount: number;
  connected: boolean;
}

export interface GameCard {
  id: string;
  color: CardColor | null;
  value: string;
}

export interface GameView {
  hand: GameCard[];
  discardPile: GameCard[];
  drawPileCount: number;
  currentPlayerIndex: number;
  currentColor: CardColor;
  direction: 1 | -1;
  drawnCardId: string | null;
  winnerId: string | null;
}

export interface RoomState {
  roomId: string;
  hostId: string;
  status: "waiting" | "playing" | "finished";
  players: RoomPlayer[];
  settings: RoomSettings;
  game: GameView | null;
}

export type RoomErrorPayload =
  | string
  | {
      message?: string;
      error?: string;
    };

export interface ReconnectCredentials {
  roomId: string;
  playerId: string;
  reconnectToken: string;
}