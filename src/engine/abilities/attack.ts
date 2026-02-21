import type { RelativeDirection } from "../direction";
import { BaseAbility } from "./base";

export class Attack extends BaseAbility {
  perform(direction: RelativeDirection = "forward"): void {
    this.verifyDirection(direction);
    const receiver = this.unitAt(direction);
    if (receiver) {
      this._unit.say({ key: "engine.attackHit", params: { direction, target: receiver.nameKey } });
      const power =
        direction === "backward"
          ? Math.ceil(this._unit.attackPower / 2)
          : this._unit.attackPower;
      this.damage(receiver, power);
    } else {
      this._unit.say({ key: "engine.attackMiss", params: { direction } });
    }
  }
}
