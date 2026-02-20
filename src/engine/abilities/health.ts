import { BaseAbility } from "./base";

export class Health extends BaseAbility {
  perform(): number {
    return this._unit.health;
  }
}
