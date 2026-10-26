import { describe, expect, it } from "vitest";
import {
  createGame,
  drawCards,
  drawForCurrentPlayer,
  getCurrentPlayer,
  isPlayableCard,
  passTurn,
  playCard,
} from "./engine.js";
import type { Card, CardColor, GameState } from "./types.js";

function createTestCard(
  id: string,
  color: CardColor | null,
  value: Card["value"],
): Card {
  return { id, color, value };
}

function createTestGame(): GameState {
  return {
    roomId: "TEST01",
    players: [
      {
        id: "player-1",
        name: "swiftotter123",
        hand: [
          createTestCard("red-1", "red", "1"),
          createTestCard("blue-2", "blue", "2"),
        ],
        connected: true,
      },
      {
        id: "player-2",
        name: "brightfox456",
        hand: [
          createTestCard("green-3", "green", "3"),
          createTestCard("yellow-4", "yellow", "4"),
        ],
        connected: true,
      },
    ],
    drawPile: [
      createTestCard("draw-blue-5", "blue", "5"),
      createTestCard("draw-green-6", "green", "6"),
    ],
    discardPile: [createTestCard("discard-red-7", "red", "7")],
    currentPlayerIndex: 0,
    direction: 1,
    currentColor: "red",
    status: "playing",
    winnerId: null,
    drawnCardId: null,
  };
}

describe("ColorFlip game engine", () => {
  it("creates a game with 2–4 players and seven cards per player", () => {
    const game = createGame("TEST01", [
      { id: "player-1", name: "swiftotter123" },
      { id: "player-2", name: "brightfox456" },
    ]);

    expect(game.players).toHaveLength(2);
    expect(game.players[0]?.hand).toHaveLength(7);
    expect(game.players[1]?.hand).toHaveLength(7);
    expect(game.status).toBe("playing");
    expect(game.discardPile).toHaveLength(1);
  });

  it("rejects games with fewer than two players", () => {
    expect(() =>
      createGame("TEST01", [{ id: "player-1", name: "swiftotter123" }]),
    ).toThrow("ColorFlip requires 2–4 players.");
  });

  it("rejects games with more than four players", () => {
    expect(() =>
      createGame("TEST01", [
        { id: "player-1", name: "playerone" },
        { id: "player-2", name: "playertwo" },
        { id: "player-3", name: "playerthree" },
        { id: "player-4", name: "playerfour" },
        { id: "player-5", name: "playerfive" },
      ]),
    ).toThrow("ColorFlip requires 2–4 players.");
  });

  it("rejects duplicate player IDs", () => {
    expect(() =>
      createGame("TEST01", [
        { id: "player-1", name: "swiftotter123" },
        { id: "player-1", name: "brightfox456" },
      ]),
    ).toThrow("Player IDs must be unique.");
  });

  it("finds the current player", () => {
    const game = createTestGame();

    expect(getCurrentPlayer(game).id).toBe("player-1");
  });

  it("allows a card matching the active color", () => {
    const game = createTestGame();
    const card = game.players[0]?.hand[0];

    expect(card).toBeDefined();

    if (card) {
      expect(isPlayableCard(card, game)).toBe(true);
    }
  });

  it("rejects a card that matches neither color nor value", () => {
    const game = createTestGame();
    const card = game.players[1]?.hand[0];

    expect(card).toBeDefined();

    if (card) {
      expect(isPlayableCard(card, game)).toBe(false);
    }
  });

  it("allows a card matching the top discard value", () => {
    const game = createTestGame();
    const card = createTestCard("blue-7", "blue", "7");

    expect(isPlayableCard(card, game)).toBe(true);
  });

  it("does not allow a player to play out of turn", () => {
    const game = createTestGame();

    expect(() => playCard(game, "player-2", "green-3")).toThrow(
      "It is not your turn.",
    );
  });

  it("allows the current player to play a valid card", () => {
    const game = createTestGame();

    playCard(game, "player-1", "red-1");

    expect(game.players[0]?.hand).toHaveLength(1);
    expect(game.discardPile.at(-1)?.id).toBe("red-1");
    expect(game.currentPlayerIndex).toBe(1);
  });

  it("rejects playing a card that is not in the player's hand", () => {
    const game = createTestGame();

    expect(() => playCard(game, "player-1", "missing-card")).toThrow(
      "Card not found in your hand.",
    );
  });

  it("requires a valid color when playing a Wild card", () => {
    const game = createTestGame();

    game.players[0]?.hand.push(createTestCard("wild-1", null, "wild"));

    expect(() => playCard(game, "player-1", "wild-1")).toThrow(
      "Choose a valid color for your Wild card.",
    );
  });

  it("rejects an invalid chosen color for a Wild card", () => {
    const game = createTestGame();

    game.players[0]?.hand.push(createTestCard("wild-1", null, "wild"));

    expect(() =>
      playCard(game, "player-1", "wild-1", "purple" as CardColor),
    ).toThrow("Choose a valid color for your Wild card.");
  });

  it("draws one card for the current player", () => {
    const game = createTestGame();

    const drawnCard = drawForCurrentPlayer(game, "player-1");

    expect(drawnCard.id).toBe("draw-green-6");
    expect(game.players[0]?.hand).toHaveLength(3);
    expect(game.drawnCardId).toBe(drawnCard.id);
  });

  it("does not allow drawing twice in the same turn", () => {
    const game = createTestGame();

    drawForCurrentPlayer(game, "player-1");

    expect(() => drawForCurrentPlayer(game, "player-1")).toThrow(
      "You have already drawn a card this turn.",
    );
  });

  it("requires drawing before passing", () => {
    const game = createTestGame();

    expect(() => passTurn(game, "player-1")).toThrow(
      "Draw a card before passing your turn.",
    );
  });

  it("passes to the next player after drawing", () => {
    const game = createTestGame();

    drawForCurrentPlayer(game, "player-1");
    passTurn(game, "player-1");

    expect(game.currentPlayerIndex).toBe(1);
    expect(game.drawnCardId).toBeNull();
  });

  it("finishes the game when a player plays their last card", () => {
    const game = createTestGame();

    game.players[0]!.hand = [createTestCard("last-card", "red", "1")];

    playCard(game, "player-1", "last-card");

    expect(game.status).toBe("finished");
    expect(game.winnerId).toBe("player-1");
  });

  it("rejects drawing a negative number of cards", () => {
    const game = createTestGame();

    expect(() => drawCards(game, 0, -1)).toThrow(
      "Draw count must be a non-negative integer.",
    );
  });

  it("rejects drawing a fractional number of cards", () => {
    const game = createTestGame();

    expect(() => drawCards(game, 0, 1.5)).toThrow(
      "Draw count must be a non-negative integer.",
    );
  });
});

describe("Special card tests", () => {
  it("should skip the next player in a two-player game", () => {
    const game = createTestGame();

    game.players[0]!.hand = [
      createTestCard("skip-card", "red", "skip"),
      createTestCard("extra-card", "blue", "5"),
    ];

    game.currentPlayerIndex = 0;
    game.currentColor = "red";

    playCard(game, "player-1", "skip-card");

    expect(game.currentPlayerIndex).toBe(0);
  });

  it("should reverse direction in a three-player game", () => {
    const game = createTestGame();

    game.players.push({
      id: "player-3",
      name: "swiftfox789",
      hand: [createTestCard("third-card", "green", "3")],
      connected: true,
    });

    game.players[0]!.hand = [
      createTestCard("reverse-card", "red", "reverse"),
      createTestCard("extra-card", "blue", "5"),
    ];

    game.currentPlayerIndex = 0;
    game.currentColor = "red";
    game.direction = 1;

    playCard(game, "player-1", "reverse-card");

    expect(game.direction).toBe(-1);
    expect(game.currentPlayerIndex).toBe(2);
  });

  it("should make Reverse act like Skip in a two-player game", () => {
    const game = createTestGame();

    game.players[0]!.hand = [
      createTestCard("reverse-card", "red", "reverse"),
      createTestCard("extra-card", "blue", "5"),
    ];

    game.currentPlayerIndex = 0;
    game.currentColor = "red";
    game.direction = 1;

    playCard(game, "player-1", "reverse-card");

    expect(game.direction).toBe(-1);
    expect(game.currentPlayerIndex).toBe(0);
  });

  it("should apply Draw Two and advance past the affected player", () => {
    const game = createTestGame();

    game.players[0]!.hand = [
      createTestCard("draw-two-card", "red", "draw-two"),
      createTestCard("extra-card", "blue", "5"),
    ];

    game.players[1]!.hand = [createTestCard("opponent-card", "green", "3")];

    game.drawPile = [
      createTestCard("draw-1", "blue", "1"),
      createTestCard("draw-2", "green", "2"),
    ];

    const opponentHandSize = game.players[1]!.hand.length;

    playCard(game, "player-1", "draw-two-card");

    expect(game.players[1]!.hand).toHaveLength(opponentHandSize + 2);
    expect(game.currentPlayerIndex).toBe(0);
  });

  it("rejects Wild Draw Four when the player has a matching-color card", () => {
    const game = createTestGame();

    game.players[0]!.hand = [
      createTestCard("wild-four-card", null, "wild-draw-four"),
      createTestCard("matching-card", "red", "5"),
    ];

    game.currentColor = "red";

    expect(() => playCard(game, "player-1", "wild-four-card", "blue")).toThrow(
      "That card cannot be played.",
    );
  });

  it("allows Wild Draw Four when the player has no matching-color card", () => {
    const game = createTestGame();

    game.players[0]!.hand = [
      createTestCard("wild-four-card", null, "wild-draw-four"),
      createTestCard("other-card", "blue", "5"),
    ];

    game.players[1]!.hand = [createTestCard("opponent-card", "green", "3")];

    game.drawPile = [
      createTestCard("draw-1", "blue", "1"),
      createTestCard("draw-2", "green", "2"),
      createTestCard("draw-3", "yellow", "3"),
      createTestCard("draw-4", "red", "4"),
    ];

    game.currentPlayerIndex = 0;
    game.currentColor = "red";
    game.drawnCardId = null;

    const opponentHandSize = game.players[1]!.hand.length;

    playCard(game, "player-1", "wild-four-card", "green");

    expect(game.currentColor).toBe("green");
    expect(game.players[1]!.hand).toHaveLength(opponentHandSize + 4);
    expect(game.currentPlayerIndex).toBe(0);
  });

  it("draws four cards when enough cards are available", () => {
    const game = createTestGame();

    game.players[1]!.hand = [createTestCard("opponent-card", "green", "3")];

    game.drawPile = [
      createTestCard("draw-1", "blue", "1"),
      createTestCard("draw-2", "green", "2"),
      createTestCard("draw-3", "yellow", "3"),
      createTestCard("draw-4", "red", "4"),
    ];

    const initialHandSize = game.players[1]!.hand.length;

    const drawnCards = drawCards(game, 1, 4);

    expect(drawnCards).toHaveLength(4);
    expect(game.players[1]!.hand).toHaveLength(initialHandSize + 4);
  });

  it("reshuffles the discard pile when the draw pile is empty", () => {
    const game = createTestGame();

    game.drawPile = [];
    game.discardPile = [
      createTestCard("discard-1", "red", "1"),
      createTestCard("discard-2", "blue", "2"),
      createTestCard("discard-3", "green", "3"),
      createTestCard("discard-top", "yellow", "4"),
    ];

    const preservedTopCard = game.discardPile[3];

    const drawnCards = drawCards(game, 0, 2);

    expect(drawnCards).toHaveLength(2);
    expect(game.discardPile).toHaveLength(1);
    expect(game.discardPile[0]?.id).toBe(preservedTopCard?.id);
  });

  it("draws as many cards as possible when the deck is exhausted", () => {
    const game = createTestGame();

    game.drawPile = [];
    game.discardPile = [createTestCard("only-discard", "red", "1")];

    const drawnCards = drawCards(game, 0, 4);

    expect(drawnCards).toHaveLength(0);
  });
});
