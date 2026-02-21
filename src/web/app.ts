import { Level, type LevelResult } from "../engine/level";
import type { RelativeDirection } from "../engine/direction";
import type { Space } from "../engine/space";
import { Turn } from "../engine/turn";
import type { IPlayer, ITurn, ILogger, LevelDefinition } from "../engine/types";
import { towers } from "../levels";
import { basicSetup, EditorView } from "codemirror";
import { python } from "@codemirror/lang-python";

const FIXED_PLAYER_CODE = `class Player:\n    def play_turn(self, warrior):\n        space = warrior.feel()\n        if space.is_enemy():\n            warrior.attack()\n        elif warrior.health() < 8:\n            warrior.rest()\n        else:\n            warrior.walk()`;

const RELATIVE_DIRECTIONS: RelativeDirection[] = [
  "forward",
  "left",
  "right",
  "backward",
];

class MemoryLogger implements ILogger {
  lines: string[] = [];

  log(msg: string): void {
    this.lines.push(msg);
  }

  clear(): void {
    this.lines = [];
  }

  dump(): string {
    return this.lines.join("\n");
  }
}

class LevelSession {
  private _logger = new MemoryLogger();
  private _level: Level | null = null;

  setup(levelDef: LevelDefinition, playerCode: string): void {
    this._logger.clear();
    this._level = new Level(levelDef, this._logger);
    this._level.setup(createScriptedPlayer(playerCode), []);
  }

  step(): boolean {
    if (!this._level) return false;
    return this._level.step();
  }

  get board(): string {
    if (!this._level) return "";
    return this._level.floor.character();
  }

  get logs(): string {
    return this._logger.dump();
  }

  get result(): LevelResult | null {
    if (!this._level) return null;
    return this._level.result();
  }
}

type Screen = "title" | "game" | "result";

interface AppState {
  screen: Screen;
  playerName: string;
  towerName: string;
  levelNumber: number;
  speedMs: number;
  playerCode: string;
}

function createScriptedPlayer(source: string): IPlayer {
  const canFeel = /\bfeel\s*\(/.test(source);
  const canHealth = /\bhealth\s*\(/.test(source);
  const canWalk = /\bwalk\s*\(/.test(source);
  const canAttack = /\battack\s*\(/.test(source);
  const canRescue = /\brescue\s*\(/.test(source);
  const canRest = /\brest\s*\(/.test(source);
  const canPivot = /\bpivot\s*\(/.test(source);

  return {
    playTurn(turn: ITurn): void {
      const t = turn as Turn;

      if (canFeel && t.hasSense("feel")) {
        for (const direction of RELATIVE_DIRECTIONS) {
          const space = t.doSense("feel", direction) as Space;
          if (canAttack && space.isEnemy() && t.hasAction("attack!")) {
            t.doAction("attack!", direction);
            return;
          }
          if (canRescue && space.isCaptive() && t.hasAction("rescue!")) {
            t.doAction("rescue!", direction);
            return;
          }
        }
      }

      if (canHealth && canRest && t.hasSense("health") && t.hasAction("rest!")) {
        const health = t.doSense("health") as number;
        if (health <= 8) {
          t.doAction("rest!");
          return;
        }
      }

      if (canWalk && t.hasAction("walk!")) {
        t.doAction("walk!", "forward");
        return;
      }

      if (canPivot && t.hasAction("pivot!")) {
        t.doAction("pivot!", "backward");
      }
    },
  };
}

function createCodeEditor(
  parent: HTMLElement,
  initialCode: string,
  onChange: (code: string) => void,
): EditorView {
  return new EditorView({
    doc: initialCode,
    parent,
    extensions: [
      basicSetup,
      python(),
      EditorView.theme({
        "&": {
          minHeight: "220px",
          fontSize: "14px",
        },
        ".cm-scroller": {
          overflow: "auto",
          fontFamily: "\"UDEV Gothic 35\", \"SFMono-Regular\", Consolas, monospace",
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
    ],
  });
}

function getLevelDefinition(state: AppState): LevelDefinition {
  const tower = towers.find((item) => item.name === state.towerName) ?? towers[0];
  return tower.getLevel(state.levelNumber) ?? tower.levels[0];
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function mountApp(): void {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("#app was not found");
  }

  const state: AppState = {
    screen: "title",
    playerName: "Samurai",
    towerName: "beginner",
    levelNumber: 1,
    speedMs: 450,
    playerCode: FIXED_PLAYER_CODE,
  };

  const session = new LevelSession();
  let timer: ReturnType<typeof setInterval> | null = null;
  let editorView: EditorView | null = null;

  const stopTimer = (): void => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const refreshGameState = (): void => {
    const board = root.querySelector<HTMLPreElement>("#board");
    const logs = root.querySelector<HTMLPreElement>("#logs");
    if (board) board.textContent = session.board;
    if (logs) logs.textContent = session.logs || "(ログなし)";
  };

  const finishGame = (): void => {
    stopTimer();
    state.screen = "result";
    render();
  };

  const tick = (): void => {
    const canContinue = session.step();
    refreshGameState();
    if (!canContinue) {
      finishGame();
    }
  };

  const resetSession = (): void => {
    stopTimer();
    const level = getLevelDefinition(state);
    session.setup(level, state.playerCode);
    refreshGameState();
  };

  const renderTitle = (): void => {
    root.innerHTML = `
      <main class="layout">
        <section class="panel title-panel">
          <h1>Py Samurai</h1>
          <p>TypeScriptエンジンを使ったWeb版の最小プレイ画面です。</p>
          <label>
            プレイヤー名
            <input id="player-name" value="${escapeHtml(state.playerName)}" />
          </label>
          <label>
            タワー
            <select id="tower-name">
              ${towers
                .map(
                  (tower) =>
                    `<option value="${tower.name}" ${tower.name === state.towerName ? "selected" : ""}>${tower.name}</option>`,
                )
                .join("")}
            </select>
          </label>
          <button id="start-game">ゲーム開始</button>
        </section>
      </main>
    `;

    const playerName = root.querySelector<HTMLInputElement>("#player-name");
    const towerSelect = root.querySelector<HTMLSelectElement>("#tower-name");
    const startButton = root.querySelector<HTMLButtonElement>("#start-game");

    startButton?.addEventListener("click", () => {
      state.playerName = playerName?.value.trim() || "Samurai";
      state.towerName = towerSelect?.value || "beginner";
      state.levelNumber = 1;
      state.screen = "game";
      render();
      resetSession();
    });
  };

  const renderGame = (): void => {
    const level = getLevelDefinition(state);
    root.innerHTML = `
      <main class="layout">
        <section class="panel game-panel">
          <header class="game-header">
            <h2>${escapeHtml(state.playerName)} - ${escapeHtml(state.towerName)} #${state.levelNumber}</h2>
            <div class="controls">
              <button id="play">Play</button>
              <button id="pause">Pause</button>
              <button id="reset">Reset</button>
              <button id="to-title">Title</button>
            </div>
          </header>
          <p class="description">${escapeHtml(level.description)}</p>
          <div class="grid">
            <article class="panel-sub">
              <h3>Board (ASCII)</h3>
              <pre id="board"></pre>
            </article>
            <article class="panel-sub">
              <h3>Logs</h3>
              <pre id="logs"></pre>
            </article>
          </div>
          <article class="panel-sub">
            <h3>Player Code (CodeMirror)</h3>
            <div id="editor-host" class="editor-host"></div>
          </article>
        </section>
      </main>
    `;

    const play = root.querySelector<HTMLButtonElement>("#play");
    const pause = root.querySelector<HTMLButtonElement>("#pause");
    const reset = root.querySelector<HTMLButtonElement>("#reset");
    const toTitle = root.querySelector<HTMLButtonElement>("#to-title");
    const editorHost = root.querySelector<HTMLDivElement>("#editor-host");

    if (editorView) {
      editorView.destroy();
      editorView = null;
    }
    if (editorHost) {
      editorView = createCodeEditor(editorHost, state.playerCode, (code) => {
        state.playerCode = code;
      });
    }

    play?.addEventListener("click", () => {
      if (timer) return;
      timer = setInterval(tick, state.speedMs);
    });

    pause?.addEventListener("click", () => {
      stopTimer();
    });

    reset?.addEventListener("click", () => {
      resetSession();
    });

    toTitle?.addEventListener("click", () => {
      stopTimer();
      if (editorView) {
        editorView.destroy();
        editorView = null;
      }
      state.screen = "title";
      render();
    });

    refreshGameState();
  };

  const renderResult = (): void => {
    const result = session.result;
    root.innerHTML = `
      <main class="layout">
        <section class="panel result-panel">
          <h2>Result</h2>
          <p class="result-status">${result?.passed ? "CLEAR" : "FAILED"}</p>
          <ul>
            <li>Turns: ${result?.turns ?? 0}</li>
            <li>Total Score: ${result?.totalScore ?? 0}</li>
            <li>Time Bonus: ${result?.timeBonus ?? 0}</li>
            <li>Grade: ${result?.grade ?? "-"}</li>
          </ul>
          <div class="controls">
            <button id="retry">Retry</button>
            <button id="back-title">Title</button>
          </div>
        </section>
      </main>
    `;

    const retry = root.querySelector<HTMLButtonElement>("#retry");
    const backTitle = root.querySelector<HTMLButtonElement>("#back-title");

    retry?.addEventListener("click", () => {
      state.screen = "game";
      render();
      resetSession();
    });

    backTitle?.addEventListener("click", () => {
      if (editorView) {
        editorView.destroy();
        editorView = null;
      }
      state.screen = "title";
      render();
    });
  };

  const render = (): void => {
    if (state.screen === "title") {
      renderTitle();
      return;
    }
    if (state.screen === "game") {
      renderGame();
      return;
    }
    renderResult();
  };

  render();
}
