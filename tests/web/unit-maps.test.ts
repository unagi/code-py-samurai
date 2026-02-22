import { describe, expect, it } from "vitest";

import { buildUnitDirectionMap, buildUnitTileIndexMap } from "../../src/web/unit-maps";

describe("unit map helpers", () => {
  it("builds unitId -> direction map", () => {
    const map = buildUnitDirectionMap([
      { unitId: "samurai", x: 0, y: 0, direction: "east" },
      { unitId: "sludge1", x: 2, y: 0, direction: "west" },
    ]);

    expect(map.get("samurai")).toBe("east");
    expect(map.get("sludge1")).toBe("west");
  });

  it("builds unitId -> tileIndex map using centered board coordinates", () => {
    const board = "@s";
    const map = buildUnitTileIndexMap(board, [
      { unitId: "samurai", x: 0, y: 0, direction: "east" },
      { unitId: "sludge1", x: 1, y: 0, direction: "west" },
    ]);

    const samuraiIndex = map.get("samurai");
    const sludgeIndex = map.get("sludge1");

    expect(samuraiIndex).toBeTypeOf("number");
    expect(sludgeIndex).toBeTypeOf("number");
    expect(sludgeIndex).toBe((samuraiIndex as number) + 1);
  });
});
