import { Tower } from "../engine/tower";
import { beginnerLevels } from "./beginner";
import { intermediateLevels } from "./intermediate";

export const beginnerTower = new Tower("beginner", beginnerLevels);

export const intermediateTower = new Tower("intermediate", intermediateLevels);

export const towers: Tower[] = [beginnerTower, intermediateTower];
