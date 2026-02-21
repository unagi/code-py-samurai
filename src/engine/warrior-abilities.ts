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

export function warriorAbilitiesToEngineAbilities(abilities: WarriorAbilitySet): string[] {
  const skills = abilities.skills
    .map((skill) => SKILL_TO_ENGINE_ABILITY[normalizeSkillName(skill)])
    .filter((value): value is string => typeof value === "string");
  const stats = abilities.stats
    .map((stat) => STAT_TO_ENGINE_ABILITY[stat.trim()])
    .filter((value): value is string => typeof value === "string");
  return unique([...skills, ...stats]);
}
