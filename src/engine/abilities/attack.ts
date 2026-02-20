import type { RelativeDirection } from "../direction";
import { BaseAbility } from "./base";

export class Attack extends BaseAbility {
  perform(direction: RelativeDirection = "forward"): void {
    this.verifyDirection(direction);
    const receiver = this.unitAt(direction);
    if (receiver) {
      this._unit.say(`attacks ${direction} and hits ${receiver}`);
      const power =
        direction === "backward"
          ? Math.ceil(this._unit.attackPower / 2)
          : this._unit.attackPower;
      this.damage(receiver, power);
    } else {
      this._unit.say(`attacks ${direction} and hits nothing`);
    }
  }
}
