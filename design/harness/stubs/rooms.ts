// Harness stub for src/lib/rooms.ts: same exports the screens import, local
// data only. Types are re-exported from the real module (type-only, erased at
// build time), so nothing here can reach the network.
export type { RoomInfo, PlayerRow, RoomMode, RoomPreview, RoomStatus } from "../../../src/lib/rooms";
import type { PlayerRow, RoomPreview } from "../../../src/lib/rooms";
import { MOCK_PLAYERS } from "../mock";

export const DEFAULT_LIVES = 3;
export const MIN_LIVES = 1;
export const MAX_LIVES = 9;
export const PLAYER_CAP = 8;
export const livesLabel = (n: number) => `${n} ${n === 1 ? "life" : "lives"}`;

const never = () => new Promise<never>(() => {});
export const createRoom = never;
export const joinRoomByCode = never;
export const leaveRoom = async () => {};
export const updateAvatar = async () => {};
export const startGame = never;
export const startEliminationGame = never;
export const submitAnswer = never;
export const submitTurn = never;
export const advanceRound = never;
export async function previewRoomByCode(): Promise<RoomPreview | null> {
  return null;
}
export async function fetchPlayers(): Promise<PlayerRow[]> {
  return MOCK_PLAYERS.map((p) => ({ ...p, turn_order: null, lives: 3, is_eliminated: false }));
}
export async function fetchRoomHostId(): Promise<string | null> {
  return "me";
}
export function subscribePlayers() {
  return {} as never;
}
