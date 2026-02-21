import { describe, it, expect } from "vitest";
import { Position } from "@engine/position";
import type { IFloor } from "@engine/types";

/** Minimal floor stub for Position tests */
function createMockFloor(
  width = 8,
  height = 1,
  stairsX = 7,
  stairsY = 0
): IFloor {
  return {
    width,
    height,
    stairsLocation: [stairsX, stairsY],
    units: [],
    outOfBounds(x: number, y: number) {
      return x < 0 || y < 0 || x > width - 1 || y > height - 1;
    },
    get(_x: number, _y: number) {
      return undefined;
    },
    space() {
      throw new Error("not implemented in mock");
    },
    add() {},
  };
}

describe("Position", () => {
  describe("constructor", () => {
    it("initializes with coordinates and default direction north", () => {
      const floor = createMockFloor();
      const pos = new Position(floor, 0, 0);
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
      expect(pos.direction).toBe("north");
    });

    it("initializes with specified direction", () => {
      const floor = createMockFloor();
      const pos = new Position(floor, 3, 2, "east");
      expect(pos.x).toBe(3);
      expect(pos.y).toBe(2);
      expect(pos.direction).toBe("east");
    });
  });

  describe("at", () => {
    it("returns true for matching coordinates", () => {
      const pos = new Position(createMockFloor(), 3, 2, "east");
      expect(pos.at(3, 2)).toBe(true);
    });

    it("returns false for non-matching coordinates", () => {
      const pos = new Position(createMockFloor(), 3, 2, "east");
      expect(pos.at(4, 2)).toBe(false);
    });
  });

  describe("rotate", () => {
    it("rotates clockwise by 1 (north -> east)", () => {
      const pos = new Position(createMockFloor(), 0, 0, "north");
      pos.rotate(1);
      expect(pos.direction).toBe("east");
    });

    it("rotates clockwise by 2 (east -> west)", () => {
      const pos = new Position(createMockFloor(), 0, 0, "east");
      pos.rotate(2);
      expect(pos.direction).toBe("west");
    });

    it("rotates counter-clockwise (north -> west)", () => {
      const pos = new Position(createMockFloor(), 0, 0, "north");
      pos.rotate(-1);
      expect(pos.direction).toBe("west");
    });

    it("wraps around (west +1 -> north)", () => {
      const pos = new Position(createMockFloor(), 0, 0, "west");
      pos.rotate(1);
      expect(pos.direction).toBe("north");
    });
  });

  describe("move", () => {
    it("moves forward 1 when facing east (x+1)", () => {
      const pos = new Position(createMockFloor(), 2, 0, "east");
      pos.move(1);
      expect(pos.x).toBe(3);
      expect(pos.y).toBe(0);
    });

    it("moves forward 1 when facing north (y-1)", () => {
      const pos = new Position(createMockFloor(8, 8), 2, 3, "north");
      pos.move(1);
      expect(pos.x).toBe(2);
      expect(pos.y).toBe(2);
    });

    it("moves forward 1 when facing south (y+1)", () => {
      const pos = new Position(createMockFloor(8, 8), 2, 3, "south");
      pos.move(1);
      expect(pos.x).toBe(2);
      expect(pos.y).toBe(4);
    });

    it("moves forward 1 when facing west (x-1)", () => {
      const pos = new Position(createMockFloor(), 2, 0, "west");
      pos.move(1);
      expect(pos.x).toBe(1);
      expect(pos.y).toBe(0);
    });

    it("moves forward with right offset", () => {
      // Facing east, forward=1, right=1 -> x+1, y+1
      const pos = new Position(createMockFloor(8, 8), 2, 2, "east");
      pos.move(1, 1);
      expect(pos.x).toBe(3);
      expect(pos.y).toBe(3);
    });
  });

  describe("translateOffset", () => {
    it("facing east: forward=1,right=0 -> (x+1, y)", () => {
      const pos = new Position(createMockFloor(), 2, 0, "east");
      expect(pos.translateOffset(1, 0)).toEqual([3, 0]);
    });

    it("facing north: forward=1,right=0 -> (x, y-1)", () => {
      const pos = new Position(createMockFloor(8, 8), 2, 3, "north");
      expect(pos.translateOffset(1, 0)).toEqual([2, 2]);
    });

    it("facing south: forward=1,right=1 -> (x-1, y+1)", () => {
      const pos = new Position(createMockFloor(8, 8), 2, 3, "south");
      expect(pos.translateOffset(1, 1)).toEqual([1, 4]);
    });

    it("facing west: forward=2,right=0 -> (x-2, y)", () => {
      const pos = new Position(createMockFloor(), 4, 0, "west");
      expect(pos.translateOffset(2, 0)).toEqual([2, 0]);
    });
  });

  describe("distanceOf", () => {
    it("calculates manhattan distance", () => {
      const pos = new Position(createMockFloor(8, 8), 1, 1, "east");
      expect(pos.distanceOf(4, 3)).toBe(5); // |1-4| + |1-3| = 5
    });

    it("returns 0 for same position", () => {
      const pos = new Position(createMockFloor(), 3, 0, "east");
      expect(pos.distanceOf(3, 0)).toBe(0);
    });
  });

  describe("directionOf", () => {
    it("returns east when target is to the right on x axis", () => {
      const pos = new Position(createMockFloor(8, 8), 1, 1, "east");
      expect(pos.directionOf(5, 1)).toBe("east");
    });

    it("returns west when target is to the left on x axis", () => {
      const pos = new Position(createMockFloor(8, 8), 5, 1, "east");
      expect(pos.directionOf(1, 1)).toBe("west");
    });

    it("returns south when target is below on y axis", () => {
      const pos = new Position(createMockFloor(8, 8), 1, 1, "east");
      expect(pos.directionOf(1, 5)).toBe("south");
    });

    it("returns north when target is above on y axis", () => {
      const pos = new Position(createMockFloor(8, 8), 1, 5, "east");
      expect(pos.directionOf(1, 1)).toBe("north");
    });

    it("prefers x axis when dx > dy", () => {
      const pos = new Position(createMockFloor(8, 8), 0, 0, "east");
      expect(pos.directionOf(3, 1)).toBe("east"); // dx=3 > dy=1
    });

    it("prefers y axis when dy >= dx", () => {
      const pos = new Position(createMockFloor(8, 8), 0, 0, "east");
      expect(pos.directionOf(1, 3)).toBe("south"); // dx=1 < dy=3
    });
  });

  describe("relativeDirectionOf", () => {
    it("returns forward when target is in facing direction", () => {
      const pos = new Position(createMockFloor(), 0, 0, "east");
      expect(pos.relativeDirectionOf(5, 0)).toBe("forward");
    });

    it("returns backward when target is behind", () => {
      const pos = new Position(createMockFloor(), 5, 0, "east");
      expect(pos.relativeDirectionOf(0, 0)).toBe("backward");
    });

    it("returns left when target is to the left", () => {
      const pos = new Position(createMockFloor(8, 8), 3, 3, "east");
      expect(pos.relativeDirectionOf(3, 0)).toBe("left"); // north is left when facing east
    });

    it("returns right when target is to the right", () => {
      const pos = new Position(createMockFloor(8, 8), 3, 3, "east");
      expect(pos.relativeDirectionOf(3, 6)).toBe("right"); // south is right when facing east
    });
  });
});
