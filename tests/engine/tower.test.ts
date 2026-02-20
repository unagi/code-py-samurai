import { describe, it, expect } from "vitest";
import { Tower } from "@engine/tower";
import { beginnerTower, intermediateTower, towers } from "../../src/levels";

describe("Tower", () => {
  it("has correct name", () => {
    const tower = new Tower("test", []);
    expect(tower.name).toBe("test");
    expect(tower.toString()).toBe("test");
  });

  it("returns levelCount", () => {
    expect(beginnerTower.levelCount).toBe(9);
    expect(intermediateTower.levelCount).toBe(9);
  });

  it("getLevel returns level definition (1-indexed)", () => {
    const level = beginnerTower.getLevel(1);
    expect(level).not.toBeNull();
    expect(level!.floor.width).toBe(8);
  });

  it("getLevel returns null for out of range", () => {
    expect(beginnerTower.getLevel(0)).toBeNull();
    expect(beginnerTower.getLevel(10)).toBeNull();
  });

  it("hasLevel checks bounds correctly", () => {
    expect(beginnerTower.hasLevel(1)).toBe(true);
    expect(beginnerTower.hasLevel(9)).toBe(true);
    expect(beginnerTower.hasLevel(0)).toBe(false);
    expect(beginnerTower.hasLevel(10)).toBe(false);
  });

  it("levels returns all level definitions", () => {
    expect(intermediateTower.levels).toHaveLength(9);
  });

  it("towers array contains both towers", () => {
    expect(towers).toHaveLength(2);
    expect(towers[0].name).toBe("beginner");
    expect(towers[1].name).toBe("intermediate");
  });
});
