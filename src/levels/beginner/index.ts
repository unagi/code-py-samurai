import type { LevelDefinition } from "../../engine/types";
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

export const level001: LevelDefinition = parseLevelDefinitionJson(rawLevel001);
export const level002: LevelDefinition = parseLevelDefinitionJson(rawLevel002);
export const level003: LevelDefinition = parseLevelDefinitionJson(rawLevel003);
export const level004: LevelDefinition = parseLevelDefinitionJson(rawLevel004);
export const level005: LevelDefinition = parseLevelDefinitionJson(rawLevel005);
export const level006: LevelDefinition = parseLevelDefinitionJson(rawLevel006);
export const level007: LevelDefinition = parseLevelDefinitionJson(rawLevel007);
export const level008: LevelDefinition = parseLevelDefinitionJson(rawLevel008);
export const level009: LevelDefinition = parseLevelDefinitionJson(rawLevel009);

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
