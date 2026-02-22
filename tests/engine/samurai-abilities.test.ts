import { describe, expect, it } from "vitest";

import {
  getGlobalLevelFromTowerLevel,
  getMaxSamuraiLevel,
  getTowerAndLocalFromGlobal,
  getSamuraiAbilitiesAtGlobalLevel,
  getSamuraiAbilityIncrementAtGlobalLevel,
  getSamuraiRank,
  samuraiAbilitiesToEngineAbilities,
} from "@engine/samurai-abilities";

describe("samurai-abilities", () => {
  it("getMaxSamuraiLevel returns expected max", () => {
    const max = getMaxSamuraiLevel();
    expect(max).toBeGreaterThanOrEqual(18);
  });

  it("getSamuraiAbilityIncrementAtGlobalLevel returns empty for unregistered level", () => {
    const result = getSamuraiAbilityIncrementAtGlobalLevel(999);
    expect(result.skills).toEqual([]);
    expect(result.stats).toEqual([]);
  });

  it("getSamuraiAbilitiesAtGlobalLevel accumulates abilities", () => {
    const result = getSamuraiAbilitiesAtGlobalLevel(3);
    expect(result.skills).toContain("walk()");
    expect(result.skills).toContain("rest()");
    expect(result.stats).toContain("hp");
  });

  it("samuraiAbilitiesToEngineAbilities maps skills to engine names", () => {
    const result = samuraiAbilitiesToEngineAbilities({
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

  describe("getSamuraiRank", () => {
    it("returns novice for levels 1-4", () => {
      expect(getSamuraiRank(1).key).toBe("ranks.novice");
      expect(getSamuraiRank(4).key).toBe("ranks.novice");
    });

    it("returns apprentice for levels 5-9", () => {
      expect(getSamuraiRank(5).key).toBe("ranks.apprentice");
      expect(getSamuraiRank(9).key).toBe("ranks.apprentice");
    });

    it("returns journeyman for levels 10-13", () => {
      expect(getSamuraiRank(10).key).toBe("ranks.journeyman");
      expect(getSamuraiRank(13).key).toBe("ranks.journeyman");
    });

    it("returns veteran for levels 14-16", () => {
      expect(getSamuraiRank(14).key).toBe("ranks.veteran");
      expect(getSamuraiRank(16).key).toBe("ranks.veteran");
    });

    it("returns master for levels 17-18", () => {
      expect(getSamuraiRank(17).key).toBe("ranks.master");
      expect(getSamuraiRank(18).key).toBe("ranks.master");
    });

    it("clamps below 1 to novice", () => {
      expect(getSamuraiRank(0).key).toBe("ranks.novice");
      expect(getSamuraiRank(-5).key).toBe("ranks.novice");
    });
  });
});
