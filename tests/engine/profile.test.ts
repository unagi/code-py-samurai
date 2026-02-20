import { describe, it, expect } from "vitest";
import { Profile } from "@engine/profile";

describe("Profile", () => {
  it("creates with name and tower", () => {
    const profile = new Profile("Tama", "beginner");
    expect(profile.warriorName).toBe("Tama");
    expect(profile.towerName).toBe("beginner");
    expect(profile.score).toBe(0);
    expect(profile.levelNumber).toBe(0);
  });

  it("addAbilities accumulates without duplicates", () => {
    const profile = new Profile("Tama", "beginner");
    profile.addAbilities("walk!", "feel");
    profile.addAbilities("feel", "attack!");
    expect(profile.abilities).toEqual(["walk!", "feel", "attack!"]);
  });

  it("enableEpicMode / enableNormalMode toggling", () => {
    const profile = new Profile("Tama", "beginner");
    profile.levelNumber = 9;

    profile.enableEpicMode();
    expect(profile.isEpic()).toBe(true);
    expect(profile.lastLevelNumber).toBe(9);
    expect(profile.currentEpicScore).toBe(0);

    profile.enableNormalMode();
    expect(profile.isEpic()).toBe(false);
    expect(profile.levelNumber).toBe(9);
    expect(profile.lastLevelNumber).toBeNull();
  });

  it("updateEpicScore only updates when current > best", () => {
    const profile = new Profile("Tama", "beginner");
    profile.enableEpicMode();
    profile.currentEpicScore = 100;
    profile.currentEpicGrades = { 1: 0.9, 2: 0.8 };
    profile.updateEpicScore();
    expect(profile.epicScore).toBe(100);
    expect(profile.averageGrade).toBeCloseTo(0.85);

    // Lower score should not update
    profile.currentEpicScore = 50;
    profile.updateEpicScore();
    expect(profile.epicScore).toBe(100); // unchanged
  });

  it("calculateAverageGrade returns correct average", () => {
    const profile = new Profile("Tama", "beginner");
    profile.currentEpicGrades = { 1: 1.0, 2: 0.8, 3: 0.6 };
    expect(profile.calculateAverageGrade()).toBeCloseTo(0.8);
  });

  it("calculateAverageGrade returns null for empty grades", () => {
    const profile = new Profile("Tama", "beginner");
    expect(profile.calculateAverageGrade()).toBeNull();
  });

  it("toJSON / fromJSON roundtrip", () => {
    const profile = new Profile("Tama", "beginner");
    profile.score = 50;
    profile.levelNumber = 3;
    profile.addAbilities("walk!", "feel", "attack!");
    profile.epicScore = 200;

    const json = profile.toJSON();
    const restored = Profile.fromJSON(json);

    expect(restored.warriorName).toBe("Tama");
    expect(restored.towerName).toBe("beginner");
    expect(restored.score).toBe(50);
    expect(restored.levelNumber).toBe(3);
    expect(restored.abilities).toEqual(["walk!", "feel", "attack!"]);
    expect(restored.epicScore).toBe(200);
  });

  it("save / load with mock storage", () => {
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
    } as Storage;

    const profile = new Profile("Tama", "beginner");
    profile.score = 100;
    profile.levelNumber = 5;
    profile.save(mockStorage);

    const loaded = Profile.load(profile.storageKey, mockStorage);
    expect(loaded).not.toBeNull();
    expect(loaded!.warriorName).toBe("Tama");
    expect(loaded!.score).toBe(100);
    expect(loaded!.levelNumber).toBe(5);
  });

  it("load returns null for missing key", () => {
    const mockStorage = {
      getItem: () => null,
      setItem: () => {},
    } as unknown as Storage;

    expect(Profile.load("nonexistent", mockStorage)).toBeNull();
  });

  it("storageKey is sanitized", () => {
    const profile = new Profile("Super Cat!", "intermediate");
    expect(profile.storageKey).toBe("pysamurai-super-cat--intermediate");
  });
});
