import type { RelativeDirection } from "../direction";
import { BaseAbility } from "./base";

/**
 * Rotate the unit's facing direction.
 * Ported from RubyWarrior::Abilities::Pivot
 */
const ROTATION_MAP: Record<RelativeDirection, number> = {
  forward: 0,
  right: 1,
  backward: 2,
  left: 3,
};

export class Pivot extends BaseAbility {
  perform(direction: RelativeDirection = "backward"): void {
    this.verifyDirection(direction);
    this._unit.position!.rotate(ROTATION_MAP[direction]);
    this._unit.say(`pivots ${direction}`);
  }
}
