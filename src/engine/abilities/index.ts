import type { IUnit } from "../types";
import type { BaseAbility } from "./base";
import { Walk } from "./walk";
import { Feel } from "./feel";
import { Health } from "./health";
import { Attack } from "./attack";
import { Rest } from "./rest";
import { Rescue } from "./rescue";
import { Pivot } from "./pivot";
import { Look } from "./look";
import { Shoot } from "./shoot";
import { DirectionOfStairs } from "./direction-of-stairs";
import { DirectionOf } from "./direction-of";
import { DistanceOf } from "./distance-of";
import { Listen } from "./listen";
import { Bind } from "./bind";
import { Explode } from "./explode";
import { Detonate } from "./detonate";
import { Form } from "./form";

type AbilityConstructor = new (unit: IUnit) => BaseAbility;

const ABILITY_MAP: Record<string, AbilityConstructor> = {
  "walk!": Walk,
  feel: Feel,
  health: Health,
  "attack!": Attack,
  "rest!": Rest,
  "rescue!": Rescue,
  "pivot!": Pivot,
  look: Look,
  "shoot!": Shoot,
  direction_of_stairs: DirectionOfStairs,
  direction_of: DirectionOf,
  distance_of: DistanceOf,
  listen: Listen,
  "bind!": Bind,
  "explode!": Explode,
  "detonate!": Detonate,
  "form!": Form,
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

export {
  Walk,
  Feel,
  Health,
  Attack,
  Rest,
  Rescue,
  Pivot,
  Look,
  Shoot,
  DirectionOfStairs,
  DirectionOf,
  DistanceOf,
  Listen,
  Bind,
  Explode,
  Detonate,
  Form,
};
