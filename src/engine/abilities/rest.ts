import { BaseAbility } from "./base";

export class Rest extends BaseAbility {
  perform(): void {
    if (this._unit.health < this._unit.maxHealth) {
      let amount = Math.round(this._unit.maxHealth * 0.1);
      if (this._unit.health + amount > this._unit.maxHealth) {
        amount = this._unit.maxHealth - this._unit.health;
      }
      this._unit.health += amount;
      this._unit.say(
        `receives ${amount} health from resting, up to ${this._unit.health} health`
      );
    } else {
      this._unit.say("is already fit as a fiddle");
    }
  }
}
