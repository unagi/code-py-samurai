import type { ILogger } from "../types";
import { BaseUnit } from "./base";
import { Warrior } from "./warrior";
import { Sludge } from "./sludge";
import { ThickSludge } from "./thick-sludge";
import { Archer } from "./archer";
import { Captive } from "./captive";
import { Wizard } from "./wizard";
import { Golem } from "./golem";

type UnitConstructor = new (logger?: ILogger) => BaseUnit;

const UNIT_MAP: Record<string, UnitConstructor> = {
  sludge: Sludge,
  thick_sludge: ThickSludge,
  archer: Archer,
  captive: Captive,
  wizard: Wizard,
  golem: Golem,
};

export function createUnit(
  type: string,
  logger?: ILogger
): BaseUnit | null {
  const Ctor = UNIT_MAP[type];
  if (!Ctor) return null;
  return new Ctor(logger);
}

export { Warrior } from "./warrior";
export { Sludge } from "./sludge";
export { ThickSludge } from "./thick-sludge";
export { Archer } from "./archer";
export { Captive } from "./captive";
export { Wizard } from "./wizard";
export { Golem } from "./golem";
export { BaseUnit } from "./base";
