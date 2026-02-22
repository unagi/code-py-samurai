import { describe, expect, it } from "vitest";

import { runPythonPlayerSource } from "@runtime/python-runner";
import { PythonSyntaxError } from "@runtime/errors";

describe("no default injection", () => {
  it("fails for empty source instead of injecting fallback logic", () => {
    expect(() => runPythonPlayerSource("\n\n  \n")).toThrow(PythonSyntaxError);
  });

  it("does not auto-run an action when source only contains pass", () => {
    const source = `class Player:\n    def play_turn(self, samurai):\n        pass`;

    const { player } = runPythonPlayerSource(source);
    const turn = {
      action: null as [string, ...unknown[]] | null,
      doAction(name: string, ...args: unknown[]) {
        this.action = [name, ...args];
      },
      doSense() {
        return 0;
      },
      hasAction() {
        return true;
      },
      hasSense() {
        return true;
      },
    };

    player.playTurn(turn as never);
    expect(turn.action).toBeNull();
  });
});
