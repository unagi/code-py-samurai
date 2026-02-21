import type { LevelDefinition } from "../../engine/types";

import rawLevel from "./level-008.json";
import { parseLevelDefinitionJson } from "../level-schema";

const level008: LevelDefinition = parseLevelDefinitionJson(rawLevel);

export default level008;
