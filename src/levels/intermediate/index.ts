import type { LevelDefinition } from "../../engine/types";
import { getWarriorAbilitiesAtLevel } from "../../engine/warrior-abilities";
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

function withWarriorAbilities(level: LevelDefinition, levelNumber: number): LevelDefinition {
  return {
    ...level,
    warrior: {
      ...level.warrior,
      abilities: getWarriorAbilitiesAtLevel("intermediate", levelNumber),
    },
  };
}

export const level001: LevelDefinition = withWarriorAbilities(parseLevelDefinitionJson(rawLevel001), 1);
export const level002: LevelDefinition = withWarriorAbilities(parseLevelDefinitionJson(rawLevel002), 2);
export const level003: LevelDefinition = withWarriorAbilities(parseLevelDefinitionJson(rawLevel003), 3);
export const level004: LevelDefinition = withWarriorAbilities(parseLevelDefinitionJson(rawLevel004), 4);
export const level005: LevelDefinition = withWarriorAbilities(parseLevelDefinitionJson(rawLevel005), 5);
export const level006: LevelDefinition = withWarriorAbilities(parseLevelDefinitionJson(rawLevel006), 6);
export const level007: LevelDefinition = withWarriorAbilities(parseLevelDefinitionJson(rawLevel007), 7);
export const level008: LevelDefinition = withWarriorAbilities(parseLevelDefinitionJson(rawLevel008), 8);
export const level009: LevelDefinition = withWarriorAbilities(parseLevelDefinitionJson(rawLevel009), 9);

export const intermediateLevels: LevelDefinition[] = [
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
