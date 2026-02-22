import { describe, expect, it } from "vitest";

import { evaluateTickOutcome } from "../../src/web/game-controller-utils";

describe("evaluateTickOutcome", () => {
  it("stops with timeout when turn count reaches UI max while still continuable", () => {
    const outcome = evaluateTickOutcome({
      canContinue: true,
      result: { turns: 1000, passed: false } as never,
      currentGlobalLevel: 3,
      totalLevels: 18,
      maxTurns: 1000,
    });

    expect(outcome).toEqual({
      shouldStop: true,
      shouldShowResultModal: true,
      shouldAppendTimeoutLog: true,
      nextSamuraiLevel: null,
    });
  });

  it("unlocks next level when run finishes with a pass", () => {
    const outcome = evaluateTickOutcome({
      canContinue: false,
      result: { turns: 12, passed: true } as never,
      currentGlobalLevel: 5,
      totalLevels: 18,
      maxTurns: 1000,
    });

    expect(outcome).toEqual({
      shouldStop: true,
      shouldShowResultModal: true,
      shouldAppendTimeoutLog: false,
      nextSamuraiLevel: 6,
    });
  });

  it("stops without unlock on failure", () => {
    const outcome = evaluateTickOutcome({
      canContinue: false,
      result: { turns: 12, passed: false } as never,
      currentGlobalLevel: 5,
      totalLevels: 18,
      maxTurns: 1000,
    });

    expect(outcome.nextSamuraiLevel).toBeNull();
    expect(outcome.shouldAppendTimeoutLog).toBe(false);
    expect(outcome.shouldStop).toBe(true);
    expect(outcome.shouldShowResultModal).toBe(true);
  });

  it("continues normally when still under max turns", () => {
    const outcome = evaluateTickOutcome({
      canContinue: true,
      result: { turns: 10, passed: false } as never,
      currentGlobalLevel: 1,
      totalLevels: 18,
      maxTurns: 1000,
    });

    expect(outcome).toEqual({
      shouldStop: false,
      shouldShowResultModal: false,
      shouldAppendTimeoutLog: false,
      nextSamuraiLevel: null,
    });
  });
});
