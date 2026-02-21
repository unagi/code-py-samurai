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
  const [playerName, setPlayerName] = useState("Samurai");
  const [towerName, setTowerName] = useState("beginner");
  const [speedMs, setSpeedMs] = useState(450);
  const [playerCode, setPlayerCode] = useState(FIXED_PLAYER_CODE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [board, setBoard] = useState("");
  const [logs, setLogs] = useState("(ログなし)");
  const [result, setResult] = useState<LevelResult | null>(null);

  const sessionRef = useRef(new LevelSession());
  const timerRef = useRef<number | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  const level = useMemo(() => {
    const tower = towers.find((item) => item.name === towerName) ?? towers[0];
    return tower.getLevel(1) ?? tower.levels[0];
  }, [towerName]);

  const availableApi = useMemo(() => getAvailableApiList(level), [level]);

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
    sessionRef.current.setup(level, playerCode);
    refreshGameState();
  };

  const handleTick = (): void => {
    const canContinue = sessionRef.current.step();
    refreshGameState();
    if (!canContinue) {
      stopTimer();
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

  return (
    <main className="layout">
      <section className="panel game-panel">
        <header className="game-header">
          <h1>Py Samurai</h1>
          <div className="controls">
            <label>
              Name
              <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
            </label>
            <label>
              Course
              <select value={towerName} onChange={(e) => setTowerName(e.target.value)}>
                {towers.map((tower) => (
                  <option key={tower.name} value={tower.name}>
                    {tower.name}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={startLevel}>Start Level #1</button>
          </div>
        </header>

        <p className="run-state">
          Player: <strong>{playerName || "Samurai"}</strong> / State: <strong>{isPlaying ? "Running" : "Ready"}</strong>
        </p>
        <p className="description">{level.description}</p>

        <article className="panel-sub info-panel">
          <h3>Level Info</h3>
          <p>
            <strong>Tip:</strong> {level.tip}
          </p>
          {level.clue ? (
            <p>
              <strong>Clue:</strong> {level.clue}
            </p>
          ) : null}
          <h4>Available API</h4>
          <ul className="api-list">
            {availableApi.length > 0 ? (
              availableApi.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>(none)</li>
            )}
          </ul>
        </article>

        <div className="controls runtime-controls">
          <button onClick={handlePlay} disabled={isPlaying}>
            Play
          </button>
          <button onClick={handlePause} disabled={!isPlaying}>
            {isPlaying ? "Pause" : "Paused"}
          </button>
          <label className="speed-label">
            Speed
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
          <button onClick={startLevel}>Reset</button>
        </div>

        <div className="grid">
          <article className="panel-sub">
            <h3>Board (ASCII)</h3>
            <pre id="board">{board}</pre>
          </article>
          <article className="panel-sub">
            <h3>Logs</h3>
            <pre id="logs">{logs}</pre>
          </article>
        </div>

        <article className="panel-sub">
          <h3>Player Code (CodeMirror)</h3>
          <div ref={editorHostRef} className="editor-host" />
          <p className="code-note">コード変更は次回の Start/Reset 時に反映されます。</p>
        </article>

        {result ? (
          <article className="panel-sub result-inline">
            <h3>Result</h3>
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
          </article>
        ) : null}
      </section>
    </main>
  );
}
