import { describe, expect, it } from "vitest";

import type { ITurn } from "@engine/types";
import { asRuntimeTurn, callSense } from "@runtime/bridge";

class FakeSpace {
  isEmpty(): boolean {
    return true;
  }
  isEnemy(): boolean {
    return false;
  }
  isCaptive(): boolean {
    return false;
  }
  isStairs(): boolean {
    return false;
  }
  isWall(): boolean {
    return false;
  }
}

class FakeTurn implements ITurn {
  action: [string, ...unknown[]] | null = null;

  doAction(name: string, ...args: unknown[]): void {
    this.action = [name, ...args];
  }

  doSense(name: string): unknown {
    if (name === "feel") {
      return new FakeSpace();
    }
    return 0;
  }

  hasAction(_name: string): boolean {
    return true;
  }

  hasSense(_name: string): boolean {
    return true;
  }
}

describe("runtime bridge", () => {
  it("converts ITurn to runtime turn and reflects action", () => {
    const turn = asRuntimeTurn(new FakeTurn());
    turn.doAction("walk!", "forward");
    expect(turn.action).toEqual(["walk!", "forward"]);
  });

  it("maps empty sensed Space to python None", () => {
    const turn = asRuntimeTurn(new FakeTurn());
    const pySpace = callSense(turn, "feel");
    expect(pySpace).toBeNull();
  });
});
