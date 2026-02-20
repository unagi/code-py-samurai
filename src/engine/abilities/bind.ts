import type { RelativeDirection } from "../direction";
import { BaseAbility } from "./base";

export class Bind extends BaseAbility {
  perform(direction: RelativeDirection = "forward"): void {
    this.verifyDirection(direction);
    const receiver = this.unitAt(direction);
    if (receiver) {
      this._unit.say(`binds ${direction} and restricts ${receiver}`);
      receiver.bind();
    } else {
      this._unit.say(`binds ${direction} and restricts nothing`);
    }
  }
}
