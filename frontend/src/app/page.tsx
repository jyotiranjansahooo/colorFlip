"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket";

type CardColor = "red" | "blue" | "green" | "yellow";

interface RoomPlayer {
  id: string;
  name: string;
  cardCount: number;
  connected: boolean;
}

interface GameCard {
  id: string;
  color: CardColor | null;
  value: string;
}

interface GameView {
  hand: GameCard[];
  discardPile: GameCard[];
  drawPileCount: number;
  currentPlayerIndex: number;
  currentColor: CardColor;
  direction: 1 | -1;
  drawnCardId: string | null;
  winnerId: string | null;
}

interface RoomState {
  roomId: string;
  hostId: string;
  status: "waiting" | "playing" | "finished";
  players: RoomPlayer[];
  game: GameView | null;
}

type RoomErrorPayload = string | { message?: string; error?: string };
interface ReconnectCredentials {
  roomId: string;
  playerId: string;
  reconnectToken: string;
}

const RECONNECT_STORAGE_KEY = "colorflip-reconnect";
const validColors: CardColor[] = ["red", "blue", "green", "yellow"];

const cardColors: Record<CardColor, string> = {
  red: "bg-red-600 text-white",
  blue: "bg-blue-700 text-white",
  green: "bg-emerald-600 text-white",
  yellow: "bg-amber-300 text-slate-950",
};

const colorPickerStyles: Record<CardColor, string> = {
  red: "border-red-400/30 bg-red-600 hover:bg-red-500 text-white",
  blue: "border-blue-400/30 bg-blue-700 hover:bg-blue-600 text-white",
  green: "border-emerald-400/30 bg-emerald-600 hover:bg-emerald-500 text-white",
  yellow: "border-amber-200/40 bg-amber-300 hover:bg-amber-200 text-slate-950",
};

const guestAdjectives = [
  "swift",
  "misty",
  "bright",
  "calm",
  "cosmic",
  "lucky",
  "quiet",
  "frosty",
  "mellow",
  "bold",
  "silver",
  "sunny",
  "rapid",
  "clever",
  "sky",
];

const guestNouns = [
  "otter",
  "comet",
  "fox",
  "panda",
  "raven",
  "koala",
  "maple",
  "falcon",
  "lotus",
  "tiger",
  "pixel",
  "willow",
  "badger",
  "heron",
  "meteor",
];

function makeGuestName(): string {
  const adjective =
    guestAdjectives[Math.floor(Math.random() * guestAdjectives.length)];

  const noun = guestNouns[Math.floor(Math.random() * guestNouns.length)];
  const number = Math.floor(100 + Math.random() * 900);

  return adjective + noun + number;
}

export default function Home() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectingRef = useRef(false);
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [wildCard, setWildCard] = useState<GameCard | null>(null);

  useEffect(() => {
    const handleConnect = () => {
      setIsConnecting(false);
      setConnected(true);

      const savedCredentials = localStorage.getItem(RECONNECT_STORAGE_KEY);

      if (!savedCredentials) {
        return;
      }

      try {
        const credentials = JSON.parse(
          savedCredentials,
        ) as ReconnectCredentials;

        if (
          !credentials.roomId ||
          !credentials.playerId ||
          !credentials.reconnectToken
        ) {
          localStorage.removeItem(RECONNECT_STORAGE_KEY);
          reconnectingRef.current = false;
          setIsReconnecting(false);
          return;
        }

        reconnectingRef.current = true;
        setIsReconnecting(true);
        setError("");
        setNotice("Reconnecting to your previous game...");

        socket.emit("room:reconnect", credentials);
      } catch {
        localStorage.removeItem(RECONNECT_STORAGE_KEY);
        reconnectingRef.current = false;
        setIsReconnecting(false);
      }
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const saveCredentials = (payload: ReconnectCredentials) => {
      if (
        !payload ||
        typeof payload.roomId !== "string" ||
        typeof payload.playerId !== "string" ||
        typeof payload.reconnectToken !== "string"
      ) {
        setError("The server returned invalid room credentials.");
        return;
      }

      localStorage.setItem(RECONNECT_STORAGE_KEY, JSON.stringify(payload));
      setPlayerId(payload.playerId);
      setRoomCode(payload.roomId);
      setIsReconnecting(false);
      reconnectingRef.current = false;
      setNotice("");
      setError("");
    };

    const handleRoomCreated = (payload: ReconnectCredentials) => {
      saveCredentials(payload);
    };

    const handleRoomJoined = (payload: ReconnectCredentials) => {
      saveCredentials(payload);
    };

    const handleRoomReconnected = (payload: {
      roomId: string;
      playerId: string;
    }) => {
      setPlayerId(payload.playerId);
      setRoomCode(payload.roomId);
      setIsReconnecting(false);
      reconnectingRef.current = false;
      setError("");
      setNotice("Reconnected to your game.");
    };

    const handleRoomState = (nextRoom: RoomState) => {
      setRoom(nextRoom);
      setRoomCode(nextRoom.roomId);
      setError("");
      setIsReconnecting(false);
      reconnectingRef.current = false;
      setNotice((currentNotice) =>
        currentNotice === "Reconnecting to your previous game..."
          ? "Reconnected to your game."
          : currentNotice,
      );
    };

    const handleRoomError = (payload: RoomErrorPayload) => {
      setIsConnecting(false);

      const message =
        typeof payload === "string"
          ? payload
          : (payload.message ?? payload.error ?? "Something went wrong.");

      if (reconnectingRef.current) {
        localStorage.removeItem(RECONNECT_STORAGE_KEY);
        reconnectingRef.current = false;
        setIsReconnecting(false);
        setNotice("");
      }

      setError(message);
    };

    const handleConnectError = () => {
      setIsConnecting(false);
      setConnected(false);
      setError(
        "Cannot connect to the game server. Check that the backend is running.",
      );
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("room:created", handleRoomCreated);
    socket.on("room:joined", handleRoomJoined);
    socket.on("room:reconnected", handleRoomReconnected);
    socket.on("room:state", handleRoomState);
    socket.on("room:error", handleRoomError);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("room:created", handleRoomCreated);
      socket.off("room:joined", handleRoomJoined);
      socket.off("room:reconnected", handleRoomReconnected);
      socket.off("room:state", handleRoomState);
      socket.off("room:error", handleRoomError);
      socket.off("connect_error", handleConnectError);
    };
  }, []);

  const connectAndRun = useCallback(
    (action: () => void) => {
      setError("");
      setNotice("");

      const cleanName = name.trim().toLowerCase();

      if (!/^[a-z0-9]{1,20}$/.test(cleanName)) {
        setError(
          "Use lowercase letters and numbers only, without spaces. Maximum 20 characters.",
        );
        return;
      }

      if (cleanName !== name) {
        setName(cleanName);
      }

      if (socket.connected) {
        action();
        return;
      }

      setIsConnecting(true);

      socket.connect();

      socket.once("connect", action);
    },
    [name],
  );

  function createRoom() {
    localStorage.removeItem(RECONNECT_STORAGE_KEY);
    reconnectingRef.current = false;
    setIsReconnecting(false);
    connectAndRun(() => {
      socket.emit("room:create", {
        name: name.trim().toLowerCase(),
      });
    });
  }

  function joinRoom() {
    const code = roomCode.trim().toUpperCase();

    if (!code) {
      setError("Enter a room code.");
      return;
    }

    localStorage.removeItem(RECONNECT_STORAGE_KEY);
    reconnectingRef.current = false;
    setIsReconnecting(false);

    connectAndRun(() => {
      socket.emit("room:join", {
        roomId: code,
        name: name.trim().toLowerCase(),
      });
    });
  }

  function startGame() {
    setError("");
    socket.emit("room:start");
  }

  function playCard(card: GameCard) {
    if (!room?.game || !isMyTurn || room.status !== "playing") {
      return;
    }

    if (card.color === null) {
      setWildCard(card);
      return;
    }

    socket.emit("game:play", {
      cardId: card.id,
    });
  }

  function chooseWildColor(color: CardColor) {
    if (!wildCard || !isMyTurn || room?.status !== "playing") {
      setWildCard(null);
      return;
    }

    socket.emit("game:play", {
      cardId: wildCard.id,
      chosenColor: color,
    });

    setWildCard(null);
  }

  function drawCard() {
    if (!isMyTurn || room?.status !== "playing") {
      return;
    }

    socket.emit("game:draw");
  }

  function passTurn() {
    if (!isMyTurn || !room?.game?.drawnCardId || room.status !== "playing") {
      return;
    }

    socket.emit("game:pass");
  }

  function leaveRoom() {
    localStorage.removeItem(RECONNECT_STORAGE_KEY);
    reconnectingRef.current = false;
    socket.disconnect();

    setRoom(null);
    setPlayerId("");
    setRoomCode("");
    setNotice("");
    setError("");
    setConnected(false);
    setIsConnecting(false);
    setIsReconnecting(false);
    setWildCard(null);
  }

  async function copyRoomCode() {
    if (!room) {
      return;
    }

    try {
      await navigator.clipboard.writeText(room.roomId);
      setNotice("Room code copied! Share it with your friends.");
    } catch {
      setNotice("Your room code is " + room.roomId + ". Copy it manually.");
    }
  }

  const isHost = Boolean(room && playerId && room.hostId === playerId);

  const playerIndex =
    room?.players.findIndex((player) => player.id === playerId) ?? -1;

  const game = room?.game ?? null;

  const isMyTurn = Boolean(
    game && playerIndex >= 0 && game.currentPlayerIndex === playerIndex,
  );

  const topCard = game?.discardPile[game.discardPile.length - 1] ?? null;

  const winnerName = game?.winnerId
    ? (room?.players.find((player) => player.id === game.winnerId)?.name ??
      "Player")
    : "Player";

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-4 sm:px-6 md:px-12">
        <button
          type="button"
          onClick={leaveRoom}
          aria-label="ColorFlip home"
          className="shrink-0 text-xl font-black tracking-tight sm:text-2xl"
        >
          <span className="text-sky-300">Color</span>
          <span className="text-white">Flip</span>
          <span className="ml-2 text-lg sm:text-xl">🃏</span>
        </button>

        <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs sm:px-4 sm:text-sm">
          <span
            className={
              "h-2 w-2 rounded-full " +
              (connected ? "bg-emerald-400" : "bg-slate-500")
            }
          />

          <span>{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </header>

      {/* Lightweight connection overlay */}
      {(isConnecting || isReconnecting) && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 px-5"
        >
          <div className="w-full max-w-xs rounded-3xl border border-slate-700 bg-slate-900 p-7 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 text-2xl font-black">
              CF
            </div>

            <h2 className="mt-5 text-xl font-bold">
              {isReconnecting
                ? "Reconnecting to ColorFlip"
                : "Connecting to ColorFlip"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              {isReconnecting
                ? "Restoring your previous game. Please wait a moment."
                : "Getting your game room ready. Please wait a moment."}
            </p>

            <div className="mx-auto mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-2/5 rounded-full bg-sky-300" />
            </div>

            <button
              type="button"
              onClick={() => {
                socket.disconnect();
                setIsConnecting(false);
                setIsReconnecting(false);
                reconnectingRef.current = false;
                setConnected(false);
                setError("Connection cancelled.");
              }}
              className="mt-5 text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Custom wild-card color selector */}
      {wildCard && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wild-color-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setWildCard(null);
            }
          }}
        >
          <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6 sm:p-7">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-300 via-blue-700 to-emerald-400 text-xl font-black">
              CF
            </div>

            <h2
              id="wild-color-title"
              className="mt-4 text-center text-2xl font-black"
            >
              Choose a color
            </h2>

            <p className="mt-2 text-center text-sm text-slate-400">
              Which color should the next player match?
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {validColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => chooseWildColor(color)}
                  className={
                    "min-h-20 rounded-2xl border text-base font-extrabold capitalize " +
                    colorPickerStyles[color]
                  }
                >
                  {color}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setWildCard(null)}
              className="mt-4 min-h-11 w-full rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-12 md:py-16">
        {!room ? (
          /* Create and join room screen */
          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
            <div>
              <div className="mb-5 inline-flex rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-sm text-sky-200">
                Lightweight multiplayer · Guest names only
              </div>

              <h1 className="text-5xl font-black leading-tight sm:text-6xl md:text-7xl">
                Ready to
                <br />
                <span className="text-sky-300">flip the</span>
                <br />
                game?
              </h1>

              <p className="mt-5 max-w-md text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
                Create a private room, invite your friends, and see who can get
                rid of all their cards first.
              </p>

              <div className="mt-7 flex flex-wrap gap-2 sm:mt-10 sm:gap-3">
                {[
                  { label: "Royal Blue", color: "bg-blue-700" },
                  { label: "Sky Blue", color: "bg-sky-300" },
                  { label: "Slate Gray", color: "bg-slate-400" },
                  { label: "Matcha Green", color: "bg-emerald-400" },
                ].map((item) => (
                  <span
                    key={item.label}
                    className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 sm:px-4"
                  >
                    <span
                      aria-hidden="true"
                      className={
                        "mr-2 inline-block h-2.5 w-2.5 rounded-full " +
                        item.color
                      }
                    />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Join/create card */}
            <div className="rounded-3xl border border-slate-700 bg-slate-900 p-5 sm:p-7 md:p-8">
              <h2 className="text-2xl font-bold">Join the fun 🎮</h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                No account needed. Use lowercase letters and numbers, without
                spaces.
              </p>

              <label
                htmlFor="nickname"
                className="mt-6 block text-sm font-medium text-slate-300"
              >
                Your guest name
              </label>

              <input
                id="nickname"
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value
                      .toLowerCase()
                      .replace(/\s+/g, "")
                      .replace(/[^a-z0-9]/g, "")
                      .slice(0, 20),
                  )
                }
                maxLength={20}
                autoComplete="nickname"
                placeholder="e.g. swiftotter482"
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-sky-400"
              />

              <button
                type="button"
                onClick={() => setName(makeGuestName())}
                disabled={isConnecting}
                className="mt-2 min-h-9 text-xs font-medium text-sky-300 hover:text-sky-200 disabled:opacity-50"
              >
                ↻ Generate another guest name
              </button>

              <button
                type="button"
                disabled={isConnecting}
                onClick={createRoom}
                className="mt-3 min-h-12 w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isConnecting ? "Connecting..." : "✨ Create Private Room"}
              </button>

              <div className="my-5 flex items-center gap-4 text-xs text-slate-500">
                <div className="h-px flex-1 bg-slate-700" />
                OR JOIN FRIENDS
                <div className="h-px flex-1 bg-slate-700" />
              </div>

              <label
                htmlFor="room-code"
                className="block text-sm font-medium text-slate-300"
              >
                Room code
              </label>

              <input
                id="room-code"
                value={roomCode}
                onChange={(event) =>
                  setRoomCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 6),
                  )
                }
                maxLength={6}
                autoCapitalize="characters"
                placeholder="e.g. A1B2C3"
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 uppercase tracking-widest outline-none focus:border-sky-400"
              />

              <button
                type="button"
                disabled={isConnecting}
                onClick={joinRoom}
                className="mt-3 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 font-bold hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isConnecting ? "Connecting..." : "🔑 Join Room"}
              </button>

              {error && (
                <p role="alert" className="mt-4 text-sm text-rose-300">
                  {error}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Room lobby and game screen */
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs tracking-widest text-slate-400">
                  PRIVATE ROOM
                </p>

                <h1 className="mt-1 text-3xl font-black sm:text-4xl">
                  {room.roomId}
                </h1>
              </div>

              <button
                type="button"
                onClick={copyRoomCode}
                className="min-h-11 rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold hover:bg-slate-800"
              >
                📋 Copy Room Code
              </button>
            </div>

            {notice && (
              <p className="mt-4 text-sm text-emerald-300">{notice}</p>
            )}

            {error && (
              <p role="alert" className="mt-4 text-sm text-rose-300">
                {error}
              </p>
            )}

            {/* Lobby */}
            {room.status === "waiting" ? (
              <div className="mt-6 rounded-3xl border border-slate-700 bg-slate-900 p-5 sm:mt-8 sm:p-8">
                <h2 className="text-xl font-bold">Players in the lobby</h2>

                <p className="mt-2 text-sm text-slate-400">
                  Waiting for friends. {room.players.length}/4 players joined.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {room.players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800 p-4"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-400/10 text-xl">
                        {player.id === room.hostId ? "👑" : "🎮"}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-semibold">{player.name}</p>

                        <p className="mt-1 text-xs text-slate-400">
                          {player.id === room.hostId ? "Room host" : "Player"}
                          {player.id === playerId ? " · You" : ""}
                          {!player.connected ? " · Disconnected" : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {isHost ? (
                  <button
                    type="button"
                    onClick={startGame}
                    disabled={room.players.length < 2}
                    className="mt-7 min-h-12 w-full rounded-xl bg-blue-700 px-5 py-3 font-bold hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {room.players.length < 2
                      ? "Waiting for another player..."
                      : "🚀 Start Game"}
                  </button>
                ) : (
                  <p className="mt-7 text-center text-sm text-slate-400">
                    Waiting for the host to start the game...
                  </p>
                )}

                <p className="mt-4 text-center text-xs text-slate-500">
                  Share the room code with your friends to invite them.
                </p>
              </div>
            ) : game ? (
              /* Game board */
              <div className="mt-6 rounded-3xl border border-slate-700 bg-slate-900 p-4 sm:mt-8 sm:p-6 md:p-8">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <p className="text-xs tracking-widest text-slate-400">
                      PLAYERS
                    </p>

                    <p className="mt-1 font-bold">
                      {room.players.length} players
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs tracking-widest text-slate-400">
                      CURRENT COLOR
                    </p>

                    <p className="mt-1 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 font-bold capitalize">
                      <span
                        className={
                          "h-2.5 w-2.5 rounded-full " +
                          (game.currentColor === "red"
                            ? "bg-red-500"
                            : game.currentColor === "blue"
                              ? "bg-sky-400"
                              : game.currentColor === "green"
                                ? "bg-emerald-400"
                                : "bg-amber-300")
                        }
                      />
                      {game.currentColor}
                    </p>
                  </div>
                </div>

                {/* Player cards */}
                <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-8 sm:grid-cols-4 sm:gap-3">
                  {room.players.map((player, index) => (
                    <div
                      key={player.id}
                      className={
                        "min-w-0 rounded-xl border p-3 " +
                        (game.currentPlayerIndex === index
                          ? "border-sky-400 bg-blue-700/20"
                          : "border-slate-700 bg-slate-800")
                      }
                    >
                      <p className="truncate text-sm font-semibold">
                        {player.name}
                        {player.id === playerId ? " (You)" : ""}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        🃏 {player.cardCount} cards
                      </p>

                      {game.currentPlayerIndex === index &&
                        room.status === "playing" && (
                          <p className="mt-1 text-xs font-semibold text-sky-300">
                            Current turn
                          </p>
                        )}

                      {!player.connected && (
                        <p className="mt-1 text-xs text-rose-300">
                          Disconnected
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Draw pile and discard pile */}
                <div className="mt-6 flex min-h-40 items-center justify-center gap-6 rounded-2xl bg-slate-950 p-4 sm:mt-10 sm:min-h-48 sm:gap-8 sm:p-6">
                  <div className="text-center">
                    <p className="mb-3 text-xs text-slate-400">DRAW PILE</p>

                    <div className="flex h-24 w-16 items-center justify-center rounded-xl border-4 border-white bg-gradient-to-br from-sky-400 via-blue-700 to-emerald-500 text-xl font-black sm:h-28 sm:w-20 sm:text-2xl">
                      CF
                    </div>

                    <p className="mt-2 text-xs text-slate-400">
                      {game.drawPileCount} cards
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="mb-3 text-xs text-slate-400">TOP CARD</p>

                    {topCard ? (
                      <div
                        className={
                          "flex h-24 w-16 rotate-3 items-center justify-center rounded-xl border-4 border-white text-lg font-black shadow-lg sm:h-28 sm:w-20 sm:text-2xl " +
                          cardColors[topCard.color ?? game.currentColor]
                        }
                      >
                        {topCard.value.toUpperCase()}
                      </div>
                    ) : (
                      <div className="flex h-24 w-16 items-center justify-center rounded-xl border border-white/20 text-xs text-slate-500 sm:h-28 sm:w-20">
                        Empty
                      </div>
                    )}
                  </div>
                </div>

                {/* Turn status */}
                <div className="mt-6 text-center">
                  {room.status === "finished" ? (
                    <h2 className="text-xl font-black text-sky-300 sm:text-2xl">
                      🏆 {winnerName} wins!
                    </h2>
                  ) : (
                    <p
                      className={
                        "inline-flex items-center rounded-full border px-4 py-2 text-sm font-bold sm:text-base " +
                        (isMyTurn
                          ? "border-sky-400/40 bg-blue-700/20 text-sky-200"
                          : "border-slate-700 bg-slate-800 text-slate-300")
                      }
                    >
                      {isMyTurn
                        ? "✨ Your turn — play a card or draw"
                        : "Waiting for the next turn"}
                    </p>
                  )}
                </div>

                {/* Player hand */}
                <div className="mt-7">
                  <h2 className="mb-3 text-lg font-bold">
                    Your cards ({game.hand.length})
                  </h2>

                  <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-4 sm:flex-wrap sm:justify-center sm:gap-3 sm:overflow-visible">
                    {game.hand.map((card) => (
                      <button
                        type="button"
                        key={card.id}
                        onClick={() => playCard(card)}
                        disabled={!isMyTurn || room.status !== "playing"}
                        title={card.value}
                        aria-label={
                          card.color
                            ? card.color + " " + card.value
                            : "Wild " + card.value
                        }
                        className={
                          "flex h-24 w-16 shrink-0 snap-start items-center justify-center rounded-xl border-4 border-white text-base font-black shadow-md disabled:cursor-not-allowed disabled:opacity-50 sm:h-28 sm:w-20 sm:text-lg " +
                          (card.color
                            ? cardColors[card.color]
                            : "bg-blue-700 text-white")
                        }
                      >
                        {card.value.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-slate-500 sm:hidden">
                    Swipe sideways to view all your cards.
                  </p>
                </div>

                {/* Game controls */}
                <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={drawCard}
                    disabled={!isMyTurn || room.status !== "playing"}
                    className="min-h-12 rounded-xl bg-blue-700 px-6 py-3 font-bold hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    🃏 Draw Card
                  </button>

                  <button
                    type="button"
                    onClick={passTurn}
                    disabled={
                      !isMyTurn ||
                      !game.drawnCardId ||
                      room.status !== "playing"
                    }
                    className="min-h-12 rounded-xl border border-slate-700 px-6 py-3 font-bold hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Pass Turn
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6 text-sm text-slate-400">
                Waiting for the room state from the server...
              </div>
            )}

            <button
              type="button"
              onClick={leaveRoom}
              className="mt-6 min-h-10 text-sm text-slate-400 hover:text-white"
            >
              ← Leave room
            </button>
          </div>
        )}
      </section>

      <footer className="border-t border-slate-800 px-4 py-5 text-center text-xs text-slate-500 sm:px-6 sm:text-sm">
        ColorFlip © 2026 · Flip the Colors. Rule the Game.
      </footer>
    </main>
  );
}
