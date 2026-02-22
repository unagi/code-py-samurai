import { getGlobalLevelFromTowerLevel, getMaxSamuraiLevel } from "@engine/samurai-abilities";

export const STORAGE_KEY_PROGRESS = "py-samurai:progress";
export const STORAGE_KEY_PLAYER_CODE = "py-samurai:player-code";

export interface ProgressStorageData {
  // new format
  globalLevel?: number;
  // legacy fields
  towerName?: string;
  levelNumber?: number;
  samuraiLevel?: number;
  samuraiLevelByTower?: Record<string, number>;
}

function clampGlobalLevel(value: number, totalLevels: number): number {
  return Math.min(Math.max(1, Math.floor(value)), totalLevels);
}

export function readProgressStorage(): ProgressStorageData {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY_PROGRESS);
    if (!raw) return {};
    return JSON.parse(raw) as ProgressStorageData;
  } catch {
    return {};
  }
}

export function buildSamuraiLevel(data: ProgressStorageData): number {
  const maxLv = getMaxSamuraiLevel();
  if (typeof data.samuraiLevel === "number") {
    return Math.min(Math.max(1, Math.floor(data.samuraiLevel)), maxLv);
  }

  let migrated = 1;
  if (data.samuraiLevelByTower && typeof data.samuraiLevelByTower === "object") {
    for (const [towerName, local] of Object.entries(data.samuraiLevelByTower)) {
      if (typeof local !== "number") continue;
      migrated = Math.max(migrated, getGlobalLevelFromTowerLevel(towerName, Math.floor(local)));
    }
  }

  return Math.min(Math.max(1, migrated), maxLv);
}

export function migrateToGlobalLevel(data: ProgressStorageData, totalLevels: number): number {
  if (typeof data.globalLevel === "number") {
    return clampGlobalLevel(data.globalLevel, totalLevels);
  }
  if (data.towerName && typeof data.levelNumber === "number") {
    return clampGlobalLevel(getGlobalLevelFromTowerLevel(data.towerName, data.levelNumber), totalLevels);
  }
  return 1;
}

export function readPlayerCodeStorage(fallbackCode: string): string {
  try {
    const saved = globalThis.localStorage.getItem(STORAGE_KEY_PLAYER_CODE);
    if (typeof saved === "string" && saved.length > 0) {
      return saved;
    }
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
  return fallbackCode;
}

export function writeProgressStorage(globalLevel: number, samuraiLevel: number): void {
  try {
    globalThis.localStorage.setItem(
      STORAGE_KEY_PROGRESS,
      JSON.stringify({ globalLevel, samuraiLevel }),
    );
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

export function writePlayerCodeStorage(playerCode: string): void {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY_PLAYER_CODE, playerCode);
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

export function clearStoredAppData(): void {
  try {
    globalThis.localStorage.removeItem(STORAGE_KEY_PROGRESS);
    globalThis.localStorage.removeItem(STORAGE_KEY_PLAYER_CODE);
  } catch {
    // ignore storage errors
  }
}
