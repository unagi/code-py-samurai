export const ABSOLUTE_DIRECTIONS = [
  "north",
  "east",
  "south",
  "west",
] as const;

export type AbsoluteDirection = (typeof ABSOLUTE_DIRECTIONS)[number];

export const RELATIVE_DIRECTIONS = [
  "forward",
  "right",
  "backward",
  "left",
] as const;

export type RelativeDirection = (typeof RELATIVE_DIRECTIONS)[number];

export const DIRECTION_OFFSETS: Record<
  AbsoluteDirection,
  { x: number; y: number }
> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

/**
 * Rotate an absolute direction by a given amount (1 = 90° clockwise).
 */
export function rotateDirection(
  direction: AbsoluteDirection,
  amount: number
): AbsoluteDirection {
  let index = ABSOLUTE_DIRECTIONS.indexOf(direction) + amount;
  index = ((index % 4) + 4) % 4;
  return ABSOLUTE_DIRECTIONS[index];
}

/**
 * Convert a relative direction to absolute given the facing direction.
 */
export function relativeToAbsolute(
  facing: AbsoluteDirection,
  relative: RelativeDirection
): AbsoluteDirection {
  const offset = RELATIVE_DIRECTIONS.indexOf(relative);
  return rotateDirection(facing, offset);
}

/**
 * Convert an absolute direction to relative given the facing direction.
 */
export function absoluteToRelative(
  facing: AbsoluteDirection,
  absolute: AbsoluteDirection
): RelativeDirection {
  let offset =
    ABSOLUTE_DIRECTIONS.indexOf(absolute) -
    ABSOLUTE_DIRECTIONS.indexOf(facing);
  offset = ((offset % 4) + 4) % 4;
  return RELATIVE_DIRECTIONS[offset];
}
