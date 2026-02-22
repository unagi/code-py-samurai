import { afterEach, describe, expect, it } from "vitest";

import { getGlobalLevelFromTowerLevel, getMaxSamuraiLevel } from "@engine/samurai-abilities";

import {
  buildSamuraiLevel,
  clearStoredAppData,
  migrateToGlobalLevel,
  readPlayerCodeStorage,
  readProgressStorage,
  writePlayerCodeStorage,
  writeProgressStorage,
} from "../../src/web/progress-storage";

type StorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function installLocalStorageMock(mock: StorageMock): void {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: mock,
  });
}

afterEach(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
    return;
  }
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("migrateToGlobalLevel", () => {
  it("prefers new globalLevel and clamps to the provided total levels", () => {
    expect(migrateToGlobalLevel({ globalLevel: 0 }, 18)).toBe(1);
    expect(migrateToGlobalLevel({ globalLevel: 999 }, 18)).toBe(18);
    expect(migrateToGlobalLevel({ globalLevel: 4.7 }, 18)).toBe(4);
  });

  it("migrates legacy tower/level fields when globalLevel is missing", () => {
    const expected = getGlobalLevelFromTowerLevel("beginner", 3);
    expect(migrateToGlobalLevel({ towerName: "beginner", levelNumber: 3 }, 99)).toBe(expected);
  });
});

describe("buildSamuraiLevel", () => {
  it("migrates legacy samuraiLevelByTower to the highest global level and clamps", () => {
    const maxLv = getMaxSamuraiLevel();
    const migrated = buildSamuraiLevel({
      samuraiLevelByTower: {
        beginner: 2,
        intermediate: 999,
      },
    });

    expect(migrated).toBe(maxLv);
  });
});

describe("storage wrappers", () => {
  it("reads progress JSON and falls back safely on invalid JSON", () => {
    installLocalStorageMock({
      getItem: () => "{\"globalLevel\":2,\"samuraiLevel\":3}",
      setItem: () => {},
      removeItem: () => {},
    });
    expect(readProgressStorage()).toEqual({ globalLevel: 2, samuraiLevel: 3 });

    installLocalStorageMock({
      getItem: () => "{broken-json",
      setItem: () => {},
      removeItem: () => {},
    });
    expect(readProgressStorage()).toEqual({});
  });

  it("reads player code with fallback and swallows storage errors on write/clear", () => {
    const store = new Map<string, string>();
    installLocalStorageMock({
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value);
      },
      removeItem: (key) => {
        store.delete(key);
      },
    });

    expect(readPlayerCodeStorage("fallback")).toBe("fallback");
    writePlayerCodeStorage("print('hi')");
    expect(readPlayerCodeStorage("fallback")).toBe("print('hi')");
    writeProgressStorage(5, 6);
    expect(readProgressStorage()).toEqual({ globalLevel: 5, samuraiLevel: 6 });
    clearStoredAppData();
    expect(readPlayerCodeStorage("fallback")).toBe("fallback");

    installLocalStorageMock({
      getItem: () => {
        throw new Error("nope");
      },
      setItem: () => {
        throw new Error("nope");
      },
      removeItem: () => {
        throw new Error("nope");
      },
    });

    expect(readPlayerCodeStorage("fallback")).toBe("fallback");
    expect(() => writePlayerCodeStorage("x")).not.toThrow();
    expect(() => writeProgressStorage(1, 1)).not.toThrow();
    expect(() => clearStoredAppData()).not.toThrow();
  });
});
