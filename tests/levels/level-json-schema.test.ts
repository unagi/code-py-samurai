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

  it("parses abilities and unit metadata", () => {
    const parsed = parseLevelDefinitionJson({
      description: "x",
      tip: "y",
      clue: "z",
      timeBonus: 10,
      aceScore: 20,
      floor: { width: 4, height: 1 },
      stairs: { x: 3, y: 0 },
      warrior: {
        unitId: "warrior",
        x: 0,
        y: 0,
        direction: "east",
        abilities: { skills: ["walk()"], stats: ["hp"] },
      },
      units: [
        {
          unitId: "sludge#1",
          type: "sludge",
          x: 2,
          y: 0,
          direction: "west",
          abilities: ["attack!"],
          abilityConfig: { "attack!": { power: 3 } },
        },
      ],
    });

    expect(parsed.warrior.abilities?.skills).toEqual(["walk()"]);
    expect(parsed.units[0].unitId).toBe("sludge#1");
    expect(parsed.units[0].abilities).toEqual(["attack!"]);
  });

  it("fails when direction is invalid", () => {
    expect(() =>
      parseLevelDefinitionJson({
        description: "x",
        tip: "y",
        timeBonus: 1,
        aceScore: 1,
        floor: { width: 2, height: 1 },
        stairs: { x: 1, y: 0 },
        warrior: { unitId: "warrior", x: 0, y: 0, direction: "up" },
        units: [],
      }),
    ).toThrow(/must be one of/i);
  });

  it("fails when integer/string array constraints are violated", () => {
    expect(() =>
      parseLevelDefinitionJson({
        description: "x",
        tip: "y",
        timeBonus: 1,
        aceScore: 1,
        floor: { width: 2.5, height: 1 },
        stairs: { x: 1, y: 0 },
        warrior: { unitId: "warrior", x: 0, y: 0, direction: "east" },
        units: [],
      }),
    ).toThrow(/integer/i);

    expect(() =>
      parseLevelDefinitionJson({
        description: "x",
        tip: "y",
        timeBonus: 1,
        aceScore: 1,
        floor: { width: 2, height: 1 },
        stairs: { x: 1, y: 0 },
        warrior: {
          unitId: "warrior",
          x: 0,
          y: 0,
          direction: "east",
          abilities: { skills: ["walk()"], stats: [1] },
        },
        units: [],
      }),
    ).toThrow(/string\[\]/i);
  });

  it("fails when root is not an object", () => {
    expect(() => parseLevelDefinitionJson(null)).toThrow(TypeError);
    expect(() => parseLevelDefinitionJson("string")).toThrow(TypeError);
    expect(() => parseLevelDefinitionJson(42)).toThrow(TypeError);
  });

  it("fails when floor is not an object", () => {
    expect(() =>
      parseLevelDefinitionJson({
        description: "x",
        tip: "y",
        timeBonus: 1,
        aceScore: 1,
        floor: "bad",
        stairs: { x: 1, y: 0 },
        warrior: { unitId: "w", x: 0, y: 0, direction: "east" },
        units: [],
      }),
    ).toThrow(/floor must be an object/i);
  });

  it("fails when warrior is not an object", () => {
    expect(() =>
      parseLevelDefinitionJson({
        description: "x",
        tip: "y",
        timeBonus: 1,
        aceScore: 1,
        floor: { width: 2, height: 1 },
        stairs: { x: 1, y: 0 },
        warrior: "bad",
        units: [],
      }),
    ).toThrow(/warrior must be an object/i);
  });

  it("fails when units is not an array", () => {
    expect(() =>
      parseLevelDefinitionJson({
        description: "x",
        tip: "y",
        timeBonus: 1,
        aceScore: 1,
        floor: { width: 2, height: 1 },
        stairs: { x: 1, y: 0 },
        warrior: { unitId: "w", x: 0, y: 0, direction: "east" },
        units: "bad",
      }),
    ).toThrow(/units must be an array/i);
  });

  it("fails when a unit entry is not an object", () => {
    expect(() =>
      parseLevelDefinitionJson({
        description: "x",
        tip: "y",
        timeBonus: 1,
        aceScore: 1,
        floor: { width: 2, height: 1 },
        stairs: { x: 1, y: 0 },
        warrior: { unitId: "w", x: 0, y: 0, direction: "east" },
        units: [42],
      }),
    ).toThrow(/units\[0\] must be an object/i);
  });

  it("fails when a number field receives non-number", () => {
    expect(() =>
      parseLevelDefinitionJson({
        description: "x",
        tip: "y",
        timeBonus: "bad",
        aceScore: 1,
        floor: { width: 2, height: 1 },
        stairs: { x: 1, y: 0 },
        warrior: { unitId: "w", x: 0, y: 0, direction: "east" },
        units: [],
      }),
    ).toThrow(/must be a number/i);
  });

  it("fails when a string field receives non-string", () => {
    expect(() =>
      parseLevelDefinitionJson({
        description: 123,
        tip: "y",
        timeBonus: 1,
        aceScore: 1,
        floor: { width: 2, height: 1 },
        stairs: { x: 1, y: 0 },
        warrior: { unitId: "w", x: 0, y: 0, direction: "east" },
        units: [],
      }),
    ).toThrow(/must be a string/i);
  });

  it("fails when warrior.abilities is not an object", () => {
    expect(() =>
      parseLevelDefinitionJson({
        description: "x",
        tip: "y",
        timeBonus: 1,
        aceScore: 1,
        floor: { width: 2, height: 1 },
        stairs: { x: 1, y: 0 },
        warrior: {
          unitId: "w",
          x: 0,
          y: 0,
          direction: "east",
          abilities: "bad",
        },
        units: [],
      }),
    ).toThrow(/must be an object/i);
  });
});
