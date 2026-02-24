import type { BoardGridData, BoardTile } from "./board-grid";

export type BoardDisplayMode = "full" | "floor-only";

export interface BoardDisplayTileCell {
  originalIndex: number;
  tile: BoardTile;
}

export interface BoardDisplayGridData {
  columns: number;
  rows: number;
  tiles: BoardDisplayTileCell[];
}

const FLOOR_ONLY_HIDDEN_TILE_KINDS = new Set(["void", "wall-h", "wall-v"]);

function buildFullBoardDisplayGrid(boardGrid: BoardGridData): BoardDisplayGridData {
  return {
    columns: boardGrid.columns,
    rows: boardGrid.rows,
    tiles: boardGrid.tiles.map((tile, originalIndex) => ({ tile, originalIndex })),
  };
}

export function buildBoardDisplayGrid(
  boardGrid: BoardGridData,
  mode: BoardDisplayMode,
): BoardDisplayGridData {
  if (mode === "full") {
    return buildFullBoardDisplayGrid(boardGrid);
  }

  const compactRows: BoardDisplayTileCell[][] = [];

  for (let y = 0; y < boardGrid.rows; y++) {
    const row: BoardDisplayTileCell[] = [];
    for (let x = 0; x < boardGrid.columns; x++) {
      const originalIndex = y * boardGrid.columns + x;
      const tile = boardGrid.tiles[originalIndex];
      if (!tile) continue;
      if (FLOOR_ONLY_HIDDEN_TILE_KINDS.has(tile.kind)) continue;
      row.push({ tile, originalIndex });
    }
    if (row.length > 0) {
      compactRows.push(row);
    }
  }

  if (compactRows.length === 0) {
    return buildFullBoardDisplayGrid(boardGrid);
  }

  const compactColumns = compactRows[0]?.length ?? 0;
  if (compactColumns < 1 || compactRows.some((row) => row.length !== compactColumns)) {
    // Keep the layout stable if future content introduces non-rectangular rows.
    return buildFullBoardDisplayGrid(boardGrid);
  }

  return {
    columns: compactColumns,
    rows: compactRows.length,
    tiles: compactRows.flat(),
  };
}
