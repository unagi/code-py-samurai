import { describe, expect, it } from "vitest";

import type { SpriteDebugCardSpec } from "../../src/web/sprite-debug-data";
import { unitAnimationTypeSpecs, unitPreviewSlotSpecs } from "../../src/web/sprite-debug-unit-animation-specs";

function buildEnemyCard(kind: string, dir: "left" | "right"): SpriteDebugCardSpec {
  return {
    id: `${kind}-${dir}`,
    kind,
    dir,
    spriteDir: dir,
    supportedStates: ["idle", "attack", "damaged", "death"],
    unsupportedStates: [],
  };
}

describe("sprite debug unit animation specs", () => {
  it("returns static JSON specs for samurai", () => {
    const specs = unitAnimationTypeSpecs({ kind: "samurai" });

    expect(specs.map((spec) => spec.animationType)).toEqual([
      "Idle",
      "Disappear",
      "Offence",
      "Damaged",
    ]);
    expect(specs[0]).toMatchObject({
      animationType: "Idle",
      artLayout: "quad-grid",
      status: "ng",
    });
  });

  it("returns emoji fallback specs when renderMode is emoji", () => {
    const specs = unitAnimationTypeSpecs({ kind: "archer", renderMode: "emoji" });

    expect(specs).toHaveLength(4);
    expect(specs.every((spec) => spec.status === "ng")).toBe(true);
    expect(specs[0].spriteFiles).toEqual(["-"]);
  });

  it("returns preview slots from unit JSON definitions", () => {
    expect(unitPreviewSlotSpecs({ kind: "samurai" }).map((slot) => slot.label)).toEqual([
      "WEST",
      "EAST",
      "NORTH",
      "SOUTH",
    ]);
    expect(unitPreviewSlotSpecs({ kind: "captive" })).toEqual([
      { label: "NONE", spriteDir: "right" },
    ]);
    expect(unitPreviewSlotSpecs({ kind: "archer", renderMode: "emoji" }).map((slot) => slot.label)).toEqual([
      "WEST",
      "EAST",
    ]);
    expect(unitPreviewSlotSpecs({ kind: "unknown-unit" })).toEqual([]);
  });

  it("materializes sprite-config-based specs from unit cards", () => {
    const specs = unitAnimationTypeSpecs({
      kind: "sludge",
      renderMode: "sprite",
      cards: [buildEnemyCard("sludge", "left"), buildEnemyCard("sludge", "right")],
    });

    expect(specs.map((spec) => spec.animationType)).toEqual([
      "Idle",
      "Disappear",
      "Offence",
      "Damaged",
    ]);
    expect(specs.find((spec) => spec.animationType === "Idle")).toMatchObject({
      status: "ng",
      spriteFiles: ["gama/idle-left.png", "gama/idle-right.png"],
    });
    expect(specs.find((spec) => spec.animationType === "Offence")).toMatchObject({
      status: "ng",
      spriteFiles: ["gama/attack-left.png", "gama/attack-right.png"],
    });
    expect(specs.find((spec) => spec.animationType === "Damaged")).toMatchObject({
      status: "ok",
      spriteFiles: ["gama/damaged-left.png", "gama/damaged-right.png"],
    });
  });

  it("marks thick-sludge idle as NG because base idle frames do not animate yet", () => {
    const specs = unitAnimationTypeSpecs({
      kind: "thick-sludge",
      renderMode: "sprite",
      cards: [buildEnemyCard("thick-sludge", "left"), buildEnemyCard("thick-sludge", "right")],
    });

    const idle = specs.find((spec) => spec.animationType === "Idle");
    expect(idle).toBeDefined();
    expect(idle?.status).toBe("ng");
    expect(idle?.implementation).toContain("静止表示");
  });

  it("returns empty for unknown unit kind and supports sprite cards omission fallback", () => {
    expect(unitAnimationTypeSpecs({ kind: "unknown-unit" })).toEqual([]);

    const specs = unitAnimationTypeSpecs({ kind: "sludge", renderMode: "sprite" });
    expect(specs).toHaveLength(4);
    expect(specs[0].spriteFiles).toEqual([]);
    expect(specs[0].previewImageSrcs).toEqual([]);
  });
});
