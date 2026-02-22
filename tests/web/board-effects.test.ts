import { describe, expect, it, vi } from "vitest";

import type { LogEntry } from "@engine/log-entry";

import { buildBoardGrid } from "../../src/web/board-grid";
import {
  DAMAGE_POPUP_MS,
  SPRITE_OVERRIDE_MS,
  createDamagePopupsFromEntries,
  createSpriteOverridesFromEntries,
} from "../../src/web/board-effects";

describe("createDamagePopupsFromEntries", () => {
  it("creates popups for takeDamage logs using direct unitId lookup", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const entries: LogEntry[] = [
      { key: "engine.takeDamage", params: { amount: 4 }, unitId: "sludge1" },
      { key: "engine.walk", params: {}, unitId: "sludge1" },
    ];

    const popups = createDamagePopupsFromEntries(entries, "@s", 10, new Map([["sludge1", 42]]));

    expect(popups).toEqual([
      { id: 10, tileIndex: 42, text: "-4", expiresAt: 1000 + DAMAGE_POPUP_MS },
    ]);
  });

  it("falls back to kind-based lookup and assigns nearest matching tile first", () => {
    vi.spyOn(Date, "now").mockReturnValue(2000);
    const board = "@ss";
    const entries: LogEntry[] = [
      { key: "engine.takeDamage", params: { amount: 1 }, unitId: "sludge1" },
      { key: "engine.takeDamage", params: { amount: 2 }, unitId: "sludge2" },
    ];
    const popups = createDamagePopupsFromEntries(entries, board, 1, new Map());

    expect(popups).toHaveLength(2);
    expect(popups[0].tileIndex).not.toBe(popups[1].tileIndex);

    const grid = buildBoardGrid(board);
    const samuraiIndex = grid.tiles.findIndex((tile) => tile.kind === "samurai");
    const distance = (index: number) => {
      const cols = grid.columns;
      const x1 = index % cols;
      const y1 = Math.floor(index / cols);
      const x2 = samuraiIndex % cols;
      const y2 = Math.floor(samuraiIndex / cols);
      return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    };

    expect(distance(popups[0].tileIndex)).toBeLessThanOrEqual(distance(popups[1].tileIndex));
  });
});

describe("createSpriteOverridesFromEntries", () => {
  it("maps log keys to sprite states and skips unsupported kinds", () => {
    vi.spyOn(Date, "now").mockReturnValue(3000);
    const entries: LogEntry[] = [
      { key: "engine.attackHit", params: {}, unitId: "sludge1" },
      { key: "engine.takeDamage", params: { amount: 2 }, unitId: "sludge1" },
      { key: "engine.dies", params: {}, unitId: "archer1" },
    ];

    const overrides = createSpriteOverridesFromEntries(
      entries,
      "@sa",
      7,
      new Map([["sludge1", 11], ["archer1", 12]]),
      new Set(["sludge"]),
    );

    expect(overrides).toEqual([
      {
        id: 7,
        tileIndex: 11,
        kind: "sludge",
        state: "attack",
        startedAt: 3000,
        expiresAt: 3000 + SPRITE_OVERRIDE_MS,
      },
      {
        id: 8,
        tileIndex: 11,
        kind: "sludge",
        state: "damaged",
        startedAt: 3000,
        expiresAt: 3000 + SPRITE_OVERRIDE_MS,
      },
    ]);
  });
});
