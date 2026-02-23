import { describe, expect, it } from "vitest";

import { absoluteDirToSpriteDir, computeSpriteFrameIndex, resolveSpriteDir } from "../../src/web/sprite-utils";
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

  it("maps north to right", () => {
    expect(absoluteDirToSpriteDir("north")).toBe("right");
  });

  it("maps west to left", () => {
    expect(absoluteDirToSpriteDir("west")).toBe("left");
  });

  it("maps south to left", () => {
    expect(absoluteDirToSpriteDir("south")).toBe("left");
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
