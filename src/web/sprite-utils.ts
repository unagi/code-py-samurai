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
