import { describe, expect, it } from "vitest";

import rawLevel001 from "../../src/levels/beginner/level-001.json";
import { parseLevelDefinitionJson } from "../../src/levels/level-schema";

describe("level json schema", () => {
  it("parses beginner level 001 json", () => {
    const level = parseLevelDefinitionJson(rawLevel001);
    expect(level.floor.width).toBe(8);
    expect(level.stairs).toEqual({ x: 7, y: 0 });
    expect(level.warrior.abilities).toBeUndefined();
  });

  it("fails when required fields are missing", () => {
    const invalid = {
      description: "x",
      tip: "y",
      floor: { width: 8, height: 1 },
      warrior: { x: 0, y: 0, direction: "east" },
      units: [],
    };

    expect(() => parseLevelDefinitionJson(invalid)).toThrow(/stairs/i);
  });
});
