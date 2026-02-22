import type { RelativeDirection } from "../direction";
import { BaseAbility } from "./base";

export class Bind extends BaseAbility {
  perform(direction: RelativeDirection = "forward"): void {
    this.verifyDirection(direction);
    const receiver = this.unitAt(direction);
    if (receiver) {
      this._unit.say({ key: "engine.bindHit", params: { direction, target: receiver.nameKey } });
      receiver.bind();
    } else {
      this._unit.say({ key: "engine.bindMiss", params: { direction } });
    }
  }
}
