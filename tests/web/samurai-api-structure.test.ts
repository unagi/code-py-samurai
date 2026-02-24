import { describe, expect, it } from "vitest";

import type { SamuraiAbilitySet } from "../../src/engine/types";
import { getSamuraiAbilitiesAtGlobalLevel } from "../../src/engine/samurai-abilities";
import { buildSamuraiApiStructureViewModel } from "../../src/web/samurai-api-structure";

describe("buildSamuraiApiStructureViewModel", () => {
  it("renders compact Samurai method signatures without return types", () => {
    const abilities: SamuraiAbilitySet = {
      skills: ["walk()", "walk('backward')", "direction_of(space)", "listen()"],
      stats: ["hp"],
    };

    const viewModel = buildSamuraiApiStructureViewModel(abilities);

    expect(viewModel.className).toBe("Samurai");
    expect(viewModel.methodSignatures).toEqual([
      "walk(self, Direction)",
      "direction_of(self, Space)",
      "listen(self)",
    ]);
    expect(viewModel.propertySignatures).toEqual(["hp: int"]);
  });

  it("preserves unlocked ability order (level unlock order input)", () => {
    const abilities = getSamuraiAbilitiesAtGlobalLevel(3);

    const viewModel = buildSamuraiApiStructureViewModel(abilities);

    expect(viewModel.methodSignatures).toEqual([
      "walk(self, Direction)",
      "feel(self, Direction)",
      "attack(self, Direction)",
      "rest(self)",
    ]);
    expect(viewModel.propertySignatures).toEqual(["hp: int"]);
  });

  it("deduplicates methods collapsed into the same compact signature while preserving order", () => {
    const abilities: SamuraiAbilitySet = {
      skills: ["walk('backward')", "walk('forward')", "walk()"],
      stats: ["hp", "hp"],
    };

    const viewModel = buildSamuraiApiStructureViewModel(abilities);

    expect(viewModel.methodSignatures).toEqual(["walk(self, Direction)"]);
    expect(viewModel.propertySignatures).toEqual(["hp: int"]);
  });
});
