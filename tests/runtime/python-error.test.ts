import { describe, expect, it } from "vitest";

import { compilePythonPlayer } from "@runtime/python-player";
import { PythonRuntimeError, PythonSyntaxError, formatPythonError } from "@runtime/errors";

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

describe("python error handling", () => {
  it("returns syntax error for invalid source", () => {
    expect(() => compilePythonPlayer("class Player:\n    pass")).toThrow(PythonSyntaxError);

    try {
      compilePythonPlayer("class Player:\n    pass");
    } catch (error) {
      expect(formatPythonError(error)).toMatch(/^Python syntax error:/);
    }
  });

  it("returns runtime error when play_turn references unknown variable", () => {
    const source = `class Player:\n    def play_turn(self, warrior):\n        if hp < 8:\n            warrior.rest()\n        else:\n            warrior.walk()`;

    const player = compilePythonPlayer(source);
    expect(() => player.playTurn(new FakeTurn() as never)).toThrow(PythonRuntimeError);

    try {
      player.playTurn(new FakeTurn() as never);
    } catch (error) {
      expect(formatPythonError(error)).toContain("Unknown variable: hp");
      expect(formatPythonError(error)).toMatch(/^Python runtime error:/);
    }
  });
});
