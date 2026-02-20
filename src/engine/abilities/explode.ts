import { BaseAbility } from "./base";

export class Explode extends BaseAbility {
  time: number | null = null;

  perform(): void {
    if (this._unit.position) {
      this._unit.say("explodes, dealing 100 damage to every unit on the floor");
      const floor = this._unit.position.floor;
      // Copy array since units may die during iteration
      const allUnits = [...floor.units];
      for (const unit of allUnits) {
        unit.takeDamage(100);
      }
    }
  }

  passTurn(): void {
    if (this.time !== null && this._unit.position) {
      this.time -= 1;
      this._unit.say("is ticking");
      if (this.time <= 0) {
        this.perform();
      }
    }
  }
}
