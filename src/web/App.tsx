import { useEffect, useMemo, useRef, useState } from "react";
import { basicSetup, EditorView } from "codemirror";
import { python } from "@codemirror/lang-python";

import { Level, type LevelResult } from "../engine/level";
import type { RelativeDirection } from "../engine/direction";
import type { Space } from "../engine/space";
import { Turn } from "../engine/turn";
import type { IPlayer, ITurn, ILogger, LevelDefinition } from "../engine/types";
import { towers } from "../levels";

const FIXED_PLAYER_CODE = `class Player:\n    def play_turn(self, warrior):\n        space = warrior.feel()\n        if space.is_enemy():\n            warrior.attack()\n        elif warrior.health() < 8:\n            warrior.rest()\n        else:\n            warrior.walk()`;

const RELATIVE_DIRECTIONS: RelativeDirection[] = [
  "forward",
  "left",
  "right",
  "backward",
];

const ABILITY_TO_API: Record<string, string[]> = {
  "walk!": ["warrior.walk()", "warrior.walk('backward')"],
  "attack!": ["warrior.attack()", "warrior.attack('left')"],
  "rest!": ["warrior.rest()"],
  "rescue!": ["warrior.rescue()", "warrior.rescue('right')"],
  "shoot!": ["warrior.shoot()", "warrior.shoot('forward')"],
  "pivot!": ["warrior.pivot()", "warrior.pivot('backward')"],
  "bind!": ["warrior.bind()", "warrior.bind('left')"],
  "detonate!": ["warrior.detonate()", "warrior.detonate('forward')"],
  feel: ["warrior.feel()", "warrior.feel('left')"],
  health: ["warrior.health()"],
  look: ["warrior.look()", "warrior.look('backward')"],
  listen: ["warrior.listen()"],
  direction_of_stairs: ["warrior.direction_of_stairs()"],
  direction_of: ["warrior.direction_of(space)"],
  distance_of: ["warrior.distance_of(space)"],
};

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

function getAvailableApiList(level: LevelDefinition): string[] {
  const mapped = level.warrior.abilities.flatMap((ability) => {
    return ABILITY_TO_API[ability] ?? [];
  });
  return [...new Set(mapped)];
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

export default function App() {
  const [towerName, setTowerName] = useState("beginner");
  const [speedMs, setSpeedMs] = useState(450);
  const [playerCode, setPlayerCode] = useState(FIXED_PLAYER_CODE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [board, setBoard] = useState("");
  const [logs, setLogs] = useState("(ログなし)");
  const [result, setResult] = useState<LevelResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showTips, setShowTips] = useState(true);

  const sessionRef = useRef(new LevelSession());
  const timerRef = useRef<number | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const levelNumber = 1;

  const selectedTower = useMemo(() => {
    return towers.find((item) => item.name === towerName) ?? towers[0];
  }, [towerName]);

  const level = useMemo(() => {
    return selectedTower.getLevel(levelNumber) ?? selectedTower.levels[0];
  }, [selectedTower]);

  const availableApi = useMemo(() => getAvailableApiList(level), [level]);
  const levelSteps = useMemo(() => {
    return Array.from({ length: selectedTower.levelCount }, (_, index) => index + 1);
  }, [selectedTower]);

  const refreshGameState = (): void => {
    const session = sessionRef.current;
    setBoard(session.board);
    setLogs(session.logs || "(ログなし)");
    setResult(session.result);
  };

  const stopTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  };

  const startLevel = (): void => {
    stopTimer();
    setShowResultModal(false);
    sessionRef.current.setup(level, playerCode);
    refreshGameState();
  };

  const handleTick = (): void => {
    const canContinue = sessionRef.current.step();
    refreshGameState();
    if (!canContinue) {
      stopTimer();
      setShowResultModal(true);
    }
  };

  const handlePlay = (): void => {
    if (timerRef.current !== null) return;
    setIsPlaying(true);
    timerRef.current = window.setInterval(handleTick, speedMs);
  };

  const handlePause = (): void => {
    stopTimer();
  };

  useEffect(() => {
    if (!editorHostRef.current) return;

    editorViewRef.current = createCodeEditor(editorHostRef.current, playerCode, (code) => {
      setPlayerCode(code);
    });

    return () => {
      stopTimer();
      if (editorViewRef.current) {
        editorViewRef.current.destroy();
        editorViewRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    startLevel();
  }, [level]);

  return (
    <main className="layout">
      <section className="hero">
        <div className="hero-line" />
        <h1>Py Samurai ⚔️🐱</h1>
        <div className="hero-line" />
      </section>

      <nav className="level-progress" aria-label="Level Progress">
        {levelSteps.map((step, index) => (
          <button
            key={step}
            type="button"
            className={step === levelNumber ? "progress-step active" : "progress-step"}
          >
            Lv.{step}
            {index < levelSteps.length - 1 ? <span className="progress-arrow">{" > "}</span> : null}
          </button>
        ))}
      </nav>

      <div className="course-tabs" role="tablist" aria-label="Course">
        {towers.map((tower) => (
          <button
            key={tower.name}
            type="button"
            role="tab"
            aria-selected={towerName === tower.name}
            className={towerName === tower.name ? "tab-button active" : "tab-button"}
            disabled={isPlaying}
            onClick={() => setTowerName(tower.name)}
          >
            {tower.name}
          </button>
        ))}
      </div>

      <section className="workspace">
        <section className="left-column">
          <article className="console-panel">
            <h2>🗺️ Board</h2>
            <pre id="board">{board}</pre>
            <div className="console-controls">
              <button onClick={handlePlay} disabled={isPlaying}>
                ▶️ Play
              </button>
              <button onClick={handlePause} disabled={!isPlaying}>
                {isPlaying ? "⏸️ Pause" : "⏸️ Paused"}
              </button>
              <button onClick={startLevel}>🔁 Reset</button>
              <label className="speed-label">
                ⚡ Speed
                <select
                  value={speedMs}
                  disabled={isPlaying}
                  onChange={(e) => setSpeedMs(Number(e.target.value))}
                >
                  <option value={700}>Slow</option>
                  <option value={450}>Normal</option>
                  <option value={220}>Fast</option>
                </select>
              </label>
            </div>
          </article>
          <article className="editor-panel">
            <div className="player-code-header">
              <h3>👨‍💻 Player Code</h3>
              <button type="button" onClick={() => setShowTips((prev) => !prev)}>
                {showTips ? "💡 Hide Tips" : "💡 Show Tips"}
              </button>
            </div>
            <div className="editor-layout">
              <div className="editor-main">
                <div ref={editorHostRef} className="editor-host" />
                <p className="code-note">コード変更は次回の Start/Reset 時に反映されます。</p>
              </div>
              <aside className="api-panel">
                <h4>📚 Available API</h4>
                <ul className="api-list">
                  {availableApi.length > 0 ? (
                    availableApi.map((item) => <li key={item}>{item}</li>)
                  ) : (
                    <li>(none)</li>
                  )}
                </ul>
              </aside>
            </div>
            {showTips ? (
              <aside className="tips-panel">
                <h4>💡 Tip</h4>
                <p>{level.tip}</p>
                {level.clue ? (
                  <>
                    <h4>🧭 Clue</h4>
                    <p>{level.clue}</p>
                  </>
                ) : null}
              </aside>
            ) : null}
          </article>
        </section>

        <article className="logs-panel">
          <h2>🖥️ System Logs</h2>
          <p className="description">{level.description}</p>
          <pre id="logs">{logs}</pre>
        </article>
      </section>

      {showResultModal && result ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Result">
          <article className="modal-card">
            <h3>🏁 Result</h3>
            <p className="result-status">{result.passed ? "CLEAR" : "FAILED"}</p>
            <ul>
              <li>Turns: {result.turns}</li>
              <li>Total Score: {result.totalScore}</li>
              <li>Time Bonus: {result.timeBonus}</li>
              <li>Grade: {result.grade ?? "-"}</li>
            </ul>
            {!result.passed && level.clue ? (
              <p className="clue-box">
                <strong>Clue:</strong> {level.clue}
              </p>
            ) : null}
            <div className="controls">
              <button
                onClick={() => {
                  setShowResultModal(false);
                  startLevel();
                }}
              >
                🔁 Retry
              </button>
              <button onClick={() => setShowResultModal(false)}>✅ Close</button>
            </div>
          </article>
        </div>
      ) : null}
    </main>
  );
}
