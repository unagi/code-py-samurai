import { towers } from "../levels";
import archerGameplay from "@engine/unit-data/archer.gameplay.json";
import golemGameplay from "@engine/unit-data/golem.gameplay.json";
import samuraiGameplay from "@engine/unit-data/samurai.gameplay.json";
import sludgeGameplay from "@engine/unit-data/sludge.gameplay.json";
import thickSludgeGameplay from "@engine/unit-data/thick-sludge.gameplay.json";
import captiveGameplay from "@engine/unit-data/captive.gameplay.json";
import wizardGameplay from "@engine/unit-data/wizard.gameplay.json";

interface TileMeta {
  kind: string;
  altKey: string;
  assetPath?: string;
  emoji?: string;
}

const VOID_TILE: TileMeta = { kind: "void", altKey: "tiles.empty" };
const SLUDGE_ALT_KEY = `tiles.${sludgeGameplay.nameKey}`;
const THICK_SLUDGE_ALT_KEY = `tiles.${thickSludgeGameplay.nameKey}`;
const CAPTIVE_ALT_KEY = `tiles.${captiveGameplay.nameKey}`;
const SAMURAI_ALT_KEY = `tiles.${samuraiGameplay.nameKey}`;
const ARCHER_ALT_KEY = `tiles.${archerGameplay.nameKey}`;
const WIZARD_ALT_KEY = `tiles.${wizardGameplay.nameKey}`;
const GOLEM_ALT_KEY = `tiles.${golemGameplay.nameKey}`;

const TILE_META_BY_SYMBOL: Record<string, TileMeta> = {
  " ": { kind: "floor", altKey: "tiles.empty", assetPath: "/assets/tiles/cave-floor.png" },
  "-": { kind: "wall-h", altKey: "tiles.frame", assetPath: "/assets/tiles/cave-wall.png" },
  "|": { kind: "wall-v", altKey: "tiles.frame", assetPath: "/assets/tiles/cave-wall-top.png" },
  ">": { kind: "stairs", altKey: "tiles.stairs", assetPath: "/assets/tiles/cave-stairs.png" },
  [samuraiGameplay.symbol]: {
    kind: samuraiGameplay.kind,
    altKey: SAMURAI_ALT_KEY,
    assetPath: "/assets/sprites/samurai-cat/idle-east.png",
  },
  [sludgeGameplay.symbol]: { kind: sludgeGameplay.kind, altKey: SLUDGE_ALT_KEY },
  [thickSludgeGameplay.symbol]: { kind: thickSludgeGameplay.kind, altKey: THICK_SLUDGE_ALT_KEY, emoji: "\u{1F47E}" }, // 👾
  [archerGameplay.symbol]: { kind: archerGameplay.kind, altKey: ARCHER_ALT_KEY, emoji: "\u{1F3F9}" }, // 🏹
  [wizardGameplay.symbol]: { kind: wizardGameplay.kind, altKey: WIZARD_ALT_KEY, emoji: "\u{1F9D9}" }, // 🧙
  [captiveGameplay.symbol]: { kind: captiveGameplay.kind, altKey: CAPTIVE_ALT_KEY, emoji: "\u{1F64F}" }, // 🙏
  [golemGameplay.symbol]: { kind: golemGameplay.kind, altKey: GOLEM_ALT_KEY, emoji: "\u{1FAA8}" }, // 🪨
  "?": { kind: "unknown", altKey: "tiles.unknown", emoji: "\u{2753}" },      // ❓
};

export interface BoardTile {
  symbol: string;
  kind: string;
  altKey: string;
  assetPath?: string;
  emoji?: string;
  /** Display suffix such as "#1", "#2" for unit tiles. Absent for non-units. */
  displaySuffix?: string;
}

export interface BoardGridData {
  columns: number;
  rows: number;
  tiles: BoardTile[];
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

export const MAX_BOARD_SIZE = getMaxBoardSize();

export function buildBoardGrid(board: string): BoardGridData {
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

  // Build grid with padding awareness: padding spaces -> void, board spaces -> floor
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

  const pushBoardRow = (line: string, isTopWallRow: boolean) => {
    const filled = line.padEnd(sourceColumns, " ");
    const isWallRow = filled.includes("-");
    for (let x = 0; x < leftPad; x++) {
      tiles.push({ symbol: " ", kind: VOID_TILE.kind, altKey: VOID_TILE.altKey });
    }
    for (const symbol of filled) {
      if (symbol === " " && isWallRow) {
        tiles.push(isTopWallRow ? { ...WALL_V_TILE } : { ...WALL_H_TILE });
      } else {
        const meta = TILE_META_BY_SYMBOL[symbol] ?? { kind: "unknown", altKey: "tiles.unknown" };
        tiles.push({ symbol, kind: meta.kind, altKey: meta.altKey, assetPath: meta.assetPath, emoji: meta.emoji });
      }
    }
    for (let x = 0; x < rightPad; x++) {
      tiles.push({ symbol: " ", kind: VOID_TILE.kind, altKey: VOID_TILE.altKey });
    }
  };

  for (let y = 0; y < topPad; y++) pushVoidRow();
  for (let i = 0; i < sourceLines.length; i++) {
    pushBoardRow(sourceLines[i], i === 0);
  }
  for (let y = 0; y < bottomPad; y++) pushVoidRow();

  // Assign display suffixes (#1, #2, ...) to non-samurai unit tiles
  // to match the engine's unitId format (e.g. "sludge#1", "archer#2").
  const SUFFIXED_UNIT_KINDS = new Set([
    sludgeGameplay.kind,
    thickSludgeGameplay.kind,
    archerGameplay.kind,
    wizardGameplay.kind,
    captiveGameplay.kind,
    golemGameplay.kind,
  ]);
  const kindCounters = new Map<string, number>();
  for (const tile of tiles) {
    if (SUFFIXED_UNIT_KINDS.has(tile.kind)) {
      const count = (kindCounters.get(tile.kind) ?? 0) + 1;
      kindCounters.set(tile.kind, count);
      tile.displaySuffix = `#${count}`;
    }
  }

  return {
    columns,
    rows: topPad + sourceRows + bottomPad,
    tiles,
  };
}
