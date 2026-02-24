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
  it("returns sprite-config specs for samurai with 4-direction idle and ng for unimplemented states", () => {
    const specs = unitAnimationTypeSpecs({ kind: "samurai" });

    expect(specs.map((spec) => spec.animationType)).toEqual([
      "Idle",
      "Disappear",
      "Offence",
      "Damaged",
    ]);

    // Idle: 4方向プレビュー、quad-grid レイアウト
    const idle = specs[0];
    expect(idle).toMatchObject({
      animationType: "Idle",
      artLayout: "quad-grid",
      status: "ok",
    });
    expect(idle.previewImageSrcs).toHaveLength(4);
    expect(idle.spriteFiles).toHaveLength(4);
    expect(idle.previewImageSrcs[2]).toContain("idle-north");
    expect(idle.previewImageSrcs[3]).toContain("idle-south");

    // Disappear/Offence/Damaged: 未実装 → ng
    for (const spec of specs.slice(1)) {
      expect(spec.status).toBe("ng");
      expect(spec.spriteFiles).toEqual(["-"]);
      expect(spec.previewImageSrcs).toEqual([]);
      expect(spec.implementation).toContain("未制作");
    }
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

  it("returns captive static debug entries from captive.debug.json", () => {
    const specs = unitAnimationTypeSpecs({ kind: "captive" });
    const idle = specs.find((spec) => spec.animationType === "Idle");
    const disappear = specs.find((spec) => spec.animationType === "Disappear");

    expect(idle?.spriteFiles).toEqual(["captive/bound.png"]);
    expect(disappear?.spriteFiles).toEqual(["captive/rescued.png"]);
  });

  it("materializes sprite-config-based specs from previewSlots", () => {
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
      status: "ok",
      spriteFiles: ["sludge/idle-west.png", "sludge/idle-east.png"],
    });
    expect(specs.find((spec) => spec.animationType === "Offence")).toMatchObject({
      status: "ok",
      spriteFiles: ["sludge/attack-west.png", "sludge/attack-east.png"],
    });
    expect(specs.find((spec) => spec.animationType === "Damaged")).toMatchObject({
      status: "ok",
      spriteFiles: ["sludge/damaged-west.png", "sludge/damaged-east.png"],
    });
  });

  it("marks thick-sludge idle as OK when base idle sheet animation is supported", () => {
    const specs = unitAnimationTypeSpecs({
      kind: "thick-sludge",
      renderMode: "sprite",
      cards: [buildEnemyCard("thick-sludge", "left"), buildEnemyCard("thick-sludge", "right")],
    });

    const idle = specs.find((spec) => spec.animationType === "Idle");
    expect(idle).toBeDefined();
    expect(idle?.status).toBe("ok");
    expect(idle?.implementation).not.toContain("静止表示");
  });

  it("materializes wizard sprite-config specs from wizard sprites", () => {
    const specs = unitAnimationTypeSpecs({
      kind: "wizard",
      renderMode: "sprite",
      cards: [buildEnemyCard("wizard", "left"), buildEnemyCard("wizard", "right")],
    });

    expect(specs.map((spec) => spec.animationType)).toEqual([
      "Idle",
      "Disappear",
      "Offence",
      "Damaged",
    ]);
    expect(specs.every((spec) => spec.status === "ok")).toBe(true);
    expect(specs.find((spec) => spec.animationType === "Idle")?.spriteFiles)
      .toEqual(["wizard/idle-west.png", "wizard/idle-east.png"]);
  });

  it("returns empty for unknown unit kind and resolves from previewSlots without cards", () => {
    expect(unitAnimationTypeSpecs({ kind: "unknown-unit" })).toEqual([]);

    // cards 省略時も previewSlots からプレビュー画像を解決する
    const specs = unitAnimationTypeSpecs({ kind: "sludge", renderMode: "sprite" });
    expect(specs).toHaveLength(4);
    expect(specs[0].spriteFiles).toEqual(["sludge/idle-west.png", "sludge/idle-east.png"]);
    expect(specs[0].previewImageSrcs).toHaveLength(2);
  });
});
