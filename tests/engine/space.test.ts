import { describe, it, expect } from "vitest";
import { Space } from "@engine/space";
import type { IFloor, IUnit } from "@engine/types";

function createMockFloor(opts: {
  width?: number;
  height?: number;
  stairsX?: number;
  stairsY?: number;
  unitAt?: { x: number; y: number; unit: IUnit };
} = {}): IFloor {
  const { width = 8, height = 1, stairsX = 7, stairsY = 0, unitAt } = opts;
  return {
    width,
    height,
    stairsLocation: [stairsX, stairsY] as [number, number],
    units: [],
    outOfBounds(x: number, y: number) {
      return x < 0 || y < 0 || x > width - 1 || y > height - 1;
    },
    get(x: number, y: number) {
      if (unitAt && unitAt.x === x && unitAt.y === y) {
        return unitAt.unit;
      }
      return undefined;
    },
  };
}

function createMockUnit(overrides: Partial<IUnit> = {}): IUnit {
  return {
    character: "@",
    position: null,
    health: 20,
    maxHealth: 20,
    attackPower: 5,
    shootPower: 3,
    isBound: () => false,
    isWarrior: () => false,
    isGolem: () => false,
    hasAbility: () => false,
    toString: () => "unit",
    takeDamage: () => {},
    earnPoints: () => {},
    say: () => {},
    unbind: () => {},
    bind: () => {},
    ...overrides,
  };
}

describe("Space", () => {
  describe("isEmpty", () => {
    it("returns true for empty in-bounds cell", () => {
      const floor = createMockFloor();
      const space = new Space(floor, 3, 0);
      expect(space.isEmpty()).toBe(true);
    });

    it("returns false when a unit is present", () => {
      const unit = createMockUnit();
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.isEmpty()).toBe(false);
    });

    it("returns false for wall (out of bounds)", () => {
      const floor = createMockFloor();
      const space = new Space(floor, -1, 0);
      expect(space.isEmpty()).toBe(false);
    });
  });

  describe("isWall", () => {
    it("returns true for out of bounds", () => {
      const floor = createMockFloor();
      const space = new Space(floor, -1, 0);
      expect(space.isWall()).toBe(true);
    });

    it("returns true for beyond width", () => {
      const floor = createMockFloor();
      const space = new Space(floor, 8, 0);
      expect(space.isWall()).toBe(true);
    });

    it("returns false for in-bounds", () => {
      const floor = createMockFloor();
      const space = new Space(floor, 3, 0);
      expect(space.isWall()).toBe(false);
    });
  });

  describe("isStairs", () => {
    it("returns true at stairs location", () => {
      const floor = createMockFloor({ stairsX: 7, stairsY: 0 });
      const space = new Space(floor, 7, 0);
      expect(space.isStairs()).toBe(true);
    });

    it("returns false at non-stairs location", () => {
      const floor = createMockFloor({ stairsX: 7, stairsY: 0 });
      const space = new Space(floor, 3, 0);
      expect(space.isStairs()).toBe(false);
    });
  });

  describe("isEnemy", () => {
    it("returns true for non-player non-captive unit", () => {
      const unit = createMockUnit({ character: "s" });
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.isEnemy()).toBe(true);
    });

    it("returns false for warrior", () => {
      const unit = createMockUnit({ isWarrior: () => true, character: "@" });
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.isEnemy()).toBe(false);
    });

    it("returns false for golem", () => {
      const unit = createMockUnit({ isGolem: () => true, character: "G" });
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.isEnemy()).toBe(false);
    });

    it("returns false for captive (bound unit)", () => {
      const unit = createMockUnit({ isBound: () => true, character: "C" });
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.isEnemy()).toBe(false);
    });

    it("returns false for empty space", () => {
      const floor = createMockFloor();
      const space = new Space(floor, 3, 0);
      expect(space.isEnemy()).toBe(false);
    });
  });

  describe("isCaptive", () => {
    it("returns true for bound unit", () => {
      const unit = createMockUnit({ isBound: () => true, character: "C" });
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.isCaptive()).toBe(true);
    });

    it("returns false for unbound unit", () => {
      const unit = createMockUnit({ character: "s" });
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.isCaptive()).toBe(false);
    });

    it("returns false for empty space", () => {
      const floor = createMockFloor();
      const space = new Space(floor, 3, 0);
      expect(space.isCaptive()).toBe(false);
    });
  });

  describe("isPlayer", () => {
    it("returns true for warrior", () => {
      const unit = createMockUnit({ isWarrior: () => true });
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.isPlayer()).toBe(true);
    });

    it("returns true for golem", () => {
      const unit = createMockUnit({ isGolem: () => true });
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.isPlayer()).toBe(true);
    });

    it("returns false for enemy", () => {
      const unit = createMockUnit();
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.isPlayer()).toBe(false);
    });
  });

  describe("isTicking", () => {
    it("returns true when unit has explode ability", () => {
      const unit = createMockUnit({
        hasAbility: (name: string) => name === "explode!",
      });
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.isTicking()).toBe(true);
    });

    it("returns false when unit has no explode ability", () => {
      const unit = createMockUnit();
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.isTicking()).toBe(false);
    });

    it("returns false for empty space", () => {
      const floor = createMockFloor();
      const space = new Space(floor, 3, 0);
      expect(space.isTicking()).toBe(false);
    });
  });

  describe("isGolem", () => {
    it("returns true for golem unit", () => {
      const unit = createMockUnit({ isGolem: () => true, character: "G" });
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.isGolem()).toBe(true);
    });

    it("returns false for non-golem unit", () => {
      const unit = createMockUnit();
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.isGolem()).toBe(false);
    });
  });

  describe("unit", () => {
    it("returns the unit at the space", () => {
      const unit = createMockUnit({ character: "s" });
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.unit).toBe(unit);
    });

    it("returns undefined for empty space", () => {
      const floor = createMockFloor();
      const space = new Space(floor, 3, 0);
      expect(space.unit).toBeUndefined();
    });
  });

  describe("location", () => {
    it("returns [x, y] tuple", () => {
      const floor = createMockFloor();
      const space = new Space(floor, 3, 2);
      expect(space.location).toEqual([3, 2]);
    });
  });

  describe("character", () => {
    it("returns unit character when unit present", () => {
      const unit = createMockUnit({ character: "s" });
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.character).toBe("s");
    });

    it('returns ">" for stairs', () => {
      const floor = createMockFloor({ stairsX: 3, stairsY: 0 });
      const space = new Space(floor, 3, 0);
      expect(space.character).toBe(">");
    });

    it('returns " " for empty space', () => {
      const floor = createMockFloor();
      const space = new Space(floor, 3, 0);
      expect(space.character).toBe(" ");
    });
  });

  describe("toString", () => {
    it("returns unit toString when unit present", () => {
      const unit = createMockUnit({ toString: () => "Sludge" });
      const floor = createMockFloor({ unitAt: { x: 3, y: 0, unit } });
      const space = new Space(floor, 3, 0);
      expect(space.toString()).toBe("Sludge");
    });

    it('returns "wall" for wall', () => {
      const floor = createMockFloor();
      const space = new Space(floor, -1, 0);
      expect(space.toString()).toBe("wall");
    });

    it('returns "nothing" for empty space', () => {
      const floor = createMockFloor();
      const space = new Space(floor, 3, 0);
      expect(space.toString()).toBe("nothing");
    });
  });
});
