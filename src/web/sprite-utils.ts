export type SpriteDir = "left" | "right";

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
