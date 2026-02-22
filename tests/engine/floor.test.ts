import { describe, it, expect } from "vitest";
import { Floor } from "@engine/floor";
import type { IUnit } from "@engine/types";

function createMockUnit(overrides: Partial<IUnit> = {}): IUnit {
  return {
    character: "@",
    position: null,
    health: 20,
    maxHealth: 20,
    attackPower: 5,
    shootPower: 3,
    abilities: new Map(),
    isBound: () => false,
    isSamurai: () => true,
    isGolem: () => false,
    hasAbility: () => false,
    nameKey: "samurai",
    toString: () => "Samurai",
    takeDamage: () => {},
    earnPoints: () => {},
    say: () => {},
    unbind: () => {},
    bind: () => {},
    setUnitId: () => {},
    addAbilities: () => {},
    prepareTurn: () => {},
    performTurn: () => {},
    playTurn: () => {},
    ...overrides,
  };
}

function createEnemyUnit(char: string = "s", name: string = "Sludge"): IUnit {
  return createMockUnit({
    character: char,
    isSamurai: () => false,
    toString: () => name,
  });
}

describe("Floor", () => {
  describe("constructor", () => {
    it("creates floor with specified dimensions", () => {
      const floor = new Floor(8, 1);
      expect(floor.width).toBe(8);
      expect(floor.height).toBe(1);
    });
  });

  describe("placeStairs", () => {
    it("sets stairs location", () => {
      const floor = new Floor(8, 1);
      floor.placeStairs(7, 0);
      expect(floor.stairsLocation).toEqual([7, 0]);
    });
  });

  describe("outOfBounds", () => {
    it("returns false for in-bounds", () => {
      const floor = new Floor(8, 1);
      expect(floor.outOfBounds(3, 0)).toBe(false);
    });

    it("returns true for negative x", () => {
      const floor = new Floor(8, 1);
      expect(floor.outOfBounds(-1, 0)).toBe(true);
    });

    it("returns true for x >= width", () => {
      const floor = new Floor(8, 1);
      expect(floor.outOfBounds(8, 0)).toBe(true);
    });

    it("returns true for negative y", () => {
      const floor = new Floor(8, 1);
      expect(floor.outOfBounds(0, -1)).toBe(true);
    });

    it("returns true for y >= height", () => {
      const floor = new Floor(8, 1);
      expect(floor.outOfBounds(0, 1)).toBe(true);
    });
  });

  describe("add / get", () => {
    it("adds a unit and retrieves it by coordinates", () => {
      const floor = new Floor(8, 1);
      floor.placeStairs(7, 0);
      const unit = createMockUnit();
      floor.add(unit, 0, 0, "east");
      expect(floor.get(0, 0)).toBe(unit);
    });

    it("returns undefined for empty cell", () => {
      const floor = new Floor(8, 1);
      floor.placeStairs(7, 0);
      expect(floor.get(3, 0)).toBeUndefined();
    });

    it("assigns position to unit directly", () => {
      const floor = new Floor(8, 1);
      floor.placeStairs(7, 0);
      const unit = createMockUnit();
      floor.add(unit, 3, 0, "east");
      expect(unit.position).not.toBeNull();
      expect(unit.position!.x).toBe(3);
      expect(unit.position!.y).toBe(0);
      expect(unit.position!.direction).toBe("east");
    });
  });

  describe("units", () => {
    it("returns only alive units (with position)", () => {
      const floor = new Floor(8, 1);
      floor.placeStairs(7, 0);
      const samurai = createMockUnit();
      const enemy = createEnemyUnit();
      floor.add(samurai, 0, 0, "east");
      floor.add(enemy, 4, 0, "west");
      expect(floor.units).toHaveLength(2);
    });

    it("excludes dead units (removed position)", () => {
      const floor = new Floor(8, 1);
      floor.placeStairs(7, 0);
      const samurai = createMockUnit();
      const enemy = createEnemyUnit();
      floor.add(samurai, 0, 0, "east");
      floor.add(enemy, 4, 0, "west");
      // Simulate death by removing position
      floor.removeUnit(enemy);
      expect(floor.units).toHaveLength(1);
    });
  });

  describe("otherUnits", () => {
    it("returns non-samurai units", () => {
      const floor = new Floor(8, 1);
      floor.placeStairs(7, 0);
      const samurai = createMockUnit();
      const enemy = createEnemyUnit();
      floor.add(samurai, 0, 0, "east");
      floor.add(enemy, 4, 0, "west");
      const others = floor.otherUnits;
      expect(others).toHaveLength(1);
      expect(others[0]).toBe(enemy);
    });
  });

  describe("space", () => {
    it("returns a Space object for given coordinates", () => {
      const floor = new Floor(8, 1);
      floor.placeStairs(7, 0);
      const space = floor.space(3, 0);
      expect(space.isEmpty()).toBe(true);
      expect(space.location).toEqual([3, 0]);
    });

    it("space at stairs location isStairs", () => {
      const floor = new Floor(8, 1);
      floor.placeStairs(7, 0);
      expect(floor.space(7, 0).isStairs()).toBe(true);
    });
  });

  describe("stairsSpace", () => {
    it("returns the Space at stairs location", () => {
      const floor = new Floor(8, 1);
      floor.placeStairs(7, 0);
      const space = floor.stairsSpace;
      expect(space.isStairs()).toBe(true);
      expect(space.location).toEqual([7, 0]);
    });
  });

  describe("character (ASCII rendering)", () => {
    it("renders empty 8x1 floor with stairs", () => {
      const floor = new Floor(8, 1);
      floor.placeStairs(7, 0);
      // 8 cells: x0-6 empty (7 spaces) + x7 stairs (>)
      const expected = [
        " --------",
        "|       >|",
        " --------",
      ].join("\n") + "\n";
      expect(floor.character()).toBe(expected);
    });

    it("renders floor with samurai and enemy", () => {
      const floor = new Floor(8, 1);
      floor.placeStairs(7, 0);
      const samurai = createMockUnit({ character: "@" });
      const enemy = createEnemyUnit("s");
      floor.add(samurai, 0, 0, "east");
      floor.add(enemy, 4, 0, "west");
      // x0=@ x1-3=space x4=s x5-6=space x7=>
      const expected = [
        " --------",
        "|@   s  >|",
        " --------",
      ].join("\n") + "\n";
      expect(floor.character()).toBe(expected);
    });

    it("renders 4x3 multi-row floor", () => {
      const floor = new Floor(4, 3);
      floor.placeStairs(3, 2);
      const samurai = createMockUnit({ character: "@" });
      floor.add(samurai, 0, 0, "east");
      const lines = floor.character().split("\n");
      expect(lines[0]).toBe(" ----");  // top border
      expect(lines[1]).toBe("|@   |"); // row 0: x0=@ x1-3=space (4 chars)
      expect(lines[2]).toBe("|    |"); // row 1: 4 spaces
      expect(lines[3]).toBe("|   >|"); // row 2: x0-2=space x3=>
      expect(lines[4]).toBe(" ----");  // bottom border
    });
  });
});
