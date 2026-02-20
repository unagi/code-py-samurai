import { describe, it, expect } from "vitest";
import {
  AbsoluteDirection,
  RelativeDirection,
  rotateDirection,
  relativeToAbsolute,
  absoluteToRelative,
  DIRECTION_OFFSETS,
} from "@engine/direction";

describe("direction", () => {
  describe("rotateDirection", () => {
    it("rotates north by +1 to east", () => {
      expect(rotateDirection("north", 1)).toBe("east");
    });

    it("rotates east by +1 to south", () => {
      expect(rotateDirection("east", 1)).toBe("south");
    });

    it("rotates south by +1 to west", () => {
      expect(rotateDirection("south", 1)).toBe("west");
    });

    it("rotates west by +1 to north (wraps)", () => {
      expect(rotateDirection("west", 1)).toBe("north");
    });

    it("rotates north by -1 to west (wraps backward)", () => {
      expect(rotateDirection("north", -1)).toBe("west");
    });

    it("rotates north by +2 to south", () => {
      expect(rotateDirection("north", 2)).toBe("south");
    });

    it("rotates east by -2 to west", () => {
      expect(rotateDirection("east", -2)).toBe("west");
    });
  });

  describe("relativeToAbsolute", () => {
    it("forward when facing east is east", () => {
      expect(relativeToAbsolute("east", "forward")).toBe("east");
    });

    it("left when facing east is north", () => {
      expect(relativeToAbsolute("east", "left")).toBe("north");
    });

    it("right when facing east is south", () => {
      expect(relativeToAbsolute("east", "right")).toBe("south");
    });

    it("backward when facing east is west", () => {
      expect(relativeToAbsolute("east", "backward")).toBe("west");
    });

    it("forward when facing north is north", () => {
      expect(relativeToAbsolute("north", "forward")).toBe("north");
    });

    it("left when facing south is east", () => {
      expect(relativeToAbsolute("south", "left")).toBe("east");
    });

    it("right when facing west is north", () => {
      expect(relativeToAbsolute("west", "right")).toBe("north");
    });
  });

  describe("absoluteToRelative", () => {
    it("east relative to facing east is forward", () => {
      expect(absoluteToRelative("east", "east")).toBe("forward");
    });

    it("north relative to facing east is left", () => {
      expect(absoluteToRelative("east", "north")).toBe("left");
    });

    it("south relative to facing east is right", () => {
      expect(absoluteToRelative("east", "south")).toBe("right");
    });

    it("west relative to facing east is backward", () => {
      expect(absoluteToRelative("east", "west")).toBe("backward");
    });

    it("north relative to facing south is backward", () => {
      expect(absoluteToRelative("south", "north")).toBe("backward");
    });
  });

  describe("DIRECTION_OFFSETS", () => {
    it("north goes y-1", () => {
      expect(DIRECTION_OFFSETS.north).toEqual({ x: 0, y: -1 });
    });

    it("east goes x+1", () => {
      expect(DIRECTION_OFFSETS.east).toEqual({ x: 1, y: 0 });
    });

    it("south goes y+1", () => {
      expect(DIRECTION_OFFSETS.south).toEqual({ x: 0, y: 1 });
    });

    it("west goes x-1", () => {
      expect(DIRECTION_OFFSETS.west).toEqual({ x: -1, y: 0 });
    });
  });
});
