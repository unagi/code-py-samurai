import { describe, expect, it } from "vitest";

import { toPythonValue } from "@runtime/py-builtins";

class CamelSpace {
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

describe("toPythonValue", () => {
  it("wraps camelCase Space-like object to snake_case methods", () => {
    const wrapped = toPythonValue(new CamelSpace()) as {
      is_empty: () => boolean;
      is_enemy: () => boolean;
    };

    expect(wrapped.is_empty()).toBe(true);
    expect(wrapped.is_enemy()).toBe(false);
  });

  it("wraps arrays recursively", () => {
    const wrapped = toPythonValue([new CamelSpace(), new CamelSpace()]) as Array<{
      is_empty: () => boolean;
    }>;

    expect(wrapped).toHaveLength(2);
    expect(wrapped[0].is_empty()).toBe(true);
    expect(wrapped[1].is_empty()).toBe(true);
  });
});
