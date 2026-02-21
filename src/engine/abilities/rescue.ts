import type { RelativeDirection } from "../direction";
import type { IUnit } from "../types";
import { BaseAbility } from "./base";

/**
 * Rescue a captive from their chains (earning 20 points).
 * Ported from RubyWarrior::Abilities::Rescue
 */
export class Rescue extends BaseAbility {
  static readonly POINTS = 20;

  perform(direction: RelativeDirection = "forward"): void {
    this.verifyDirection(direction);
    const sp = this.space(direction);
    if (sp.isCaptive()) {
      const recipient = this.unitAt(direction) as IUnit;
      this._unit.say({ key: "engine.rescueHit", params: { direction, target: recipient.nameKey } });
      recipient.unbind();
      // Remove captive from floor and earn points
      recipient.position = null;
      this._unit.earnPoints(Rescue.POINTS);
    } else {
      this._unit.say({ key: "engine.rescueMiss", params: { direction } });
    }
  }
}
