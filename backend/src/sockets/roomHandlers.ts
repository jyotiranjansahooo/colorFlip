import { randomBytes, randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import {
  deleteRoom,
  loadRooms,
  saveRoom,
} from "../services/roomPersistence.js";
import type {
  ActionType,
  Card,
  CardColor,
  CardValue,
  GameState,
  Player,
} from "../game/types.js";
type OpponentMode = "friends" | "computers" | "mixed";
type RoomStatus = "waiting" | "playing" | "finished";

interface RoomSettings {
  maxPlayers: 2 | 3 | 4;
  opponentMode: OpponentMode;
}
interface RoomSettings {
  maxPlayers: 2 | 3 | 4;
  opponentMode: OpponentMode;
}
interface Room {
  roomId: string;
  hostId: string;
  status: RoomStatus;
  players: Player[];
  game: GameState | null;
  settings: RoomSettings;
}
interface RoomSettingsPayload {
  maxPlayers: 2 | 3 | 4;
  opponentMode: OpponentMode;
}
interface RoomCreatePayload {
  name: string;
}

interface RoomJoinPayload {
  roomId: string;
  name: string;
}

interface RoomCreatedPayload {
  roomId: string;
  playerId: string;
  reconnectToken: string;
}

interface RoomJoinedPayload {
  roomId: string;
  playerId: string;
  reconnectToken: string;
}

interface PublicPlayer {
  id: string;
  name: string;
  cardCount: number;
  connected: boolean;
  isComputer: boolean;
}

interface PublicGameState {
  hand: Card[];
  discardPile: Card[];
  drawPileCount: number;
  currentPlayerIndex: number;
  currentColor: CardColor;
  direction: 1 | -1;
  drawnCardId: string | null;
  winnerId: string | null;
}

interface PublicRoomState {
  roomId: string;
  hostId: string;
  status: RoomStatus;
  players: PublicPlayer[];
  game: PublicGameState | null;
  settings: RoomSettings;
}

interface SocketSession {
  roomId: string;
  playerId: string;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;
const STARTING_HAND_SIZE = 7;

const COLORS: CardColor[] = ["red", "blue", "green", "yellow"];

const ACTIONS: ActionType[] = ["skip", "reverse", "draw-two"];

const rooms = new Map<string, Room>();
const sessions = new Map<string, SocketSession>();
const reconnectTokens = new Map<string, string>();

export async function restorePersistedRooms(): Promise<void> {
  const savedRooms = await loadRooms();

  for (const savedRoom of savedRooms) {
    const restoredRoom = {
      roomId: savedRoom.roomId,
      hostId: savedRoom.hostId,
      status: savedRoom.status,
      players: savedRoom.players.map((player) => ({
        ...player,
        connected: false,
      })),
      game: savedRoom.game
        ? {
            ...savedRoom.game,
            players: savedRoom.game.players.map((player) => ({
              ...player,
              connected: false,
            })),
          }
        : null,
      settings: savedRoom.settings,
    };

    rooms.set(restoredRoom.roomId, restoredRoom);

    for (const [playerId, token] of Object.entries(savedRoom.reconnectTokens)) {
      reconnectTokens.set(playerId, token);
    }

    await saveRoom(restoredRoom, reconnectTokens);
  }

  console.log("Restored " + savedRooms.length + " saved room(s) from MongoDB.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCardColor(value: unknown): value is CardColor {
  return typeof value === "string" && COLORS.includes(value as CardColor);
}

function isValidNickname(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]{1,20}$/.test(value);
}

function normalizeNickname(value: string): string {
  return value.trim().toLowerCase();
}

function createRoomCode(): string {
  let roomId = "";

  do {
    roomId = randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(roomId));

  return roomId;
}
function createComputerPlayer(index: number): Player {
  const names = ["Nova", "Blaze", "Pixel", "Bolt"];

  return {
    id: randomUUID(),
    name: "CPU " + (names[index % names.length] ?? "Player"),
    hand: [],
    connected: true,
    isComputer: true,
  };
}
function createPlayer(name: string): Player {
  return {
    id: randomUUID(),
    name,
    hand: [],
    connected: true,
  };
}

function getSession(socket: Socket): SocketSession | undefined {
  return sessions.get(socket.id);
}

function getSessionRoom(socket: Socket): {
  session: SocketSession;
  room: Room;
  player: Player;
} | null {
  const session = getSession(socket);

  if (!session) {
    return null;
  }

  const room = rooms.get(session.roomId);

  if (!room) {
    sessions.delete(socket.id);
    return null;
  }

  const player = room.players.find(
    (candidate) => candidate.id === session.playerId,
  );

  if (!player) {
    sessions.delete(socket.id);
    return null;
  }

  return { session, room, player };
}

function findSocketId(room: Room, playerId: string): string | undefined {
  for (const [socketId, session] of sessions.entries()) {
    if (session.roomId === room.roomId && session.playerId === playerId) {
      return socketId;
    }
  }

  return undefined;
}

function buildPublicState(room: Room, playerId: string): PublicRoomState {
  const players: PublicPlayer[] = room.players.map((player) => {
    const gamePlayer = room.game?.players.find(
      (candidate) => candidate.id === player.id,
    );

    return {
      id: player.id,
      name: player.name,
      cardCount: gamePlayer?.hand.length ?? player.hand.length,
      connected: player.connected,
      isComputer: player.isComputer ?? false,
    };
  });

  let game: PublicGameState | null = null;

  if (room.game) {
    const ownPlayer = room.game.players.find(
      (player) => player.id === playerId,
    );

    game = {
      hand: ownPlayer ? ownPlayer.hand.map((card) => ({ ...card })) : [],
      discardPile: room.game.discardPile.map((card) => ({ ...card })),
      drawPileCount: room.game.drawPile.length,
      currentPlayerIndex: room.game.currentPlayerIndex,
      currentColor: room.game.currentColor,
      direction: room.game.direction,
      drawnCardId: room.game.drawnCardId,
      winnerId: room.game.winnerId,
    };
  }

  return {
    roomId: room.roomId,
    hostId: room.hostId,
    status: room.status,
    players,
    game,
    settings: { ...room.settings },
  };
}

function emitRoomState(io: Server, room: Room): void {
  for (const player of room.players) {
    const socketId = findSocketId(room, player.id);

    if (!socketId) {
      continue;
    }

    io.to(socketId).emit("room:state", buildPublicState(room, player.id));
  }
}

function emitRoomError(socket: Socket, message: string): void {
  socket.emit("room:error", message);
}

function emitGameError(socket: Socket, message: string): void {
  socket.emit("game:error", message);
}

function hasNickname(
  room: Room,
  nickname: string,
  exceptPlayerId?: string,
): boolean {
  return room.players.some(
    (player) => player.id !== exceptPlayerId && player.name === nickname,
  );
}

function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const color of COLORS) {
    deck.push({
      id: randomUUID(),
      color,
      value: "0",
    });

    for (let number = 1; number <= 9; number += 1) {
      for (let copy = 0; copy < 2; copy += 1) {
        deck.push({
          id: randomUUID(),
          color,
          value: String(number) as CardValue,
        });
      }
    }

    for (const action of ACTIONS) {
      for (let copy = 0; copy < 2; copy += 1) {
        deck.push({
          id: randomUUID(),
          color,
          value: action,
        });
      }
    }
  }

  for (let copy = 0; copy < 4; copy += 1) {
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

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = randomBytes(4).readUInt32BE(0) % (index + 1);

    const currentCard = shuffled[index];
    const otherCard = shuffled[otherIndex];

    if (currentCard && otherCard) {
      shuffled[index] = otherCard;
      shuffled[otherIndex] = currentCard;
    }
  }

  return shuffled;
}

function refillDrawPile(game: GameState): void {
  if (game.drawPile.length > 0 || game.discardPile.length <= 1) {
    return;
  }

  const topCard = game.discardPile[game.discardPile.length - 1];

  if (!topCard) {
    return;
  }

  const recyclableCards = game.discardPile.slice(0, -1);

  game.discardPile = [topCard];
  game.drawPile = shuffleDeck(recyclableCards);
}

function drawOneCard(game: GameState): Card | null {
  refillDrawPile(game);

  const card = game.drawPile.pop();

  return card ?? null;
}

function isPlayableCard(card: Card, game: GameState, player: Player): boolean {
  const topCard = game.discardPile[game.discardPile.length - 1];

  if (!topCard) {
    return true;
  }

  if (card.value === "wild") {
    return true;
  }

  if (card.value === "wild-draw-four") {
    return !player.hand.some(
      (handCard) =>
        handCard.color === game.currentColor &&
        handCard.value !== "wild" &&
        handCard.value !== "wild-draw-four",
    );
  }

  return card.color === game.currentColor || card.value === topCard.value;
}

function advanceTurn(game: GameState, steps = 1): void {
  const playerCount = game.players.length;

  if (playerCount === 0) {
    return;
  }

  const nextIndex = game.currentPlayerIndex + game.direction * steps;

  game.currentPlayerIndex =
    ((nextIndex % playerCount) + playerCount) % playerCount;

  game.drawnCardId = null;
}

function createInitialGame(room: Room): GameState {
  const players: Player[] = room.players.map((player) => ({
    id: player.id,
    name: player.name,
    hand: [],
    connected: player.connected,
    isComputer: player.isComputer ?? false,
  }));

  const drawPile = createDeck();

  for (let cardIndex = 0; cardIndex < STARTING_HAND_SIZE; cardIndex += 1) {
    for (const player of players) {
      const card = drawPile.pop();

      if (!card) {
        throw new Error("The deck ran out while dealing starting hands.");
      }

      player.hand.push(card);
    }
  }

  let startingCardIndex = -1;

  for (let index = drawPile.length - 1; index >= 0; index -= 1) {
    const card = drawPile[index];

    if (card && card.color !== null && /^[0-9]$/.test(card.value)) {
      startingCardIndex = index;
      break;
    }
  }

  if (startingCardIndex < 0) {
    throw new Error("Could not find a numeric starting card.");
  }

  const startingCard = drawPile.splice(startingCardIndex, 1)[0];

  if (!startingCard || !startingCard.color) {
    throw new Error("The starting card is invalid.");
  }

  const game: GameState = {
    roomId: room.roomId,
    players,
    drawPile,
    discardPile: [startingCard],
    currentPlayerIndex: 0,
    direction: 1,
    currentColor: startingCard.color,
    status: "playing",
    winnerId: null,
    drawnCardId: null,
  };

  return game;
}

function removePlayerFromRoom(io: Server, room: Room, playerId: string): void {
  const playerIndex = room.players.findIndex(
    (player) => player.id === playerId,
  );

  if (playerIndex < 0) {
    return;
  }

  room.players.splice(playerIndex, 1);
  reconnectTokens.delete(playerId);

  if (room.game) {
    const gamePlayerIndex = room.game.players.findIndex(
      (player) => player.id === playerId,
    );

    if (gamePlayerIndex >= 0) {
      room.game.players.splice(gamePlayerIndex, 1);

      if (room.game.players.length === 0) {
        room.game = null;
        room.status = "waiting";
      } else {
        if (gamePlayerIndex < room.game.currentPlayerIndex) {
          room.game.currentPlayerIndex -= 1;
        }

        if (room.game.currentPlayerIndex >= room.game.players.length) {
          room.game.currentPlayerIndex = 0;
        }

        if (room.game.players.length === 1 && room.status === "playing") {
          const remainingPlayer = room.game.players[0];

          if (remainingPlayer) {
            room.game.winnerId = remainingPlayer.id;
            room.game.status = "finished";
            room.status = "finished";
          }
        }
      }
    }
  }

  if (room.players.length === 0) {
    rooms.delete(room.roomId);

    void deleteRoom(room.roomId).catch((error: unknown) => {
      console.error("Failed to delete empty room from MongoDB:", error);
    });

    return;
  }

  if (room.hostId === playerId) {
    const nextHost = room.players[0];

    if (nextHost) {
      room.hostId = nextHost.id;
    }
  }

  emitRoomState(io, room);

  void saveRoom(room, reconnectTokens).catch((error: unknown) => {
    console.error("Failed to save room after player removal:", error);
  });
}

function validateGameSession(
  socket: Socket,
): { room: Room; game: GameState; player: Player } | null {
  const sessionData = getSessionRoom(socket);

  if (!sessionData) {
    emitGameError(socket, "Join a room first.");
    return null;
  }

  const { room, player } = sessionData;

  if (!room.game || room.status !== "playing") {
    emitGameError(socket, "The game has not started.");
    return null;
  }

  const gamePlayer = room.game.players.find(
    (candidate) => candidate.id === player.id,
  );

  if (!gamePlayer) {
    emitGameError(socket, "Join a room first.");
    return null;
  }

  return {
    room,
    game: room.game,
    player: gamePlayer,
  };
}

function playCardForPlayer(
  game: GameState,
  player: Player,
  cardId: string,
  chosenColor?: CardColor,
): string | null {
  if (game.status !== "playing") {
    return "The game has not started.";
  }

  const currentPlayer = game.players[game.currentPlayerIndex];

  if (!currentPlayer || currentPlayer.id !== player.id) {
    return "It is not your turn.";
  }

  const handIndex = player.hand.findIndex((card) => card.id === cardId);

  if (handIndex < 0) {
    return "That card is not in your hand.";
  }

  const card = player.hand[handIndex];

  if (!card) {
    return "That card is not in your hand.";
  }

  if (!isPlayableCard(card, game, player)) {
    return "That card cannot be played.";
  }

  if (
    (card.value === "wild" || card.value === "wild-draw-four") &&
    !isCardColor(chosenColor)
  ) {
    return "Choose a valid color for the wild card.";
  }

  if (
    card.value !== "wild" &&
    card.value !== "wild-draw-four" &&
    chosenColor !== undefined
  ) {
    if (!isCardColor(chosenColor)) {
      return "Invalid card play details.";
    }
  }

  player.hand.splice(handIndex, 1);
  game.discardPile.push(card);

  if (card.value === "wild" || card.value === "wild-draw-four") {
    if (!chosenColor) {
      return "Choose a valid color for the wild card.";
    }

    game.currentColor = chosenColor;
  } else if (card.color) {
    game.currentColor = card.color;
  }

  game.drawnCardId = null;

  if (player.hand.length === 0) {
    game.winnerId = player.id;
    game.status = "finished";
    return null;
  }

  if (card.value === "reverse") {
    game.direction = game.direction === 1 ? -1 : 1;

    if (game.players.length === 2) {
      advanceTurn(game, 2);
    } else {
      advanceTurn(game);
    }

    return null;
  }

  if (card.value === "skip") {
    advanceTurn(game, 2);
    return null;
  }

  if (card.value === "draw-two") {
    advanceTurn(game);

    const target = game.players[game.currentPlayerIndex];

    if (target) {
      for (let index = 0; index < 2; index += 1) {
        const drawnCard = drawOneCard(game);

        if (drawnCard) {
          target.hand.push(drawnCard);
        }
      }
    }

    advanceTurn(game);
    return null;
  }

  if (card.value === "wild-draw-four") {
    advanceTurn(game);

    const target = game.players[game.currentPlayerIndex];

    if (target) {
      for (let index = 0; index < 4; index += 1) {
        const drawnCard = drawOneCard(game);

        if (drawnCard) {
          target.hand.push(drawnCard);
        }
      }
    }

    advanceTurn(game);
    return null;
  }

  advanceTurn(game);
  return null;
}

function drawForPlayer(game: GameState, player: Player): string | null {
  if (game.status !== "playing") {
    return "The game has not started.";
  }

  const currentPlayer = game.players[game.currentPlayerIndex];

  if (!currentPlayer || currentPlayer.id !== player.id) {
    return "It is not your turn.";
  }

  if (game.drawnCardId !== null) {
    return "You have already drawn a card. Play it or pass your turn.";
  }

  const card = drawOneCard(game);

  if (!card) {
    return "No cards remain in the draw pile.";
  }

  player.hand.push(card);
  game.drawnCardId = card.id;

  return null;
}

function passPlayerTurn(game: GameState, player: Player): string | null {
  if (game.status !== "playing") {
    return "The game has not started.";
  }

  const currentPlayer = game.players[game.currentPlayerIndex];

  if (!currentPlayer || currentPlayer.id !== player.id) {
    return "It is not your turn.";
  }

  if (game.drawnCardId === null) {
    return "Draw a card before passing your turn.";
  }

  advanceTurn(game);
  return null;
}
const processingComputerRooms = new Set<string>();

function chooseComputerColor(player: Player): CardColor {
  const counts: Record<CardColor, number> = {
    red: 0,
    blue: 0,
    green: 0,
    yellow: 0,
  };

  for (const card of player.hand) {
    if (card.color !== null) {
      counts[card.color] += 1;
    }
  }

  let bestColor: CardColor = "red";

  for (const color of COLORS) {
    if (counts[color] > counts[bestColor]) {
      bestColor = color;
    }
  }

  return bestColor;
}

async function processComputerTurns(io: Server, room: Room): Promise<void> {
  if (processingComputerRooms.has(room.roomId)) {
    return;
  }

  processingComputerRooms.add(room.roomId);

  try {
    let turnsProcessed = 0;

    while (turnsProcessed < 30) {
      const game = room.game;

      if (!game || room.status !== "playing") {
        return;
      }

      if (game.status !== "playing") {
        room.status = "finished";
        emitRoomState(io, room);
        return;
      }

      const currentPlayer = game.players[game.currentPlayerIndex];

      if (!currentPlayer || !currentPlayer.isComputer) {
        return;
      }

      turnsProcessed += 1;

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 650);
      });

      // Ensure the same game is still active after the delay.
      if (room.game !== game || room.status !== "playing") {
        return;
      }

      const player = game.players[game.currentPlayerIndex];

      if (!player || !player.isComputer) {
        return;
      }

      let actionError: string | null = null;

      const playableCard = player.hand.find((card) =>
        isPlayableCard(card, game, player),
      );

      if (playableCard) {
        const chosenColor =
          playableCard.color === null ? chooseComputerColor(player) : undefined;

        actionError = playCardForPlayer(
          game,
          player,
          playableCard.id,
          chosenColor,
        );
      } else {
        actionError = drawForPlayer(game, player);

        if (!actionError) {
          const drawnCardId = game.drawnCardId;

          const drawnCard = player.hand.find((card) => card.id === drawnCardId);

          if (drawnCard && isPlayableCard(drawnCard, game, player)) {
            const chosenColor =
              drawnCard.color === null
                ? chooseComputerColor(player)
                : undefined;

            actionError = playCardForPlayer(
              game,
              player,
              drawnCard.id,
              chosenColor,
            );
          } else {
            actionError = passPlayerTurn(game, player);
          }
        } else {
          // If no card can be drawn, advance the turn safely.
          advanceTurn(game);
          actionError = null;
        }
      }

      if (actionError) {
        console.error("Computer turn failed:", player.name, actionError);

        // Prevent a stuck game if an unexpected validation error occurs.
        if (
          game.status === "playing" &&
          game.players[game.currentPlayerIndex]?.id === player.id
        ) {
          advanceTurn(game);
        }
      }

      if (game.winnerId !== null) {
        room.status = "finished";
      }

      emitRoomState(io, room);

      try {
        await saveRoom(room, reconnectTokens);
      } catch (error: unknown) {
        console.error("Failed to save room after computer turn:", error);
      }

      if (room.status !== "playing" || game.status !== "playing") {
        return;
      }
    }

    console.warn("Computer turn limit reached for room:", room.roomId);
  } finally {
    processingComputerRooms.delete(room.roomId);
  }
}

function handleCreateRoom(socket: Socket, payload: unknown, io: Server): void {
  if (!isRecord(payload) || typeof payload.name !== "string") {
    emitRoomError(socket, "Invalid room creation details.");
    return;
  }

  const name = normalizeNickname(payload.name);

  if (!isValidNickname(name)) {
    emitRoomError(
      socket,
      "Your nickname must contain 1–20 lowercase letters or numbers, with no spaces.",
    );
    return;
  }

  const roomId = createRoomCode();
  const player = createPlayer(name);
  const reconnectToken = randomBytes(32).toString("hex");
  reconnectTokens.set(player.id, reconnectToken);

  const room: Room = {
    roomId,
    hostId: player.id,
    status: "waiting",
    players: [player],
    game: null,
    settings: {
      maxPlayers: 4,
      opponentMode: "friends",
    },
  };

  rooms.set(roomId, room);
  sessions.set(socket.id, {
    roomId,
    playerId: player.id,
  });
  console.log("Creating room:", roomId);
  socket.emit("room:created", {
    roomId,
    playerId: player.id,
    reconnectToken,
  } satisfies RoomCreatedPayload);

  emitRoomState(io, room);

  void saveRoom(room, reconnectTokens)
    .then(() => {
      console.log("Room saved to MongoDB:", roomId);
    })
    .catch((error: unknown) => {
      console.error("Failed to save created room:", error);
    });
}

function handleJoinRoom(socket: Socket, payload: unknown, io: Server): void {
  if (
    !isRecord(payload) ||
    typeof payload.roomId !== "string" ||
    typeof payload.name !== "string"
  ) {
    emitRoomError(socket, "Invalid room joining details.");
    return;
  }

  const roomId = payload.roomId.trim().toUpperCase();
  const name = normalizeNickname(payload.name);

  if (!/^[A-F0-9]{6}$/.test(roomId)) {
    emitRoomError(socket, "Enter a valid 6-character room code.");
    return;
  }

  const room = rooms.get(roomId);

  if (!room) {
    emitRoomError(socket, "Room not found.");
    return;
  }

  if (room.status !== "waiting") {
    emitRoomError(socket, "This game has already started.");
    return;
  }

  if (!isValidNickname(name)) {
    emitRoomError(
      socket,
      "Your nickname must contain 1–20 lowercase letters or numbers, with no spaces.",
    );
    return;
  }

  if (hasNickname(room, name)) {
    emitRoomError(socket, "That nickname is already being used in this room.");
    return;
  }

  if (room.players.length >= room.settings.maxPlayers) {
    emitRoomError(socket, "This room cannot accept more players.");
    return;
  }

  const player = createPlayer(name);
  const reconnectToken = randomBytes(32).toString("hex");
  reconnectTokens.set(player.id, reconnectToken);

  room.players.push(player);

  sessions.set(socket.id, {
    roomId: room.roomId,
    playerId: player.id,
  });

  socket.emit("room:joined", {
    roomId: room.roomId,
    playerId: player.id,
    reconnectToken,
  } satisfies RoomJoinedPayload);

  emitRoomState(io, room);

  void saveRoom(room, reconnectTokens).catch((error: unknown) => {
    console.error("Failed to save room after player joined:", error);
  });
}
function handleUpdateRoomSettings(
  socket: Socket,
  payload: unknown,
  io: Server,
): void {
  const sessionData = getSessionRoom(socket);

  if (!sessionData) {
    emitRoomError(socket, "Join a room first.");
    return;
  }

  const { room, player } = sessionData;

  if (player.id !== room.hostId) {
    emitRoomError(socket, "Only the host can change room settings.");
    return;
  }

  if (room.status !== "waiting") {
    emitRoomError(
      socket,
      "Room settings cannot be changed after the game starts.",
    );
    return;
  }

  if (!isRecord(payload)) {
    emitRoomError(socket, "Invalid room settings.");
    return;
  }

  const maxPlayers = payload.maxPlayers;
  const opponentMode = payload.opponentMode;

  if (maxPlayers !== 2 && maxPlayers !== 3 && maxPlayers !== 4) {
    emitRoomError(socket, "Choose 2, 3, or 4 players.");
    return;
  }

  if (
    opponentMode !== "friends" &&
    opponentMode !== "computers" &&
    opponentMode !== "mixed"
  ) {
    emitRoomError(socket, "Choose a valid opponent mode.");
    return;
  }

  if (room.players.length > maxPlayers) {
    emitRoomError(
      socket,
      "There are already too many human players for that limit.",
    );
    return;
  }

  room.settings = {
    maxPlayers,
    opponentMode,
  };

  emitRoomState(io, room);

  void saveRoom(room, reconnectTokens).catch((error: unknown) => {
    console.error("Failed to save room settings:", error);
  });
}
function handleStartRoom(socket: Socket, io: Server): void {
  const sessionData = getSessionRoom(socket);

  if (!sessionData) {
    emitRoomError(socket, "Join a room first.");
    return;
  }

  const { room, player } = sessionData;

  if (room.hostId !== player.id) {
    emitRoomError(socket, "Only the room host can start the game.");
    return;
  }

  if (room.status !== "waiting") {
    emitRoomError(socket, "The game has already started.");
    return;
  }
  const disconnectedPlayers = room.players.filter(
    (roomPlayer) => !roomPlayer.isComputer && !roomPlayer.connected,
  );

  if (disconnectedPlayers.length > 0) {
    emitRoomError(
      socket,
      "Cannot start the game. All players must be connected. Remove disconnected players or ask them to reconnect.",
    );
    return;
  }
  const maxPlayers = room.settings.maxPlayers;
  const opponentMode = room.settings.opponentMode;

  const humanPlayers = room.players.filter(
    (roomPlayer) => !roomPlayer.isComputer,
  );

  if (humanPlayers.length > maxPlayers) {
    emitRoomError(socket, "The room has more players than the selected limit.");
    return;
  }

  if (opponentMode === "friends" && humanPlayers.length < 2) {
    emitRoomError(
      socket,
      "Invite at least one friend before starting a friends-only game.",
    );
    return;
  }

  if (humanPlayers.length < 1) {
    emitRoomError(socket, "At least one human player is required.");
    return;
  }

  const originalPlayers = [...room.players];

  try {
    if (opponentMode === "computers" || opponentMode === "mixed") {
      const emptySeats = maxPlayers - humanPlayers.length;

      for (let index = 0; index < emptySeats; index += 1) {
        room.players.push(createComputerPlayer(index));
      }
    }

    if (room.players.length < 2) {
      room.players = originalPlayers;

      emitRoomError(socket, "The game requires at least two players.");
      return;
    }

    room.game = createInitialGame(room);
    room.status = "playing";

    emitRoomState(io, room);

    void saveRoom(room, reconnectTokens).catch((error: unknown) => {
      console.error("Failed to save room after game started:", error);
    });

    // If the first player is a computer, start its turn automatically.
    void processComputerTurns(io, room);
  } catch (error: unknown) {
    room.players = originalPlayers;
    room.game = null;
    room.status = "waiting";

    console.error("Failed to start game:", error);

    emitRoomError(socket, "Unable to start the game. Please try again.");
  }
}

function handlePlayCard(socket: Socket, payload: unknown, io: Server): void {
  if (
    !isRecord(payload) ||
    typeof payload.cardId !== "string" ||
    payload.cardId.trim().length === 0 ||
    (payload.chosenColor !== undefined && !isCardColor(payload.chosenColor))
  ) {
    emitGameError(socket, "Invalid card play details.");
    return;
  }

  const sessionData = validateGameSession(socket);

  if (!sessionData) {
    return;
  }

  const error = playCardForPlayer(
    sessionData.game,
    sessionData.player,
    payload.cardId,
    payload.chosenColor,
  );

  if (error) {
    emitGameError(socket, error);
    return;
  }

  if (sessionData.game.status === "finished") {
    sessionData.room.status = "finished";
  }

  emitRoomState(io, sessionData.room);

  void saveRoom(sessionData.room, reconnectTokens).catch((error: unknown) => {
    console.error("Failed to save room after card played:", error);
  });

  void processComputerTurns(io, sessionData.room);
}

function handleDrawCard(socket: Socket, io: Server): void {
  const sessionData = validateGameSession(socket);

  if (!sessionData) {
    return;
  }

  const error = drawForPlayer(sessionData.game, sessionData.player);

  if (error) {
    emitGameError(socket, error);
    return;
  }

  emitRoomState(io, sessionData.room);

  void saveRoom(sessionData.room, reconnectTokens).catch((error: unknown) => {
    console.error("Failed to save room after card drawn:", error);
  });
}

function handlePassTurn(socket: Socket, io: Server): void {
  const sessionData = validateGameSession(socket);

  if (!sessionData) {
    return;
  }

  const error = passPlayerTurn(sessionData.game, sessionData.player);

  if (error) {
    emitGameError(socket, error);
    return;
  }

  emitRoomState(io, sessionData.room);

  void saveRoom(sessionData.room, reconnectTokens).catch((error: unknown) => {
    console.error("Failed to save room after turn passed:", error);
  });
}

function handleReconnect(socket: Socket, payload: unknown, io: Server): void {
  if (
    !isRecord(payload) ||
    typeof payload.roomId !== "string" ||
    typeof payload.playerId !== "string" ||
    typeof payload.reconnectToken !== "string"
  ) {
    emitRoomError(socket, "Invalid reconnection details.");
    return;
  }

  const roomId = payload.roomId.trim().toUpperCase();
  const room = rooms.get(roomId);

  if (!room) {
    emitRoomError(socket, "Room not found or expired.");
    return;
  }

  const player = room.players.find(
    (candidate) => candidate.id === payload.playerId,
  );
  const expectedToken = reconnectTokens.get(payload.playerId);

  if (!player || !expectedToken || expectedToken !== payload.reconnectToken) {
    emitRoomError(socket, "Invalid reconnection credentials.");
    return;
  }

  const existingSocketId = findSocketId(room, player.id);

  if (existingSocketId && existingSocketId !== socket.id) {
    sessions.delete(existingSocketId);

    const existingSocket = io.sockets.sockets.get(existingSocketId);

    if (existingSocket?.connected) {
      existingSocket.disconnect(true);
    }
  }

  player.connected = false;

  sessions.set(socket.id, {
    roomId: room.roomId,
    playerId: player.id,
  });

  player.connected = true;

  const gamePlayer = room.game?.players.find(
    (candidate) => candidate.id === player.id,
  );

  if (gamePlayer) {
    gamePlayer.connected = true;
  }

  socket.emit("room:reconnected", {
    roomId: room.roomId,
    playerId: player.id,
  });

  emitRoomState(io, room);

  void saveRoom(room, reconnectTokens).catch((error: unknown) => {
    console.error("Failed to save room after player reconnected:", error);
  });
}

function handleDisconnect(socket: Socket, io: Server): void {
  const session = sessions.get(socket.id);

  if (!session) {
    return;
  }

  sessions.delete(socket.id);

  const room = rooms.get(session.roomId);

  if (!room) {
    return;
  }

  const player = room.players.find(
    (candidate) => candidate.id === session.playerId,
  );

  if (!player) {
    return;
  }

  player.connected = false;

  const gamePlayer = room.game?.players.find(
    (candidate) => candidate.id === player.id,
  );

  if (gamePlayer) {
    gamePlayer.connected = false;
  }

  emitRoomState(io, room);

  void saveRoom(room, reconnectTokens).catch((error: unknown) => {
    console.error("Failed to save room after player disconnected:", error);
  });
}
function handleKickPlayer(socket: Socket, payload: unknown, io: Server): void {
  const sessionData = getSessionRoom(socket);

  if (!sessionData) {
    emitRoomError(socket, "Join a room first.");
    return;
  }

  const { room, player } = sessionData;

  if (player.id !== room.hostId) {
    emitRoomError(socket, "Only the host can kick players.");
    return;
  }

  if (!isRecord(payload) || typeof payload.playerId !== "string") {
    emitRoomError(socket, "Invalid player selection.");
    return;
  }

  const target = room.players.find(
    (candidate) => candidate.id === payload.playerId,
  );

  if (!target) {
    emitRoomError(socket, "Player not found.");
    return;
  }

  if (target.id === room.hostId) {
    emitRoomError(socket, "The host cannot kick themselves.");
    return;
  }

  if (target.connected) {
    emitRoomError(socket, "You can only kick disconnected players.");
    return;
  }

  const targetSocketId = findSocketId(room, target.id);

  if (targetSocketId) {
    sessions.delete(targetSocketId);
    io.to(targetSocketId).emit("room:kicked", {
      message: "The host removed you from the room.",
    });
    io.sockets.sockets.get(targetSocketId)?.disconnect(true);
  }

  removePlayerFromRoom(io, room, target.id);
}
export function registerRoomHandlers(io: Server, socket: Socket): void {
  socket.on("room:reconnect", (payload: unknown) => {
    handleReconnect(socket, payload, io);
  });
  socket.on("room:player:kick", (payload: unknown) => {
    handleKickPlayer(socket, payload, io);
  });
  socket.on("room:create", (payload: unknown) => {
    handleCreateRoom(socket, payload, io);
  });

  socket.on("room:join", (payload: unknown) => {
    handleJoinRoom(socket, payload, io);
  });

  socket.on("room:start", () => {
    handleStartRoom(socket, io);
  });

  socket.on("game:play", (payload: unknown) => {
    handlePlayCard(socket, payload, io);
  });

  socket.on("game:draw", () => {
    handleDrawCard(socket, io);
  });

  socket.on("game:pass", () => {
    handlePassTurn(socket, io);
  });

  socket.on("disconnect", () => {
    handleDisconnect(socket, io);
  });
  socket.on("room:settings:update", (payload: unknown) => {
    handleUpdateRoomSettings(socket, payload, io);
  });
}
