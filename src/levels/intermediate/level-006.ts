import type { LevelDefinition } from "../../engine/types";

import rawLevel from "./level-006.json";
import { parseLevelDefinitionJson } from "../level-schema";

const level006: LevelDefinition = parseLevelDefinitionJson(rawLevel);

export default level006;
