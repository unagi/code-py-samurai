import type { AbsoluteDirection } from "@engine/direction";
import { Level, type LevelResult } from "@engine/level";
import type { LogEntry } from "@engine/log-entry";
import type { ILogger, IPlayer, LevelDefinition } from "@engine/types";

import { formatPythonError } from "./errors";
import { runPythonPlayerSource } from "./python-runner";

class MemoryLogger implements ILogger {
  entries: LogEntry[] = [];

  log(entry: LogEntry): void {
    this.entries.push(entry);
  }

  clear(): void {
    this.entries = [];
  }
}

export interface LevelSessionUnitSnapshot {
  unitId: string;
  x: number;
  y: number;
  direction: AbsoluteDirection;
}

export class LevelSession {
  private _logger = new MemoryLogger();
  private _level: Level | null = null;
  private _setupError: string | null = null;
  private _runtimeError: string | null = null;
  private _fallbackBoard = "";
  private _lastValidPlayer: IPlayer | null = null;
  private readonly _fallbackMessageKey = "logs.systemFallback";

  private buildFallbackBoard(levelDef: LevelDefinition): string {
    const previewPlayer: IPlayer = {
      playTurn: () => {},
    };
    const previewLevel = new Level(levelDef);
    previewLevel.setup(previewPlayer, []);
    return previewLevel.floor.character();
  }

  setup(levelDef: LevelDefinition, playerCode: string, existingAbilities: string[] = []): void {
    this._logger.clear();
    this._setupError = null;
    this._runtimeError = null;
    this._fallbackBoard = this.buildFallbackBoard(levelDef);
    try {
      const { player } = runPythonPlayerSource(playerCode);
      this._lastValidPlayer = player;
      this._level = new Level(levelDef, this._logger);
      this._level.setup(player, existingAbilities);
    } catch (error) {
      this._setupError = formatPythonError(error);
      this._logger.log({ key: "logs.pythonError", params: { message: this._setupError } });
      if (this._lastValidPlayer) {
        this._logger.log({ key: this._fallbackMessageKey, params: {} });
        this._level = new Level(levelDef, this._logger);
        this._level.setup(this._lastValidPlayer, []);
      } else {
        this._level = null;
      }
    }
  }

  resetWithLastValid(levelDef: LevelDefinition): boolean {
    if (!this._lastValidPlayer) return false;
    this._logger.clear();
    this._setupError = null;
    this._runtimeError = null;
    this._fallbackBoard = this.buildFallbackBoard(levelDef);
    this._level = new Level(levelDef, this._logger);
    this._level.setup(this._lastValidPlayer, []);
    return true;
  }

  step(): boolean {
    if (!this._level) return false;
    try {
      return this._level.step();
    } catch (error) {
      this._runtimeError = formatPythonError(error);
      this._logger.log({ key: "logs.pythonError", params: { message: this._runtimeError } });
      return false;
    }
  }

  get board(): string {
    if (!this._level) return this._fallbackBoard;
    return this._level.floor.character();
  }

  get entries(): readonly LogEntry[] {
    return this._logger.entries;
  }

  get result(): LevelResult | null {
    if (!this._level) return null;
    return this._level.result();
  }

  get samuraiHealth(): number | null {
    if (!this._level) return null;
    return this._level.samurai.health;
  }

  get samuraiMaxHealth(): number | null {
    if (!this._level) return null;
    return this._level.samurai.maxHealth;
  }

  get unitSnapshots(): readonly LevelSessionUnitSnapshot[] {
    if (!this._level) return [];

    const snapshots: LevelSessionUnitSnapshot[] = [];
    for (const unit of this._level.floor.units) {
      const candidate = unit as unknown as {
        unitId?: string;
        position: { x: number; y: number; direction: AbsoluteDirection } | null;
      };
      if (typeof candidate.unitId !== "string" || !candidate.position) continue;
      snapshots.push({
        unitId: candidate.unitId.toLowerCase(),
        x: candidate.position.x,
        y: candidate.position.y,
        direction: candidate.position.direction,
      });
    }
    return snapshots;
  }

  get canPlay(): boolean {
    return this._level !== null && this._setupError === null && this._runtimeError === null;
  }

  get hasSetupError(): boolean {
    return this._setupError !== null;
  }

  get hasLastValidPlayer(): boolean {
    return this._lastValidPlayer !== null;
  }
}
