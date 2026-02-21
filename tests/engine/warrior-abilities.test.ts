import { describe, expect, it } from "vitest";

import {
  getMaxWarriorLevel,
  getWarriorAbilitiesAtGlobalLevel,
  getWarriorAbilityIncrementAtGlobalLevel,
  warriorAbilitiesToEngineAbilities,
} from "@engine/warrior-abilities";

describe("warrior-abilities", () => {
  it("getMaxWarriorLevel returns expected max", () => {
    const max = getMaxWarriorLevel();
    expect(max).toBeGreaterThanOrEqual(18);
  });

  it("getWarriorAbilityIncrementAtGlobalLevel returns empty for unregistered level", () => {
    const result = getWarriorAbilityIncrementAtGlobalLevel(999);
    expect(result.skills).toEqual([]);
    expect(result.stats).toEqual([]);
  });

  it("getWarriorAbilitiesAtGlobalLevel accumulates abilities", () => {
    const result = getWarriorAbilitiesAtGlobalLevel(3);
    expect(result.skills).toContain("walk()");
    expect(result.skills).toContain("rest()");
    expect(result.stats).toContain("hp");
  });

  it("warriorAbilitiesToEngineAbilities maps skills to engine names", () => {
    const result = warriorAbilitiesToEngineAbilities({
      skills: ["walk()", "attack()"],
      stats: ["hp"],
    });
    expect(result).toContain("walk!");
    expect(result).toContain("attack!");
    expect(result).toContain("health");
  });
});
