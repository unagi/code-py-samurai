/**
 * Structured log entry emitted by the game engine.
 * The engine produces these; the UI layer translates them via i18n `t()`.
 */
export interface LogEntry {
  /** i18n key, e.g. "engine.walk", "engine.attackHit" */
  key: string;
  /** Interpolation params for the i18n template */
  params: Record<string, string | number>;
  /** The unitId of the speaking unit (auto-set by BaseUnit.say) */
  unitId?: string;
}
