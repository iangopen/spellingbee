// Fixed mock data for the screenshot harness. Words and definitions are real
// entries from src/data/words; names are invented guests.
import type { GameState } from "../../src/types";
import type { PlayerRow } from "../../src/lib/rooms";
import type { MultiplayerExtras } from "../../src/hooks/useMultiplayerGame";

const T = "2026-09-28T12:00:00Z";

export const MOCK_PLAYERS: PlayerRow[] = [
  { room_id: "r", player_id: "me", display_name: "Maya", score: 118, streak: 3, connected_at: T, lives: 2, is_eliminated: false, turn_order: 1, avatar: "bee" },
  { room_id: "r", player_id: "p2", display_name: "Tomasz", score: 96, streak: 0, connected_at: T, lives: 3, is_eliminated: false, turn_order: 2, avatar: "clover" },
  { room_id: "r", player_id: "p3", display_name: "Adaeze", score: 74, streak: 1, connected_at: T, lives: 1, is_eliminated: false, turn_order: 3, avatar: "blossom" },
  { room_id: "r", player_id: "p4", display_name: "Rafael", score: 31, streak: 0, connected_at: T, lives: 0, is_eliminated: true, turn_order: 4, avatar: "wasp" },
];

const RHYTHM = { id: "m1", word: "rhythm", tier: "medium" as const, definition: "A strong, regular repeated pattern of sound" };

export function spState(status: GameState["status"], over: Partial<GameState> = {}): GameState {
  return {
    tier: "medium",
    status,
    currentWord: RHYTHM,
    score: 58,
    streak: 3,
    bestStreak: 4,
    timeLeft: 9,
    wordsRemaining: 6,
    untimed: false,
    hideDefinition: false,
    lastResponseMs: status === "correct" ? 2100 : null,
    ...over,
  };
}

export const BESTS = { novice: 214, easy: 187, building: 152, medium: 118, advanced: 64, hard: 0, expert: 0, master: 0 };

export function elimExtras(over: Partial<MultiplayerExtras> = {}): MultiplayerExtras {
  return {
    awaitingOthers: false,
    resultNote: null,
    players: MOCK_PLAYERS,
    isHost: true,
    currentUserId: "me",
    error: null,
    mode: "elimination",
    livesSetting: 3,
    startingPlayers: 4,
    tableStreak: 2,
    currentTurnPlayerId: "p2",
    isMyTurn: false,
    submitting: false,
    amEliminated: false,
    myLives: 2,
    survivors: 3,
    eliminationOrder: ["p4"],
    turnOutcome: null,
    lastResolvedTurn: null,
    winnerId: null,
    winnerName: null,
    ...over,
  };
}
