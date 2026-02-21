import type { LevelDefinition } from "../../engine/types";

import rawLevel from "./level-007.json";
import { parseLevelDefinitionJson } from "../level-schema";

const level007: LevelDefinition = parseLevelDefinitionJson(rawLevel);

export default level007;
