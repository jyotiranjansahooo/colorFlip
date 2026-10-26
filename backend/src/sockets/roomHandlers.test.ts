import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server as SocketIOServer } from "socket.io";
import {
  io as createClient,
  type Socket as ClientSocket,
} from "socket.io-client";

import { registerRoomHandlers } from "./roomHandlers.js";
type RoomPlayer = {
  id: string;
  name: string;
  cardCount: number;
  connected: boolean;
};

type RoomState = {
  roomId: string;
  hostId: string;
  status: "waiting" | "playing" | "finished";
  players: RoomPlayer[];
  game: unknown | null;
};

type RoomCreated = {
  roomId: string;
  playerId: string;
};

type RoomJoined = {
  roomId: string;
  playerId: string;
};

let httpServer: HttpServer;
let ioServer: SocketIOServer;
let serverUrl: string;

const clients: ClientSocket[] = [];
const EVENT_TIMEOUT = 5000;

function onceEvent<T>(socket: ClientSocket, eventName: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error("Timed out waiting for event: " + eventName));
    }, EVENT_TIMEOUT);

    function handler(payload: T): void {
      clearTimeout(timer);
      resolve(payload);
    }

    socket.once(eventName, handler);
  });
}

function matchingEvent<T>(
  socket: ClientSocket,
  eventName: string,
  predicate: (payload: T) => boolean,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error("Timed out waiting for matching event: " + eventName));
    }, EVENT_TIMEOUT);

    function handler(payload: T): void {
      if (!predicate(payload)) {
        return;
      }

      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(payload);
    }

    socket.on(eventName, handler);
  });
}

async function connectClient(): Promise<ClientSocket> {
  const socket = createClient(serverUrl, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    timeout: EVENT_TIMEOUT,
  });

  clients.push(socket);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      reject(new Error("Timed out connecting test client."));
    }, EVENT_TIMEOUT);

    function onConnect(): void {
      clearTimeout(timer);
      socket.off("connect_error", onConnectError);
      resolve();
    }

    function onConnectError(error: Error): void {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      reject(error);
    }

    socket.once("connect", onConnect);
    socket.once("connect_error", onConnectError);
  });

  return socket;
}

async function createRoom(
  socket: ClientSocket,
  name: string,
): Promise<{ created: RoomCreated; state: RoomState }> {
  const createdPromise = onceEvent<RoomCreated>(socket, "room:created");

  const statePromise = matchingEvent<RoomState>(
    socket,
    "room:state",
    (state) => state.status === "waiting",
  );

  socket.emit("room:create", { name });

  const [created, state] = await Promise.all([createdPromise, statePromise]);

  return { created, state };
}

async function joinRoom(
  socket: ClientSocket,
  roomId: string,
  name: string,
): Promise<{ joined: RoomJoined; state: RoomState }> {
  const joinedPromise = onceEvent<RoomJoined>(socket, "room:joined");

  const statePromise = matchingEvent<RoomState>(
    socket,
    "room:state",
    (state) => state.roomId === roomId,
  );

  socket.emit("room:join", { roomId, name });

  const [joined, state] = await Promise.all([joinedPromise, statePromise]);

  return { joined, state };
}

beforeEach(async () => {
  httpServer = createServer();
  ioServer = new SocketIOServer(httpServer);

  ioServer.on("connection", (socket) => {
    registerRoomHandlers(ioServer, socket);
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);

    httpServer.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });

  const address = httpServer.address();

  if (!address || typeof address === "string") {
    throw new Error("Could not determine the test server address.");
  }

  serverUrl = "http://127.0.0.1:" + (address as AddressInfo).port;
});

afterEach(async () => {
  for (const socket of clients) {
    socket.disconnect();
  }

  clients.length = 0;

  await new Promise<void>((resolve) => {
    ioServer.close(() => {
      resolve();
    });
  });
});

describe("ColorFlip room handlers", () => {
  it("creates a room and returns its details", async () => {
    const host = await connectClient();

    const result = await createRoom(host, "swiftotter");

    expect(result.created.roomId).toMatch(/^[A-F0-9]{6}$/);
    expect(result.created.playerId).toBeTruthy();

    expect(result.state.roomId).toBe(result.created.roomId);
    expect(result.state.status).toBe("waiting");
    expect(result.state.players).toHaveLength(1);
    expect(result.state.players[0].name).toBe("swiftotter");
    expect(result.state.players[0].connected).toBe(true);
    expect(result.state.hostId).toBe(result.created.playerId);
  });

  it("rejects an invalid room code", async () => {
    const player = await connectClient();

    const errorPromise = onceEvent<string>(player, "room:error");

    player.emit("room:join", {
      roomId: "INVALID",
      name: "blueplayer",
    });

    const error = await errorPromise;

    expect(typeof error).toBe("string");
    expect(error.length).toBeGreaterThan(0);
  });

  it("allows another player to join an existing room", async () => {
    const host = await connectClient();
    const guest = await connectClient();

    const { created } = await createRoom(host, "swiftotter");

    const hostUpdatePromise = matchingEvent<RoomState>(
      host,
      "room:state",
      (state) => state.players.length === 2,
    );

    const guestResult = await joinRoom(guest, created.roomId, "blueplayer");

    const hostUpdate = await hostUpdatePromise;

    expect(guestResult.joined.roomId).toBe(created.roomId);
    expect(guestResult.joined.playerId).toBeTruthy();
    expect(guestResult.state.players).toHaveLength(2);
    expect(hostUpdate.players).toHaveLength(2);

    expect(hostUpdate.players.map((player) => player.name)).toContain(
      "blueplayer",
    );
  });

  it("rejects a duplicate nickname in the same room", async () => {
    const host = await connectClient();
    const guest = await connectClient();

    const { created } = await createRoom(host, "swiftotter");

    await joinRoom(guest, created.roomId, "blueplayer");

    const anotherGuest = await connectClient();

    const errorPromise = onceEvent<string>(anotherGuest, "room:error");

    anotherGuest.emit("room:join", {
      roomId: created.roomId,
      name: "blueplayer",
    });

    const error = await errorPromise;

    expect(error).toBe("That nickname is already being used in this room.");
  });

  it("rejects a fifth player when the room is full", async () => {
    const host = await connectClient();
    const { created } = await createRoom(host, "swiftotter");

    const playerNames = ["blueplayer", "greenplayer", "yellowplayer"];

    for (const name of playerNames) {
      const player = await connectClient();
      await joinRoom(player, created.roomId, name);
    }

    const fifthPlayer = await connectClient();

    const errorPromise = onceEvent<string>(fifthPlayer, "room:error");

    fifthPlayer.emit("room:join", {
      roomId: created.roomId,
      name: "purpleplayer",
    });

    const error = await errorPromise;

    expect(error).toBe("This room cannot accept more players.");
  });

  it("does not allow the host to start a game with one player", async () => {
    const host = await connectClient();

    await createRoom(host, "swiftotter");

    const errorPromise = onceEvent<string>(host, "room:error");

    host.emit("room:start");

    const error = await errorPromise;

    expect(typeof error).toBe("string");
    expect(error.length).toBeGreaterThan(0);
  });

  it("does not allow a guest to start the game", async () => {
    const host = await connectClient();
    const guest = await connectClient();

    const { created } = await createRoom(host, "swiftotter");

    await joinRoom(guest, created.roomId, "blueplayer");

    const errorPromise = onceEvent<string>(guest, "room:error");

    guest.emit("room:start");

    const error = await errorPromise;

    expect(typeof error).toBe("string");
    expect(error.length).toBeGreaterThan(0);
  });

  it("starts the game when the host starts a valid room", async () => {
    const host = await connectClient();
    const guest = await connectClient();

    const { created } = await createRoom(host, "swiftotter");

    await joinRoom(guest, created.roomId, "blueplayer");

    const hostPlayingState = matchingEvent<RoomState>(
      host,
      "room:state",
      (state) => state.status === "playing",
    );

    const guestPlayingState = matchingEvent<RoomState>(
      guest,
      "room:state",
      (state) => state.status === "playing",
    );

    host.emit("room:start");

    const [hostState, guestState] = await Promise.all([
      hostPlayingState,
      guestPlayingState,
    ]);

    expect(hostState.status).toBe("playing");
    expect(guestState.status).toBe("playing");

    expect(hostState.players).toHaveLength(2);
    expect(guestState.players).toHaveLength(2);

    expect(hostState.game).not.toBeNull();
    expect(guestState.game).not.toBeNull();
  });

  it("updates the room when a player disconnects before the game starts", async () => {
    const host = await connectClient();
    const guest = await connectClient();

    const { created } = await createRoom(host, "swiftotter");

    await joinRoom(guest, created.roomId, "blueplayer");

    const hostUpdatePromise = matchingEvent<RoomState>(
      host,
      "room:state",
      (state) =>
        state.players.some(
          (player) => player.name === "blueplayer" && !player.connected,
        ),
    );

    guest.disconnect();

    const updatedState = await hostUpdatePromise;

    expect(updatedState.players).toHaveLength(2);
    expect(
      updatedState.players.find((player) => player.name === "swiftotter")
        ?.connected,
    ).toBe(true);
    expect(
      updatedState.players.find((player) => player.name === "blueplayer")
        ?.connected,
    ).toBe(false);
  });

  it("rejects playing a card before the game starts", async () => {
    const host = await connectClient();

    await createRoom(host, "swiftotter");

    const errorPromise = onceEvent<string>(host, "game:error");

    host.emit("game:play", {
      cardId: "invalid-card",
      chosenColor: "red",
    });

    const error = await errorPromise;

    expect(error).toBe("The game has not started.");
  });

  it("rejects drawing before the game starts", async () => {
    const host = await connectClient();

    await createRoom(host, "swiftotter");

    const errorPromise = onceEvent<string>(host, "game:error");

    host.emit("game:draw");

    const error = await errorPromise;

    expect(error).toBe("The game has not started.");
  });

  it("rejects passing before the game starts", async () => {
    const host = await connectClient();

    await createRoom(host, "swiftotter");

    const errorPromise = onceEvent<string>(host, "game:error");

    host.emit("game:pass");

    const error = await errorPromise;

    expect(error).toBe("The game has not started.");
  });

  it("rejects malformed card-play payloads", async () => {
    const host = await connectClient();

    await createRoom(host, "swiftotter");

    const errorPromise = onceEvent<string>(host, "game:error");

    host.emit("game:play", {
      cardId: 123,
      chosenColor: "purple",
    });

    const error = await errorPromise;

    expect(error).toBe("Invalid card play details.");
  });

  it("rejects card-play payloads with a missing card ID", async () => {
    const host = await connectClient();

    await createRoom(host, "swiftotter");

    const errorPromise = onceEvent<string>(host, "game:error");

    host.emit("game:play", {
      chosenColor: "red",
    });

    const error = await errorPromise;

    expect(error).toBe("Invalid card play details.");
  });
});
