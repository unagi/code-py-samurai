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
  it("returns None(null) for empty non-stairs space", () => {
    expect(toPythonValue(new CamelSpace())).toBeNull();
  });

  it("wraps non-empty space to snake_case methods", () => {
    class EnemySpace extends CamelSpace {
      override isEmpty(): boolean {
        return false;
      }

      override isEnemy(): boolean {
        return true;
      }
    }

    const wrapped = toPythonValue(new EnemySpace()) as { is_enemy: () => boolean };
    expect(wrapped.is_enemy()).toBe(true);
  });

  it("maps stairs to None(null) as passable empty space", () => {
    class StairsSpace extends CamelSpace {
      override isStairs(): boolean {
        return true;
      }
    }

    expect(toPythonValue(new StairsSpace())).toBeNull();
  });

  it("wraps arrays recursively", () => {
    class OccupiedSpace extends CamelSpace {
      override isEmpty(): boolean {
        return false;
      }
    }

    const wrapped = toPythonValue([new CamelSpace(), new OccupiedSpace()]) as Array<
      null | { is_enemy: () => boolean }
    >;

    expect(wrapped).toHaveLength(2);
    expect(wrapped[0]).toBeNull();
    expect((wrapped[1] as { is_enemy: () => boolean }).is_enemy()).toBe(false);
  });

  it("supports snake_case space methods", () => {
    const snakeSpace = {
      is_empty: () => false,
      is_enemy: () => true,
      is_captive: () => false,
      is_stairs: () => false,
      is_wall: () => true,
    };

    const wrapped = toPythonValue(snakeSpace) as {
      is_enemy: () => boolean;
      is_wall: () => boolean;
    };
    expect(wrapped.is_enemy()).toBe(true);
    expect(wrapped.is_wall()).toBe(true);
  });

  it("throws when wrapped space misses predicate implementation", () => {
    const broken = {
      isEmpty: () => false,
    };
    const wrapped = toPythonValue(broken) as { is_enemy: () => boolean };
    expect(() => wrapped.is_enemy()).toThrow(/not available/i);
  });

  it("returns primitive values unchanged", () => {
    expect(toPythonValue(123)).toBe(123);
    expect(toPythonValue("abc")).toBe("abc");
    expect(toPythonValue(false)).toBe(false);
  });
});
