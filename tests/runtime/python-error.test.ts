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
    // Missing play_turn method → PythonSyntaxError
    expect(() => compilePythonPlayer("class Player:\n    pass")).toThrow(PythonSyntaxError);

    try {
      compilePythonPlayer("class Player:\n    pass");
    } catch (error) {
      expect(formatPythonError(error)).toMatch(/^Python syntax error:/);
      expect(formatPythonError(error)).toMatch(/play_turn/);
    }
  });

  it("returns runtime error when play_turn references unknown variable", () => {
    const source = `class Player:\n    def play_turn(self, samurai):\n        if hp < 8:\n            samurai.rest()\n        else:\n            samurai.walk()`;

    const player = compilePythonPlayer(source);
    expect(() => player.playTurn(new FakeTurn() as never)).toThrow(PythonRuntimeError);

    try {
      player.playTurn(new FakeTurn() as never);
    } catch (error) {
      // Skulpt error message: "name 'hp' is not defined"
      expect(formatPythonError(error)).toMatch(/hp/);
      expect(formatPythonError(error)).toMatch(/not defined|unknown/i);
      expect(formatPythonError(error)).toMatch(/^Python runtime error:/);
    }
  });

  it("includes line number in formatted syntax error when available", () => {
    const error = new PythonSyntaxError("invalid syntax", 3, 5);
    expect(error.line).toBe(3);
    expect(error.column).toBe(5);
    expect(formatPythonError(error)).toBe("Python syntax error (line 3): invalid syntax");
  });

  it("omits line number when not provided", () => {
    const error = new PythonSyntaxError("unexpected EOF");
    expect(error.line).toBeUndefined();
    expect(formatPythonError(error)).toBe("Python syntax error: unexpected EOF");
  });

  it("formats generic Error and non-Error values", () => {
    expect(formatPythonError(new Error("oops"))).toBe("Python error: oops");
    expect(formatPythonError("oops")).toBe("Python error: oops");
  });
});
