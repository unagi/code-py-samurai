import { describe, expect, it } from "vitest";

import { runPythonPlayerSource } from "@runtime/python-runner";

class FakeTurn {
  action: [string, ...unknown[]] | null = null;

  doAction(name: string, ...args: unknown[]): void {
    this.action = [name, ...args];
  }

  doSense(_name: string, ..._args: unknown[]): unknown {
    return 0;
  }

  hasAction(_name: string): boolean {
    return true;
  }

  hasSense(_name: string): boolean {
    return true;
  }
}

describe("runPythonPlayerSource", () => {
  it("compiles source and returns executable player", () => {
    const source = `class Player:\n    def play_turn(self, warrior):\n        warrior.walk()`;

    const { player } = runPythonPlayerSource(source);
    const turn = new FakeTurn();

    player.playTurn(turn as never);
    expect(turn.action).toEqual(["walk!", "forward"]);
  });
});
