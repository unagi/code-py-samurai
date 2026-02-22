import type { ITurn } from "@engine/types";

export interface RuntimeTurn extends ITurn {
  doAction(name: string, ...args: unknown[]): void;
  doSense(name: string, ...args: unknown[]): unknown;
  hasAction(name: string): boolean;
  hasSense(name: string): boolean;
}

export function asRuntimeTurn(turn: ITurn): RuntimeTurn {
  const candidate = turn as Partial<RuntimeTurn>;
  if (
    typeof candidate.doAction !== "function" ||
    typeof candidate.doSense !== "function" ||
    typeof candidate.hasAction !== "function" ||
    typeof candidate.hasSense !== "function"
  ) {
    throw new TypeError("Runtime turn interface is not available.");
  }
  return candidate as RuntimeTurn;
}
