import type { WarriorAbilitySet } from "./types";

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

const EMPTY_ABILITIES: WarriorAbilitySet = { skills: [], stats: [] };

const TOWER_START_LEVEL: Record<string, number> = {
  beginner: 1,
  intermediate: 10,
};

// Incremental unlock table on global warrior level.
const WARRIOR_ABILITY_INCREMENTS: Record<number, WarriorAbilitySet> = {
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

export function mergeWarriorAbilities(list: WarriorAbilitySet[]): WarriorAbilitySet {
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

export function getMaxWarriorLevel(): number {
  return Math.max(1, ...Object.keys(WARRIOR_ABILITY_INCREMENTS).map(Number));
}

export function getWarriorAbilityIncrementAtGlobalLevel(globalLevel: number): WarriorAbilitySet {
  return WARRIOR_ABILITY_INCREMENTS[globalLevel] ?? EMPTY_ABILITIES;
}

export function getWarriorAbilityIncrement(towerName: string, level: number): WarriorAbilitySet {
  return getWarriorAbilityIncrementAtGlobalLevel(getGlobalLevelFromTowerLevel(towerName, level));
}

export function getWarriorAbilitiesAtLevel(towerName: string, level: number): WarriorAbilitySet {
  return getWarriorAbilitiesAtGlobalLevel(getGlobalLevelFromTowerLevel(towerName, level));
}

export function getWarriorAbilitiesAtGlobalLevel(globalLevel: number): WarriorAbilitySet {
  const increments: WarriorAbilitySet[] = [];
  const top = Math.max(1, Math.floor(globalLevel));
  for (let lv = 1; lv <= top; lv++) {
    const inc = getWarriorAbilityIncrementAtGlobalLevel(lv);
    if (inc.skills.length === 0 && inc.stats.length === 0) continue;
    increments.push(inc);
  }
  return mergeWarriorAbilities(increments);
}

export function warriorAbilitiesToEngineAbilities(abilities: WarriorAbilitySet): string[] {
  const skills = abilities.skills
    .map((skill) => SKILL_TO_ENGINE_ABILITY[normalizeSkillName(skill)])
    .filter((value): value is string => typeof value === "string");
  const stats = abilities.stats
    .map((stat) => STAT_TO_ENGINE_ABILITY[stat.trim()])
    .filter((value): value is string => typeof value === "string");
  return unique([...skills, ...stats]);
}
