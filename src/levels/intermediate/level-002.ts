import type { LevelDefinition } from "../../engine/types";

import rawLevel from "./level-002.json";
import { parseLevelDefinitionJson } from "../level-schema";

const level002: LevelDefinition = parseLevelDefinitionJson(rawLevel);

export default level002;
