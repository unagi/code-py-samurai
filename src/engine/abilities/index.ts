import type { IUnit } from "../types";
import type { BaseAbility } from "./base";
import { Walk } from "./walk";
import { Feel } from "./feel";
import { Health } from "./health";
import { Attack } from "./attack";
import { Rest } from "./rest";

type AbilityConstructor = new (unit: IUnit) => BaseAbility;

const ABILITY_MAP: Record<string, AbilityConstructor> = {
  "walk!": Walk,
  feel: Feel,
  health: Health,
  "attack!": Attack,
  "rest!": Rest,
};

/**
 * Create an ability instance by name.
 */
export function createAbility(
  name: string,
  unit: IUnit
): BaseAbility | null {
  const Ctor = ABILITY_MAP[name];
  if (!Ctor) return null;
  return new Ctor(unit);
}

export { Walk, Feel, Health, Attack, Rest };
