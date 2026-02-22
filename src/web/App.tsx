import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { basicSetup, EditorView } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { EditorState } from "@codemirror/state";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";

import { Level, type LevelResult } from "../engine/level";
import type { LogEntry } from "../engine/log-entry";
import type { ILogger, IPlayer, LevelDefinition, SamuraiAbilitySet } from "../engine/types";
import {
  getGlobalLevelFromTowerLevel,
  getMaxSamuraiLevel,
  getTowerAndLocalFromGlobal,
  getSamuraiAbilitiesAtGlobalLevel,
  getSamuraiRank,
  samuraiAbilitiesToEngineAbilities,
} from "../engine/samurai-abilities";
import { formatPythonError } from "../runtime/errors";
import { runPythonPlayerSource } from "../runtime/python-runner";
import { towers } from "../levels";
import { absoluteDirToSpriteDir, resolveSpriteDir, type SpriteDir } from "./sprite-utils";

function buildStarterPlayerCode(comment: string): string {
  return `class Player:\n    def play_turn(self, samurai):\n        ${comment}\n        pass`;
}

interface TileMeta {
  kind: string;
  altKey: string;
  assetPath?: string;
  emoji?: string;
}

const VOID_TILE: TileMeta = { kind: "void", altKey: "tiles.empty" };

const TILE_META_BY_SYMBOL: Record<string, TileMeta> = {
  " ": { kind: "floor", altKey: "tiles.empty", assetPath: "/assets/tiles/cave-floor.png" },
  "-": { kind: "wall-h", altKey: "tiles.frame", assetPath: "/assets/tiles/cave-wall.png" },
  "|": { kind: "wall-v", altKey: "tiles.frame", assetPath: "/assets/tiles/cave-wall-top.png" },
  ">": { kind: "stairs", altKey: "tiles.stairs", assetPath: "/assets/tiles/cave-stairs.png" },
  "@": {
    kind: "samurai",
    altKey: "tiles.samurai",
    assetPath: "/assets/sprites/samurai-cat/idle-east-frames/frame_01.png",
  },
  s: { kind: "sludge", altKey: "tiles.sludge" },
  S: { kind: "thick-sludge", altKey: "tiles.thickSludge", emoji: "\u{1F47E}" }, // 👾
  a: { kind: "archer", altKey: "tiles.archer", emoji: "\u{1F3F9}" },         // 🏹
  w: { kind: "wizard", altKey: "tiles.wizard", emoji: "\u{1F9D9}" },         // 🧙
  C: { kind: "captive", altKey: "tiles.captive", emoji: "\u{1F64F}" },       // 🙏
  G: { kind: "golem", altKey: "tiles.golem", emoji: "\u{1FAA8}" },           // 🪨
  "?": { kind: "unknown", altKey: "tiles.unknown", emoji: "\u{2753}" },      // ❓
};

interface BoardTile {
  symbol: string;
  kind: string;
  altKey: string;
  assetPath?: string;
  emoji?: string;
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
const SAMURAI_IDLE_FRAME_COUNT = 16;
const SAMURAI_IDLE_FRAME_MS = 140;
const DAMAGE_POPUP_MS = 820;
const STORAGE_KEY_PROGRESS = "py-samurai:progress";
const STORAGE_KEY_PLAYER_CODE = "py-samurai:player-code";

const UNIT_ID_PREFIX_TO_KIND: Record<string, string> = {
  samurai: "samurai",
  golem: "golem",
  sludge: "sludge",
  thicksludge: "thick-sludge",
  archer: "archer",
  wizard: "wizard",
  captive: "captive",
};

const TILE_BASE_STATS: Record<string, { hp: number | null; atk: number | null }> = {
  samurai: { hp: 20, atk: 5 },
  golem: { hp: null, atk: 3 },
  sludge: { hp: 12, atk: 3 },
  "thick-sludge": { hp: 24, atk: 3 },
  archer: { hp: 7, atk: 3 },
  wizard: { hp: 3, atk: 11 },
  captive: { hp: 1, atk: 0 },
};

// ── スプライト設定 ─────────────────────────────────────────────────────────

interface SpriteStateConfig {
  /** パステンプレート — "{dir}" が "left" / "right" に置換される */
  pathTemplate: string;
  frames: number;
}

interface CharSpriteConfig {
  idle: SpriteStateConfig;
  attack: SpriteStateConfig;
  damaged: SpriteStateConfig;
  death: SpriteStateConfig;
}

/** キャラ種別 → スプライトシート定義 */
const CHAR_SPRITES: Readonly<Record<string, CharSpriteConfig>> = {
  sludge: {
    idle:    { pathTemplate: "/assets/sprites/gama/idle-{dir}.png",    frames: 1 },
    attack:  { pathTemplate: "/assets/sprites/gama/attack-{dir}.png",  frames: 1 },
    damaged: { pathTemplate: "/assets/sprites/gama/damaged-{dir}.png", frames: 2 },
    death:   { pathTemplate: "/assets/sprites/gama/death-{dir}.png",   frames: 4 },
  },
  "thick-sludge": {
    idle:    { pathTemplate: "/assets/sprites/orochi/idle-{dir}.png",    frames: 3 },
    attack:  { pathTemplate: "/assets/sprites/orochi/attack-{dir}.png",  frames: 4 },
    damaged: { pathTemplate: "/assets/sprites/orochi/damaged-{dir}.png", frames: 2 },
    death:   { pathTemplate: "/assets/sprites/orochi/death-{dir}.png",   frames: 4 },
  },
  captive: {
    idle:    { pathTemplate: "/assets/sprites/tsuru/bound.png",    frames: 3 },
    attack:  { pathTemplate: "/assets/sprites/tsuru/bound.png",    frames: 3 },
    damaged: { pathTemplate: "/assets/sprites/tsuru/bound.png",    frames: 3 },
    death:   { pathTemplate: "/assets/sprites/tsuru/bound.png",    frames: 3 },
  },
  archer: {
    idle:    { pathTemplate: "/assets/sprites/saru/idle-{dir}.png",    frames: 2 },
    attack:  { pathTemplate: "/assets/sprites/saru/shoot-{dir}.png",   frames: 2 },
    damaged: { pathTemplate: "/assets/sprites/saru/damaged-{dir}.png", frames: 2 },
    death:   { pathTemplate: "/assets/sprites/saru/death-{dir}.png",   frames: 2 },
  },
};


/** スプライト状態の表示時間 (ms) — ターン速度と同程度 */
const SPRITE_OVERRIDE_MS = 700;
/** スプライトフレームあたりの表示時間 (ms) */
const SPRITE_FRAME_MS = 160;

interface ProgressStorageData {
  // new format
  globalLevel?: number;
  // legacy fields
  towerName?: string;
  levelNumber?: number;
  samuraiLevel?: number;
  samuraiLevelByTower?: Record<string, number>;
}

const TOTAL_LEVELS = towers.reduce((sum, t) => sum + t.levelCount, 0);

function clampGlobalLevel(value: number): number {
  return Math.min(Math.max(1, Math.floor(value)), TOTAL_LEVELS);
}

function readProgressStorage(): ProgressStorageData {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY_PROGRESS);
    if (!raw) return {};
    return JSON.parse(raw) as ProgressStorageData;
  } catch {
    return {};
  }
}

function buildSamuraiLevel(data: ProgressStorageData): number {
  const maxLv = getMaxSamuraiLevel();
  if (typeof data.samuraiLevel === "number") {
    return Math.min(Math.max(1, Math.floor(data.samuraiLevel)), maxLv);
  }

  let migrated = 1;
  if (data.samuraiLevelByTower && typeof data.samuraiLevelByTower === "object") {
    for (const [towerName, local] of Object.entries(data.samuraiLevelByTower)) {
      if (typeof local !== "number") continue;
      migrated = Math.max(migrated, getGlobalLevelFromTowerLevel(towerName, Math.floor(local)));
    }
  }

  return Math.min(Math.max(1, migrated), maxLv);
}

function migrateToGlobalLevel(data: ProgressStorageData): number {
  if (typeof data.globalLevel === "number") {
    return clampGlobalLevel(data.globalLevel);
  }
  if (data.towerName && typeof data.levelNumber === "number") {
    return clampGlobalLevel(getGlobalLevelFromTowerLevel(data.towerName, data.levelNumber));
  }
  return 1;
}

function getSamuraiIdleFramePath(frameIndex: number): string {
  const frame = String((frameIndex % SAMURAI_IDLE_FRAME_COUNT) + 1).padStart(2, "0");
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

  // Build grid with padding awareness: padding spaces → void, board spaces → floor
  const tiles: BoardTile[] = [];

  const pushVoidRow = () => {
    for (let x = 0; x < columns; x++) {
      tiles.push({ symbol: " ", kind: VOID_TILE.kind, altKey: VOID_TILE.altKey });
    }
  };

  const WALL_H_TILE: BoardTile = {
    symbol: "-", kind: "wall-h", altKey: "tiles.frame",
    assetPath: "/assets/tiles/cave-wall.png",
  };
  const WALL_V_TILE: BoardTile = {
    symbol: "|", kind: "wall-v", altKey: "tiles.frame",
    assetPath: "/assets/tiles/cave-wall-top.png",
  };

  const pushBoardRow = (line: string, isTopWallRow: boolean, _isBottomWallRow: boolean) => {
    const filled = line.padEnd(sourceColumns, " ");
    const isWallRow = filled.includes("-");
    // Left padding
    for (let x = 0; x < leftPad; x++) {
      tiles.push({ symbol: " ", kind: VOID_TILE.kind, altKey: VOID_TILE.altKey });
    }
    // Board content
    for (const symbol of filled) {
      if (symbol === " " && isWallRow) {
        // Corner: space in a wall row → render as wall tile
        tiles.push(isTopWallRow ? { ...WALL_V_TILE } : { ...WALL_H_TILE });
      } else {
        const meta = TILE_META_BY_SYMBOL[symbol] ?? { kind: "unknown", altKey: "tiles.unknown" };
        tiles.push({ symbol, kind: meta.kind, altKey: meta.altKey, assetPath: meta.assetPath, emoji: meta.emoji });
      }
    }
    // Right padding
    for (let x = 0; x < rightPad; x++) {
      tiles.push({ symbol: " ", kind: VOID_TILE.kind, altKey: VOID_TILE.altKey });
    }
  };

  for (let y = 0; y < topPad; y++) pushVoidRow();
  for (let i = 0; i < sourceLines.length; i++) {
    pushBoardRow(sourceLines[i], i === 0, i === sourceLines.length - 1);
  }
  for (let y = 0; y < bottomPad; y++) pushVoidRow();

  return {
    columns,
    rows: topPad + sourceRows + bottomPad,
    tiles,
  };
}

function normalizeIdPrefix(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
}

/** Direction values that need i18n translation in log messages. */
const DIRECTION_KEYS: Record<string, string> = {
  forward: "directions.forward",
  backward: "directions.backward",
  left: "directions.left",
  right: "directions.right",
};

/**
 * Format a structured LogEntry into a translated display string.
 */
function formatLogEntry(entry: LogEntry, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(entry.params)) {
    if (k === "direction" && typeof v === "string" && DIRECTION_KEYS[v]) {
      params[k] = t(DIRECTION_KEYS[v]);
    } else if (k === "target" && typeof v === "string") {
      params[k] = t(`tiles.${v}`, { defaultValue: v });
    } else {
      params[k] = v;
    }
  }
  const msg = t(entry.key, params as Record<string, unknown>);
  if (entry.unitId) {
    const base = entry.unitId.includes("#")
      ? entry.unitId.split("#")[0]
      : stripTrailingDigits(entry.unitId);
    const suffix = entry.unitId.slice(base.length);
    const name = t(`tiles.${normalizeIdPrefix(base)}`, { defaultValue: entry.unitId });
    return `${name}${suffix} ${msg}`;
  }
  return msg;
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
  const samuraiIndex = tiles.findIndex((tile) => tile.kind === "samurai");
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

  const distanceToSamurai = (index: number): number => {
    if (samuraiIndex < 0) return 0;
    const x1 = index % cols;
    const y1 = Math.floor(index / cols);
    const x2 = samuraiIndex % cols;
    const y2 = Math.floor(samuraiIndex / cols);
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
      if (kind !== "samurai" && samuraiIndex >= 0) {
        indices.sort((a, b) => {
          const d = distanceToSamurai(a) - distanceToSamurai(b);
          return d === 0 ? a - b : d;
        });
      }
      const tileIndex = indices[used % indices.length];
      useCountByKind.set(kind, used + 1);
      return tileIndex;
    },
  };
}

function createDamagePopupsFromEntries(
  entries: LogEntry[],
  board: string,
  idSeed: number,
  unitTileIndexByLabel: Map<string, number>,
): DamagePopup[] {
  if (entries.length === 0) return [];

  const resolver = buildTileIndexResolver(unitTileIndexByLabel, buildBoardGrid(board));
  const popups: DamagePopup[] = [];
  let nextId = idSeed;
  const now = Date.now();

  for (const entry of entries) {
    if (entry.key !== "engine.takeDamage" || !entry.unitId) continue;
    const unitId = entry.unitId.toLowerCase();
    const amount = entry.params.amount as number;
    const tileIndex = resolver.directLookup(unitId) ?? resolver.kindLookup(unitId);
    if (tileIndex === undefined) continue;
    popups.push({ id: nextId++, tileIndex, text: `-${amount}`, expiresAt: now + DAMAGE_POPUP_MS });
  }

  return popups;
}

// ── スプライト状態オーバーライド ─────────────────────────────────────────────

type SpriteState = "attack" | "damaged" | "death";

interface SpriteOverride {
  id: number;
  tileIndex: number;
  kind: string;
  state: SpriteState;
  startedAt: number;
  expiresAt: number;
}

/**
 * ログエントリからスプライト状態オーバーライドを生成する。
 * ダメージポップアップと同じパターンで、該当ユニットのタイル位置に対して
 * 一時的にスプライトを切り替える。
 */
function createSpriteOverridesFromEntries(
  entries: LogEntry[],
  board: string,
  idSeed: number,
  unitTileIndexByLabel: Map<string, number>,
): SpriteOverride[] {
  if (entries.length === 0) return [];

  const resolver = buildTileIndexResolver(unitTileIndexByLabel, buildBoardGrid(board));
  const overrides: SpriteOverride[] = [];
  let nextId = idSeed;
  const now = Date.now();

  for (const entry of entries) {
    if (!entry.unitId) continue;
    const unitId = entry.unitId.toLowerCase();
    const kind = resolveUnitKind(unitId);
    if (!kind || !CHAR_SPRITES[kind]) continue;

    let state: SpriteState | null = null;
    if (entry.key === "engine.attackHit" || entry.key === "engine.attackMiss") {
      state = "attack";
    } else if (entry.key === "engine.takeDamage") {
      state = "damaged";
    } else if (entry.key === "engine.dies") {
      state = "death";
    }
    if (!state) continue;

    const tileIndex = resolver.directLookup(unitId) ?? resolver.kindLookup(unitId);
    if (tileIndex === undefined) continue;

    overrides.push({
      id: nextId++,
      tileIndex,
      kind,
      state,
      startedAt: now,
      expiresAt: now + SPRITE_OVERRIDE_MS,
    });
  }

  return overrides;
}

interface StatsFormatter {
  hp(current: number | string, max: number | string): string;
  atk(value: number | string): string;
}

function buildTileStatsText(
  tileKind: string,
  samuraiHealth: number | null,
  samuraiMaxHealth: number | null,
  fmt: StatsFormatter,
): string | null {
  if (tileKind === "samurai") {
    return `${fmt.hp(samuraiHealth ?? "--", samuraiMaxHealth ?? "--")}  ${fmt.atk(5)}`;
  }
  const stats = TILE_BASE_STATS[tileKind];
  if (!stats) return null;
  const hpText = stats.hp === null ? fmt.hp("--", "--") : fmt.hp(stats.hp, stats.hp);
  const atkText = stats.atk === null ? fmt.atk("--") : fmt.atk(stats.atk);
  return `${hpText}  ${atkText}`;
}

class MemoryLogger implements ILogger {
  entries: LogEntry[] = [];

  log(entry: LogEntry): void {
    this.entries.push(entry);
  }

  clear(): void {
    this.entries = [];
  }
}

class LevelSession {
  private _logger = new MemoryLogger();
  private _level: Level | null = null;
  private _setupError: string | null = null;
  private _runtimeError: string | null = null;
  private _fallbackBoard = "";
  private _lastValidPlayer: IPlayer | null = null;
  private readonly _fallbackMessageKey = "logs.systemFallback";

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
      this._logger.log({ key: "logs.pythonError", params: { message: this._setupError } });
      if (this._lastValidPlayer) {
        this._logger.log({ key: this._fallbackMessageKey, params: {} });
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
      this._logger.log({ key: "logs.pythonError", params: { message: this._runtimeError } });
      return false;
    }
  }

  get board(): string {
    if (!this._level) return this._fallbackBoard;
    return this._level.floor.character();
  }

  get entries(): readonly LogEntry[] {
    return this._logger.entries;
  }

  get result(): LevelResult | null {
    if (!this._level) return null;
    return this._level.result();
  }

  get samuraiHealth(): number | null {
    if (!this._level) return null;
    return this._level.samurai.health;
  }

  get samuraiMaxHealth(): number | null {
    if (!this._level) return null;
    return this._level.samurai.maxHealth;
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

  /**
   * unitId (lowercase) → AbsoluteDirection ("north"|"east"|"south"|"west") のマップを返す。
   * スプライトの向き決定に使用。
   */
  getUnitDirectionMap(): Map<string, string> {
    const map = new Map<string, string>();
    if (!this._level) return map;
    for (const unit of this._level.floor.units) {
      const candidate = unit as unknown as {
        unitId?: string;
        position: { x: number; y: number; direction: string } | null;
      };
      if (typeof candidate.unitId !== "string" || !candidate.position) continue;
      map.set(candidate.unitId.toLowerCase(), candidate.position.direction);
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
  const { t, i18n } = useTranslation();
  const initialProgress = readProgressStorage();
  const [currentGlobalLevel, setCurrentGlobalLevel] = useState(() => {
    return migrateToGlobalLevel(initialProgress);
  });
  const [samuraiLevel, setSamuraiLevel] = useState<number>(() => {
    return buildSamuraiLevel(initialProgress);
  });

  const { towerName, localLevel } = useMemo(
    () => getTowerAndLocalFromGlobal(currentGlobalLevel),
    [currentGlobalLevel],
  );
  const isLevelAccessible = (globalLvl: number): boolean => globalLvl <= samuraiLevel;
  const [speedMs, setSpeedMs] = useState(450);
  const starterCode = buildStarterPlayerCode(t("starterCode.comment"));
  const [playerCode, setPlayerCode] = useState(() => {
    try {
      const saved = globalThis.localStorage.getItem(STORAGE_KEY_PLAYER_CODE);
      if (typeof saved === "string" && saved.length > 0) {
        return saved;
      }
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
    return starterCode;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [canPlay, setCanPlay] = useState(true);
  const [board, setBoard] = useState("");
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<LevelResult | null>(null);
  const [samuraiHealth, setSamuraiHealth] = useState<number | null>(null);
  const [samuraiMaxHealth, setSamuraiMaxHealth] = useState<number | null>(null);
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
  const [hoveredEnemyStats, setHoveredEnemyStats] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [tileSizePx, setTileSizePx] = useState(20);
  const [samuraiFrame, setSamuraiFrame] = useState(0);
  const [isCodeDirty, setIsCodeDirty] = useState(false);

  const sessionRef = useRef(new LevelSession());
  const timerRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const boardViewportRef = useRef<HTMLDivElement | null>(null);
  const logLineCountRef = useRef(0);
  const damagePopupIdRef = useRef(1);
  const unitTileIndexMapRef = useRef(new Map<string, number>());
  const unitDirectionMapRef = useRef(new Map<string, string>());
  const [spriteOverrides, setSpriteOverrides] = useState<SpriteOverride[]>([]);
  const spriteOverrideIdRef = useRef(1);

  const selectedTower = useMemo(() => {
    return towers.find((item) => item.name === towerName) ?? towers[0];
  }, [towerName]);
  const level = useMemo(() => {
    return selectedTower.getLevel(localLevel) ?? selectedTower.levels[0];
  }, [selectedTower, localLevel]);
  const unlockedSamuraiAbilities = useMemo<SamuraiAbilitySet>(() => {
    return getSamuraiAbilitiesAtGlobalLevel(samuraiLevel);
  }, [samuraiLevel]);
  const unlockedEngineAbilities = useMemo(
    () => samuraiAbilitiesToEngineAbilities(unlockedSamuraiAbilities),
    [unlockedSamuraiAbilities],
  );
  const availableMethods = useMemo(
    () => unlockedSamuraiAbilities.skills.map((item) => `samurai.${item}`),
    [unlockedSamuraiAbilities.skills],
  );
  const availableProperties = useMemo(
    () => unlockedSamuraiAbilities.stats.map((item) => `samurai.${item}`),
    [unlockedSamuraiAbilities.stats],
  );
  const statsFmt: StatsFormatter = useMemo(() => ({
    hp: (current, max) => t("board.hp", { current, max }),
    atk: (value) => t("board.atk", { value }),
  }), [t]);
  const boardGrid = useMemo(() => buildBoardGrid(board), [board]);
  const formattedLogs = useMemo(() => {
    if (logEntries.length === 0) return "";
    return logEntries.map((entry) => formatLogEntry(entry, t)).join("\n");
  }, [logEntries, t]);
  const allLevelSteps = useMemo(() => {
    return Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1);
  }, []);
  const hasNextLevel = currentGlobalLevel < TOTAL_LEVELS;
  const samuraiRank = useMemo(() => getSamuraiRank(samuraiLevel), [samuraiLevel]);
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
  /** タイルインデックス → 最新のスプライトオーバーライド */
  const spriteOverrideByTile = useMemo(() => {
    const map = new Map<number, SpriteOverride>();
    // 同じタイルに複数オーバーライドがある場合、最新のもの（後ろ）を優先
    for (const o of spriteOverrides) {
      map.set(o.tileIndex, o);
    }
    return map;
  }, [spriteOverrides]);

  /** tileIndex → SpriteDir (エンジンの facing direction から算出) */
  const spriteDirByTile = useMemo(() => {
    const map = new Map<number, SpriteDir>();
    const idxMap = unitTileIndexMapRef.current;
    const dirMap = unitDirectionMapRef.current;
    for (const [unitId, tileIdx] of idxMap) {
      const absDir = dirMap.get(unitId);
      if (absDir) map.set(tileIdx, absoluteDirToSpriteDir(absDir));
    }
    return map;
    // spriteOverrides を deps に入れることでターン毎に再計算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spriteOverrides, board]);

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
    const allEntries = session.entries;
    const prevCount = allEntries.length < logLineCountRef.current ? 0 : logLineCountRef.current;
    const newEntries = allEntries.slice(prevCount);
    logLineCountRef.current = allEntries.length;

    const boardForDamage = board.trim().length > 0 ? board : nextBoard;
    const popups = createDamagePopupsFromEntries(
      newEntries,
      boardForDamage,
      damagePopupIdRef.current,
      unitTileIndexMapRef.current,
    );
    damagePopupIdRef.current += popups.length;
    setDamagePopups(popups);

    const overrides = createSpriteOverridesFromEntries(
      newEntries,
      boardForDamage,
      spriteOverrideIdRef.current,
      unitTileIndexMapRef.current,
    );
    spriteOverrideIdRef.current += overrides.length;
    if (overrides.length > 0) {
      setSpriteOverrides((prev) => [...prev, ...overrides]);
    }

    setBoard(nextBoard);
    setLogEntries([...allEntries]);
    setResult(session.result);
    setSamuraiHealth(session.samuraiHealth);
    setSamuraiMaxHealth(session.samuraiMaxHealth);
    setCanPlay(session.canPlay);
    unitTileIndexMapRef.current = session.getUnitTileIndexMap(nextBoard);
    unitDirectionMapRef.current = session.getUnitDirectionMap();
  };

  const stopTimer = (): void => {
    if (timerRef.current !== null) {
      globalThis.clearInterval(timerRef.current);
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
    unitDirectionMapRef.current = new Map<string, string>();
    setDamagePopups([]);
    setSpriteOverrides([]);
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
      setLogEntries((prev) => [...prev, { key: "logs.systemTimeout", params: { maxTurns: UI_MAX_TURNS } }]);
      setShowResultModal(true);
      return;
    }
    if (!canContinue) {
      stopTimer();
      if (currentResult?.passed) {
        setSamuraiLevel((prev) => Math.max(prev, Math.min(currentGlobalLevel + 1, TOTAL_LEVELS)));
      }
      setShowResultModal(true);
    }
  };

  const handlePlay = (): void => {
    if (timerRef.current !== null) return;
    const playable = isCodeDirty ? startLevel() : canPlay;
    if (!playable) return;
    setIsPlaying(true);
    timerRef.current = globalThis.setInterval(handleTick, speedMs);
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

  const goToLevel = (globalLvl: number): void => {
    if (globalLvl < 1 || globalLvl > TOTAL_LEVELS) return;
    if (!isLevelAccessible(globalLvl)) return;
    stopTimer();
    setShowResultModal(false);
    setCurrentGlobalLevel(globalLvl);
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
    const ok = globalThis.confirm(t("app.clearDataConfirm"));
    if (!ok) return;

    stopTimer();
    setShowResultModal(false);
    setHoveredEnemyStats(null);
    try {
      globalThis.localStorage.removeItem(STORAGE_KEY_PROGRESS);
      globalThis.localStorage.removeItem(STORAGE_KEY_PLAYER_CODE);
    } catch {
      // ignore storage errors
    }

    setCurrentGlobalLevel(1);
    setSamuraiLevel(1);
    setPlayerCode(starterCode);
    applyCodeToEditor(starterCode);
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
    const animationTimer = globalThis.setInterval(() => {
      setSamuraiFrame((prev) => (prev + 1) % SAMURAI_IDLE_FRAME_COUNT);
    }, SAMURAI_IDLE_FRAME_MS);
    return () => globalThis.clearInterval(animationTimer);
  }, []);

  function expireDamagePopups() {
    const now = Date.now();
    setDamagePopups((prev) => prev.filter((p) => p.expiresAt > now));
  }

  function expireSpriteOverrides() {
    const now = Date.now();
    setSpriteOverrides((prev) => prev.filter((o) => o.expiresAt > now));
  }

  // 統合タイマー: ポップアップ/オーバーライド期限切れ + スプライトフレーム更新トリガー
  // spriteRenderTick は参照不要だが、state更新による再レンダリングでフレーム進行させる
  const [, setSpriteRenderTick] = useState(0);

  useEffect(() => {
    const timer = globalThis.setInterval(() => {
      expireDamagePopups();
      expireSpriteOverrides();
      setSpriteRenderTick((prev) => (prev + 1) % 1000);
    }, SPRITE_FRAME_MS);
    return () => globalThis.clearInterval(timer);
  }, []);

  useEffect(() => {
    startLevel();
  }, [level]);

  useEffect(() => {
    try {
      globalThis.localStorage.setItem(
        STORAGE_KEY_PROGRESS,
        JSON.stringify({ globalLevel: currentGlobalLevel, samuraiLevel }),
      );
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
  }, [currentGlobalLevel, samuraiLevel]);

  useEffect(() => {
    try {
      globalThis.localStorage.setItem(STORAGE_KEY_PLAYER_CODE, playerCode);
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
  }, [playerCode]);

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const levelDescKey = `levels.${towerName}.${localLevel}.description`;
  const levelTipKey = `levels.${towerName}.${localLevel}.tip`;
  const levelClueKey = `levels.${towerName}.${localLevel}.clue`;
  const hasClue = i18n.exists(levelClueKey);

  return (
    <main className="layout">
      <section className="hero">
        <div className="hero-line" />
        <h1>{t("app.title")} ⚔️🐱</h1>
        <div className="hero-line" />
        <select
          className="lang-selector"
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          aria-label={t("nav.language")}
        >
          <option value="en">EN</option>
          <option value="ja">JA</option>
        </select>
      </section>

      <div className="top-controls">
        <div className="top-controls-main">
          <nav className="level-progress" aria-label={t("nav.levelProgress")}>
            {allLevelSteps.map((globalLvl) => {
              const isActive = globalLvl === currentGlobalLevel;
              const isCleared = globalLvl < samuraiLevel && !isActive;
              const isLocked = !isLevelAccessible(globalLvl);

              let className = "progress-step";
              if (isActive) className += " active";
              else if (isCleared) className += " cleared";
              if (isLocked) className += " locked";

              return (
                <button
                  key={globalLvl}
                  type="button"
                  className={className}
                  disabled={isPlaying || isLocked}
                  onClick={() => goToLevel(globalLvl)}
                  aria-label={isLocked
                    ? t("nav.levelLocked", { level: globalLvl })
                    : t("board.lv", { level: globalLvl })}
                >
                  {t("board.lv", { level: globalLvl })}
                  {isActive ? <i className="bi bi-geo-alt-fill" /> : null}
                  {isCleared ? <i className="bi bi-check-lg" /> : null}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="top-controls-side">
          <button type="button" className="danger-button" onClick={handleClearData} disabled={isPlaying}>
            <span className="icon-label"><i className="bi bi-trash3" />{t("app.clearData")}</span>
          </button>
        </div>
      </div>

      <section className="workspace">
          <article className="console-panel">
            <div className="console-header">
              <h2>🗺️ {t("board.heading")}</h2>
              <p className="description">{t(levelDescKey)}</p>
            </div>
            <div id="board" className="board-viewport" ref={boardViewportRef} style={{ aspectRatio: `${boardGrid.columns} / ${boardGrid.rows}` }}>
              <div className="board-status">
                <span className="status-chip">
                  {t("board.samurai")} {t(samuraiRank.key)} {t("board.lv", { level: samuraiLevel })}  {t("board.hp", { current: samuraiHealth ?? "--", max: samuraiMaxHealth ?? "--" })}  {t("board.atk", { value: 5 })}
                </span>
                {hoveredEnemyStats ? <span className="status-chip status-chip-sub">{hoveredEnemyStats}</span> : null}
              </div>
              <div
                className="board-grid"
                role="img"
                aria-label={t("board.ariaLabel", { rows: boardGrid.rows, columns: boardGrid.columns })}
                style={boardGridStyle}
              >
                {boardGrid.tiles.map((tile, index) => {
                  const displaySymbol = tile.emoji ?? (tile.symbol === " " ? "\u00a0" : tile.symbol);
                  const tilePopups = damagePopupsByTile.get(index) ?? [];
                  const tileStats = buildTileStatsText(tile.kind, samuraiHealth, samuraiMaxHealth, statsFmt);
                  const tileAlt = t(tile.altKey);

                  // スプライトオーバーライド判定
                  const override = spriteOverrideByTile.get(index);
                  const overrideSpriteConfig = override ? CHAR_SPRITES[override.kind] : undefined;
                  const ownSpriteConfig = CHAR_SPRITES[tile.kind];
                  const spriteDir: SpriteDir = spriteDirByTile.get(index) ?? "right";

                  // ベースタイル画像 (床・壁・idle スプライト等)
                  let baseTileImageSrc: string | undefined;
                  if (tile.kind === "samurai") {
                    baseTileImageSrc = getSamuraiIdleFramePath(samuraiFrame);
                  } else if (!override && ownSpriteConfig) {
                    // オーバーライドなし & 自身がスプライト対応キャラ → idle (方向付き)
                    baseTileImageSrc = resolveSpriteDir(ownSpriteConfig.idle.pathTemplate, spriteDir);
                  } else if (override && ownSpriteConfig) {
                    // オーバーライドあり & タイルがキャラ本人 → オーバーライドで上書き（下にベース不要）
                    baseTileImageSrc = undefined;
                  } else {
                    // 通常タイル（床・壁等）
                    baseTileImageSrc = tile.assetPath;
                  }

                  // オーバーライドスプライト (attack / damaged / death)
                  let overlaySrc: string | undefined;
                  let overlayFrames = 1;
                  let overlayCurrentFrame = 0;
                  if (override && overrideSpriteConfig) {
                    const stateConfig = overrideSpriteConfig[override.state];
                    overlaySrc = resolveSpriteDir(stateConfig.pathTemplate, spriteDir);
                    overlayFrames = stateConfig.frames;
                    if (overlayFrames > 1) {
                      const elapsed = Date.now() - override.startedAt;
                      overlayCurrentFrame = Math.min(
                        Math.floor(elapsed / SPRITE_FRAME_MS),
                        overlayFrames - 1,
                      );
                    }
                  }

                  return (
                    <div
                      key={`${index}-${tile.kind}-${tile.symbol}`}
                      className={`board-tile tile-${tile.kind}`}
                      title={tileAlt}
                      aria-label={tileAlt}
                      onMouseEnter={() => {
                        if (!tileStats) return;
                        if (tile.kind === "samurai") return;
                        setHoveredEnemyStats(`${tileAlt.toUpperCase()}  ${tileStats}`);
                      }}
                      onMouseLeave={() => setHoveredEnemyStats(null)}
                      onFocus={() => {
                        if (!tileStats) return;
                        if (tile.kind === "samurai") return;
                        setHoveredEnemyStats(`${tileAlt.toUpperCase()}  ${tileStats}`);
                      }}
                      onBlur={() => setHoveredEnemyStats(null)}
                    >
                      {/* ベースタイル（床・壁・idle スプライト） */}
                      {baseTileImageSrc ? (
                        <img src={baseTileImageSrc} alt={tileAlt} className="tile-image" />
                      ) : !overlaySrc ? (
                        <span className="tile-fallback" style={{ fontSize: `${Math.round(tileSizePx * 0.7)}px` }} aria-hidden="true">{displaySymbol}</span>
                      ) : null}

                      {/* オーバーレイ: スプライト状態 (attack / damaged / death) */}
                      {overlaySrc && overlayFrames <= 1 ? (
                        <img src={overlaySrc} alt={tileAlt} className="tile-image tile-sprite-overlay" />
                      ) : overlaySrc && overlayFrames > 1 ? (
                        <div
                          className="tile-sprite-sheet tile-sprite-overlay"
                          role="img"
                          aria-label={tileAlt}
                          style={{
                            backgroundImage: `url(${overlaySrc})`,
                            backgroundSize: `${overlayFrames * 100}% 100%`,
                            backgroundPositionX: `${(overlayCurrentFrame / (overlayFrames - 1)) * 100}%`,
                          }}
                        />
                      ) : null}
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
                <span className="icon-label"><i className="bi bi-play-fill" />{t("controls.play")}</span>
              </button>
              <button onClick={handlePause} disabled={!isPlaying}>
                <span className="icon-label"><i className="bi bi-pause-fill" />{isPlaying ? t("controls.pause") : t("controls.paused")}</span>
              </button>
              <button onClick={handleReset}>
                <span className="icon-label"><i className="bi bi-arrow-repeat" />{t("controls.reset")}</span>
              </button>
              <label className="speed-label">
                <span className="icon-label"><i className="bi bi-lightning-charge-fill" />{t("controls.speed")}</span>
                <select
                  value={speedMs}
                  disabled={isPlaying}
                  onChange={(e) => setSpeedMs(Number(e.target.value))}
                >
                  <option value={700}>{t("controls.slow")}</option>
                  <option value={450}>{t("controls.normal")}</option>
                  <option value={220}>{t("controls.fast")}</option>
                </select>
              </label>
            </div>
          </article>
        <div className="bottom-columns">
          <article className="editor-panel">
            <div className="player-code-header">
              <h3>👨‍💻 {t("editor.heading")}</h3>
              <div className="tip-anchor">
                <button type="button" className="tip-trigger" aria-describedby="tips-popover">
                  <span className="icon-label"><i className="bi bi-lightbulb-fill" />{t("editor.tips")}</span>
                </button>
                <aside id="tips-popover" className="tips-popover" role="tooltip">
                  <h4>💡 {t("editor.tip")}</h4>
                  <p>{t(levelTipKey)}</p>
                  {hasClue ? (
                    <>
                      <h4>🧭 {t("editor.clue")}</h4>
                      <p>{t(levelClueKey)}</p>
                    </>
                  ) : null}
                </aside>
              </div>
            </div>
            <div className="editor-layout">
              <div className="editor-main">
                <div ref={editorHostRef} className="editor-host" />
                <p className="code-note">{t("editor.codeNote")}</p>
              </div>
              <aside className="api-panel">
                <h4>📚 {t("editor.apiHeading")}</h4>
                <h4>{t("editor.methods")}</h4>
                <ul className="api-list">
                  {availableMethods.length > 0 ? (
                    availableMethods.map((item) => <li key={item}>{item}</li>)
                  ) : (
                    <li>{t("editor.none")}</li>
                  )}
                </ul>
                <h4>{t("editor.properties")}</h4>
                <ul className="api-list">
                  {availableProperties.length > 0 ? (
                    availableProperties.map((item) => <li key={item}>{item}</li>)
                  ) : (
                    <li>{t("editor.none")}</li>
                  )}
                </ul>
              </aside>
            </div>
          </article>
          <article className="logs-panel">
            <h2>🖥️ {t("logs.heading")}</h2>
            <pre id="logs">{formattedLogs || t("logs.empty")}</pre>
          </article>
        </div>
      </section>

      {showResultModal && result ? (
        <dialog className="modal-backdrop" open aria-label={t("result.heading")}>
          <article className="modal-card">
            <h3>🏁 {t("result.heading")}</h3>
            <p className="result-status">{result.passed ? t("result.clear") : t("result.failed")}</p>
            <ul>
              <li>{t("result.turns")}: {result.turns}</li>
              <li>{t("result.totalScore")}: {result.totalScore}</li>
              <li>{t("result.timeBonus")}: {result.timeBonus}</li>
              <li>{t("result.grade")}: {result.grade ?? "-"}</li>
            </ul>
            {!result.passed && hasClue ? (
              <p className="clue-box">
                <strong>{t("result.clue")}</strong> {t(levelClueKey)}
              </p>
            ) : null}
            <div className="controls">
              <button
                onClick={() => {
                  setShowResultModal(false);
                  startLevel();
                }}
              >
                <span className="icon-label"><i className="bi bi-arrow-repeat" />{t("result.retry")}</span>
              </button>
              {result.passed && hasNextLevel ? (
                <button onClick={() => goToLevel(currentGlobalLevel + 1)}>
                  <span className="icon-label"><i className="bi bi-skip-forward-fill" />{t("result.next")}</span>
                </button>
              ) : (
                <button onClick={() => setShowResultModal(false)}>
                  <span className="icon-label"><i className="bi bi-check2-circle" />{t("result.close")}</span>
                </button>
              )}
            </div>
          </article>
        </dialog>
      ) : null}
    </main>
  );
}
