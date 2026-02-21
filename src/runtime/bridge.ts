import type { ITurn } from "@engine/types";
import { toPythonValue } from "./py-builtins";

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
    throw new Error("Runtime turn interface is not available.");
  }
  return candidate as RuntimeTurn;
}

export function callSense(turn: RuntimeTurn, name: string, ...args: unknown[]): unknown {
  const senseName = name === "hp" ? "health" : name;
  return toPythonValue(turn.doSense(senseName, ...args));
}
