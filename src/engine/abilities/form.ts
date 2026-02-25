import type { RelativeDirection } from "../direction";
import type { Turn } from "../turn";
import { Terrain } from "../types";
import { BaseAbility } from "./base";
import { Golem } from "../units/golem";

export class Form extends BaseAbility {
  perform(
    direction: RelativeDirection = "forward",
    callback?: (turn: Turn) => void
  ): void {
    this.verifyDirection(direction);
    const sp = this.space(direction);
    if (sp.unit === undefined && sp.terrain !== Terrain.Wall) {
      const pos = this._unit.position!;
      const [fwd, rt] = this.offset(direction);
      const [x, y] = pos.translateOffset(fwd, rt);
      const golemHealth = Math.floor(this._unit.health / 2);

      const golem = new Golem();
      golem.maxHealthValue = golemHealth;
      golem.health = golemHealth;
      golem.addAbilities("walk!", "feel", "attack!");
      if (callback) {
        golem.turnCallback = callback;
      }

      this._unit.health -= golemHealth;
      pos.floor.add(golem, x, y, pos.direction);

      this._unit.say({ key: "engine.formSuccess", params: { direction, amount: golemHealth } });
    } else {
      this._unit.say({ key: "engine.formBlocked", params: {} });
    }
  }
}
