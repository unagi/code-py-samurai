import { afterEach, describe, expect, it } from "vitest";

import { checkPythonSyntax, _resetParseReady } from "@runtime/python-syntax-checker";

/* ================================================================
 * Unit tests — mock Sk to verify offset calculation logic
 * ================================================================ */

describe("checkPythonSyntax (unit)", () => {
  const origSk = globalThis.Sk;

  afterEach(() => {
    if (origSk === undefined) {
      delete (globalThis as Record<string, unknown>).Sk;
    } else {
      globalThis.Sk = origSk;
    }
    _resetParseReady();
  });

  it("returns null for empty source", () => {
    expect(checkPythonSyntax("")).toBeNull();
    expect(checkPythonSyntax("   \n  ")).toBeNull();
  });

  it("returns null when Sk is not loaded", () => {
    delete (globalThis as Record<string, unknown>).Sk;
    expect(checkPythonSyntax("print('hello')")).toBeNull();
  });

  it("returns null for valid Python source", () => {
    (globalThis as Record<string, unknown>).Sk = {
      configure: () => {},
      python3: {},
      parse: () => ({ cst: {}, flags: {} }),
    };
    expect(checkPythonSyntax("x = 1\nprint(x)")).toBeNull();
  });

  it("returns a diagnostic for syntax errors with traceback", () => {
    (globalThis as Record<string, unknown>).Sk = {
      configure: () => {},
      python3: {},
      parse: () => {
        const err = new Error("bad token") as Error & Record<string, unknown>;
        err.args = { v: [{ v: "invalid syntax" }] };
        err.traceback = [{ lineno: 2, colno: 4 }];
        throw err;
      },
    };

    const source = "x = 1\n    y = 2";
    const result = checkPythonSyntax(source);
    expect(result).not.toBeNull();
    expect(result!.message).toBe("invalid syntax");
    expect(result!.line).toBe(2);
    // from should point to line 2 col 4
    expect(result!.from).toBe(10); // "x = 1\n" (6 chars) + 4 = 10
    expect(result!.to).toBeGreaterThan(result!.from);
  });

  it("returns a diagnostic for syntax errors without column info", () => {
    (globalThis as Record<string, unknown>).Sk = {
      configure: () => {},
      python3: {},
      parse: () => {
        const err = new Error("unexpected EOF") as Error & Record<string, unknown>;
        err.args = { v: [{ v: "unexpected EOF while parsing" }] };
        err.traceback = [{ lineno: 1 }];
        throw err;
      },
    };

    const source = "def foo(";
    const result = checkPythonSyntax(source);
    expect(result).not.toBeNull();
    expect(result!.message).toBe("unexpected EOF while parsing");
    expect(result!.line).toBe(1);
    expect(result!.from).toBe(0);
    // to should be end of line 1
    expect(result!.to).toBe(source.length);
  });

  it("returns a diagnostic for errors without traceback", () => {
    (globalThis as Record<string, unknown>).Sk = {
      configure: () => {},
      python3: {},
      parse: () => {
        throw new Error("parse failed");
      },
    };

    const result = checkPythonSyntax("class:");
    expect(result).not.toBeNull();
    expect(result!.message).toBe("parse failed");
    expect(result!.line).toBe(1);
  });

  it("clamps offsets to source length", () => {
    (globalThis as Record<string, unknown>).Sk = {
      configure: () => {},
      python3: {},
      parse: () => {
        const err = new Error("err") as Error & Record<string, unknown>;
        err.args = { v: [{ v: "err" }] };
        err.traceback = [{ lineno: 99, colno: 50 }];
        throw err;
      },
    };

    const source = "x = 1";
    const result = checkPythonSyntax(source);
    expect(result).not.toBeNull();
    expect(result!.from).toBeLessThanOrEqual(source.length);
    expect(result!.to).toBeLessThanOrEqual(source.length);
  });

  it("returns null when Sk.configure throws (graceful degradation)", () => {
    (globalThis as Record<string, unknown>).Sk = {
      configure: () => { throw new Error("not ready"); },
      python3: undefined,
    };
    expect(checkPythonSyntax("x = 1")).toBeNull();
  });
});

/* ================================================================
 * Integration tests — real Skulpt (loaded by tests/setup-skulpt.ts)
 * ================================================================ */

describe("checkPythonSyntax (integration with Skulpt)", () => {
  afterEach(() => {
    _resetParseReady();
  });

  it("returns null for syntactically valid code", () => {
    expect(checkPythonSyntax("x = 1")).toBeNull();
    expect(checkPythonSyntax("def foo():\n    pass")).toBeNull();
    expect(checkPythonSyntax("class Foo:\n    def bar(self):\n        return 1")).toBeNull();
    // Single-line if statement is valid Python
    expect(checkPythonSyntax("if True: pass")).toBeNull();
  });

  it("detects unclosed parenthesis", () => {
    const result = checkPythonSyntax("print(1");
    expect(result).not.toBeNull();
    expect(result!.line).toBeGreaterThanOrEqual(1);
  });

  it("detects invalid token (bare colon)", () => {
    const result = checkPythonSyntax("class:");
    expect(result).not.toBeNull();
  });

  it("detects missing colon after def", () => {
    const source = [
      "class Player:",
      "    def play_turn(self, samurai):",
      "        samurai.walk()",
      "    def broken(self)",       // missing colon
      "        pass",
    ].join("\n");
    const result = checkPythonSyntax(source);
    expect(result).not.toBeNull();
    // Error should NOT be on lines 1-3 (those are valid)
    expect(result!.line).toBeGreaterThanOrEqual(4);
  });

  it("reports from/to offsets within the source range", () => {
    const source = "x = 1\ny = (\nz = 3";
    const result = checkPythonSyntax(source);
    expect(result).not.toBeNull();
    expect(result!.from).toBeGreaterThanOrEqual(0);
    expect(result!.from).toBeLessThanOrEqual(source.length);
    expect(result!.to).toBeGreaterThanOrEqual(result!.from);
    expect(result!.to).toBeLessThanOrEqual(source.length);
  });

  it("returns a non-empty message for any detected error", () => {
    const cases = ["def:", "class Foo(\n    pass", "if True\n    pass"];
    for (const src of cases) {
      const result = checkPythonSyntax(src);
      expect(result).not.toBeNull();
      expect(result!.message.length).toBeGreaterThan(0);
    }
  });
});
