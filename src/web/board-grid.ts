import { towers } from "../levels";

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

export interface BoardTile {
  symbol: string;
  kind: string;
  altKey: string;
  assetPath?: string;
  emoji?: string;
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

  return {
    columns,
    rows: topPad + sourceRows + bottomPad,
    tiles,
  };
}
