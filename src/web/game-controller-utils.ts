import type { LevelResult } from "@engine/level";

export interface TickOutcomeInput {
  canContinue: boolean;
  result: Pick<LevelResult, "turns" | "passed"> | null;
  currentGlobalLevel: number;
  totalLevels: number;
  maxTurns: number;
}

export interface TickOutcome {
  shouldStop: boolean;
  shouldShowResultModal: boolean;
  shouldAppendTimeoutLog: boolean;
  nextSamuraiLevel: number | null;
}

export function evaluateTickOutcome(input: TickOutcomeInput): TickOutcome {
  const { canContinue, result, currentGlobalLevel, totalLevels, maxTurns } = input;

  if (canContinue && result && result.turns >= maxTurns) {
    return {
      shouldStop: true,
      shouldShowResultModal: true,
      shouldAppendTimeoutLog: true,
      nextSamuraiLevel: null,
    };
  }

  if (!canContinue) {
    return {
      shouldStop: true,
      shouldShowResultModal: true,
      shouldAppendTimeoutLog: false,
      nextSamuraiLevel: result?.passed
        ? Math.min(currentGlobalLevel + 1, totalLevels)
        : null,
    };
  }

  return {
    shouldStop: false,
    shouldShowResultModal: false,
    shouldAppendTimeoutLog: false,
    nextSamuraiLevel: null,
  };
}
