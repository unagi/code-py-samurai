import type { RelativeDirection } from "../direction";
import type { IUnit } from "../types";
import { BaseAbility } from "./base";

/**
 * Shoot bow & arrow in a given direction (range 1-3).
 * Hits the first unit encountered.
 * Ported from RubyWarrior::Abilities::Shoot
 */
export class Shoot extends BaseAbility {
  perform(direction: RelativeDirection = "forward"): void {
    this.verifyDirection(direction);
    // Find first unit in range 1-3
    let receiver: IUnit | undefined;
    for (let n = 1; n <= 3; n++) {
      receiver = this.unitAt(direction, n);
      if (receiver) break;
    }
    if (receiver) {
      this._unit.say({ key: "engine.shootHit", params: { direction, target: receiver.nameKey } });
      this.damage(receiver, this._unit.shootPower);
    } else {
      this._unit.say({ key: "engine.shootMiss", params: {} });
    }
  }
}
