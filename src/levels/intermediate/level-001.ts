import type { LevelDefinition } from "../../engine/types";

import rawLevel from "./level-001.json";
import { parseLevelDefinitionJson } from "../level-schema";

const level001: LevelDefinition = parseLevelDefinitionJson(rawLevel);

export default level001;
