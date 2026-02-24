import { describe, expect, it } from "vitest";

import {
  absoluteDirToSpriteDir,
  computeDeterministicAnimationOffsetMs,
  computeDeterministicJitteredCycleMs,
  computeFrameMsFromCycle,
  computeSpriteFrameIndex,
  resolveSpriteDir,
} from "../../src/web/sprite-utils";
import { Sludge } from "@engine/units/sludge";
import { Samurai } from "@engine/units/samurai";
import { Floor } from "@engine/floor";

describe("resolveSpriteDir", () => {
  it("replaces {dir} with the given direction", () => {
    expect(resolveSpriteDir("/sprites/sludge/idle-{dir}.png", "left"))
      .toBe("/sprites/sludge/idle-left.png");
    expect(resolveSpriteDir("/sprites/sludge/attack-{dir}.png", "right"))
      .toBe("/sprites/sludge/attack-right.png");
  });

  it("returns template unchanged when no placeholder present", () => {
    expect(resolveSpriteDir("/sprites/fixed.png", "left")).toBe("/sprites/fixed.png");
  });
});

describe("absoluteDirToSpriteDir", () => {
  it("maps east to right", () => {
    expect(absoluteDirToSpriteDir("east")).toBe("right");
  });

  it("maps north to north", () => {
    expect(absoluteDirToSpriteDir("north")).toBe("north");
  });

  it("maps west to left", () => {
    expect(absoluteDirToSpriteDir("west")).toBe("left");
  });

  it("maps south to south", () => {
    expect(absoluteDirToSpriteDir("south")).toBe("south");
  });
});

describe("computeSpriteFrameIndex", () => {
  it("loops frames at fixed intervals when loop=true", () => {
    expect(computeSpriteFrameIndex(0, 4, 160, true)).toBe(0);
    expect(computeSpriteFrameIndex(159, 4, 160, true)).toBe(0);
    expect(computeSpriteFrameIndex(160, 4, 160, true)).toBe(1);
    expect(computeSpriteFrameIndex(320, 4, 160, true)).toBe(2);
    expect(computeSpriteFrameIndex(480, 4, 160, true)).toBe(3);
    expect(computeSpriteFrameIndex(640, 4, 160, true)).toBe(0);
  });

  it("stops at the last frame when loop=false", () => {
    expect(computeSpriteFrameIndex(0, 4, 160, false)).toBe(0);
    expect(computeSpriteFrameIndex(160, 4, 160, false)).toBe(1);
    expect(computeSpriteFrameIndex(999, 4, 160, false)).toBe(3);
  });

  it("returns frame 0 for single-frame sprites", () => {
    expect(computeSpriteFrameIndex(999, 1, 160, true)).toBe(0);
    expect(computeSpriteFrameIndex(999, 1, 160, false)).toBe(0);
  });
});

describe("computeDeterministicAnimationOffsetMs", () => {
  it("returns a stable offset within the animation cycle", () => {
    const cycleMs = 640;
    const offsetA = computeDeterministicAnimationOffsetMs(42, cycleMs);
    const offsetB = computeDeterministicAnimationOffsetMs(42, cycleMs);

    expect(offsetA).toBe(offsetB);
    expect(offsetA).toBeGreaterThanOrEqual(0);
    expect(offsetA).toBeLessThan(cycleMs);
  });

  it("returns 0 when cycle duration is not positive", () => {
    expect(computeDeterministicAnimationOffsetMs(42, 0)).toBe(0);
    expect(computeDeterministicAnimationOffsetMs(42, -10)).toBe(0);
  });

  it("produces non-uniform offsets across different seeds", () => {
    const offsets = new Set(
      Array.from({ length: 12 }, (_, seed) => computeDeterministicAnimationOffsetMs(seed, 640)),
    );

    expect(offsets.size).toBeGreaterThan(1);
  });
});

describe("computeFrameMsFromCycle", () => {
  it("derives per-frame duration from target cycle length", () => {
    expect(computeFrameMsFromCycle(4, 1200, 160)).toBe(300);
    expect(computeFrameMsFromCycle(5, 1200, 160)).toBe(240);
  });

  it("falls back to default frame duration for invalid inputs", () => {
    expect(computeFrameMsFromCycle(1, 1200, 160)).toBe(160);
    expect(computeFrameMsFromCycle(4, 0, 160)).toBe(160);
    expect(computeFrameMsFromCycle(4, -1, 160)).toBe(160);
  });
});

describe("computeDeterministicJitteredCycleMs", () => {
  it("returns a stable cycle duration within jitter bounds", () => {
    const baseCycleMs = 1400;
    const jitterRatio = 0.15;
    const cycleA = computeDeterministicJitteredCycleMs(42, baseCycleMs, jitterRatio);
    const cycleB = computeDeterministicJitteredCycleMs(42, baseCycleMs, jitterRatio);

    expect(cycleA).toBe(cycleB);
    expect(cycleA).toBeGreaterThanOrEqual(Math.round(baseCycleMs * (1 - jitterRatio)));
    expect(cycleA).toBeLessThanOrEqual(Math.round(baseCycleMs * (1 + jitterRatio)));
  });

  it("returns the base cycle when jitter is disabled or inputs are invalid", () => {
    expect(computeDeterministicJitteredCycleMs(42, 1400, 0)).toBe(1400);
    expect(computeDeterministicJitteredCycleMs(42, 1400, -0.1)).toBe(1400);
    expect(computeDeterministicJitteredCycleMs(42, 1400, Number.NaN)).toBe(1400);
    expect(computeDeterministicJitteredCycleMs(42, 1400, Number.POSITIVE_INFINITY)).toBe(1400);
    expect(computeDeterministicJitteredCycleMs(42, 0, 0.15)).toBe(1);
  });

  it("produces non-uniform cycle durations across different seeds", () => {
    const cycles = new Set(
      Array.from({ length: 12 }, (_, seed) => computeDeterministicJitteredCycleMs(seed, 1400, 0.15)),
    );

    expect(cycles.size).toBeGreaterThan(1);
  });
});

describe("engine unit direction via position", () => {
  it("exposes facing direction on position.direction", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const sludge = new Sludge();
    floor.add(sludge, 4, 0, "west");

    expect(sludge.position).not.toBeNull();
    expect(sludge.position!.direction).toBe("west");
  });

  it("west-facing sludge resolves to left sprite", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const sludge = new Sludge();
    floor.add(sludge, 4, 0, "west");

    const spriteDir = absoluteDirToSpriteDir(sludge.position!.direction);
    expect(spriteDir).toBe("left");
    expect(resolveSpriteDir("/sprites/sludge/attack-{dir}.png", spriteDir))
      .toBe("/sprites/sludge/attack-left.png");
  });

  it("east-facing samurai resolves to right sprite", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const samurai = new Samurai();
    floor.add(samurai, 0, 0, "east");

    const spriteDir = absoluteDirToSpriteDir(samurai.position!.direction);
    expect(spriteDir).toBe("right");
  });

  it("dead unit has null position (no direction available)", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const sludge = new Sludge();
    floor.add(sludge, 4, 0, "west");
    sludge.takeDamage(sludge.maxHealth);

    expect(sludge.position).toBeNull();
  });
});
