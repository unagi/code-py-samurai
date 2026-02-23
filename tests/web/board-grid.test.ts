import { describe, expect, it } from "vitest";

import { buildBoardGrid } from "../../src/web/board-grid";

describe("buildBoardGrid", () => {
  it("returns a fully void grid when board is empty", () => {
    const grid = buildBoardGrid("");

    expect(grid.tiles).toHaveLength(grid.columns * grid.rows);
    expect(grid.tiles.every((tile) => tile.kind === "void")).toBe(true);
  });

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

  it("keeps sludge tile metadata stable for symbol, kind, and alt key", () => {
    const grid = buildBoardGrid("s");
    const sludgeTile = grid.tiles.find((tile) => tile.symbol === "s" && tile.kind !== "void");

    expect(sludgeTile).toBeDefined();
    expect(sludgeTile).toMatchObject({
      symbol: "s",
      kind: "sludge",
      altKey: "tiles.sludge",
    });
  });

  it("keeps thick-sludge tile metadata stable for symbol, kind, and alt key", () => {
    const grid = buildBoardGrid("S");
    const thickSludgeTile = grid.tiles.find((tile) => tile.symbol === "S" && tile.kind !== "void");

    expect(thickSludgeTile).toBeDefined();
    expect(thickSludgeTile).toMatchObject({
      symbol: "S",
      kind: "thick-sludge",
      altKey: "tiles.thickSludge",
    });
  });

  it("keeps captive tile metadata stable for symbol, kind, and alt key", () => {
    const grid = buildBoardGrid("C");
    const captiveTile = grid.tiles.find((tile) => tile.symbol === "C" && tile.kind !== "void");

    expect(captiveTile).toBeDefined();
    expect(captiveTile).toMatchObject({
      symbol: "C",
      kind: "captive",
      altKey: "tiles.captive",
    });
  });

  it("keeps samurai tile metadata stable for symbol, kind, and alt key", () => {
    const grid = buildBoardGrid("@");
    const samuraiTile = grid.tiles.find((tile) => tile.symbol === "@" && tile.kind !== "void");

    expect(samuraiTile).toBeDefined();
    expect(samuraiTile).toMatchObject({
      symbol: "@",
      kind: "samurai",
      altKey: "tiles.samurai",
    });
  });

  it("keeps archer/wizard/golem tile metadata stable via gameplay JSON", () => {
    const grid = buildBoardGrid("awG");
    const nonVoid = grid.tiles.filter((tile) => tile.kind !== "void");

    expect(nonVoid.find((tile) => tile.symbol === "a")).toMatchObject({
      symbol: "a",
      kind: "archer",
      altKey: "tiles.archer",
    });
    expect(nonVoid.find((tile) => tile.symbol === "w")).toMatchObject({
      symbol: "w",
      kind: "wizard",
      altKey: "tiles.wizard",
    });
    expect(nonVoid.find((tile) => tile.symbol === "G")).toMatchObject({
      symbol: "G",
      kind: "golem",
      altKey: "tiles.golem",
    });
  });

  it("maps unsupported symbols to unknown tiles via fallback metadata", () => {
    const grid = buildBoardGrid("@x");
    const nonVoid = grid.tiles.filter((tile) => tile.kind !== "void");

    expect(nonVoid.some((tile) => tile.symbol === "x" && tile.kind === "unknown")).toBe(true);
  });
});
