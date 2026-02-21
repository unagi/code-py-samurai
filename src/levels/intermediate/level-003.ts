import type { LevelDefinition } from "../../engine/types";

import rawLevel from "./level-003.json";
import { parseLevelDefinitionJson } from "../level-schema";

const level003: LevelDefinition = parseLevelDefinitionJson(rawLevel);

export default level003;
