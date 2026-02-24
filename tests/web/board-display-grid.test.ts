import { describe, expect, it } from "vitest";

import { buildBoardDisplayGrid } from "../../src/web/board-display-grid";
import { buildBoardGrid, type BoardGridData } from "../../src/web/board-grid";

describe("buildBoardDisplayGrid", () => {
  it("hides void tiles in full mode while preserving original indices", () => {
    const boardGrid = buildBoardGrid("---@\n|  |\n----");

    const displayGrid = buildBoardDisplayGrid(boardGrid, "full");

    expect(displayGrid.columns).toBeGreaterThan(0);
    expect(displayGrid.rows).toBeGreaterThan(0);
    expect(displayGrid.tiles.length).toBeLessThan(boardGrid.tiles.length);
    expect(displayGrid.tiles.every((cell) => cell.tile.kind !== "void")).toBe(true);
    expect(
      displayGrid.tiles.every((cell) => boardGrid.tiles[cell.originalIndex] === cell.tile),
    ).toBe(true);
  });

  it("compacts away void and wall tiles while preserving original tile indices", () => {
    const boardGrid = buildBoardGrid("----\n|@>|\n----");

    const displayGrid = buildBoardDisplayGrid(boardGrid, "floor-only");

    expect(displayGrid.columns).toBe(2);
    expect(displayGrid.rows).toBe(1);
    expect(displayGrid.tiles.map((cell) => cell.tile.kind)).toEqual(["samurai", "stairs"]);
    expect(displayGrid.tiles[1]?.originalIndex).toBe((displayGrid.tiles[0]?.originalIndex ?? 0) + 1);
  });

  it("falls back to full mode when floor-only compaction would become non-rectangular", () => {
    const boardGrid: BoardGridData = {
      columns: 4,
      rows: 2,
      tiles: [
        { symbol: ".", kind: "floor", altKey: "tiles.empty" },
        { symbol: "-", kind: "wall-h", altKey: "tiles.frame" },
        { symbol: ".", kind: "floor", altKey: "tiles.empty" },
        { symbol: ".", kind: "floor", altKey: "tiles.empty" },
        { symbol: ".", kind: "floor", altKey: "tiles.empty" },
        { symbol: ".", kind: "floor", altKey: "tiles.empty" },
        { symbol: ".", kind: "floor", altKey: "tiles.empty" },
        { symbol: ".", kind: "floor", altKey: "tiles.empty" },
      ],
    };

    const displayGrid = buildBoardDisplayGrid(boardGrid, "floor-only");

    expect(displayGrid.columns).toBe(boardGrid.columns);
    expect(displayGrid.rows).toBe(boardGrid.rows);
    expect(displayGrid.tiles).toHaveLength(boardGrid.tiles.length);
  });

  it("falls back to raw grid when full mode void compaction would become non-rectangular", () => {
    const boardGrid: BoardGridData = {
      columns: 3,
      rows: 2,
      tiles: [
        { symbol: ".", kind: "floor", altKey: "tiles.empty" },
        { symbol: " ", kind: "void", altKey: "tiles.empty" },
        { symbol: ".", kind: "floor", altKey: "tiles.empty" },
        { symbol: ".", kind: "floor", altKey: "tiles.empty" },
        { symbol: ".", kind: "floor", altKey: "tiles.empty" },
        { symbol: ".", kind: "floor", altKey: "tiles.empty" },
      ],
    };

    const displayGrid = buildBoardDisplayGrid(boardGrid, "full");

    expect(displayGrid.columns).toBe(boardGrid.columns);
    expect(displayGrid.rows).toBe(boardGrid.rows);
    expect(displayGrid.tiles).toHaveLength(boardGrid.tiles.length);
  });

  it("falls back to raw grid when compaction hides every tile", () => {
    const boardGrid: BoardGridData = {
      columns: 2,
      rows: 2,
      tiles: [
        { symbol: "-", kind: "wall-h", altKey: "tiles.frame" },
        { symbol: "|", kind: "wall-v", altKey: "tiles.frame" },
        { symbol: " ", kind: "void", altKey: "tiles.empty" },
        { symbol: "-", kind: "wall-h", altKey: "tiles.frame" },
      ],
    };

    const displayGrid = buildBoardDisplayGrid(boardGrid, "floor-only");

    expect(displayGrid.columns).toBe(boardGrid.columns);
    expect(displayGrid.rows).toBe(boardGrid.rows);
    expect(displayGrid.tiles).toHaveLength(boardGrid.tiles.length);
  });

  it("compacts away only void tiles in full mode while keeping walls", () => {
    const boardGrid = buildBoardGrid("----\n|@>|\n----");

    const displayGrid = buildBoardDisplayGrid(boardGrid, "full");

    expect(displayGrid.columns).toBe(4);
    expect(displayGrid.rows).toBe(3);
    expect(displayGrid.tiles.map((cell) => cell.tile.kind)).toEqual([
      "wall-h", "wall-h", "wall-h", "wall-h",
      "wall-v", "samurai", "stairs", "wall-v",
      "wall-h", "wall-h", "wall-h", "wall-h",
    ]);
  });
});
