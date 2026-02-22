import type { ILogger } from "../types";
import { Sludge } from "./sludge";

/**
 * ThickSludge - stronger variant of Sludge.
 * Ported from RubyWarrior::Units::ThickSludge
 */
export class ThickSludge extends Sludge {
  protected static readonly MAX_HEALTH: number = 24;
  protected static readonly CHARACTER: string = "S";
  protected static readonly DISPLAY_NAME: string = "Thick Sludge";

  constructor(logger?: ILogger) {
    super(logger);
  }
}
