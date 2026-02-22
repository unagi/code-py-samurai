import { describe, expect, it } from "vitest";

import { buildBoardGrid } from "../../src/web/board-grid";

describe("buildBoardGrid", () => {
  it("returns a rectangular grid padded to at least the source board size", () => {
    const board = "@>\n s";
    const grid = buildBoardGrid(board);

    expect(grid.columns).toBeGreaterThanOrEqual(2);
    expect(grid.rows).toBeGreaterThanOrEqual(2);
    expect(grid.tiles).toHaveLength(grid.columns * grid.rows);
  });

  it("renders spaces in wall rows as wall corner/frame tiles instead of floor", () => {
    const board = " - \n|@|\n - ";
    const grid = buildBoardGrid(board);
    const nonVoid = grid.tiles.filter((tile) => tile.kind !== "void");

    const wallHCount = nonVoid.filter((tile) => tile.kind === "wall-h").length;
    const wallVCount = nonVoid.filter((tile) => tile.kind === "wall-v").length;
    const samuraiCount = nonVoid.filter((tile) => tile.kind === "samurai").length;
    const floorCount = nonVoid.filter((tile) => tile.kind === "floor").length;

    expect(wallHCount).toBe(4);
    expect(wallVCount).toBe(4);
    expect(samuraiCount).toBe(1);
    expect(floorCount).toBe(0);
  });

  it("maps known symbols and normal spaces to expected tile kinds", () => {
    const board = "@ >\nsC?";
    const grid = buildBoardGrid(board);
    const nonVoid = grid.tiles.filter((tile) => tile.kind !== "void");

    expect(nonVoid.some((tile) => tile.kind === "samurai")).toBe(true);
    expect(nonVoid.some((tile) => tile.kind === "stairs")).toBe(true);
    expect(nonVoid.some((tile) => tile.kind === "sludge")).toBe(true);
    expect(nonVoid.some((tile) => tile.kind === "captive")).toBe(true);
    expect(nonVoid.some((tile) => tile.kind === "unknown")).toBe(true);
    expect(nonVoid.some((tile) => tile.kind === "floor")).toBe(true);
  });
});
