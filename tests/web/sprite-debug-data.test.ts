import { describe, expect, it } from "vitest";

import {
  DEBUG_SPRITE_TRIGGER_STATES,
  buildSpriteDebugCardSpecs,
  buildSpriteDebugDirectionCoverageSpecs,
  buildSamuraiSkillCoverageSpecs,
  buildSpriteDebugUnsupportedUnitSpecs,
} from "../../src/web/sprite-debug-data";

describe("sprite debug data", () => {
  it("builds preview cards as unit x direction", () => {
    const cards = buildSpriteDebugCardSpecs();

    expect(cards.map((card) => card.id)).toEqual([
      "samurai-left",
      "samurai-right",
      "sludge-left",
      "sludge-right",
      "thick-sludge-left",
      "thick-sludge-right",
      "captive-none",
    ]);
  });

  it("marks samurai as idle-only and exposes missing state buttons", () => {
    const cards = buildSpriteDebugCardSpecs();
    const samuraiLeft = cards.find((card) => card.id === "samurai-left");

    expect(samuraiLeft).toBeDefined();
    expect(samuraiLeft?.supportedStates).toEqual(["idle"]);
    expect(samuraiLeft?.unsupportedStates).toEqual(["attack", "damaged", "death"]);
    expect(samuraiLeft?.note).toContain("idle");
    expect(DEBUG_SPRITE_TRIGGER_STATES).toEqual(["attack", "damaged", "death"]);
  });

  it("creates a single directionless card for captive", () => {
    const cards = buildSpriteDebugCardSpecs();
    const captiveCards = cards.filter((card) => card.kind === "captive");

    expect(captiveCards).toHaveLength(1);
    expect(captiveCards[0]).toMatchObject({
      id: "captive-none",
      dir: "none",
      spriteDir: "right",
      supportedStates: ["idle", "attack", "damaged", "death"],
      unsupportedStates: [],
    });
  });

  it("lists emoji-rendered game units as unsupported preview targets", () => {
    const unsupported = buildSpriteDebugUnsupportedUnitSpecs();

    expect(unsupported).toEqual([
      { kind: "archer", renderMode: "emoji", reason: "sprite logic not implemented" },
      { kind: "golem", renderMode: "emoji", reason: "sprite logic not implemented" },
      { kind: "wizard", renderMode: "emoji", reason: "sprite logic not implemented" },
    ]);
  });

  it("covers all directions required by current game level data (over-coverage allowed)", () => {
    const coverage = buildSpriteDebugDirectionCoverageSpecs();

    expect(coverage.map((item) => ({
      kind: item.kind,
      requiredDirs: item.requiredDirs,
      missingDirs: item.missingDirs,
    }))).toEqual([
      { kind: "samurai", requiredDirs: ["left", "right"], missingDirs: [] },
      { kind: "sludge", requiredDirs: ["left", "right"], missingDirs: [] },
      { kind: "thick-sludge", requiredDirs: ["left", "right"], missingDirs: [] },
      { kind: "captive", requiredDirs: ["none"], missingDirs: [] },
    ]);
  });

  it("lists implemented samurai skills and classifies sprite-debug coverage", () => {
    const skills = buildSamuraiSkillCoverageSpecs();
    const walk = skills.find((item) => item.skillName === "walk");
    const attack = skills.find((item) => item.skillName === "attack");
    const feel = skills.find((item) => item.skillName === "feel");

    expect(walk?.skillSignature).toContain("direction: Direction");
    expect(walk?.category).toBe("action");
    expect(walk?.acceptsDirection).toBe(true);
    expect(walk?.acceptedDirections).toEqual(["FORWARD", "RIGHT", "BACKWARD", "LEFT"]);
    expect(walk?.derivedMotionSequence).toEqual(["walk", "idle"]);
    expect(walk?.missingSpriteModes).toEqual(["walk"]);

    expect(attack?.derivedMotionSequence).toEqual(["attack", "idle"]);
    expect(attack?.missingSpriteModes).toEqual(["attack"]);

    expect(feel?.category).toBe("sense");
    expect(feel?.derivedMotionSequence).toEqual(["idle"]);
    expect(feel?.missingSpriteModes).toEqual([]);
  });
});
