import { Tower } from "../engine/tower";

import begLevel001 from "./beginner/level-001";
import begLevel002 from "./beginner/level-002";
import begLevel003 from "./beginner/level-003";
import begLevel004 from "./beginner/level-004";
import begLevel005 from "./beginner/level-005";
import begLevel006 from "./beginner/level-006";
import begLevel007 from "./beginner/level-007";
import begLevel008 from "./beginner/level-008";
import begLevel009 from "./beginner/level-009";

import intLevel001 from "./intermediate/level-001";
import intLevel002 from "./intermediate/level-002";
import intLevel003 from "./intermediate/level-003";
import intLevel004 from "./intermediate/level-004";
import intLevel005 from "./intermediate/level-005";
import intLevel006 from "./intermediate/level-006";
import intLevel007 from "./intermediate/level-007";
import intLevel008 from "./intermediate/level-008";
import intLevel009 from "./intermediate/level-009";

export const beginnerTower = new Tower("beginner", [
  begLevel001,
  begLevel002,
  begLevel003,
  begLevel004,
  begLevel005,
  begLevel006,
  begLevel007,
  begLevel008,
  begLevel009,
]);

export const intermediateTower = new Tower("intermediate", [
  intLevel001,
  intLevel002,
  intLevel003,
  intLevel004,
  intLevel005,
  intLevel006,
  intLevel007,
  intLevel008,
  intLevel009,
]);

export const towers: Tower[] = [beginnerTower, intermediateTower];
