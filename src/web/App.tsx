import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { basicSetup, EditorView } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { EditorState } from "@codemirror/state";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";

import { Level, type LevelResult } from "../engine/level";
import type { ILogger, IPlayer, LevelDefinition, WarriorAbilitySet } from "../engine/types";
import {
  getGlobalLevelFromTowerLevel,
  getMaxWarriorLevel,
  getWarriorAbilitiesAtGlobalLevel,
  warriorAbilitiesToEngineAbilities,
} from "../engine/warrior-abilities";
import { formatPythonError } from "../runtime/errors";
import { runPythonPlayerSource } from "../runtime/python-runner";
import { towers } from "../levels";

const STARTER_PLAYER_CODE = `class Player:\n    def play_turn(self, warrior):\n        # ここに1ターン分の処理を書く\n        pass`;

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
  "@": {
    kind: "warrior",
    alt: "warrior",
    assetPath: "/assets/sprites/samurai-cat/idle-east-frames/frame_01.png",
  },
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

interface DamagePopup {
  id: number;
  tileIndex: number;
  text: string;
  expiresAt: number;
}

const BOARD_TILE_GAP_PX = 2;
const UI_MAX_TURNS = 1000;
const WARRIOR_IDLE_FRAME_COUNT = 16;
const WARRIOR_IDLE_FRAME_MS = 140;
const DAMAGE_POPUP_MS = 820;
const STORAGE_KEY_PROGRESS = "py-samurai:progress";
const STORAGE_KEY_PLAYER_CODE = "py-samurai:player-code";

const UNIT_ID_PREFIX_TO_KIND: Record<string, string> = {
  warrior: "warrior",
  golem: "golem",
  sludge: "sludge",
  thicksludge: "thick-sludge",
  archer: "archer",
  wizard: "wizard",
  captive: "captive",
};

const TILE_BASE_STATS: Record<string, { hp: number | null; atk: number | null }> = {
  warrior: { hp: 20, atk: 5 },
  golem: { hp: null, atk: 3 },
  sludge: { hp: 12, atk: 3 },
  "thick-sludge": { hp: 24, atk: 3 },
  archer: { hp: 7, atk: 3 },
  wizard: { hp: 3, atk: 11 },
  captive: { hp: 1, atk: 0 },
};

interface ProgressStorageData {
  towerName?: string;
  levelNumber?: number;
  warriorLevel?: number;
  warriorLevelByTower?: Record<string, number>;
}

function clampLevel(value: unknown, levelCount: number): number {
  const n = typeof value === "number" ? Math.floor(value) : 1;
  return Math.min(Math.max(1, n), levelCount);
}

function readProgressStorage(): ProgressStorageData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PROGRESS);
    if (!raw) return {};
    return JSON.parse(raw) as ProgressStorageData;
  } catch {
    return {};
  }
}

function buildWarriorLevel(data: ProgressStorageData): number {
  const maxLv = getMaxWarriorLevel();
  if (typeof data.warriorLevel === "number") {
    return Math.min(Math.max(1, Math.floor(data.warriorLevel)), maxLv);
  }

  let migrated = 1;
  if (data.warriorLevelByTower && typeof data.warriorLevelByTower === "object") {
    for (const [towerName, local] of Object.entries(data.warriorLevelByTower)) {
      if (typeof local !== "number") continue;
      migrated = Math.max(migrated, getGlobalLevelFromTowerLevel(towerName, Math.floor(local)));
    }
  }

  return Math.min(Math.max(1, migrated), maxLv);
}

function getWarriorIdleFramePath(frameIndex: number): string {
  const frame = String((frameIndex % WARRIOR_IDLE_FRAME_COUNT) + 1).padStart(2, "0");
  return `/assets/sprites/samurai-cat/idle-east-frames/frame_${frame}.png`;
}

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

function normalizeIdPrefix(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseDamageLine(line: string): { unitId: string; amount: number } | null {
  const m = /^([a-z0-9#_-]+)\s+takes\s+(\d+)\s+damage/i.exec(line);
  if (!m) return null;
  return { unitId: m[1].toLowerCase(), amount: Number(m[2]) };
}

function stripTrailingDigits(s: string): string {
  let end = s.length;
  while (end > 0 && s[end - 1] >= "0" && s[end - 1] <= "9") end--;
  return s.slice(0, end);
}

function resolveUnitKind(unitId: string): string | undefined {
  const prefixRaw = unitId.includes("#") ? unitId.split("#")[0] : stripTrailingDigits(unitId);
  return UNIT_ID_PREFIX_TO_KIND[normalizeIdPrefix(prefixRaw)];
}

interface TileIndexResolver {
  directLookup(unitId: string): number | undefined;
  kindLookup(unitId: string): number | undefined;
}

function buildTileIndexResolver(
  unitTileIndexByLabel: Map<string, number>,
  grid: ReturnType<typeof buildBoardGrid>,
): TileIndexResolver {
  const indicesByKind = new Map<string, number[]>();
  const useCountByKind = new Map<string, number>();
  const tiles = grid.tiles;
  const warriorIndex = tiles.findIndex((tile) => tile.kind === "warrior");
  const cols = Math.max(grid.columns, 1);

  for (let i = 0; i < tiles.length; i++) {
    const kind = tiles[i].kind;
    const list = indicesByKind.get(kind);
    if (list) {
      list.push(i);
    } else {
      indicesByKind.set(kind, [i]);
    }
  }

  const distanceToWarrior = (index: number): number => {
    if (warriorIndex < 0) return 0;
    const x1 = index % cols;
    const y1 = Math.floor(index / cols);
    const x2 = warriorIndex % cols;
    const y2 = Math.floor(warriorIndex / cols);
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  };

  return {
    directLookup(unitId: string) {
      return unitTileIndexByLabel.get(unitId);
    },
    kindLookup(unitId: string) {
      const kind = resolveUnitKind(unitId);
      if (!kind) return undefined;
      const indices = indicesByKind.get(kind);
      if (!indices || indices.length === 0) return undefined;
      const used = useCountByKind.get(kind) ?? 0;
      if (kind !== "warrior" && warriorIndex >= 0) {
        indices.sort((a, b) => {
          const d = distanceToWarrior(a) - distanceToWarrior(b);
          return d !== 0 ? d : a - b;
        });
      }
      const tileIndex = indices[used % indices.length];
      useCountByKind.set(kind, used + 1);
      return tileIndex;
    },
  };
}

function createDamagePopupsFromLogs(
  lines: string[],
  board: string,
  idSeed: number,
  unitTileIndexByLabel: Map<string, number>,
): DamagePopup[] {
  if (lines.length === 0) return [];

  const resolver = buildTileIndexResolver(unitTileIndexByLabel, buildBoardGrid(board));
  const popups: DamagePopup[] = [];
  let nextId = idSeed;
  const now = Date.now();

  for (const line of lines) {
    const parsed = parseDamageLine(line);
    if (!parsed) continue;
    const { unitId, amount } = parsed;
    const tileIndex = resolver.directLookup(unitId) ?? resolver.kindLookup(unitId);
    if (tileIndex === undefined) continue;
    popups.push({ id: nextId++, tileIndex, text: `-${amount}`, expiresAt: now + DAMAGE_POPUP_MS });
  }

  return popups;
}

function buildTileStatsText(
  tileKind: string,
  warriorHealth: number | null,
  warriorMaxHealth: number | null,
): string | null {
  if (tileKind === "warrior") {
    const hpNow = warriorHealth ?? "--";
    const hpMax = warriorMaxHealth ?? "--";
    return `HP ${hpNow}/${hpMax}  ATK 5`;
  }
  const stats = TILE_BASE_STATS[tileKind];
  if (!stats) return null;
  const hpText = stats.hp === null ? "HP --/--" : `HP ${stats.hp}/${stats.hp}`;
  const atkText = stats.atk === null ? "ATK --" : `ATK ${stats.atk}`;
  return `${hpText}  ${atkText}`;
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
  private _fallbackBoard = "";
  private _lastValidPlayer: IPlayer | null = null;

  private buildFallbackBoard(levelDef: LevelDefinition): string {
    const previewPlayer: IPlayer = {
      playTurn: () => {},
    };
    const previewLevel = new Level(levelDef);
    previewLevel.setup(previewPlayer, []);
    return previewLevel.floor.character();
  }

  setup(levelDef: LevelDefinition, playerCode: string, existingAbilities: string[] = []): void {
    this._logger.clear();
    this._setupError = null;
    this._runtimeError = null;
    this._fallbackBoard = this.buildFallbackBoard(levelDef);
    try {
      const { player } = runPythonPlayerSource(playerCode);
      this._lastValidPlayer = player;
      this._level = new Level(levelDef, this._logger);
      this._level.setup(player, existingAbilities);
    } catch (error) {
      this._setupError = formatPythonError(error);
      this._logger.log(this._setupError);
      if (this._lastValidPlayer) {
        this._logger.log("[system] Using last valid player code. Fix syntax and retry to apply new code.");
        this._level = new Level(levelDef, this._logger);
        this._level.setup(this._lastValidPlayer, []);
      } else {
        this._level = null;
      }
    }
  }

  resetWithLastValid(levelDef: LevelDefinition): boolean {
    if (!this._lastValidPlayer) return false;
    this._logger.clear();
    this._setupError = null;
    this._runtimeError = null;
    this._fallbackBoard = this.buildFallbackBoard(levelDef);
    this._level = new Level(levelDef, this._logger);
    this._level.setup(this._lastValidPlayer, []);
    return true;
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
    if (!this._level) return this._fallbackBoard;
    return this._level.floor.character();
  }

  get logs(): string {
    return this._logger.dump();
  }

  get result(): LevelResult | null {
    if (!this._level) return null;
    return this._level.result();
  }

  get warriorHealth(): number | null {
    if (!this._level) return null;
    return this._level.warrior.health;
  }

  get warriorMaxHealth(): number | null {
    if (!this._level) return null;
    return this._level.warrior.maxHealth;
  }

  getUnitTileIndexMap(board: string): Map<string, number> {
    const map = new Map<string, number>();
    if (!this._level) return map;
    const raw = board.trimEnd();
    const sourceLines = raw.length > 0 ? raw.split("\n") : [];
    const sourceColumns = sourceLines.reduce((max, line) => Math.max(max, line.length), 0);
    const sourceRows = sourceLines.length;
    const columns = Math.max(MAX_BOARD_SIZE.columns, sourceColumns);
    const rows = Math.max(MAX_BOARD_SIZE.rows, sourceRows);
    const leftPad = Math.floor((columns - sourceColumns) / 2);
    const topPad = Math.floor((rows - sourceRows) / 2);

    for (const unit of this._level.floor.units) {
      const candidate = unit as unknown as {
        unitId?: string;
        position: { x: number; y: number } | null;
      };
      if (typeof candidate.unitId !== "string" || !candidate.position) continue;
      const boardX = leftPad + candidate.position.x + 1;
      const boardY = topPad + candidate.position.y + 1;
      const tileIndex = boardY * columns + boardX;
      map.set(candidate.unitId.toLowerCase(), tileIndex);
    }

    return map;
  }

  get canPlay(): boolean {
    return this._level !== null && this._setupError === null && this._runtimeError === null;
  }

  get hasSetupError(): boolean {
    return this._setupError !== null;
  }

  get hasLastValidPlayer(): boolean {
    return this._lastValidPlayer !== null;
  }
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
      keymap.of([indentWithTab]),
      EditorState.tabSize.of(4),
      indentUnit.of("    "),
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
  const initialProgress = readProgressStorage();
  const [towerName, setTowerName] = useState(() => {
    const exists = towers.some((tower) => tower.name === initialProgress.towerName);
    return exists && initialProgress.towerName ? initialProgress.towerName : "beginner";
  });
  const [levelNumber, setLevelNumber] = useState(() => {
    const tower = towers.find((item) => item.name === initialProgress.towerName) ?? towers[0];
    return clampLevel(initialProgress.levelNumber, tower.levelCount);
  });
  const [warriorLevel, setWarriorLevel] = useState<number>(() => {
    return buildWarriorLevel(initialProgress);
  });
  const [speedMs, setSpeedMs] = useState(450);
  const [playerCode, setPlayerCode] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_PLAYER_CODE);
      if (typeof saved === "string" && saved.length > 0) {
        return saved;
      }
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
    return STARTER_PLAYER_CODE;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [canPlay, setCanPlay] = useState(true);
  const [board, setBoard] = useState("");
  const [logs, setLogs] = useState("(ログなし)");
  const [result, setResult] = useState<LevelResult | null>(null);
  const [warriorHealth, setWarriorHealth] = useState<number | null>(null);
  const [warriorMaxHealth, setWarriorMaxHealth] = useState<number | null>(null);
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
  const [hoveredEnemyStats, setHoveredEnemyStats] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [tileSizePx, setTileSizePx] = useState(20);
  const [warriorFrame, setWarriorFrame] = useState(0);
  const [isCodeDirty, setIsCodeDirty] = useState(false);

  const sessionRef = useRef(new LevelSession());
  const timerRef = useRef<number | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const boardViewportRef = useRef<HTMLDivElement | null>(null);
  const logLineCountRef = useRef(0);
  const damagePopupIdRef = useRef(1);
  const unitTileIndexMapRef = useRef(new Map<string, number>());

  const selectedTower = useMemo(() => {
    return towers.find((item) => item.name === towerName) ?? towers[0];
  }, [towerName]);
  const level = useMemo(() => {
    return selectedTower.getLevel(levelNumber) ?? selectedTower.levels[0];
  }, [selectedTower, levelNumber]);
  const unlockedWarriorAbilities = useMemo<WarriorAbilitySet>(() => {
    return getWarriorAbilitiesAtGlobalLevel(warriorLevel);
  }, [warriorLevel]);
  const unlockedEngineAbilities = useMemo(
    () => warriorAbilitiesToEngineAbilities(unlockedWarriorAbilities),
    [unlockedWarriorAbilities],
  );
  const availableMethods = useMemo(
    () => unlockedWarriorAbilities.skills.map((item) => `warrior.${item}`),
    [unlockedWarriorAbilities.skills],
  );
  const availableProperties = useMemo(
    () => unlockedWarriorAbilities.stats.map((item) => `warrior.${item}`),
    [unlockedWarriorAbilities.stats],
  );
  const boardGrid = useMemo(() => buildBoardGrid(board), [board]);
  const levelSteps = useMemo(() => {
    return Array.from({ length: selectedTower.levelCount }, (_, index) => index + 1);
  }, [selectedTower]);
  const hasNextLevel = levelNumber < selectedTower.levelCount;
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
  const damagePopupsByTile = useMemo(() => {
    const grouped = new Map<number, DamagePopup[]>();
    for (const popup of damagePopups) {
      const list = grouped.get(popup.tileIndex);
      if (list) {
        list.push(popup);
      } else {
        grouped.set(popup.tileIndex, [popup]);
      }
    }
    return grouped;
  }, [damagePopups]);

  const refreshGameState = (): void => {
    const session = sessionRef.current;
    const nextBoard = session.board;
    const nextLogs = session.logs || "(ログなし)";
    const allLogLines = nextLogs === "(ログなし)" ? [] : nextLogs.split("\n");
    const prevLineCount = allLogLines.length < logLineCountRef.current ? 0 : logLineCountRef.current;
    const newLines = allLogLines.slice(prevLineCount);
    logLineCountRef.current = allLogLines.length;

    const boardForDamage = board.trim().length > 0 ? board : nextBoard;
    const popups = createDamagePopupsFromLogs(
      newLines,
      boardForDamage,
      damagePopupIdRef.current,
      unitTileIndexMapRef.current,
    );
    if (popups.length > 0) {
      damagePopupIdRef.current += popups.length;
      setDamagePopups((prev) => [...prev, ...popups].slice(-40));
    }

    setBoard(nextBoard);
    setLogs(nextLogs);
    setResult(session.result);
    setWarriorHealth(session.warriorHealth);
    setWarriorMaxHealth(session.warriorMaxHealth);
    setCanPlay(session.canPlay);
    unitTileIndexMapRef.current = session.getUnitTileIndexMap(nextBoard);
  };

  const stopTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  };

  const startLevel = (): boolean => {
    stopTimer();
    setShowResultModal(false);
    setHoveredEnemyStats(null);
    logLineCountRef.current = 0;
    unitTileIndexMapRef.current = new Map<string, number>();
    setDamagePopups([]);
    sessionRef.current.setup(level, playerCode, unlockedEngineAbilities);
    refreshGameState();
    setIsCodeDirty(false);
    return sessionRef.current.canPlay;
  };

  const handleTick = (): void => {
    const canContinue = sessionRef.current.step();
    const currentResult = sessionRef.current.result;
    refreshGameState();
    if (canContinue && currentResult && currentResult.turns >= UI_MAX_TURNS) {
      stopTimer();
      setLogs((prev) => `${prev}\n[system] Stopped at ${UI_MAX_TURNS} turns (timeout).`);
      setShowResultModal(true);
      return;
    }
    if (!canContinue) {
      stopTimer();
      if (currentResult?.passed) {
        const clearedGlobalLevel = getGlobalLevelFromTowerLevel(towerName, levelNumber);
        setWarriorLevel((prev) => Math.max(prev, clearedGlobalLevel));
      }
      setShowResultModal(true);
    }
  };

  const handlePlay = (): void => {
    if (timerRef.current !== null) return;
    const playable = isCodeDirty ? startLevel() : canPlay;
    if (!playable) return;
    setIsPlaying(true);
    timerRef.current = window.setInterval(handleTick, speedMs);
  };

  const handlePause = (): void => {
    stopTimer();
  };

  const handleReset = (): void => {
    stopTimer();
    setShowResultModal(false);
    setHoveredEnemyStats(null);
    const session = sessionRef.current;
    if (session.hasSetupError && session.hasLastValidPlayer) {
      session.resetWithLastValid(level);
      refreshGameState();
      setIsCodeDirty(false);
      return;
    }
    startLevel();
  };

  const goToLevel = (nextLevelNumber: number): void => {
    if (!selectedTower.hasLevel(nextLevelNumber)) return;
    stopTimer();
    setShowResultModal(false);
    setLevelNumber(nextLevelNumber);
  };

  const handleTowerChange = (nextTowerName: string): void => {
    if (nextTowerName === towerName) return;
    const nextTower = towers.find((tower) => tower.name === nextTowerName);
    if (!nextTower) return;
    stopTimer();
    setShowResultModal(false);
    setTowerName(nextTowerName);
    setLevelNumber((prev) => Math.min(prev, nextTower.levelCount));
  };

  const applyCodeToEditor = (code: string): void => {
    const view = editorViewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === code) return;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: code,
      },
    });
  };

  const handleClearData = (): void => {
    const ok = window.confirm("保存済みの進捗（Lv）と Player Code を消去して初期状態に戻します。よろしいですか？");
    if (!ok) return;

    stopTimer();
    setShowResultModal(false);
    setHoveredEnemyStats(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY_PROGRESS);
      window.localStorage.removeItem(STORAGE_KEY_PLAYER_CODE);
    } catch {
      // ignore storage errors
    }

    setTowerName("beginner");
    setLevelNumber(1);
    setWarriorLevel(1);
    setPlayerCode(STARTER_PLAYER_CODE);
    applyCodeToEditor(STARTER_PLAYER_CODE);
    setIsCodeDirty(true);
  };

  useEffect(() => {
    if (!editorHostRef.current) return;

    editorViewRef.current = createCodeEditor(editorHostRef.current, playerCode, (code) => {
      setPlayerCode(code);
      setIsCodeDirty(true);
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
    const animationTimer = window.setInterval(() => {
      setWarriorFrame((prev) => (prev + 1) % WARRIOR_IDLE_FRAME_COUNT);
    }, WARRIOR_IDLE_FRAME_MS);
    return () => window.clearInterval(animationTimer);
  }, []);

  function expireDamagePopups() {
    const now = Date.now();
    setDamagePopups((prev) => prev.filter((p) => p.expiresAt > now));
  }

  useEffect(() => {
    const timer = window.setInterval(expireDamagePopups, 120);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    startLevel();
  }, [level]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY_PROGRESS,
        JSON.stringify({ towerName, levelNumber, warriorLevel }),
      );
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
  }, [towerName, levelNumber, warriorLevel]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_PLAYER_CODE, playerCode);
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
  }, [playerCode]);

  return (
    <main className="layout">
      <section className="hero">
        <div className="hero-line" />
        <h1>Py Samurai ⚔️🐱</h1>
        <div className="hero-line" />
      </section>

      <div className="top-controls">
        <div className="top-controls-main">
          <nav className="level-progress" aria-label="Level Progress">
            {levelSteps.map((step, index) => (
              <button
                key={step}
                type="button"
                className={step === levelNumber ? "progress-step active" : "progress-step"}
                disabled={isPlaying}
                onClick={() => goToLevel(step)}
              >
                Lv.{getGlobalLevelFromTowerLevel(towerName, step)}
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
                onClick={() => handleTowerChange(tower.name)}
              >
                {tower.name}
              </button>
            ))}
          </div>
        </div>
        <div className="top-controls-side">
          <button type="button" className="danger-button" onClick={handleClearData} disabled={isPlaying}>
            <span className="icon-label"><i className="bi bi-trash3" />データ消去</span>
          </button>
        </div>
      </div>

      <section className="workspace">
        <section className="left-column">
          <article className="console-panel">
            <h2>🗺️ Board</h2>
            <div id="board" className="board-viewport" ref={boardViewportRef}>
              <div className="board-status">
                <span className="status-chip">
                  WARRIOR Lv.{warriorLevel}  HP {warriorHealth ?? "--"}/{warriorMaxHealth ?? "--"}  ATK 5
                </span>
                {hoveredEnemyStats ? <span className="status-chip status-chip-sub">{hoveredEnemyStats}</span> : null}
              </div>
              <div
                className="board-grid"
                role="img"
                aria-label={`Board ${boardGrid.rows}x${boardGrid.columns}`}
                style={boardGridStyle}
              >
                {boardGrid.tiles.map((tile, index) => {
                  const displaySymbol = tile.symbol === " " ? "\u00a0" : tile.symbol;
                  const tileImageSrc =
                    tile.kind === "warrior" ? getWarriorIdleFramePath(warriorFrame) : tile.assetPath;
                  const tilePopups = damagePopupsByTile.get(index) ?? [];
                  const tileStats = buildTileStatsText(tile.kind, warriorHealth, warriorMaxHealth);
                  return (
                    <div
                      key={`${index}-${tile.kind}-${tile.symbol}`}
                      className={`board-tile tile-${tile.kind}`}
                      title={tile.alt}
                      aria-label={tile.alt}
                      onMouseEnter={() => {
                        if (!tileStats) return;
                        if (tile.kind === "warrior") return;
                        setHoveredEnemyStats(`${tile.alt.toUpperCase()}  ${tileStats}`);
                      }}
                      onMouseLeave={() => setHoveredEnemyStats(null)}
                    >
                      {tileImageSrc ? (
                        <img src={tileImageSrc} alt={tile.alt} className="tile-image" />
                      ) : (
                        <span className="tile-fallback" aria-hidden="true">{displaySymbol}</span>
                      )}
                      {tilePopups.map((popup) => (
                        <span key={popup.id} className="damage-popup" aria-hidden="true">
                          {popup.text}
                        </span>
                      ))}
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
              <button onClick={handleReset}>
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
                <h4>📚 Methods / Properties</h4>
                <h4>Methods</h4>
                <ul className="api-list">
                  {availableMethods.length > 0 ? (
                    availableMethods.map((item) => <li key={item}>{item}</li>)
                  ) : (
                    <li>(none)</li>
                  )}
                </ul>
                <h4>Properties</h4>
                <ul className="api-list">
                  {availableProperties.length > 0 ? (
                    availableProperties.map((item) => <li key={item}>{item}</li>)
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
              {result.passed && hasNextLevel ? (
                <button onClick={() => goToLevel(levelNumber + 1)}>
                  <span className="icon-label"><i className="bi bi-skip-forward-fill" />Next</span>
                </button>
              ) : (
                <button onClick={() => setShowResultModal(false)}>
                  <span className="icon-label"><i className="bi bi-check2-circle" />Close</span>
                </button>
              )}
            </div>
          </article>
        </div>
      ) : null}
    </main>
  );
}
