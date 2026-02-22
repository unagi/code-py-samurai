import type { ILogger } from "../types";
import { createAbility } from "../abilities/index";
import { BaseUnit } from "./base";

/**
 * Captive - rescue target, starts bound.
 * Ported from RubyWarrior::Units::Captive
 */
export class Captive extends BaseUnit {
  protected static readonly MAX_HEALTH: number = 1;
  protected static readonly CHARACTER: string = "C";

  constructor(logger?: ILogger) {
    super(logger, createAbility);
    this.bind();
  }
}
