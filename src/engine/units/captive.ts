import type { ILogger } from "../types";
import type { BaseAbility } from "../abilities/base";
import { createAbility } from "../abilities/index";
import { BaseUnit } from "./base";

/**
 * Captive - rescue target, starts bound.
 * Ported from RubyWarrior::Units::Captive
 */
export class Captive extends BaseUnit {
  constructor(logger?: ILogger) {
    super(logger);
    this.bind();
  }

  get maxHealth(): number {
    return 1;
  }

  get character(): string {
    return "C";
  }

  get name(): string {
    return "Captive";
  }

  protected createAbility(name: string): BaseAbility | null {
    return createAbility(name, this);
  }
}
