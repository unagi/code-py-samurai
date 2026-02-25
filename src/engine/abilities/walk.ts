import type { RelativeDirection } from "../direction";
import { Terrain } from "../types";
import { BaseAbility } from "./base";

export class Walk extends BaseAbility {
  perform(direction: RelativeDirection = "forward"): void {
    this.verifyDirection(direction);
    if (this._unit.position) {
      this._unit.say({ key: "engine.walk", params: { direction } });
      const sp = this.space(direction);
      if (sp.unit === undefined && sp.terrain !== Terrain.Wall) {
        const [fwd, rt] = this.offset(direction);
        this._unit.position.move(fwd, rt);
      } else {
        this._unit.say({ key: "engine.bump", params: { target: sp.nameKey } });
      }
    }
  }
}
