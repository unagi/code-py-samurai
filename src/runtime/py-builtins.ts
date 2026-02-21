function callBoolMethod(target: Record<string, unknown>, snake: string, camel: string): boolean {
  const snakeFn = target[snake];
  if (typeof snakeFn === "function") {
    return Boolean((snakeFn as () => unknown).call(target));
  }
  const camelFn = target[camel];
  if (typeof camelFn === "function") {
    return Boolean((camelFn as () => unknown).call(target));
  }
  throw new TypeError(`Space method ${snake}/${camel} is not available.`);
}

export interface PythonSpace {
  is_enemy(): boolean;
  is_captive(): boolean;
  is_stairs(): boolean;
  is_wall(): boolean;
}

export function wrapSpace(value: unknown): PythonSpace {
  const target = value as Record<string, unknown>;
  return {
    is_enemy: () => callBoolMethod(target, "is_enemy", "isEnemy"),
    is_captive: () => callBoolMethod(target, "is_captive", "isCaptive"),
    is_stairs: () => callBoolMethod(target, "is_stairs", "isStairs"),
    is_wall: () => callBoolMethod(target, "is_wall", "isWall"),
  };
}

function looksLikeSpace(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const target = value as Record<string, unknown>;
  return (
    typeof target.isEmpty === "function" ||
    typeof target.is_empty === "function"
  );
}

export function toPythonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => toPythonValue(item));
  }
  if (looksLikeSpace(value)) {
    const target = value as Record<string, unknown>;
    const isEmpty = callBoolMethod(target, "is_empty", "isEmpty");
    if (isEmpty) {
      return null;
    }
    return wrapSpace(value);
  }
  return value;
}
