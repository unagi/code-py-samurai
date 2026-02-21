import type { LevelDefinition } from "../../engine/types";

import rawLevel from "./level-009.json";
import { parseLevelDefinitionJson } from "../level-schema";

const level009: LevelDefinition = parseLevelDefinitionJson(rawLevel);

export default level009;
