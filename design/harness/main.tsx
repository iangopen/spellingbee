// Screenshot harness entry: ?screen=<id>&theme=light|dark
// Every screen is the real component from src/, handed mock props. The shell
// markup mirrors App.tsx's <Shell> so layout and the settings launcher match.
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft } from "lucide-react";
import "../../src/index.css";
import "../../src/App.css";
import { applyTheme, setStoredTheme } from "../../src/lib/theme";
import { HoneycombBackground } from "../../src/components/HoneycombBackground";
import { SettingsPanel } from "../../src/components/SettingsPanel";
import { ModeSelect } from "../../src/components/ModeSelect";
import { DifficultySelect } from "../../src/components/DifficultySelect";
import { RoundScreen } from "../../src/components/RoundScreen";
import { ResultsScreen } from "../../src/components/ResultsScreen";
import { LobbyScreen } from "../../src/components/LobbyScreen";
import { WaitingRoom } from "../../src/components/WaitingRoom";
import { TurnScreen } from "../../src/components/TurnScreen";
import { EliminationResults } from "../../src/components/EliminationResults";
import { BESTS, MOCK_PLAYERS, elimExtras, spState } from "./mock";

const noop = () => {};
const params = new URLSearchParams(location.search);
const theme = params.get("theme") === "light" ? "light" : "dark";
// The OS setting is ignored since redesign stage 1, and SettingsPanel re-applies the
// stored theme on mount, so the harness stores its pick exactly as a player would.
setStoredTheme(theme);
applyTheme(theme);
// ?peak=1: the shimmer at its brightest everywhere (honeycomb.css), so measure.mjs sees the worst pixel.
if (params.get("peak") === "1") document.documentElement.setAttribute("data-peak", "1");

const SCREENS: Record<string, () => ReactNode> = {
  home: () => <ModeSelect onSingle={noop} onMulti={noop} />,
  difficulty: () => (
    <div className="sp-home">
      <button className="back-link">
        <ArrowLeft size={15} aria-hidden />
        Modes
      </button>
      <DifficultySelect bests={BESTS} onSelect={noop} />
    </div>
  ),
  "sp-round": () => <RoundScreen state={spState("playing")} onSubmit={noop} onSkip={noop} onExit={noop} />,
  "sp-correct": () => <RoundScreen state={spState("correct", { score: 77, streak: 4 })} onSubmit={noop} onSkip={noop} onExit={noop} />,
  "sp-incorrect": () => <RoundScreen state={spState("incorrect", { streak: 0 })} onSubmit={noop} onSkip={noop} onExit={noop} />,
  "sp-results": () => <ResultsScreen score={132} bestStreak={6} best={118} onReplay={noop} onMenu={noop} />,
  settings: () => <ModeSelect onSingle={noop} onMulti={noop} />,
  lobby: () => <LobbyScreen onExitToModes={noop} onEnterRoom={noop} />,
  "waiting-room": () => (
    <div className="lobby">
      <WaitingRoom
        room={{ id: "r", code: "K7QPZM", tier: "medium", status: "lobby", mode: "race", livesSetting: 3 }}
        currentUserId="me"
        isHost
        onLeave={noop}
      />
    </div>
  ),
  "race-round": () => (
    <RoundScreen state={spState("playing", { timeLeft: 11 })} onSubmit={noop} onSkip={noop} canSkip={false} />
  ),
  "race-locked": () => (
    <RoundScreen state={spState("playing", { timeLeft: 7 })} onSubmit={noop} onSkip={noop} canSkip={false} awaitingOthers />
  ),
  "race-roundend": () => (
    <RoundScreen
      state={spState("incorrect", { streak: 0 })}
      onSubmit={noop}
      onSkip={noop}
      canSkip={false}
      resultNote="Tomasz won this round"
    />
  ),
  "race-results": () => <ResultsScreen score={205} bestStreak={5} best={205} onReplay={noop} onMenu={noop} />,
  "elim-watch": () => (
    <TurnScreen state={spState("playing", { timeLeft: 10 })} extras={elimExtras()} onSubmit={noop} onLeave={noop} />
  ),
  "elim-myturn": () => (
    <TurnScreen
      state={spState("playing", { timeLeft: 12 })}
      extras={elimExtras({ currentTurnPlayerId: "me", isMyTurn: true })}
      onSubmit={noop}
      onLeave={noop}
    />
  ),
  "elim-results": () => (
    <EliminationResults
      extras={elimExtras({
        winnerId: "p2",
        winnerName: "Tomasz",
        eliminationOrder: ["p4", "p3", "me"],
        players: MOCK_PLAYERS.map((p) => ({ ...p, is_eliminated: p.player_id !== "p2" })),
      })}
      onLeave={noop}
    />
  ),
};

const screen = params.get("screen") ?? "home";
const render = SCREENS[screen] ?? (() => <p>Unknown screen: {screen}</p>);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="app-shell">
      <HoneycombBackground />
      <SettingsPanel />
      {render()}
    </div>
  </StrictMode>
);
