import type { LevelDefinition } from "../../engine/types";
import { getWarriorAbilityIncrement } from "../../engine/warrior-abilities";
import { parseLevelDefinitionJson } from "../level-schema";

import rawLevel001 from "./level-001.json";
import rawLevel002 from "./level-002.json";
import rawLevel003 from "./level-003.json";
import rawLevel004 from "./level-004.json";
import rawLevel005 from "./level-005.json";
import rawLevel006 from "./level-006.json";
import rawLevel007 from "./level-007.json";
import rawLevel008 from "./level-008.json";
import rawLevel009 from "./level-009.json";

function withWarriorAbilityIncrement(level: LevelDefinition, levelNumber: number): LevelDefinition {
  return {
    ...level,
    warrior: {
      ...level.warrior,
      abilities: getWarriorAbilityIncrement("beginner", levelNumber),
    },
  };
}

export const level001: LevelDefinition = withWarriorAbilityIncrement(parseLevelDefinitionJson(rawLevel001), 1);
export const level002: LevelDefinition = withWarriorAbilityIncrement(parseLevelDefinitionJson(rawLevel002), 2);
export const level003: LevelDefinition = withWarriorAbilityIncrement(parseLevelDefinitionJson(rawLevel003), 3);
export const level004: LevelDefinition = withWarriorAbilityIncrement(parseLevelDefinitionJson(rawLevel004), 4);
export const level005: LevelDefinition = withWarriorAbilityIncrement(parseLevelDefinitionJson(rawLevel005), 5);
export const level006: LevelDefinition = withWarriorAbilityIncrement(parseLevelDefinitionJson(rawLevel006), 6);
export const level007: LevelDefinition = withWarriorAbilityIncrement(parseLevelDefinitionJson(rawLevel007), 7);
export const level008: LevelDefinition = withWarriorAbilityIncrement(parseLevelDefinitionJson(rawLevel008), 8);
export const level009: LevelDefinition = withWarriorAbilityIncrement(parseLevelDefinitionJson(rawLevel009), 9);

export const beginnerLevels: LevelDefinition[] = [
  level001,
  level002,
  level003,
  level004,
  level005,
  level006,
  level007,
  level008,
  level009,
];
