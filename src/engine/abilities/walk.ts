import type { RelativeDirection } from "../direction";
import { BaseAbility } from "./base";

export class Walk extends BaseAbility {
  perform(direction: RelativeDirection = "forward"): void {
    this.verifyDirection(direction);
    if (this._unit.position) {
      this._unit.say(`walks ${direction}`);
      const sp = this.space(direction);
      if (sp.isEmpty()) {
        const [fwd, rt] = this.offset(direction);
        this._unit.position.move(fwd, rt);
      } else {
        this._unit.say(`bumps into ${sp}`);
      }
    }
  }
}
