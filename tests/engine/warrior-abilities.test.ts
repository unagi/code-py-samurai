import { describe, expect, it } from "vitest";

import {
  getGlobalLevelFromTowerLevel,
  getMaxWarriorLevel,
  getTowerAndLocalFromGlobal,
  getWarriorAbilitiesAtGlobalLevel,
  getWarriorAbilityIncrementAtGlobalLevel,
  getWarriorRank,
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

  describe("getTowerAndLocalFromGlobal", () => {
    it("maps beginner range correctly", () => {
      expect(getTowerAndLocalFromGlobal(1)).toEqual({ towerName: "beginner", localLevel: 1 });
      expect(getTowerAndLocalFromGlobal(5)).toEqual({ towerName: "beginner", localLevel: 5 });
      expect(getTowerAndLocalFromGlobal(9)).toEqual({ towerName: "beginner", localLevel: 9 });
    });

    it("maps intermediate range correctly", () => {
      expect(getTowerAndLocalFromGlobal(10)).toEqual({ towerName: "intermediate", localLevel: 1 });
      expect(getTowerAndLocalFromGlobal(14)).toEqual({ towerName: "intermediate", localLevel: 5 });
      expect(getTowerAndLocalFromGlobal(18)).toEqual({ towerName: "intermediate", localLevel: 9 });
    });

    it("round-trips with getGlobalLevelFromTowerLevel", () => {
      for (let gl = 1; gl <= 18; gl++) {
        const { towerName, localLevel } = getTowerAndLocalFromGlobal(gl);
        expect(getGlobalLevelFromTowerLevel(towerName, localLevel)).toBe(gl);
      }
    });
  });

  describe("getWarriorRank", () => {
    it("returns novice for levels 1-4", () => {
      expect(getWarriorRank(1).key).toBe("ranks.novice");
      expect(getWarriorRank(4).key).toBe("ranks.novice");
    });

    it("returns apprentice for levels 5-9", () => {
      expect(getWarriorRank(5).key).toBe("ranks.apprentice");
      expect(getWarriorRank(9).key).toBe("ranks.apprentice");
    });

    it("returns journeyman for levels 10-13", () => {
      expect(getWarriorRank(10).key).toBe("ranks.journeyman");
      expect(getWarriorRank(13).key).toBe("ranks.journeyman");
    });

    it("returns veteran for levels 14-16", () => {
      expect(getWarriorRank(14).key).toBe("ranks.veteran");
      expect(getWarriorRank(16).key).toBe("ranks.veteran");
    });

    it("returns master for levels 17-18", () => {
      expect(getWarriorRank(17).key).toBe("ranks.master");
      expect(getWarriorRank(18).key).toBe("ranks.master");
    });

    it("clamps below 1 to novice", () => {
      expect(getWarriorRank(0).key).toBe("ranks.novice");
      expect(getWarriorRank(-5).key).toBe("ranks.novice");
    });
  });
});
