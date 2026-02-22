import type { SamuraiAbilitySet } from "./types";

const SKILL_TO_ENGINE_ABILITY: Record<string, string> = {
  walk: "walk!",
  attack: "attack!",
  rest: "rest!",
  rescue: "rescue!",
  shoot: "shoot!",
  pivot: "pivot!",
  bind: "bind!",
  detonate: "detonate!",
  form: "form!",
  feel: "feel",
  look: "look",
  listen: "listen",
  direction_of_stairs: "direction_of_stairs",
  direction_of: "direction_of",
  distance_of: "distance_of",
};

const STAT_TO_ENGINE_ABILITY: Record<string, string> = {
  hp: "health",
};

const EMPTY_ABILITIES: SamuraiAbilitySet = { skills: [], stats: [] };

const TOWER_START_LEVEL: Record<string, number> = {
  beginner: 1,
  intermediate: 10,
};

// Incremental unlock table on global samurai level.
const SAMURAI_ABILITY_INCREMENTS: Record<number, SamuraiAbilitySet> = {
  1: { skills: ["walk()", "walk('backward')"], stats: [] },
  2: { skills: ["feel()", "feel('left')", "attack()", "attack('left')"], stats: [] },
  3: { skills: ["rest()"], stats: ["hp"] },
  5: { skills: ["rescue()", "rescue('right')"], stats: [] },
  7: { skills: ["pivot()", "pivot('backward')"], stats: [] },
  8: { skills: ["look()", "look('backward')", "shoot()", "shoot('forward')"], stats: [] },
  10: { skills: ["direction_of_stairs()"], stats: [] },
  12: { skills: ["bind()", "bind('left')"], stats: [] },
  13: { skills: ["listen()", "direction_of(space)"], stats: [] },
  17: { skills: ["detonate()", "detonate('forward')"], stats: [] },
  18: { skills: ["distance_of(space)"], stats: [] },
};

function normalizeSkillName(skill: string): string {
  const trimmed = skill.trim();
  const paren = trimmed.indexOf("(");
  return (paren >= 0 ? trimmed.slice(0, paren) : trimmed).trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function mergeSamuraiAbilities(list: SamuraiAbilitySet[]): SamuraiAbilitySet {
  return {
    skills: unique(list.flatMap((item) => item.skills)),
    stats: unique(list.flatMap((item) => item.stats)),
  };
}

export function getGlobalLevelFromTowerLevel(towerName: string, localLevel: number): number {
  const start = TOWER_START_LEVEL[towerName];
  if (!start) return localLevel;
  return start + Math.max(0, localLevel - 1);
}

export interface TowerLocalLevel {
  towerName: string;
  localLevel: number;
}

/** Reverse mapping: global level → { towerName, localLevel }. */
export function getTowerAndLocalFromGlobal(globalLevel: number): TowerLocalLevel {
  const entries = Object.entries(TOWER_START_LEVEL).sort(
    ([, a], [, b]) => b - a,
  );
  for (const [name, startLevel] of entries) {
    if (globalLevel >= startLevel) {
      return { towerName: name, localLevel: globalLevel - startLevel + 1 };
    }
  }
  return { towerName: entries[entries.length - 1][0], localLevel: 1 };
}

export interface SamuraiRank {
  key: string;
  minLevel: number;
  maxLevel: number;
}

const SAMURAI_RANKS: SamuraiRank[] = [
  { key: "ranks.novice", minLevel: 1, maxLevel: 4 },
  { key: "ranks.apprentice", minLevel: 5, maxLevel: 9 },
  { key: "ranks.journeyman", minLevel: 10, maxLevel: 13 },
  { key: "ranks.veteran", minLevel: 14, maxLevel: 16 },
  { key: "ranks.master", minLevel: 17, maxLevel: 18 },
];

/** Get RPG-style rank for the given global samurai level. */
export function getSamuraiRank(globalLevel: number): SamuraiRank {
  const clamped = Math.max(1, Math.floor(globalLevel));
  for (let i = SAMURAI_RANKS.length - 1; i >= 0; i--) {
    if (clamped >= SAMURAI_RANKS[i].minLevel) return SAMURAI_RANKS[i];
  }
  return SAMURAI_RANKS[0];
}

export function getMaxSamuraiLevel(): number {
  return Math.max(1, ...Object.keys(SAMURAI_ABILITY_INCREMENTS).map(Number));
}

export function getSamuraiAbilityIncrementAtGlobalLevel(globalLevel: number): SamuraiAbilitySet {
  return SAMURAI_ABILITY_INCREMENTS[globalLevel] ?? EMPTY_ABILITIES;
}

export function getSamuraiAbilityIncrement(towerName: string, level: number): SamuraiAbilitySet {
  return getSamuraiAbilityIncrementAtGlobalLevel(getGlobalLevelFromTowerLevel(towerName, level));
}

export function getSamuraiAbilitiesAtLevel(towerName: string, level: number): SamuraiAbilitySet {
  return getSamuraiAbilitiesAtGlobalLevel(getGlobalLevelFromTowerLevel(towerName, level));
}

export function getSamuraiAbilitiesAtGlobalLevel(globalLevel: number): SamuraiAbilitySet {
  const increments: SamuraiAbilitySet[] = [];
  const top = Math.max(1, Math.floor(globalLevel));
  for (let lv = 1; lv <= top; lv++) {
    const inc = getSamuraiAbilityIncrementAtGlobalLevel(lv);
    if (inc.skills.length === 0 && inc.stats.length === 0) continue;
    increments.push(inc);
  }
  return mergeSamuraiAbilities(increments);
}

export function samuraiAbilitiesToEngineAbilities(abilities: SamuraiAbilitySet): string[] {
  const skills = abilities.skills
    .map((skill) => SKILL_TO_ENGINE_ABILITY[normalizeSkillName(skill)])
    .filter((value): value is string => typeof value === "string");
  const stats = abilities.stats
    .map((stat) => STAT_TO_ENGINE_ABILITY[stat.trim()])
    .filter((value): value is string => typeof value === "string");
  return unique([...skills, ...stats]);
}
