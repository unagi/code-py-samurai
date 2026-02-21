import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { basicSetup, EditorView } from "codemirror";
import { python } from "@codemirror/lang-python";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

import { Level, type LevelResult } from "../engine/level";
import type { ILogger, LevelDefinition } from "../engine/types";
import { compilePythonPlayer } from "../runtime/python-player";
import { formatPythonError } from "../runtime/errors";
import { towers } from "../levels";

const STARTER_PLAYER_CODE = `class Player:\n    def play_turn(self, warrior):\n        # ここに1ターン分の処理を書く\n        pass`;

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

interface TileMeta {
  kind: string;
  alt: string;
  assetPath?: string;
}

const TILE_META_BY_SYMBOL: Record<string, TileMeta> = {
  " ": { kind: "empty", alt: "empty floor" },
  "-": { kind: "frame", alt: "frame wall" },
  "|": { kind: "frame", alt: "frame wall" },
  ">": { kind: "stairs", alt: "stairs" },
  "@": { kind: "warrior", alt: "warrior" },
  s: { kind: "sludge", alt: "sludge" },
  S: { kind: "thick-sludge", alt: "thick sludge" },
  a: { kind: "archer", alt: "archer" },
  w: { kind: "wizard", alt: "wizard" },
  C: { kind: "captive", alt: "captive" },
  G: { kind: "golem", alt: "golem" },
  "?": { kind: "unknown", alt: "unknown unit" },
};

interface BoardTile {
  symbol: string;
  kind: string;
  alt: string;
  assetPath?: string;
}

interface BoardGridData {
  columns: number;
  rows: number;
  tiles: BoardTile[];
}

const BOARD_TILE_GAP_PX = 2;

function getMaxBoardSize(): { columns: number; rows: number } {
  let maxColumns = 1;
  let maxRows = 1;
  for (const tower of towers) {
    for (const level of tower.levels) {
      const columns = level.floor.width + 2;
      const rows = level.floor.height + 2;
      if (columns > maxColumns) maxColumns = columns;
      if (rows > maxRows) maxRows = rows;
    }
  }
  return { columns: maxColumns, rows: maxRows };
}

const MAX_BOARD_SIZE = getMaxBoardSize();

function buildBoardGrid(board: string): BoardGridData {
  const raw = board.trimEnd();
  const sourceLines = raw.length > 0 ? raw.split("\n") : [];
  const sourceColumns = sourceLines.reduce((max, line) => Math.max(max, line.length), 0);
  const sourceRows = sourceLines.length;

  const columns = Math.max(MAX_BOARD_SIZE.columns, sourceColumns);
  const rows = Math.max(MAX_BOARD_SIZE.rows, sourceRows);

  const leftPad = Math.floor((columns - sourceColumns) / 2);
  const rightPad = columns - sourceColumns - leftPad;
  const topPad = Math.floor((rows - sourceRows) / 2);
  const bottomPad = rows - sourceRows - topPad;

  const normalizedLines: string[] = [];
  for (let y = 0; y < topPad; y++) normalizedLines.push(" ".repeat(columns));
  for (const line of sourceLines) {
    const filled = line.padEnd(sourceColumns, " ");
    normalizedLines.push(`${" ".repeat(leftPad)}${filled}${" ".repeat(rightPad)}`);
  }
  for (let y = 0; y < bottomPad; y++) normalizedLines.push(" ".repeat(columns));

  const tiles: BoardTile[] = [];
  for (const line of normalizedLines) {
    for (const symbol of line) {
      const meta = TILE_META_BY_SYMBOL[symbol] ?? { kind: "unknown", alt: `unknown(${symbol})` };
      tiles.push({
        symbol,
        kind: meta.kind,
        alt: meta.alt,
        assetPath: meta.assetPath,
      });
    }
  }

  return {
    columns,
    rows: normalizedLines.length,
    tiles,
  };
}

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
  private _setupError: string | null = null;
  private _runtimeError: string | null = null;

  setup(levelDef: LevelDefinition, playerCode: string): void {
    this._logger.clear();
    this._setupError = null;
    this._runtimeError = null;
    try {
      const player = compilePythonPlayer(playerCode);
      this._level = new Level(levelDef, this._logger);
      this._level.setup(player, []);
    } catch (error) {
      this._level = null;
      this._setupError = formatPythonError(error);
      this._logger.log(this._setupError);
    }
  }

  step(): boolean {
    if (!this._level) return false;
    try {
      return this._level.step();
    } catch (error) {
      this._runtimeError = formatPythonError(error);
      this._logger.log(this._runtimeError);
      return false;
    }
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

  get canPlay(): boolean {
    return this._level !== null && this._setupError === null && this._runtimeError === null;
  }
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
  const readableHighlight = HighlightStyle.define([
    { tag: [tags.keyword, tags.controlKeyword], color: "#7ec7ff", fontWeight: "700" },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#ffd58e" },
    { tag: [tags.variableName, tags.propertyName], color: "#d9e8f5" },
    { tag: [tags.number, tags.bool, tags.null], color: "#ffb88c" },
    { tag: [tags.string], color: "#b6f29a" },
    { tag: [tags.comment], color: "#7f96ac", fontStyle: "italic" },
    { tag: [tags.operator, tags.punctuation], color: "#b6c8d8" },
  ]);

  return new EditorView({
    doc: initialCode,
    parent,
    extensions: [
      basicSetup,
      python(),
      syntaxHighlighting(readableHighlight),
      EditorView.theme({
        "&": {
          minHeight: "220px",
          fontSize: "14px",
          color: "#dce8f3",
          backgroundColor: "#15191f",
        },
        ".cm-scroller": {
          overflow: "auto",
          fontFamily: "\"UDEV Gothic 35\", \"SFMono-Regular\", Consolas, monospace",
        },
        ".cm-content": {
          caretColor: "#9dd7ff",
        },
        "&.cm-focused .cm-cursor": {
          borderLeftColor: "#9dd7ff",
        },
        "&.cm-focused .cm-selectionBackground, ::selection": {
          backgroundColor: "#2b4561",
        },
        ".cm-activeLine": {
          backgroundColor: "#1b222b",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "#1b222b",
          color: "#9bb2c8",
        },
        ".cm-gutters": {
          backgroundColor: "#15191f",
          color: "#7f93a8",
          border: "none",
        },
        ".cm-lineNumbers .cm-gutterElement": {
          color: "#7f93a8",
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
  const [playerCode, setPlayerCode] = useState(STARTER_PLAYER_CODE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [canPlay, setCanPlay] = useState(true);
  const [board, setBoard] = useState("");
  const [logs, setLogs] = useState("(ログなし)");
  const [result, setResult] = useState<LevelResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [tileSizePx, setTileSizePx] = useState(20);

  const sessionRef = useRef(new LevelSession());
  const timerRef = useRef<number | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const boardViewportRef = useRef<HTMLDivElement | null>(null);
  const levelNumber = 1;

  const selectedTower = useMemo(() => {
    return towers.find((item) => item.name === towerName) ?? towers[0];
  }, [towerName]);

  const level = useMemo(() => {
    return selectedTower.getLevel(levelNumber) ?? selectedTower.levels[0];
  }, [selectedTower]);

  const availableApi = useMemo(() => getAvailableApiList(level), [level]);
  const boardGrid = useMemo(() => buildBoardGrid(board), [board]);
  const levelSteps = useMemo(() => {
    return Array.from({ length: selectedTower.levelCount }, (_, index) => index + 1);
  }, [selectedTower]);
  useLayoutEffect(() => {
    const viewport = boardViewportRef.current;
    if (!viewport) return;

    const computeTileSize = (): void => {
      const cols = Math.max(boardGrid.columns, 1);
      const rows = Math.max(boardGrid.rows, 1);
      const availableWidth = Math.max(0, viewport.clientWidth);
      const availableHeight = Math.max(0, viewport.clientHeight);
      const tileByWidth = (availableWidth - BOARD_TILE_GAP_PX * (cols - 1)) / cols;
      const tileByHeight = (availableHeight - BOARD_TILE_GAP_PX * (rows - 1)) / rows;
      const computed = Math.max(1, Math.floor(Math.min(tileByWidth, tileByHeight)));
      setTileSizePx(computed);
    };

    computeTileSize();
    const observer = new ResizeObserver(computeTileSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [boardGrid.columns, boardGrid.rows]);

  const boardGridStyle = useMemo(() => {
    return {
      gridTemplateColumns: `repeat(${Math.max(boardGrid.columns, 1)}, ${tileSizePx}px)`,
      gridTemplateRows: `repeat(${Math.max(boardGrid.rows, 1)}, ${tileSizePx}px)`,
      gap: `${BOARD_TILE_GAP_PX}px`,
    } as CSSProperties;
  }, [boardGrid.columns, boardGrid.rows, tileSizePx]);

  const refreshGameState = (): void => {
    const session = sessionRef.current;
    setBoard(session.board);
    setLogs(session.logs || "(ログなし)");
    setResult(session.result);
    setCanPlay(session.canPlay);
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
    if (timerRef.current !== null || !canPlay) return;
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
            <div id="board" className="board-viewport" ref={boardViewportRef}>
              <div
                className="board-grid"
                role="img"
                aria-label={`Board ${boardGrid.rows}x${boardGrid.columns}`}
                style={boardGridStyle}
              >
                {boardGrid.tiles.map((tile, index) => {
                  const displaySymbol = tile.symbol === " " ? "\u00a0" : tile.symbol;
                  return (
                    <div
                      key={`${index}-${tile.kind}-${tile.symbol}`}
                      className={`board-tile tile-${tile.kind}`}
                      title={tile.alt}
                      aria-label={tile.alt}
                    >
                      {tile.assetPath ? (
                        <img src={tile.assetPath} alt={tile.alt} className="tile-image" />
                      ) : (
                        <span className="tile-fallback" aria-hidden="true">{displaySymbol}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="console-controls">
              <button onClick={handlePlay} disabled={isPlaying || !canPlay}>
                <span className="icon-label"><i className="bi bi-play-fill" />Play</span>
              </button>
              <button onClick={handlePause} disabled={!isPlaying}>
                <span className="icon-label"><i className="bi bi-pause-fill" />{isPlaying ? "Pause" : "Paused"}</span>
              </button>
              <button onClick={startLevel}>
                <span className="icon-label"><i className="bi bi-arrow-repeat" />Reset</span>
              </button>
              <label className="speed-label">
                <span className="icon-label"><i className="bi bi-lightning-charge-fill" />Speed</span>
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
              <div className="tip-anchor">
                <button type="button" className="tip-trigger" aria-describedby="tips-popover">
                  <span className="icon-label"><i className="bi bi-lightbulb-fill" />Tips</span>
                </button>
                <aside id="tips-popover" className="tips-popover" role="tooltip">
                  <h4>💡 Tip</h4>
                  <p>{level.tip}</p>
                  {level.clue ? (
                    <>
                      <h4>🧭 Clue</h4>
                      <p>{level.clue}</p>
                    </>
                  ) : null}
                </aside>
              </div>
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
                <span className="icon-label"><i className="bi bi-arrow-repeat" />Retry</span>
              </button>
              <button onClick={() => setShowResultModal(false)}>
                <span className="icon-label"><i className="bi bi-check2-circle" />Close</span>
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </main>
  );
}
