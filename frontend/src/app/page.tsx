"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { socket } from "@/lib/socket";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { gsap } from "gsap";
import PlayerHand from "@/components/PlayerHand";
import { ArrowLeft, Check, Palette, RotateCcw } from "lucide-react";
import GameControls from "@/components/GameControls";
import PlayingCard from "@/components/PlayingCard";
import type {
  CardColor,
  GameCard,
  GameView,
  OpponentMode,
  ReconnectCredentials,
  RoomErrorPayload,
  RoomPlayer,
  RoomSettings,
  RoomState,
} from "@/types/game";

const RECONNECT_STORAGE_KEY = "colorflip-reconnect";
const validColors: CardColor[] = ["red", "blue", "green", "yellow"];

const cardColors: Record<CardColor, string> = {
  red: "bg-red-600 border-red-200 text-white",
  blue: "bg-blue-600 border-blue-200 text-white",
  green: "bg-emerald-600 border-emerald-200 text-white",
  yellow: "bg-yellow-300 border-yellow-100 text-red-950",
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

function saveReconnectCredentials(payload: {
  roomId: string;
  playerId: string;
  reconnectToken: string;
}): void {
  localStorage.setItem(RECONNECT_STORAGE_KEY, JSON.stringify(payload));
}
function makeGuestName(): string {
  const adjective =
    guestAdjectives[Math.floor(Math.random() * guestAdjectives.length)];

  const noun = guestNouns[Math.floor(Math.random() * guestNouns.length)];
  const number = Math.floor(100 + Math.random() * 900);

  return adjective + noun + number;
}

/* ------------------------------------------------------------------ */
/* Animation helpers                                                   */
/* ------------------------------------------------------------------ */

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getCardColorClass(card: GameCard): string {
  if (card.color === null) {
    return "bg-blue-700 text-white";
  }

  return cardColors[card.color];
}

function ShowcaseFallback({ label }: { label: string }) {
  const colors = [
    "bg-red-600",
    "bg-yellow-400",
    "bg-emerald-600",
    "bg-blue-700",
  ];

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-8 flex flex-col items-center gap-4 md:items-start"
    >
      <div className="flex items-end gap-2">
        {colors.map((color, index) => (
          <span
            key={color}
            className={
              "h-16 w-11 animate-pulse rounded-lg border-2 border-white/50 sm:h-20 sm:w-14 " +
              color
            }
            style={{
              animationDelay: index * 150 + "ms",
              transform: "rotate(" + (index - 1.5) * 8 + "deg)",
            }}
          />
        ))}
      </div>

      <p className="text-xs font-semibold tracking-wider text-white/70">
        {label}
      </p>
    </div>
  );
}

function HowToFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-16 grid gap-4 sm:mt-20 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4"
    >
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-40 animate-pulse rounded-3xl border border-slate-700 bg-slate-900/70"
          style={{ animationDelay: item * 120 + "ms" }}
        />
      ))}
      <span className="sr-only">Loading how to play...</span>
    </div>
  );
}

// Lazy-loaded (separate JS chunks, client only). GSAP ScrollTrigger lives
// inside these chunks so it is not downloaded until they are needed.
const LazyCardShowcase = dynamic(() => import("@/components/CardShowcase"), {
  ssr: false,
  loading: () => <ShowcaseFallback label="Loading card showcase..." />,
});

const LazyHowToPlayCards = dynamic(() => import("@/components/howToPlay"), {
  ssr: false,
  loading: () => <HowToFallback />,
});

function ConnectionOverlay({
  isReconnecting,
  onCancel,
}: {
  isReconnecting: boolean;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.from("[data-overlay-backdrop]", {
        opacity: 0,
        duration: 0.3,
      });

      gsap.from("[data-overlay-card]", {
        scale: 0.85,
        y: 24,
        opacity: 0,
        duration: 0.5,
        ease: "back.out(1.7)",
      });

      gsap.fromTo(
        "[data-overlay-logo]",
        { rotation: -6 },
        {
          rotation: 6,
          duration: 0.9,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        },
      );

      gsap.to("[data-overlay-mini]", {
        y: -10,
        duration: 0.45,
        yoyo: true,
        repeat: -1,
        stagger: 0.12,
        ease: "power1.inOut",
      });

      gsap.fromTo(
        "[data-overlay-bar]",
        { xPercent: -100 },
        {
          xPercent: 250,
          duration: 1.3,
          repeat: -1,
          ease: "power1.inOut",
        },
      );
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      data-overlay-backdrop
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 px-5"
    >
      <div
        data-overlay-card
        className="w-full max-w-xs rounded-3xl border border-slate-700 bg-slate-900 p-7 text-center"
      >
        <div
          data-overlay-logo
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 text-2xl font-black"
        >
          CF
        </div>

        <div
          className="mt-4 flex items-end justify-center gap-1.5"
          aria-hidden="true"
        >
          {["bg-red-600", "bg-yellow-400", "bg-emerald-600", "bg-blue-700"].map(
            (color) => (
              <span
                key={color}
                data-overlay-mini
                className={
                  "h-6 w-4 rounded-[5px] border border-white/60 " + color
                }
              />
            ),
          )}
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
          <div
            data-overlay-bar
            className="h-full w-2/5 rounded-full bg-sky-300"
          />
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-5 text-sm text-slate-400 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function WildColorDialog({
  onChoose,
  onClose,
}: {
  onChoose: (color: CardColor) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.from("[data-wild-card]", {
        scale: 0.8,
        y: 30,
        opacity: 0,
        duration: 0.45,
        ease: "back.out(1.8)",
      });

      gsap.from("[data-wild-color]", {
        scale: 0.4,
        rotation: () => gsap.utils.random(-25, 25),
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        delay: 0.15,
        ease: "back.out(2.2)",
      });
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wild-color-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        data-wild-card
        className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6 sm:p-7"
      >
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
              data-wild-color
              type="button"
              onClick={() => onChoose(color)}
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
          onClick={onClose}
          className="mt-4 min-h-11 w-full rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState(() => {
    if (typeof window === "undefined") return "";

    const invitedRoom = new URLSearchParams(window.location.search).get("room");

    return (invitedRoom ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
  });
  const autoJoinAttempted = useRef(false);
  const [playerId, setPlayerId] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectingRef = useRef(false);
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [wildCard, setWildCard] = useState<GameCard | null>(null);

  // Animation refs
  const mainRef = useRef<HTMLElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);
  const seenPlayersRef = useRef<Set<string>>(new Set());
  const seenCardsRef = useRef<Set<string>>(new Set());
  const prevTopCardRef = useRef<string | null>(null);

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

  // Automatically join the room when a player opens an invitation link.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const invitedRoom = (params.get("room") ?? "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);

      if (!invitedRoom || autoJoinAttempted.current) {
        return;
      }

      autoJoinAttempted.current = true;

      localStorage.removeItem(RECONNECT_STORAGE_KEY);
      reconnectingRef.current = false;
      setIsReconnecting(false);

      const guestName = makeGuestName();
      setName(guestName);
      setRoomCode(invitedRoom);
      setError("");
      setNotice("Joining your friend's room...");

      const joinInvitedRoom = () => {
        setIsConnecting(false);
        socket.emit("room:join", {
          roomId: invitedRoom,
          name: guestName,
        });
      };

      if (socket.connected) {
        joinInvitedRoom();
        return;
      }

      setIsConnecting(true);
      socket.once("connect", joinInvitedRoom);
      socket.connect();
    }, 0);

    return () => {
      window.clearTimeout(timer);
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

  function updateMaxPlayers(maxPlayers: 2 | 3 | 4) {
    if (!room || !isHost || room.status !== "waiting") {
      return;
    }

    if (room.players.length > maxPlayers) {
      setError(
        "You cannot set the room limit below the number of players already joined.",
      );
      return;
    }

    setError("");
    setNotice("");
    socket.emit("room:settings:update", {
      maxPlayers,
      opponentMode: room.settings.opponentMode,
    });
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

    seenPlayersRef.current.clear();
    seenCardsRef.current.clear();
    prevTopCardRef.current = null;

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

  function getInviteLink(): string {
    if (!room) return window.location.origin;

    const inviteUrl = new URL(window.location.origin);
    inviteUrl.searchParams.set("room", room.roomId);
    return inviteUrl.toString();
  }

  function getInviteMessage(): string {
    if (!room) return "Join me on ColorFlip!";

    return (
      "🎮 Join my ColorFlip game!\n\n" +
      "🔑 Room Code: " +
      room.roomId +
      "\n\n🔗 Join here: " +
      getInviteLink()
    );
  }

  async function shareRoom(): Promise<void> {
    if (!room) return;

    const inviteLink = getInviteLink();
    const inviteMessage = getInviteMessage();

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join my ColorFlip game",
          text: inviteMessage,
          url: inviteLink,
        });
      } else {
        await navigator.clipboard.writeText(inviteMessage);
        setNotice("Invite copied! Share it with your friends.");
      }
    } catch (shareError: unknown) {
      if (shareError instanceof Error && shareError.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(inviteMessage);
          setNotice("Invite copied! Share it with your friends.");
        } catch {
          setError(
            "Unable to share or copy the invite. Please copy the room code.",
          );
        }
      }
    }
  }

  function shareOnWhatsApp(): void {
    if (!room) return;

    const message = encodeURIComponent(getInviteMessage());
    window.open(
      "https://wa.me/?text=" + message,
      "_blank",
      "noopener,noreferrer",
    );
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

  const showLanding = !room;
  const roomStatus = room?.status ?? null;
  const topCardId = topCard?.id ?? null;

  /* ---------------------------- GSAP effects ---------------------------- */

  // Header: slide in + gently wobbling logo badge (runs once)
  useIsomorphicLayoutEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        gsap.from("[data-header]", {
          y: -40,
          opacity: 0,
          duration: 0.6,
          ease: "power3.out",
        });

        gsap.fromTo(
          "[data-logo]",
          { rotation: -8 },
          {
            rotation: 8,
            duration: 1.6,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
          },
        );
      },
      mainRef,
    );

    return () => mm.revert();
  }, []);

  // Landing page: staggered hero entrance
  useIsomorphicLayoutEffect(() => {
    if (!showLanding) {
      return;
    }

    const mm = gsap.matchMedia();

    mm.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        tl.from("[data-hero='badge']", { y: -20, opacity: 0, duration: 0.6 })
          .from(
            "[data-hero='title']",
            {
              y: 50,
              opacity: 0,
              rotateX: -40,
              transformOrigin: "0% 50%",
              duration: 0.8,
              stagger: 0.12,
            },
            "-=0.3",
          )
          .from(
            "[data-hero='copy']",
            { y: 20, opacity: 0, duration: 0.6 },
            "-=0.4",
          )
          .from(
            "[data-hero='chip']",
            {
              scale: 0.7,
              opacity: 0,
              duration: 0.4,
              stagger: 0.08,
              ease: "back.out(2)",
            },
            "-=0.2",
          )
          .from(
            "[data-hero='form']",
            { x: 60, opacity: 0, duration: 0.8 },
            0.2,
          );
      },
      mainRef,
    );

    return () => mm.revert();
  }, [showLanding]);

  // Lobby / board panel entrance when the room status changes
  useIsomorphicLayoutEffect(() => {
    if (!roomStatus || roomStatus === "finished" || prefersReducedMotion()) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.from("[data-panel]", {
        y: 30,
        opacity: 0,
        duration: 0.6,
        ease: "power3.out",
        clearProps: "transform,opacity",
      });
    }, mainRef);

    return () => ctx.revert();
  }, [roomStatus]);

  // Lobby: only NEW players pop in
  useIsomorphicLayoutEffect(() => {
    if (!room) {
      seenPlayersRef.current.clear();
      return;
    }

    if (room.status !== "waiting") {
      return;
    }

    const tiles = gsap.utils.toArray<HTMLElement>(
      "[data-player-tile]",
      mainRef.current,
    );

    const fresh = tiles.filter(
      (tile) => !seenPlayersRef.current.has(tile.dataset.playerId ?? ""),
    );

    tiles.forEach((tile) =>
      seenPlayersRef.current.add(tile.dataset.playerId ?? ""),
    );

    if (fresh.length === 0 || prefersReducedMotion()) {
      return;
    }

    gsap.fromTo(
      fresh,
      {
        y: 30,
        scale: 0.8,
        opacity: 0,
        rotation: () => gsap.utils.random(-6, 6),
      },
      {
        y: 0,
        scale: 1,
        opacity: 1,
        rotation: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "back.out(1.7)",
        clearProps: "transform,opacity",
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.players.length, room?.status]);

  // Hand: newly dealt/drawn cards fly in from the draw pile
  useIsomorphicLayoutEffect(() => {
    if (!game) {
      seenCardsRef.current.clear();
      return;
    }

    const cards = gsap.utils.toArray<HTMLElement>(
      "[data-hand-card]",
      handRef.current,
    );

    const fresh = cards.filter(
      (card) => !seenCardsRef.current.has(card.dataset.cardId ?? ""),
    );

    cards.forEach((card) =>
      seenCardsRef.current.add(card.dataset.cardId ?? ""),
    );

    if (fresh.length === 0 || prefersReducedMotion()) {
      return;
    }

    gsap.fromTo(
      fresh,
      {
        y: 140,
        x: () => gsap.utils.random(-60, 60),
        rotation: () => gsap.utils.random(-25, 25),
        scale: 0.5,
        opacity: 0,
      },
      {
        y: 0,
        x: 0,
        rotation: 0,
        scale: 1,
        opacity: 1,
        duration: 0.7,
        stagger: 0.07,
        ease: "back.out(1.5)",
        clearProps: "transform,opacity", // keeps your CSS hover styles working
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.hand]);

  // Discard pile: new top card slams down
  useIsomorphicLayoutEffect(() => {
    if (!topCardId) {
      prevTopCardRef.current = null;
      return;
    }

    if (prevTopCardRef.current === topCardId) {
      return;
    }

    const isFirst = prevTopCardRef.current === null;
    prevTopCardRef.current = topCardId;

    if (prefersReducedMotion()) {
      return;
    }

    gsap.fromTo(
      "[data-top-card]",
      {
        y: isFirst ? -60 : -120,
        scale: 1.5,
        rotation: gsap.utils.random(-25, 25),
        opacity: 0,
      },
      {
        y: 0,
        scale: 1,
        rotation: gsap.utils.random(-6, 6),
        opacity: 1,
        duration: 0.6,
        ease: "back.out(1.6)",
      },
    );
  }, [topCardId]);

  // Current-color chip pops when the color changes
  useIsomorphicLayoutEffect(() => {
    if (!game || prefersReducedMotion()) {
      return;
    }

    gsap.fromTo(
      "[data-color-chip]",
      { scale: 0.7 },
      { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.currentColor]);

  // Turn change: message + active player token bounce
  useIsomorphicLayoutEffect(() => {
    if (!game || roomStatus !== "playing" || prefersReducedMotion()) {
      return;
    }

    gsap.fromTo(
      "[data-turn]",
      { scale: 0.9, opacity: 0.4 },
      { scale: 1, opacity: 1, duration: 0.7, ease: "elastic.out(1, 0.5)" },
    );

    gsap.fromTo(
      "[data-token-active]",
      { y: -8 },
      { y: 0, duration: 0.6, ease: "bounce.out" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.currentPlayerIndex, isMyTurn]);

  // Your turn: draw pile bobs to hint "draw here"
  useIsomorphicLayoutEffect(() => {
    if (!isMyTurn || roomStatus !== "playing" || prefersReducedMotion()) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.to("[data-draw-pile]", {
        y: -8,
        duration: 0.7,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
    }, mainRef);

    return () => ctx.revert();
  }, [isMyTurn, roomStatus]);

  // Winner: pop the banner and rain confetti
  useIsomorphicLayoutEffect(() => {
    if (roomStatus !== "finished" || prefersReducedMotion()) {
      return;
    }

    const host = confettiRef.current;

    if (!host) {
      return;
    }

    const palette = ["#ef4444", "#3b82f6", "#22c55e", "#facc15", "#ffffff"];

    const pieces = Array.from({ length: 36 }, () => {
      const piece = document.createElement("span");
      piece.className = "pointer-events-none absolute top-0 h-3 w-2 rounded-sm";
      piece.style.left = gsap.utils.random(0, 100) + "%";
      piece.style.backgroundColor = gsap.utils.random(palette);
      host.appendChild(piece);
      return piece;
    });

    const banner = gsap.fromTo(
      "[data-winner]",
      { scale: 0.5, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.8, ease: "elastic.out(1, 0.5)" },
    );

    const fall = gsap.fromTo(
      pieces,
      { y: -20, opacity: 1 },
      {
        y: () => host.clientHeight + 60,
        x: () => gsap.utils.random(-80, 80),
        rotation: () => gsap.utils.random(180, 720),
        duration: () => gsap.utils.random(1.8, 3.2),
        ease: "power1.in",
        stagger: { amount: 0.8 },
        onComplete: () => pieces.forEach((piece) => piece.remove()),
      },
    );

    return () => {
      banner.kill();
      fall.kill();
      pieces.forEach((piece) => piece.remove());
    };
  }, [roomStatus]);

  return (
    <main ref={mainRef} className="min-h-screen overflow-x-hidden text-white">
      {/* Winner celebration overlay */}
      {roomStatus === "finished" && game?.winnerId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/50 px-5 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="winner-title"
        >
          <div
            data-winner
            className="relative w-full max-w-md rounded-3xl border-2 border-yellow-300/80 bg-gradient-to-br from-red-700 via-red-800 to-rose-950 p-8 text-center shadow-[0_0_80px_rgba(250,204,21,0.35)] sm:p-10"
          >
            {/* Trophy */}
            <div className="mb-4 text-6xl sm:text-7xl">🏆</div>

            {/* Celebration heading */}
            <p className="text-sm font-black uppercase tracking-[0.35em] text-yellow-300 sm:text-base">
              Game Over
            </p>

            <h2
              id="winner-title"
              className="mt-4 text-3xl font-black leading-tight text-white sm:text-5xl"
            >
              🎉 {winnerName} 🎉
            </h2>

            <p className="mt-4 text-lg font-bold text-yellow-200 sm:text-xl">
              YOU WON!
            </p>

            <div className="mx-auto mt-6 h-1.5 w-24 rounded-full bg-yellow-300" />

            <p className="mt-5 text-sm text-white/80 sm:text-base">
              Congratulations on winning UNO!
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={leaveRoom}
                className="min-h-12 w-full rounded-xl bg-yellow-300 px-5 py-3 font-bold text-red-950 transition hover:bg-yellow-200"
              >
                🏠 Back to Home
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="min-h-12 w-full rounded-xl border border-yellow-300/60 px-5 py-3 font-bold text-white transition hover:bg-white/10"
              >
                🔄 Play Again
              </button>
            </div>
          </div>
        </div>
      )}
      <header
        data-header
        className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-4 sm:px-6 md:px-12"
      >
        <button
          type="button"
          onClick={leaveRoom}
          aria-label="ColorFlip home"
          className="shrink-0 text-xl font-black tracking-tight sm:text-2xl"
        >
          <span className="text-rose-100">Color</span>
          <span className="text-white">Flip</span>
          <span
            data-logo
            aria-hidden="true"
            className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/70 bg-white text-xs font-black text-rose-700"
          >
            CF
          </span>
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

      {/* Animated connection overlay */}
      {(isConnecting || isReconnecting) && (
        <ConnectionOverlay
          isReconnecting={isReconnecting}
          onCancel={() => {
            socket.disconnect();
            setIsConnecting(false);
            setIsReconnecting(false);
            reconnectingRef.current = false;
            setConnected(false);
            setError("Connection cancelled.");
          }}
        />
      )}

      {/* Animated wild-card color selector */}
      {wildCard && (
        <WildColorDialog
          onChoose={chooseWildColor}
          onClose={() => setWildCard(null)}
        />
      )}

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-12 md:py-16">
        {!room ? (
          /* Create and join room screen */
          <>
            <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
              <div>
                <div
                  data-hero="badge"
                  className="mb-5 inline-flex rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-sm text-sky-200"
                >
                  Lightweight multiplayer · Guest names only
                </div>

                <h1 className="text-5xl font-black leading-tight sm:text-6xl md:text-7xl [perspective:800px]">
                  <span data-hero="title" className="block">
                    Ready to
                  </span>
                  <span data-hero="title" className="block text-rose-100">
                    flip the
                  </span>
                  <span data-hero="title" className="block">
                    game?
                  </span>
                </h1>

                <p
                  data-hero="copy"
                  className="mt-5 max-w-md text-base leading-7 text-slate-400 sm:text-lg sm:leading-8"
                >
                  Create a private room, invite your friends, and see who can
                  get rid of all their cards first.
                </p>

                {/* Lazy loaded + Suspense: GSAP ScrollTrigger card fan */}
                <Suspense
                  fallback={
                    <ShowcaseFallback label="Preparing your cards..." />
                  }
                >
                  <LazyCardShowcase />
                </Suspense>

                <div className="mt-7 flex flex-wrap gap-2 sm:mt-10 sm:gap-3">
                  {[
                    { label: "Royal Blue", color: "bg-blue-700" },
                    { label: "Sky Blue", color: "bg-sky-300" },
                    { label: "Slate Gray", color: "bg-slate-400" },
                    { label: "Matcha Green", color: "bg-emerald-400" },
                  ].map((item) => (
                    <span
                      key={item.label}
                      data-hero="chip"
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
              <div
                data-hero="form"
                className="rounded-3xl border border-slate-700 bg-slate-900 p-5 sm:p-7 md:p-8"
              >
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

            {/* Lazy loaded + Suspense: ScrollTrigger "how to play" cards */}
            <Suspense fallback={<HowToFallback />}>
              <LazyHowToPlayCards />
            </Suspense>
          </>
        ) : (
          /* Room lobby and game screen */
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs tracking-widest text-red-50/90">
                  PRIVATE ROOM
                </p>

                <h1 className="mt-1 text-3xl font-black sm:text-4xl">
                  {room.roomId}
                </h1>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyRoomCode}
                  className="min-h-11 rounded-xl border border-red-100/20 px-4 py-3 text-sm font-semibold hover:bg-[#9F2928]"
                >
                  📋 Copy Room Code
                </button>

                {isHost && (
                  <>
                    <button
                      type="button"
                      onClick={shareRoom}
                      className="min-h-11 rounded-xl border border-red-100/20 px-4 py-3 text-sm font-semibold hover:bg-[#9F2928]"
                    >
                      🔗 Share Invite
                    </button>
                    <button
                      type="button"
                      onClick={shareOnWhatsApp}
                      className="min-h-11 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-500"
                    >
                      WhatsApp
                    </button>
                  </>
                )}
              </div>
            </div>

            {notice && (
              <p className="mt-4 text-sm text-emerald-200">{notice}</p>
            )}

            {error && (
              <p role="alert" className="mt-4 text-sm text-orange-200">
                {error}
              </p>
            )}

            {/* Lobby */}
            {room.status === "waiting" ? (
              <div
                data-panel
                className="mt-6 rounded-3xl border border-red-100/20 bg-gradient-to-br from-[#A93231] to-[#741B1B] p-5 sm:mt-8 sm:p-8"
              >
                <h2 className="text-xl font-bold">Players in the lobby</h2>

                <p className="mt-2 text-sm text-red-50/70">
                  Waiting for friends. {room.players.length}/
                  {room.settings.maxPlayers} players joined.
                </p>

                {isHost ? (
                  <div className="mt-6 rounded-2xl border border-red-100/15 bg-[#651818]/35 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-white">
                          Players per room
                        </h3>
                        <p className="mt-1 text-sm text-red-50/70">
                          Choose how many players can join before starting.
                        </p>
                      </div>
                      <span className="rounded-full border border-[#F5C56B]/30 bg-[#F5C56B]/10 px-3 py-1 text-xs font-bold text-[#FFE0A0]">
                        HOST SETTINGS
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      {([2, 3, 4] as const).map((count) => {
                        const selected = room.settings.maxPlayers === count;
                        const cannotSelect = room.players.length > count;

                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => updateMaxPlayers(count)}
                            disabled={cannotSelect || selected}
                            aria-pressed={selected}
                            className={
                              "min-h-24 rounded-2xl border px-3 py-4 text-center transition " +
                              (selected
                                ? "border-[#F5C56B] bg-[#F5C56B] text-[#541414] shadow-lg shadow-black/10"
                                : "border-red-100/20 bg-[#8C2322]/60 text-white hover:border-[#F5C56B]/70 hover:bg-[#8C2322]") +
                              (cannotSelect
                                ? " cursor-not-allowed opacity-40"
                                : "")
                            }
                          >
                            <span className="block text-2xl font-black">
                              {count}
                            </span>
                            <span className="mt-1 block text-xs font-semibold">
                              {count} Players
                            </span>
                            {selected && (
                              <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider">
                                <Check size={12} aria-hidden="true" />
                                Selected
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-3 text-xs text-red-50/60">
                      {room.players.length} of {room.settings.maxPlayers} seats
                      filled.
                      {room.players.length === room.settings.maxPlayers
                        ? " The room is full."
                        : " Friends can join until the room is full."}
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-red-100/15 bg-[#651818]/30 p-4">
                    <p className="text-sm font-semibold text-white">
                      Room size: {room.settings.maxPlayers} players
                    </p>
                    <p className="mt-1 text-xs text-red-50/65">
                      Only the host can change the player limit.
                    </p>
                  </div>
                )}

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {room.players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 p-4"
                    >
                      <div>
                        <p className="font-semibold text-white">
                          {player.name}
                          {player.id === room.hostId && (
                            <span className="ml-2 text-yellow-300">(Host)</span>
                          )}
                          {player.id === playerId && (
                            <span className="ml-2 text-emerald-300">(You)</span>
                          )}
                        </p>

                        <p className="text-sm text-white/60">
                          {player.connected
                            ? "🟢 Connected"
                            : "🔴 Disconnected"}
                        </p>
                      </div>

                      {playerId === room.hostId &&
                        player.id !== room.hostId &&
                        !player.connected && (
                          <button
                            type="button"
                            onClick={() => {
                              socket.emit("room:player:kick", {
                                playerId: player.id,
                              });
                            }}
                            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                          >
                            Kick
                          </button>
                        )}
                    </div>
                  ))}
                </div>

                {isHost ? (
                  <button
                    type="button"
                    onClick={startGame}
                    disabled={room.players.length < 2}
                    className="mt-7 min-h-12 w-full rounded-xl bg-[#F5C56B] text-[#541414] px-5 py-3 font-bold hover:bg-[#FFDA8C] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {room.players.length < 2
                      ? "Waiting for another player..."
                      : "🚀 Start Game"}
                  </button>
                ) : (
                  <p className="mt-7 text-center text-sm text-red-50/70">
                    Waiting for the host to start the game...
                  </p>
                )}

                <p className="mt-4 text-center text-xs text-red-50/55">
                  Share the room code with your friends to invite them.
                </p>
              </div>
            ) : game ? (
              /* Game board */
              <div
                data-panel
                className="game-table relative mt-3 min-h-[700px] overflow-hidden p-2 sm:mt-8 sm:min-h-[900px] sm:p-6 md:p-8"
              >
                <div className="game-table-glow" />

                {/* Confetti layer (winner) */}
                <div
                  ref={confettiRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[inherit]"
                />

                {/* Game header */}
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold tracking-[0.2em] text-red-50/80">
                      COLORFLIP ARENA
                    </p>
                    <p className="mt-1 text-lg font-black sm:text-xl">
                      {room.players.length} Players
                    </p>
                  </div>

                  <div
                    data-color-chip
                    className="flex items-center gap-2 rounded-full border border-red-50/20 bg-[#651818]/35 px-3 py-2"
                  >
                    <Palette size={16} aria-hidden="true" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {game.currentColor}
                    </span>
                    <span
                      aria-hidden="true"
                      className={
                        "h-3 w-3 rounded-full " +
                        (game.currentColor === "red"
                          ? "bg-red-400"
                          : game.currentColor === "blue"
                            ? "bg-blue-400"
                            : game.currentColor === "green"
                              ? "bg-green-400"
                              : "bg-yellow-300")
                      }
                    />
                  </div>
                </div>

                {/* Seats arranged around the table. Your seat stays at the bottom. */}
                <div className="pointer-events-none absolute inset-0 z-10">
                  {room.players.map((player, index) => {
                    const isCurrentPlayer = game.currentPlayerIndex === index;
                    const isYou = player.id === playerId;
                    const opponentIndex = room.players
                      .filter((candidate) => candidate.id !== playerId)
                      .findIndex((candidate) => candidate.id === player.id);
                    let seatPosition = "";

                    if (isYou) {
                      seatPosition =
                        "bottom-[125px] left-1/2 w-[96%] -translate-x-1/2 sm:bottom-32 sm:w-[min(76%,240px)]";
                    } else if (room.players.length === 2) {
                      seatPosition =
                        "left-1/2 top-[17%] w-[min(70%,260px)] -translate-x-1/2";
                    } else if (room.players.length === 3) {
                      seatPosition =
                        opponentIndex === 0
                          ? "left-3 top-[39%] w-[25%] -translate-y-1/2 sm:left-5 sm:w-[min(26%,200px)]"
                          : "right-0 top-[39%] w-[22%] -translate-y-1/2 sm:right-5 sm:w-[min(26%,200px)]";
                    } else {
                      seatPosition =
                        opponentIndex === 0
                          ? "left-1/2 top-[10%] w-[min(54%,220px)] -translate-x-1/2"
                          : opponentIndex === 1
                            ? "left-8 top-[22%] w-[20%] -translate-y-1/2 sm:left-5 sm:w-[min(27%,170px)]"
                            : "right-0 top-[22%] w-[20%] -translate-y-1/2 sm:right-5 sm:w-[min(27%,170px)]";
                    }

                    return (
                      <div
                        key={player.id}
                        data-token-active={isCurrentPlayer ? "true" : undefined}
                        className={
                          "pointer-events-auto absolute z-30 overflow-visible rounded-2xl border-0 bg-transparent p-3 shadow-none transition-all duration-200 " +
                          seatPosition
                        }
                      >
                        {!isYou && (
                          <div className="w-full min-w-0">
                            {/* {!(
                              room.players.length === 3 ||
                              (room.players.length >= 4 &&
                                (opponentIndex === 1 || opponentIndex === 2))
                            ) && (
                              <p className="mb-3 truncate text-center text-sm font-extrabold text-white sm:text-base">
                                {player.name}
                              </p>
                            )} */}

                            <div
                              className={
                                "relative mx-auto flex w-full items-center justify-center overflow-visible " +
                                (room.players.length === 3 ||
                                (room.players.length >= 4 &&
                                  (opponentIndex === 1 || opponentIndex === 2))
                                  ? "h-[250px] sm:h-[300px]"
                                  : "h-[112px] sm:h-[140px]")
                              }
                              aria-label={
                                "Opponent has " + player.cardCount + " cards"
                              }
                              title={player.cardCount + " cards"}
                            >
                              {Array.from({ length: player.cardCount }).map(
                                (_, cardIndex) => {
                                  const cardCount = Math.max(
                                    player.cardCount,
                                    1,
                                  );
                                  const isSideSeat =
                                    room.players.length === 3 ||
                                    (room.players.length >= 4 &&
                                      (opponentIndex === 1 ||
                                        opponentIndex === 2));
                                  const cardWidth = isSideSeat ? 58 : 78;
                                  const cardHeight = isSideSeat ? 82 : 116;
                                  const spacing = isSideSeat ? 16 : 25;
                                  const offset =
                                    cardIndex - (cardCount - 1) / 2;
                                  const isRightSideSeat =
                                    room.players.length >= 4 &&
                                    opponentIndex === 2;
                                  const sideRotation =
                                    opponentIndex === 1 ? 90 : -90;
                                  const rotation = isSideSeat
                                    ? sideRotation +
                                      offset * (isRightSideSeat ? -2.8 : 2.8)
                                    : offset * 2.8;

                                  return (
                                    <div
                                      key={player.id + "-card-" + cardIndex}
                                      className={
                                        "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden border-[3px] border-white bg-black shadow-[0_5px_12px_rgba(0,0,0,0.28)] " +
                                        (isSideSeat
                                          ? "rounded-[9px] sm:rounded-[10px]"
                                          : "rounded-[13px] sm:rounded-[15px]")
                                      }
                                      style={{
                                        width: cardWidth + "px",
                                        height: cardHeight + "px",
                                        marginLeft: isSideSeat
                                          ? "0px"
                                          : offset * spacing + "px",
                                        marginTop: isSideSeat
                                          ? offset * spacing + "px"
                                          : "0px",
                                        transform:
                                          "translate(-50%, -50%) rotate(" +
                                          rotation +
                                          "deg)",
                                        zIndex: cardIndex + 1,
                                      }}
                                    >
                                      <div className="absolute left-[-35%] top-[22%] h-[54%] w-[170%] rotate-[-35deg] rounded-[50%] bg-red-600" />
                                      <div className="absolute left-[7%] top-[31%] h-[38%] w-[86%] rotate-[-35deg] rounded-[50%] border-2 border-white/95" />
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span
                                          className={
                                            "relative -rotate-[25deg] font-black italic tracking-tight text-yellow-400 " +
                                            (isSideSeat
                                              ? "text-[9px]"
                                              : "text-[11px] sm:text-sm")
                                          }
                                          style={{
                                            WebkitTextStroke: "0.7px white",
                                            textShadow:
                                              "2px 2px 0 #111, -1px -1px 0 #111",
                                          }}
                                        >
                                          UNO
                                        </span>
                                      </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>

                            <p className="hidden">
                              {player.cardCount}{" "}
                              {player.cardCount === 1 ? "card" : "cards"}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Central card piles */}

                <div className="absolute left-1/2 top-[53%] z-10 flex min-h-40 w-[min(68%,500px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-3 rounded-[999px] border-2 border-yellow-400/80 bg-[#741B1B]/45 px-3 py-4 shadow-[0_0_0_10px_rgba(245,197,107,0.07),inset_0_0_30px_rgba(0,0,0,0.12)] sm:top-1/2 sm:min-h-56 sm:w-[min(66%,500px)] sm:gap-10 sm:px-3 sm:py-8">
                  <div className="game-pile">
                    {/* <p className="mb-3 text-[10px] font-black tracking-[0.2em] text-red-50/80 sm:text-xs">
                      DRAW PILE
                    </p> */}

                    <button
                      type="button"
                      data-draw-pile
                      onClick={drawCard}
                      disabled={!isMyTurn || room.status !== "playing"}
                      aria-label={
                        "Draw a card. " +
                        game.drawPileCount +
                        " cards remaining"
                      }
                      className="relative flex h-[58px] w-10 items-center justify-center overflow-hidden rounded-lg border-2 border-white bg-black text-white shadow-xl transition hover:-translate-y-1 hover:shadow-2xl sm:h-36 sm:w-24 sm:rounded-xl sm:border-[3px] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="absolute left-[-28%] top-[23%] h-[54%] w-[156%] rotate-[-35deg] rounded-[50%] bg-red-600" />
                      <span className="absolute left-[5%] top-[32%] h-[36%] w-[90%] rotate-[-35deg] rounded-[50%] border-2 border-white/95" />
                      <span className="relative flex -rotate-[25deg] flex-col items-center justify-center leading-none">
                        <span
                          className="text-2xl font-black italic tracking-tight text-yellow-400 sm:text-3xl"
                          style={{
                            WebkitTextStroke: "0.8px white",
                            textShadow: "2px 2px 0 #111, -1px -1px 0 #111",
                          }}
                        >
                          CF
                        </span>
                        <span className="mt-1 text-[6px] font-black tracking-[0.12em] text-white sm:text-[7px]">
                          COLORFLIP
                        </span>
                      </span>
                    </button>

                    <p className="mt-3 text-center text-xs font-semibold text-red-50/85">
                      {game.drawPileCount} cards
                    </p>
                  </div>

                  <div className="game-pile">
                    {/* <p className="mb-3 text-[10px] font-black tracking-[0.2em] text-red-50/80 sm:text-xs">
                      DISCARD PILE
                    </p> */}

                    {topCard ? (
                      <div
                        data-top-card
                        className={
                          "relative flex h-[100px] w-[66px] items-center justify-center overflow-hidden rounded-xl border-[3px] border-white shadow-xl sm:h-36 sm:w-24 sm:rounded-2xl sm:border-[5px] " +
                          cardColors[topCard.color ?? game.currentColor]
                        }
                        aria-label={
                          (topCard.color ?? game.currentColor) +
                          " " +
                          topCard.value
                        }
                      >
                        <span className="absolute left-2 top-2 text-[10px] font-black uppercase sm:text-xs">
                          {topCard.value.toUpperCase()}
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/80 bg-white/20 text-base font-black italic drop-shadow sm:h-16 sm:w-16 sm:text-2xl">
                          {topCard.value.toUpperCase()}
                        </span>
                      </div>
                    ) : (
                      <div className="flex h-28 w-[4.5rem] items-center justify-center rounded-2xl border-2 border-dashed border-red-100/40 bg-[#741B1B] text-xs text-red-50/65 sm:h-36 sm:w-24">
                        Empty
                      </div>
                    )}

                    <p className="mt-2 w-full text-center text-base font-bold text-white sm:text-lg">
                      Top card
                    </p>
                  </div>
                </div>

                {/* Player hand */}
                <div className="absolute bottom-3 left-2 right-2 z-10 sm:bottom-4 sm:left-8 sm:right-8">
                  <PlayerHand
                    cards={game.hand}
                    onPlayCard={playCard}
                    disabled={!isMyTurn || room.status !== "playing"}
                    getCardColorClass={(card) =>
                      card.color
                        ? cardColors[card.color]
                        : "bg-blue-700 text-white"
                    }
                  />
                </div>

                <GameControls
                  onDrawCard={drawCard}
                  onPassTurn={passTurn}
                  isMyTurn={isMyTurn}
                  isPlaying={room.status === "playing"}
                  hasDrawnCard={Boolean(game.drawnCardId)}
                />
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-red-100/20 bg-[#741B1B] p-6 text-sm text-red-50/75">
                Waiting for the room state from the server...
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const shouldLeave = window.confirm(
                  "Are you sure you want to leave this room?",
                );

                if (shouldLeave) {
                  leaveRoom();
                }
              }}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-100/30 bg-[#651818]/50 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#541414]/70"
            >
              <span aria-hidden="true">↗</span>
              Leave Room
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
