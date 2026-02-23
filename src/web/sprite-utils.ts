export type SpriteDir = "left" | "right";

function mixUint32(seed: number): number {
  let value = Math.trunc(seed) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0;
}

/** pathTemplate 内の {dir} を実際の方向に置換 */
export function resolveSpriteDir(template: string, dir: SpriteDir): string {
  return template.replace("{dir}", dir);
}

/** AbsoluteDirection (engine) → スプライト左右 */
export function absoluteDirToSpriteDir(absDir: string): SpriteDir {
  // east / north → right,  west / south → left
  return absDir === "west" || absDir === "south" ? "left" : "right";
}

/** 等間隔フレーム遷移の現在フレームを返す */
export function computeSpriteFrameIndex(
  elapsedMs: number,
  frames: number,
  frameMs: number,
  loop: boolean,
): number {
  if (frames <= 1) return 0;
  const safeElapsedMs = Math.max(0, elapsedMs);
  const advancedFrames = Math.floor(safeElapsedMs / Math.max(1, frameMs));
  if (loop) {
    return advancedFrames % frames;
  }
  return Math.min(advancedFrames, frames - 1);
}

/** seed から決定的な位相オフセット(ms)を返す（再描画ごとに揺れない） */
export function computeDeterministicAnimationOffsetMs(seed: number, cycleMs: number): number {
  const safeCycleMs = Math.floor(cycleMs);
  if (safeCycleMs <= 0) return 0;
  return mixUint32(seed) % safeCycleMs;
}

/** seed から決定的な周期ゆらぎ(ms)を返す。速度差は固定され、再描画ごとに揺れない。 */
export function computeDeterministicJitteredCycleMs(
  seed: number,
  baseCycleMs: number,
  jitterRatio: number,
): number {
  const safeBaseCycleMs = Math.max(1, Math.floor(baseCycleMs));
  const safeJitterRatio = Number.isFinite(jitterRatio)
    ? Math.min(0.95, Math.max(0, jitterRatio))
    : 0;
  if (safeJitterRatio === 0) return safeBaseCycleMs;

  const mixed = mixUint32(seed);
  const normalized = mixed / 0xffffffff;
  const signedJitter = (normalized * 2) - 1;
  return Math.max(1, Math.round(safeBaseCycleMs * (1 + (signedJitter * safeJitterRatio))));
}

/** 目標サイクル時間から1フレーム時間(ms)を求める。無効値は既定値へフォールバック。 */
export function computeFrameMsFromCycle(
  frames: number,
  cycleMs: number,
  fallbackFrameMs: number,
): number {
  const safeFallbackFrameMs = Math.max(1, Math.floor(fallbackFrameMs));
  if (frames <= 1) return safeFallbackFrameMs;

  const safeCycleMs = Math.floor(cycleMs);
  if (safeCycleMs <= 0) return safeFallbackFrameMs;

  return Math.max(1, Math.round(safeCycleMs / frames));
}
