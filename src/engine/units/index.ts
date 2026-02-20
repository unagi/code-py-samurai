import type { ILogger } from "../types";
import { BaseUnit } from "./base";
import { Warrior } from "./warrior";
import { Sludge } from "./sludge";

type UnitConstructor = new (logger?: ILogger) => BaseUnit;

const UNIT_MAP: Record<string, UnitConstructor> = {
  sludge: Sludge,
};

export function createUnit(
  type: string,
  logger?: ILogger
): BaseUnit | null {
  const Ctor = UNIT_MAP[type];
  if (!Ctor) return null;
  return new Ctor(logger);
}

export { Warrior, Sludge, BaseUnit };
