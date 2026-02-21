import type { RelativeDirection } from "../direction";
import type { ILogger } from "../types";
import type { Space } from "../space";
import type { BaseAbility } from "../abilities/base";
import { createAbility } from "../abilities/index";
import { Turn } from "../turn";
import { BaseUnit } from "./base";

const SEARCH_DIRECTIONS: RelativeDirection[] = [
  "forward",
  "left",
  "right",
  "backward",
];

export class Sludge extends BaseUnit {
  constructor(logger?: ILogger) {
    super(logger);
    this.addAbilities("attack!", "feel");
  }

  get attackPower(): number {
    return 3;
  }

  get maxHealth(): number {
    return 12;
  }

  get character(): string {
    return "s";
  }

  get name(): string {
    return "Sludge";
  }

  playTurn(turn: Turn): void {
    for (const direction of SEARCH_DIRECTIONS) {
      const space = turn.doSense("feel", direction) as Space;
      if (space.isPlayer()) {
        turn.doAction("attack!", direction);
        return;
      }
    }
  }

  protected createAbility(name: string): BaseAbility | null {
    return createAbility(name, this);
  }
}
