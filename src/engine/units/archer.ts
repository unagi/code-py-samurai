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
 * Archer - ranged enemy that shoots the player.
 * Ported from RubyWarrior::Units::Archer
 */
export class Archer extends BaseUnit {
  constructor(logger?: ILogger) {
    super(logger);
    this.addAbilities("shoot!", "look");
  }

  get shootPower(): number {
    return 3;
  }

  get maxHealth(): number {
    return 7;
  }

  get character(): string {
    return "a";
  }

  get name(): string {
    return "Archer";
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
