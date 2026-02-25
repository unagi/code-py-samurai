import { afterEach, describe, expect, it } from "vitest";

import { checkPythonSyntax } from "@runtime/python-syntax-checker";

describe("checkPythonSyntax", () => {
  const origSk = globalThis.Sk;

  afterEach(() => {
    if (origSk === undefined) {
      delete (globalThis as Record<string, unknown>).Sk;
    } else {
      globalThis.Sk = origSk;
    }
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
      parse: () => ({ cst: {}, flags: {} }),
    };
    expect(checkPythonSyntax("x = 1\nprint(x)")).toBeNull();
  });

  it("returns a diagnostic for syntax errors with traceback", () => {
    (globalThis as Record<string, unknown>).Sk = {
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
});
