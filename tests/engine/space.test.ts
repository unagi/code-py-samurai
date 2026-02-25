import { describe, it, expect } from "vitest";
import { Space } from "@engine/space";
import { Terrain, type IFloor, type IUnit } from "@engine/types";

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
    space() {
      throw new Error("not implemented in mock");
    },
    add() {},
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
    abilities: new Map(),
    isBound: () => false,
    isSamurai: () => false,
    isGolem: () => false,
    hasAbility: () => false,
    nameKey: "unit",
    toString: () => "unit",
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

describe("Space", () => {
  describe("terrain", () => {
    it("returns Terrain.Wall for out of bounds", () => {
      const floor = createMockFloor();
      const space = new Space(floor, -1, 0);
      expect(space.terrain).toBe(Terrain.Wall);
    });

    it("returns Terrain.Stairs at stairs location", () => {
      const floor = createMockFloor({ stairsX: 7, stairsY: 0 });
      const space = new Space(floor, 7, 0);
      expect(space.terrain).toBe(Terrain.Stairs);
    });

    it("returns Terrain.Floor for in-bounds non-stairs", () => {
      const floor = createMockFloor();
      const space = new Space(floor, 3, 0);
      expect(space.terrain).toBe(Terrain.Floor);
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
