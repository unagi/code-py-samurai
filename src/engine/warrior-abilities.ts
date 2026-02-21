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

// Incremental unlock table per tower/level.
const WARRIOR_ABILITY_INCREMENTS: Record<string, Record<number, WarriorAbilitySet>> = {
  beginner: {
    1: { skills: ["walk()", "walk('backward')"], stats: [] },
    2: { skills: ["feel()", "feel('left')", "attack()", "attack('left')"], stats: [] },
    3: { skills: ["rest()"], stats: ["hp"] },
    5: { skills: ["rescue()", "rescue('right')"], stats: [] },
    7: { skills: ["pivot()", "pivot('backward')"], stats: [] },
    8: { skills: ["look()", "look('backward')", "shoot()", "shoot('forward')"], stats: [] },
  },
  intermediate: {
    1: { skills: ["walk()", "walk('backward')", "feel()", "feel('left')", "direction_of_stairs()"], stats: [] },
    2: { skills: ["attack()", "attack('left')", "rest()"], stats: ["hp"] },
    3: { skills: ["rescue()", "rescue('right')", "bind()", "bind('left')"], stats: [] },
    4: { skills: ["listen()", "direction_of(space)"], stats: [] },
    8: { skills: ["look()", "look('backward')", "detonate()", "detonate('forward')"], stats: [] },
    9: { skills: ["distance_of(space)"], stats: [] },
  },
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

export function getWarriorAbilityIncrement(towerName: string, level: number): WarriorAbilitySet {
  const tower = WARRIOR_ABILITY_INCREMENTS[towerName];
  if (!tower) return EMPTY_ABILITIES;
  return tower[level] ?? EMPTY_ABILITIES;
}

export function getWarriorAbilitiesAtLevel(towerName: string, level: number): WarriorAbilitySet {
  const increments: WarriorAbilitySet[] = [];
  for (let lv = 1; lv <= level; lv++) {
    const inc = getWarriorAbilityIncrement(towerName, lv);
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
