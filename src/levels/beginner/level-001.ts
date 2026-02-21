import type { LevelDefinition } from "../../engine/types";

import rawLevel001 from "./level-001.json";
import { parseLevelDefinitionJson } from "../level-schema";

const level001: LevelDefinition = parseLevelDefinitionJson(rawLevel001);

export default level001;
