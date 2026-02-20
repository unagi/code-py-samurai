import type { RelativeDirection } from "../direction";
import type { ILogger } from "../types";
import type { BaseAbility } from "../abilities/base";
import type { Space } from "../space";
import { createAbility } from "../abilities/index";
import { Turn } from "../turn";
import { BaseUnit } from "./base";

const SEARCH_DIRECTIONS: RelativeDirection[] = [
  "forward",
  "left",
  "right",
];

/**
 * Wizard - deadly ranged enemy with high shoot damage.
 * Ported from RubyWarrior::Units::Wizard
 */
export class Wizard extends BaseUnit {
  constructor(logger?: ILogger) {
    super(logger);
    this.addAbilities("shoot!", "look");
  }

  get shootPower(): number {
    return 11;
  }

  get maxHealth(): number {
    return 3;
  }

  get character(): string {
    return "w";
  }

  get name(): string {
    return "Wizard";
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
