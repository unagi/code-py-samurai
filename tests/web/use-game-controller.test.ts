import { beforeEach, describe, expect, it, vi } from "vitest";

import { level001 } from "../../src/levels/beginner";

type EffectSlot = {
  deps: readonly unknown[] | undefined;
  effect: () => void | (() => void);
  cleanup?: (() => void) | void;
  pending: boolean;
};

const reactHarness = vi.hoisted(() => {
  const stateValues: unknown[] = [];
  const refValues: Array<{ current: unknown }> = [];
  const effectSlots: EffectSlot[] = [];
  let stateCursor = 0;
  let refCursor = 0;
  let effectCursor = 0;

  const sameDeps = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean => {
    if (a === undefined || b === undefined) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return false;
    }
    return true;
  };

  return {
    stateValues,
    refValues,
    effectSlots,
    beginRender(): void {
      stateCursor = 0;
      refCursor = 0;
      effectCursor = 0;
    },
    resetAll(): void {
      stateValues.length = 0;
      refValues.length = 0;
      effectSlots.length = 0;
      stateCursor = 0;
      refCursor = 0;
      effectCursor = 0;
    },
    useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void] {
      const index = stateCursor++;
      if (!(index in stateValues)) {
        stateValues[index] = typeof initial === "function" ? (initial as () => T)() : initial;
      }
      const setState = (value: T | ((prev: T) => T)): void => {
        const prev = stateValues[index] as T;
        stateValues[index] = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
      };
      return [stateValues[index] as T, setState];
    },
    useRef<T>(initial: T): { current: T } {
      const index = refCursor++;
      if (!refValues[index]) {
        refValues[index] = { current: initial };
      }
      return refValues[index] as { current: T };
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void {
      const index = effectCursor++;
      const prev = effectSlots[index];
      const pending = !prev || !sameDeps(prev.deps, deps);
      effectSlots[index] = {
        deps,
        effect,
        cleanup: prev?.cleanup,
        pending,
      };
    },
    flushEffects(): void {
      for (const slot of effectSlots) {
        if (!slot.pending) continue;
        if (typeof slot.cleanup === "function") {
          slot.cleanup();
        }
        slot.cleanup = slot.effect();
        slot.pending = false;
      }
    },
    unmount(): void {
      for (const slot of effectSlots) {
        if (typeof slot.cleanup === "function") {
          slot.cleanup();
        }
      }
    },
  };
});

const depMocks = vi.hoisted(() => {
  class FakeLevelSession {
    board = "@";
    entries: Array<{ key: string; params: Record<string, unknown>; unitId?: string }> = [];
    result: unknown = null;
    samuraiHealth: number | null = 20;
    samuraiMaxHealth: number | null = 20;
    canPlay = true;
    unitSnapshots = [{ unitId: "samurai", x: 0, y: 0, direction: "east" as const }];
    hasSetupError = false;
    hasLastValidPlayer = false;
    stepQueue: boolean[] = [];
    setupCalls: unknown[][] = [];
    resetCalls: unknown[][] = [];

    setup(level: unknown, code: unknown, abilities: unknown): void {
      this.setupCalls.push([level, code, abilities]);
    }

    step(): boolean {
      if (this.stepQueue.length === 0) return false;
      return this.stepQueue.shift() as boolean;
    }

    resetWithLastValid(level: unknown): boolean {
      this.resetCalls.push([level]);
      return true;
    }
  }

  return {
    FakeLevelSession,
    createdSessions: [] as InstanceType<typeof FakeLevelSession>[],
    damagePopupsQueue: [] as unknown[][],
    spriteOverridesQueue: [] as unknown[][],
    outcomesQueue: [] as Array<{
      shouldStop: boolean;
      shouldAppendTimeoutLog: boolean;
      nextSamuraiLevel: number | null;
      shouldShowResultModal: boolean;
    }>,
    damageCalls: [] as unknown[][],
    spriteCalls: [] as unknown[][],
    outcomeCalls: [] as unknown[][],
    unitTileMapCalls: [] as unknown[][],
    unitDirMapCalls: [] as unknown[][],
    reset(): void {
      this.createdSessions.length = 0;
      this.damagePopupsQueue.length = 0;
      this.spriteOverridesQueue.length = 0;
      this.outcomesQueue.length = 0;
      this.damageCalls.length = 0;
      this.spriteCalls.length = 0;
      this.outcomeCalls.length = 0;
      this.unitTileMapCalls.length = 0;
      this.unitDirMapCalls.length = 0;
    },
  };
});

vi.mock("react", () => ({
  useState: reactHarness.useState,
  useRef: reactHarness.useRef,
  useEffect: reactHarness.useEffect,
}));

vi.mock("../../src/runtime/level-session", () => ({
  LevelSession: class MockedLevelSession extends depMocks.FakeLevelSession {
    constructor() {
      super();
      depMocks.createdSessions.push(this);
    }
  },
}));

vi.mock("../../src/web/board-effects", () => ({
  createDamagePopupsFromEntries: (...args: unknown[]) => {
    depMocks.damageCalls.push(args);
    return depMocks.damagePopupsQueue.shift() ?? [];
  },
  createSpriteOverridesFromEntries: (...args: unknown[]) => {
    depMocks.spriteCalls.push(args);
    return depMocks.spriteOverridesQueue.shift() ?? [];
  },
}));

vi.mock("../../src/web/game-controller-utils", () => ({
  evaluateTickOutcome: (...args: unknown[]) => {
    depMocks.outcomeCalls.push(args);
    return depMocks.outcomesQueue.shift() ?? {
      shouldStop: false,
      shouldAppendTimeoutLog: false,
      nextSamuraiLevel: null,
      shouldShowResultModal: false,
    };
  },
}));

vi.mock("../../src/web/unit-maps", () => ({
  buildUnitTileIndexMap: (...args: unknown[]) => {
    depMocks.unitTileMapCalls.push(args);
    return new Map([["samurai", 10]]);
  },
  buildUnitDirectionMap: (...args: unknown[]) => {
    depMocks.unitDirMapCalls.push(args);
    return new Map([["samurai", "east"]]);
  },
}));

import { useGameController } from "../../src/web/use-game-controller";

function renderHook(
  overrides: Partial<Parameters<typeof useGameController>[0]> = {},
): ReturnType<typeof useGameController> {
  reactHarness.beginRender();
  return useGameController({
    level: level001,
    playerCode: "class Player:\n    def play_turn(self, samurai):\n        pass",
    unlockedEngineAbilities: [],
    currentGlobalLevel: 1,
    totalLevels: 9,
    speedMs: 450,
    spriteCapableKinds: new Set(["samurai", "sludge"]),
    setSamuraiLevel: () => {},
    ...overrides,
  });
}

describe("useGameController", () => {
  beforeEach(() => {
    reactHarness.resetAll();
    depMocks.reset();
    vi.restoreAllMocks();
  });

  it("starts the level on mount and drives play/pause/tick state transitions", () => {
    const onResetVisualState = vi.fn();
    const setSamuraiLevel = vi.fn();
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval").mockImplementation(((
      cb: TimerHandler,
    ) => {
      (globalThis as unknown as { __tick?: () => void }).__tick = cb as () => void;
      return 123 as unknown as ReturnType<typeof globalThis.setInterval>;
    }) as unknown as typeof globalThis.setInterval);
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);

    depMocks.damagePopupsQueue.push(
      [
        { id: 1, tileIndex: 10, text: "-1", expiresAt: 100 },
        { id: 2, tileIndex: 11, text: "-2", expiresAt: 9999 },
      ],
      [],
    );
    depMocks.spriteOverridesQueue.push(
      [
        { id: 3, tileIndex: 10, kind: "sludge", state: "attack", startedAt: 0, expiresAt: 100 },
        { id: 4, tileIndex: 11, kind: "sludge", state: "damaged", startedAt: 0, expiresAt: 9999 },
      ],
      [],
    );
    depMocks.outcomesQueue.push(
      {
        shouldStop: false,
        shouldAppendTimeoutLog: false,
        nextSamuraiLevel: null,
        shouldShowResultModal: false,
      },
      {
        shouldStop: true,
        shouldAppendTimeoutLog: true,
        nextSamuraiLevel: 4,
        shouldShowResultModal: true,
      },
    );

    let result = renderHook({ onResetVisualState, setSamuraiLevel });
    const session = reactHarness.refValues[0]?.current as InstanceType<typeof depMocks.FakeLevelSession>;
    expect(session).toBeTruthy();
    session.board = "@s";
    session.entries = [{ key: "engine.start", params: {} }];
    session.stepQueue = [true, false];

    reactHarness.flushEffects();
    result = renderHook({ onResetVisualState, setSamuraiLevel });

    expect(onResetVisualState).toHaveBeenCalled();
    expect(session.setupCalls).toHaveLength(1);
    expect(depMocks.damageCalls.length).toBeGreaterThan(0);
    expect(depMocks.unitTileMapCalls.length).toBeGreaterThan(0);
    expect(result.damagePopups).toHaveLength(2);
    expect(result.spriteOverrides).toHaveLength(2);

    vi.spyOn(Date, "now").mockReturnValue(500);
    result.expireDamagePopups();
    result.expireSpriteOverrides();
    result = renderHook({ onResetVisualState, setSamuraiLevel });
    expect(result.damagePopups).toHaveLength(1);
    expect(result.spriteOverrides).toHaveLength(1);

    result.handlePause();
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    result.handlePlay();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    result.handlePlay();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    session.entries = [];
    (globalThis as unknown as { __tick: () => void }).__tick();
    result = renderHook({ onResetVisualState, setSamuraiLevel });
    expect(result.showResultModal).toBe(false);

    session.result = { passed: true, turns: 3, totalScore: 10, timeBonus: 0, grade: "A" };
    session.entries = [{ key: "engine.done", params: {} }];
    (globalThis as unknown as { __tick: () => void }).__tick();
    result = renderHook({ onResetVisualState, setSamuraiLevel });

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(setSamuraiLevel).toHaveBeenCalled();
    expect(result.showResultModal).toBe(true);
    expect(result.logEntries.some((entry) => entry.key === "logs.systemTimeout")).toBe(true);

    reactHarness.unmount();
  });

  it("uses resetWithLastValid on reset when setup error exists and a fallback player is available", () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);

    let result = renderHook();
    const session = reactHarness.refValues[0]?.current as InstanceType<typeof depMocks.FakeLevelSession>;
    session.board = "@";
    reactHarness.flushEffects();
    result = renderHook();

    session.hasSetupError = true;
    session.hasLastValidPlayer = true;

    result.handleReset();
    result = renderHook();

    expect(session.resetCalls).toHaveLength(1);
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    expect(result.isCodeDirty).toBe(false);
  });

  it("restarts the level on normal reset and on setup error without a fallback player", () => {
    let result = renderHook();
    const session = reactHarness.refValues[0]?.current as InstanceType<typeof depMocks.FakeLevelSession>;
    session.board = "@";
    reactHarness.flushEffects();
    result = renderHook();

    const setupCallsAfterMount = session.setupCalls.length;
    result.handleReset();
    expect(session.setupCalls.length).toBe(setupCallsAfterMount + 1);

    session.hasSetupError = true;
    session.hasLastValidPlayer = false;
    result.handleReset();
    expect(session.resetCalls).toHaveLength(0);
    expect(session.setupCalls.length).toBe(setupCallsAfterMount + 2);
  });

  it("stops without timeout/unlock/modal side effects when stop outcome flags are false", () => {
    const setSamuraiLevel = vi.fn();
    vi.spyOn(globalThis, "setInterval").mockImplementation(((
      cb: TimerHandler,
    ) => {
      (globalThis as unknown as { __tick?: () => void }).__tick = cb as () => void;
      return 789 as unknown as ReturnType<typeof globalThis.setInterval>;
    }) as unknown as typeof globalThis.setInterval);
    vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);

    depMocks.outcomesQueue.push({
      shouldStop: true,
      shouldAppendTimeoutLog: false,
      nextSamuraiLevel: null,
      shouldShowResultModal: false,
    });

    let result = renderHook({ setSamuraiLevel });
    const session = reactHarness.refValues[0]?.current as InstanceType<typeof depMocks.FakeLevelSession>;
    session.board = "@";
    session.entries = [{ key: "engine.tick", params: {} }];
    session.stepQueue = [false];

    reactHarness.flushEffects();
    result = renderHook({ setSamuraiLevel });
    result.handlePlay();
    (globalThis as unknown as { __tick: () => void }).__tick();
    result = renderHook({ setSamuraiLevel });

    expect(result.showResultModal).toBe(false);
    expect(result.logEntries.some((entry) => entry.key === "logs.systemTimeout")).toBe(false);
    expect(setSamuraiLevel).not.toHaveBeenCalled();
  });

  it("does not start playback when the refreshed session cannot play", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval").mockImplementation(((
      cb: TimerHandler,
    ) => {
      (globalThis as unknown as { __tick?: () => void }).__tick = cb as () => void;
      return 456 as unknown as ReturnType<typeof globalThis.setInterval>;
    }) as unknown as typeof globalThis.setInterval);

    let result = renderHook();
    const session = reactHarness.refValues[0]?.current as InstanceType<typeof depMocks.FakeLevelSession>;
    session.canPlay = false;
    reactHarness.flushEffects();
    result = renderHook();

    result.handlePlay();
    expect(setIntervalSpy).not.toHaveBeenCalled();

    result.setIsCodeDirty(true);
    result = renderHook();
    result.handlePlay();
    expect(session.setupCalls.length).toBeGreaterThanOrEqual(2);
  });
});
