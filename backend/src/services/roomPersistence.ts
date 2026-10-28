import RoomModel from "../models/Room.js";
import type { Card, GameState, Player } from "../game/types.js";

export type PersistedRoomStatus = "waiting" | "playing" | "finished";

export interface RoomSnapshot {
  roomId: string;
  hostId: string;
  status: PersistedRoomStatus;
  players: Player[];
  game: GameState | null;
}

export interface StoredRoomSnapshot extends RoomSnapshot {
  reconnectTokens: Record<string, string>;
  createdAt?: Date;
  updatedAt?: Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCard(value: unknown): value is Card {
  if (!isRecord(value)) {
    return false;
  }

  const validColors = ["red", "blue", "green", "yellow", null];
  const validValues = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "skip",
    "reverse",
    "draw-two",
    "wild",
    "wild-draw-four",
  ];

  return (
    typeof value.id === "string" &&
    validColors.includes(value.color as string | null) &&
    typeof value.value === "string" &&
    validValues.includes(value.value)
  );
}

function isPlayer(value: unknown): value is Player {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.connected === "boolean" &&
    Array.isArray(value.hand) &&
    value.hand.every(isCard)
  );
}

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.roomId === "string" &&
    Array.isArray(value.players) &&
    value.players.every(isPlayer) &&
    Array.isArray(value.drawPile) &&
    value.drawPile.every(isCard) &&
    Array.isArray(value.discardPile) &&
    value.discardPile.every(isCard) &&
    typeof value.currentPlayerIndex === "number" &&
    (value.direction === 1 || value.direction === -1) &&
    typeof value.currentColor === "string" &&
    ["red", "blue", "green", "yellow"].includes(value.currentColor) &&
    ["waiting", "playing", "finished"].includes(String(value.status)) &&
    (typeof value.winnerId === "string" || value.winnerId === null) &&
    (typeof value.drawnCardId === "string" || value.drawnCardId === null)
  );
}

function isRoomStatus(value: unknown): value is PersistedRoomStatus {
  return value === "waiting" || value === "playing" || value === "finished";
}

function normalizeReconnectTokens(value: unknown): Record<string, string> {
  const tokens: Record<string, string> = {};

  if (value instanceof Map) {
    for (const [playerId, token] of value.entries()) {
      if (typeof playerId === "string" && typeof token === "string") {
        tokens[playerId] = token;
      }
    }

    return tokens;
  }

  if (isRecord(value)) {
    for (const [playerId, token] of Object.entries(value)) {
      if (typeof token === "string") {
        tokens[playerId] = token;
      }
    }
  }

  return tokens;
}

export async function saveRoom(
  room: RoomSnapshot,
  reconnectTokens: ReadonlyMap<string, string>,
): Promise<void> {
const tokens: Record<string, string> = {};
const roomPlayerIds = new Set(room.players.map((player) => player.id));

for (const [playerId, token] of reconnectTokens.entries()) {
  if (roomPlayerIds.has(playerId)) {
    tokens[playerId] = token;
  }
}

  await RoomModel.updateOne(
    { roomId: room.roomId },
    {
      $set: {
        hostId: room.hostId,
        status: room.status,
        players: room.players,
        game: room.game,
        reconnectTokens: tokens,
      },
    },
    {
      upsert: true,
      runValidators: true,
    },
  );
}

export async function loadRooms(): Promise<StoredRoomSnapshot[]> {
  const documents = await RoomModel.find({}).lean().exec();
  const restoredRooms: StoredRoomSnapshot[] = [];

  for (const document of documents) {
    const data: unknown = document;

    if (!isRecord(data)) {
      continue;
    }

    if (
      typeof data.roomId !== "string" ||
      typeof data.hostId !== "string" ||
      !isRoomStatus(data.status) ||
      !Array.isArray(data.players) ||
      !data.players.every(isPlayer)
    ) {
      console.warn("Skipping invalid saved room:", data.roomId);
      continue;
    }

    let game: GameState | null = null;

    if (data.game !== null && data.game !== undefined) {
      if (!isGameState(data.game)) {
        console.warn("Skipping room with invalid game state:", data.roomId);
        continue;
      }

      game = data.game;
    }

    restoredRooms.push({
      roomId: data.roomId,
      hostId: data.hostId,
      status: data.status,
      players: data.players,
      game,
      reconnectTokens: normalizeReconnectTokens(data.reconnectTokens),
      ...(data.createdAt instanceof Date ? { createdAt: data.createdAt } : {}),
      ...(data.updatedAt instanceof Date ? { updatedAt: data.updatedAt } : {}),
    });
  }

  return restoredRooms;
}

export async function deleteRoom(roomId: string): Promise<void> {
  await RoomModel.deleteOne({ roomId }).exec();
}
