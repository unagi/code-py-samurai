import type { RelativeDirection } from "../direction";
import { BaseAbility } from "./base";

export class Detonate extends BaseAbility {
  perform(direction: RelativeDirection = "forward"): void {
    this.verifyDirection(direction);
    if (this._unit.position) {
      this._unit.say({ key: "engine.detonate", params: { direction } });
      this.bomb(direction, 1, 0, 8);
      this.bomb(direction, 1, 1, 4);
      this.bomb(direction, 1, -1, 4);
      this.bomb(direction, 2, 0, 4);
      this.bomb(direction, 0, 0, 4);
    }
  }

  private bomb(
    direction: RelativeDirection,
    forward: number,
    right: number,
    damageAmount: number
  ): void {
    if (!this._unit.position) return;
    const sp = this.space(direction, forward, right);
    const receiver = sp.unit;
    if (receiver) {
      if (receiver.hasAbility("explode!")) {
        receiver.say({ key: "engine.bombChain", params: {} });
        const explodeAbility = receiver.abilities.get("explode!");
        if (explodeAbility) {
          explodeAbility.perform();
        }
      } else {
        this.damage(receiver, damageAmount);
      }
    }
  }
}
