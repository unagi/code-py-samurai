import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";

import type { LevelResult } from "@engine/level";
import type { LogEntry } from "@engine/log-entry";
import type { LevelDefinition } from "@engine/types";
import { LevelSession } from "../runtime/level-session";

import { createDamagePopupsFromEntries, createSpriteOverridesFromEntries, type DamagePopup, type SpriteOverride } from "./board-effects";
import { evaluateTickOutcome } from "./game-controller-utils";
import { buildUnitDirectionMap, buildUnitTileIndexMap } from "./unit-maps";

const UI_MAX_TURNS = 1000;

export interface UseGameControllerParams {
  level: LevelDefinition;
  playerCode: string;
  unlockedEngineAbilities: string[];
  currentGlobalLevel: number;
  totalLevels: number;
  speedMs: number;
  spriteCapableKinds: ReadonlySet<string>;
  setSamuraiLevel: Dispatch<SetStateAction<number>>;
  onResetVisualState?: () => void;
}

export interface UseGameControllerResult {
  isPlaying: boolean;
  canPlay: boolean;
  board: string;
  logEntries: LogEntry[];
  result: LevelResult | null;
  samuraiHealth: number | null;
  samuraiMaxHealth: number | null;
  damagePopups: DamagePopup[];
  spriteOverrides: SpriteOverride[];
  showResultModal: boolean;
  isCodeDirty: boolean;
  setIsCodeDirty: Dispatch<SetStateAction<boolean>>;
  setShowResultModal: Dispatch<SetStateAction<boolean>>;
  handlePlay: () => void;
  handlePause: () => void;
  handleReset: () => void;
  startLevel: () => boolean;
  stopTimer: () => void;
  expireDamagePopups: () => void;
  expireSpriteOverrides: () => void;
  unitTileIndexMapRef: RefObject<Map<string, number>>;
  unitDirectionMapRef: RefObject<Map<string, string>>;
}

export function useGameController(params: UseGameControllerParams): UseGameControllerResult {
  const {
    level,
    playerCode,
    unlockedEngineAbilities,
    currentGlobalLevel,
    totalLevels,
    speedMs,
    spriteCapableKinds,
    setSamuraiLevel,
    onResetVisualState,
  } = params;

  const [isPlaying, setIsPlaying] = useState(false);
  const [canPlay, setCanPlay] = useState(true);
  const [board, setBoard] = useState("");
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<LevelResult | null>(null);
  const [samuraiHealth, setSamuraiHealth] = useState<number | null>(null);
  const [samuraiMaxHealth, setSamuraiMaxHealth] = useState<number | null>(null);
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
  const [spriteOverrides, setSpriteOverrides] = useState<SpriteOverride[]>([]);
  const [showResultModal, setShowResultModal] = useState(false);
  const [isCodeDirty, setIsCodeDirty] = useState(false);

  const sessionRef = useRef(new LevelSession());
  const timerRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null);
  const logLineCountRef = useRef(0);
  const damagePopupIdRef = useRef(1);
  const unitTileIndexMapRef = useRef(new Map<string, number>());
  const unitDirectionMapRef = useRef(new Map<string, string>());
  const spriteOverrideIdRef = useRef(1);

  const refreshGameState = (): void => {
    const session = sessionRef.current;
    const nextBoard = session.board;
    const allEntries = session.entries;
    const prevCount = allEntries.length < logLineCountRef.current ? 0 : logLineCountRef.current;
    const newEntries = allEntries.slice(prevCount);
    logLineCountRef.current = allEntries.length;

    const boardForDamage = board.trim().length > 0 ? board : nextBoard;
    const popups = createDamagePopupsFromEntries(
      newEntries,
      boardForDamage,
      damagePopupIdRef.current,
      unitTileIndexMapRef.current,
    );
    damagePopupIdRef.current += popups.length;
    setDamagePopups(popups);

    const overrides = createSpriteOverridesFromEntries(
      newEntries,
      boardForDamage,
      spriteOverrideIdRef.current,
      unitTileIndexMapRef.current,
      spriteCapableKinds,
    );
    spriteOverrideIdRef.current += overrides.length;
    if (overrides.length > 0) {
      setSpriteOverrides((prev) => [...prev, ...overrides]);
    }

    setBoard(nextBoard);
    setLogEntries([...allEntries]);
    setResult(session.result);
    setSamuraiHealth(session.samuraiHealth);
    setSamuraiMaxHealth(session.samuraiMaxHealth);
    setCanPlay(session.canPlay);
    const unitSnapshots = session.unitSnapshots;
    unitTileIndexMapRef.current = buildUnitTileIndexMap(nextBoard, unitSnapshots);
    unitDirectionMapRef.current = buildUnitDirectionMap(unitSnapshots);
  };

  const stopTimer = (): void => {
    if (timerRef.current !== null) {
      globalThis.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  };

  const startLevel = (): boolean => {
    stopTimer();
    setShowResultModal(false);
    onResetVisualState?.();
    logLineCountRef.current = 0;
    unitTileIndexMapRef.current = new Map<string, number>();
    unitDirectionMapRef.current = new Map<string, string>();
    setDamagePopups([]);
    setSpriteOverrides([]);
    sessionRef.current.setup(level, playerCode, unlockedEngineAbilities);
    refreshGameState();
    setIsCodeDirty(false);
    return sessionRef.current.canPlay;
  };

  const handleTick = (): void => {
    const canContinue = sessionRef.current.step();
    const currentResult = sessionRef.current.result;
    refreshGameState();

    const outcome = evaluateTickOutcome({
      canContinue,
      result: currentResult,
      currentGlobalLevel,
      totalLevels,
      maxTurns: UI_MAX_TURNS,
    });

    if (!outcome.shouldStop) return;

    stopTimer();

    if (outcome.shouldAppendTimeoutLog) {
      setLogEntries((prev) => [...prev, { key: "logs.systemTimeout", params: { maxTurns: UI_MAX_TURNS } }]);
    }

    const nextSamuraiLevel = outcome.nextSamuraiLevel;
    if (nextSamuraiLevel !== null) {
      setSamuraiLevel((prev) => Math.max(prev, nextSamuraiLevel));
    }

    if (outcome.shouldShowResultModal) {
      setShowResultModal(true);
    }
  };

  const handlePlay = (): void => {
    if (timerRef.current !== null) return;
    const playable = isCodeDirty ? startLevel() : canPlay;
    if (!playable) return;
    setIsPlaying(true);
    timerRef.current = globalThis.setInterval(handleTick, speedMs);
  };

  const handlePause = (): void => {
    stopTimer();
  };

  const handleReset = (): void => {
    stopTimer();
    setShowResultModal(false);
    onResetVisualState?.();
    logLineCountRef.current = 0;
    unitTileIndexMapRef.current = new Map<string, number>();
    unitDirectionMapRef.current = new Map<string, string>();
    setDamagePopups([]);
    setSpriteOverrides([]);
    const session = sessionRef.current;
    if (!isCodeDirty && session.hasLastValidPlayer) {
      // Code unchanged – restart with last valid player, skip re-compile.
      session.resetWithLastValid(level);
    } else {
      // Code changed or no valid player yet – re-compile.
      session.setup(level, playerCode, unlockedEngineAbilities);
      setIsCodeDirty(false);
    }
    refreshGameState();
  };

  const expireDamagePopups = (): void => {
    const now = Date.now();
    setDamagePopups((prev) => prev.filter((p) => p.expiresAt > now));
  };

  const expireSpriteOverrides = (): void => {
    const now = Date.now();
    setSpriteOverrides((prev) => prev.filter((o) => o.expiresAt > now));
  };

  useEffect(() => {
    startLevel();
  }, [level]);

  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, []);

  return {
    isPlaying,
    canPlay,
    board,
    logEntries,
    result,
    samuraiHealth,
    samuraiMaxHealth,
    damagePopups,
    spriteOverrides,
    showResultModal,
    isCodeDirty,
    setIsCodeDirty,
    setShowResultModal,
    handlePlay,
    handlePause,
    handleReset,
    startLevel,
    stopTimer,
    expireDamagePopups,
    expireSpriteOverrides,
    unitTileIndexMapRef,
    unitDirectionMapRef,
  };
}
