import type { RelativeDirection } from "../direction";
import type { ILogger } from "../types";
import type { BaseAbility } from "../abilities/base";
import type { Space } from "../space";
import { createAbility } from "../abilities/index";
import { Turn } from "../turn";
import { BaseUnit } from "./base";

const SEARCH_DIRECTIONS = [
  "forward",
  "left",
  "right",
] as const satisfies readonly RelativeDirection[];

/**
 * Wizard - deadly ranged enemy with high shoot damage.
 * Ported from RubyWarrior::Units::Wizard
 */
export class Wizard extends BaseUnit {
  protected static readonly SHOOT_POWER: number = 11;
  protected static readonly MAX_HEALTH: number = 3;
  protected static readonly CHARACTER: string = "w";

  constructor(logger?: ILogger) {
    super(logger);
    this.addAbilities("shoot!", "look");
  }

  playTurn(turn: Turn): void {
    for (const direction of SEARCH_DIRECTIONS) {
      const spaces = turn.doSense("look", direction) as Space[];
      for (const space of spaces) {
        if (space.isPlayer()) {
          turn.doAction("shoot!", direction);
          return;
        } else if (!space.isEmpty()) {
          break;
        }
      }
    }
  }

  protected createAbility(name: string): BaseAbility | null {
    return createAbility(name, this);
  }
}
