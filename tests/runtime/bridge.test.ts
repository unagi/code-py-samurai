import { describe, expect, it } from "vitest";

import type { ITurn } from "@engine/types";
import { asRuntimeTurn } from "@runtime/bridge";

class FakeTurn implements ITurn {
  action: [string, ...unknown[]] | null = null;

  doAction(name: string, ...args: unknown[]): void {
    this.action = [name, ...args];
  }

  doSense(_name: string): unknown {
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

  it("throws when turn does not satisfy runtime interface", () => {
    expect(() => asRuntimeTurn({ doAction() {} } as unknown as ITurn)).toThrow(
      /interface is not available/i,
    );
  });
});
