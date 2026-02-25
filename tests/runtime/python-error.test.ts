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

  it("reports correct user-relative line number for syntax errors (preamble offset)", () => {
    // "self._done = False" at class body level (line 2) is a NameError at compile time.
    // The preamble injected by injectGetattr must be subtracted so the reported line
    // matches the user's source, not the internal combined source.
    const source = "class Player:\n    self._done = False\n    def play_turn(self, samurai):\n        pass";
    try {
      compilePythonPlayer(source);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(PythonSyntaxError);
      const synErr = error as PythonSyntaxError;
      // The error is on user's line 2 — must NOT report a preamble-inflated line number
      expect(synErr.line).toBe(2);
    }
  });

  it("reports line 1 for syntax error on the first line of user code", () => {
    // Invalid token on line 1 — "@@" is not valid Python.
    // "class Player:" is required for injectGetattr, so the error must be
    // within the class body or after a valid class header on line 1.
    const source = "class Player: @@\n    def play_turn(self, samurai):\n        pass";
    try {
      compilePythonPlayer(source);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(PythonSyntaxError);
      const synErr = error as PythonSyntaxError;
      expect(synErr.line).toBe(1);
    }
  });

  it("reports correct line for errors deep in the source", () => {
    // Syntax error on line 5 (missing colon on second method definition)
    const source = [
      "class Player:",
      "    def play_turn(self, samurai):",
      "        samurai.walk()",
      "",
      "    def broken(self)",   // line 5: missing colon
      "        pass",
    ].join("\n");
    try {
      compilePythonPlayer(source);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(PythonSyntaxError);
      const synErr = error as PythonSyntaxError;
      // Should be line 5 or 6 (Skulpt may report next line), but never 20+
      expect(synErr.line).toBeDefined();
      expect(synErr.line!).toBeGreaterThanOrEqual(5);
      expect(synErr.line!).toBeLessThanOrEqual(6);
    }
  });

  it("includes line number in formatted output for compile-time errors", () => {
    const source = "class Player:\n    self.x = 1\n    def play_turn(self, samurai):\n        pass";
    try {
      compilePythonPlayer(source);
      expect.unreachable("should have thrown");
    } catch (error) {
      const formatted = formatPythonError(error);
      expect(formatted).toMatch(/\(line 2\)/);
      expect(formatted).toMatch(/^Python syntax error/);
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
