import type { LevelDefinition } from "../../engine/types";

import rawLevel from "./level-004.json";
import { parseLevelDefinitionJson } from "../level-schema";

const level004: LevelDefinition = parseLevelDefinitionJson(rawLevel);

export default level004;
