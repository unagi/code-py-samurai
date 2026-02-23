import { describe, expect, it } from "vitest";

import { buildTileStatsText, type StatsFormatter } from "../../src/web/board-stats";

const fmt: StatsFormatter = {
  hp: (current, max) => `HP(${current}/${max})`,
  atk: (value) => `ATK(${value})`,
};

describe("buildTileStatsText", () => {
  it("formats samurai stats using current/max health from state", () => {
    expect(buildTileStatsText("samurai", 12, 20, fmt)).toBe("HP(12/20)  ATK(5)");
  });

  it("uses placeholders when samurai health is not available yet", () => {
    expect(buildTileStatsText("samurai", null, null, fmt)).toBe("HP(--/--)  ATK(5)");
  });

  it("formats enemy stats from static tile metadata", () => {
    expect(buildTileStatsText("sludge", null, null, fmt)).toBe("HP(12/12)  ATK(3)");
    expect(buildTileStatsText("wizard", null, null, fmt)).toBe("HP(3/3)  ATK(11)");
    expect(buildTileStatsText("golem", null, null, fmt)).toBe("HP(--/--)  ATK(3)");
    expect(buildTileStatsText("captive", null, null, fmt)).toBe("HP(1/1)  ATK(0)");
  });

  it("returns null for tiles without stats", () => {
    expect(buildTileStatsText("floor", 20, 20, fmt)).toBeNull();
    expect(buildTileStatsText("void", 20, 20, fmt)).toBeNull();
  });
});
