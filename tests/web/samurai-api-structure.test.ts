import { describe, expect, it } from "vitest";

import type { SamuraiAbilitySet } from "../../src/engine/types";
import { getSamuraiAbilitiesAtGlobalLevel } from "../../src/engine/samurai-abilities";
import { buildSamuraiApiStructureViewModel } from "../../src/web/samurai-api-structure";

describe("buildSamuraiApiStructureViewModel", () => {
  it("renders compact Samurai method signatures without self and with type hints", () => {
    const abilities: SamuraiAbilitySet = {
      skills: ["walk()", "walk('backward')", "direction_of(space)", "listen()"],
      stats: ["hp"],
    };

    const viewModel = buildSamuraiApiStructureViewModel(abilities);

    expect(viewModel.className).toBe("Samurai");
    expect(viewModel.methodSignatures).toEqual([
      "walk(direction: Direction)",
      "direction_of(space: Space)",
      "listen()",
    ]);
    expect(viewModel.propertySignatures).toEqual(["hp: int"]);
    expect(viewModel.enums).toContain("enum Direction { FORWARD, RIGHT, BACKWARD, LEFT }");
    expect(viewModel.otherClasses.find(c => c.name === "Space")).toBeDefined();
    expect(viewModel.otherClasses.find(c => c.name === "Occupant")).toBeDefined();
  });

  it("preserves unlocked ability order (level unlock order input)", () => {
    const abilities = getSamuraiAbilitiesAtGlobalLevel(3);

    const viewModel = buildSamuraiApiStructureViewModel(abilities);

    expect(viewModel.methodSignatures).toEqual([
      "walk(direction: Direction)",
      "feel(direction: Direction)",
      "attack(direction: Direction)",
      "rest()",
    ]);
    expect(viewModel.propertySignatures).toEqual(["hp: int"]);
  });

  it("deduplicates methods collapsed into the same compact signature while preserving order", () => {
    const abilities: SamuraiAbilitySet = {
      skills: ["walk('backward')", "walk('forward')", "walk()"],
      stats: ["hp", "hp"],
    };

    const viewModel = buildSamuraiApiStructureViewModel(abilities);

    expect(viewModel.methodSignatures).toEqual(["walk(direction: Direction)"]);
    expect(viewModel.propertySignatures).toEqual(["hp: int"]);
  });
});
