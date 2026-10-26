import { createDeck, shuffleDeck } from "./deck.js";
import type { Card, CardColor, GameState, Player } from "./types.js";

export interface PlayerInput {
  id: string;
  name: string;
}

const COLORS: CardColor[] = ["red", "blue", "green", "yellow"];

export function createGame(
  roomId: string,
  playerInputs: PlayerInput[],
): GameState {
  if (playerInputs.length < 2 || playerInputs.length > 4) {
    throw new Error("ColorFlip requires 2–4 players.");
  }

  if (
    new Set(playerInputs.map((player) => player.id)).size !==
    playerInputs.length
  ) {
    throw new Error("Player IDs must be unique.");
  }

  const players: Player[] = playerInputs.map((player) => ({
    id: player.id,
    name: player.name,
    hand: [],
    connected: true,
  }));

  const deck = createDeck();

  for (const player of players) {
    player.hand = deck.splice(0, 7);
  }

  const startingIndex = deck.findIndex(
    (card) =>
      card.color !== null &&
      typeof card.value === "string" &&
      /^\d$/.test(card.value),
  );

  if (startingIndex === -1) {
    throw new Error("Unable to find a starting card.");
  }

  const startingCard = deck.splice(startingIndex, 1)[0];

  if (!startingCard || !startingCard.color) {
    throw new Error("Invalid starting card.");
  }

  return {
    roomId,
    players,
    drawPile: deck,
    discardPile: [startingCard],
    currentPlayerIndex: 0,
    direction: 1,
    currentColor: startingCard.color,
    status: "playing",
    winnerId: null,
    drawnCardId: null,
  };
}

export function getCurrentPlayer(game: GameState): Player {
  const player = game.players[game.currentPlayerIndex];

  if (!player) {
    throw new Error("Current player not found.");
  }

  return player;
}

export function isPlayableCard(card: Card, game: GameState): boolean {
  const topCard = game.discardPile[game.discardPile.length - 1];

  if (!topCard) {
    return true;
  }

  if (card.color === null) {
    if (card.value === "wild-draw-four") {
      const player = getCurrentPlayer(game);

      return !player.hand.some(
        (handCard) => handCard.color === game.currentColor,
      );
    }

    return card.value === "wild";
  }

  return card.color === game.currentColor || card.value === topCard.value;
}

export function drawCards(
  game: GameState,
  playerIndex: number,
  count: number,
): Card[] {
  const player = game.players[playerIndex];

  if (!player) {
    throw new Error("Player not found.");
  }

  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Draw count must be a non-negative integer.");
  }

  const drawnCards: Card[] = [];

  for (let index = 0; index < count; index++) {
    if (game.drawPile.length === 0) {
      const topCard = game.discardPile.pop();

      if (!topCard) {
        break;
      }

      game.drawPile = shuffleDeck(game.discardPile);
      game.discardPile = [topCard];
    }

    const card = game.drawPile.pop();

    if (!card) {
      break;
    }

    player.hand.push(card);
    drawnCards.push(card);
  }

  return drawnCards;
}

export function nextPlayer(game: GameState): void {
  const playerCount = game.players.length;

  if (playerCount === 0) {
    throw new Error("Cannot advance a game with no players.");
  }

  for (let attempt = 0; attempt < playerCount; attempt++) {
    game.currentPlayerIndex =
      (game.currentPlayerIndex + game.direction + playerCount) % playerCount;

    const player = game.players[game.currentPlayerIndex];

    if (player?.connected) {
      return;
    }
  }

  throw new Error("No connected players are available to take a turn.");
}

export function playCard(
  game: GameState,
  playerId: string,
  cardId: string,
  chosenColor?: CardColor,
): GameState {
  if (game.status !== "playing") {
    throw new Error("The game is not in progress.");
  }

  const player = getCurrentPlayer(game);

  if (player.id !== playerId) {
    throw new Error("It is not your turn.");
  }

  const cardIndex = player.hand.findIndex((card) => card.id === cardId);

  if (cardIndex === -1) {
    throw new Error("Card not found in your hand.");
  }

  const card = player.hand[cardIndex];

  if (!card) {
    throw new Error("Invalid card.");
  }

  if (game.drawnCardId !== null && game.drawnCardId !== card.id) {
    throw new Error("You may only play the card you just drew.");
  }

  if (!isPlayableCard(card, game)) {
    throw new Error("That card cannot be played.");
  }

  if (card.color === null && (!chosenColor || !COLORS.includes(chosenColor))) {
    throw new Error("Choose a valid color for your Wild card.");
  }

  player.hand.splice(cardIndex, 1);
  game.discardPile.push(card);
  game.currentColor = card.color ?? chosenColor!;
  game.drawnCardId = null;

  if (player.hand.length === 0) {
    game.status = "finished";
    game.winnerId = player.id;
    return game;
  }

  switch (card.value) {
    case "reverse": {
      game.direction = game.direction === 1 ? -1 : 1;

      // With two players, Reverse acts like Skip.
      if (game.players.length === 2) {
        nextPlayer(game);
      }

      nextPlayer(game);
      break;
    }

    case "skip": {
      nextPlayer(game);
      nextPlayer(game);
      break;
    }

    case "draw-two": {
      nextPlayer(game);
      drawCards(game, game.currentPlayerIndex, 2);
      nextPlayer(game);
      break;
    }

    case "wild-draw-four": {
      nextPlayer(game);
      drawCards(game, game.currentPlayerIndex, 4);
      nextPlayer(game);
      break;
    }

    default: {
      nextPlayer(game);
      break;
    }
  }

  return game;
}

export function drawForCurrentPlayer(game: GameState, playerId: string): Card {
  if (game.status !== "playing") {
    throw new Error("The game is not in progress.");
  }

  const player = getCurrentPlayer(game);

  if (player.id !== playerId) {
    throw new Error("It is not your turn.");
  }

  if (game.drawnCardId !== null) {
    throw new Error("You have already drawn a card this turn.");
  }

  const drawnCards = drawCards(game, game.currentPlayerIndex, 1);

  const card = drawnCards[0];

  if (!card) {
    throw new Error("No cards are available to draw.");
  }

  game.drawnCardId = card.id;

  return card;
}

export function passTurn(game: GameState, playerId: string): GameState {
  if (game.status !== "playing") {
    throw new Error("The game is not in progress.");
  }

  const player = getCurrentPlayer(game);

  if (player.id !== playerId) {
    throw new Error("It is not your turn.");
  }

  if (game.drawnCardId === null) {
    throw new Error("Draw a card before passing your turn.");
  }

  game.drawnCardId = null;
  nextPlayer(game);

  return game;
}
