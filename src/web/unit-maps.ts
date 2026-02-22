import type { LevelSessionUnitSnapshot } from "../runtime/level-session";

import { MAX_BOARD_SIZE } from "./board-grid";

export function buildUnitTileIndexMap(
  board: string,
  unitSnapshots: readonly LevelSessionUnitSnapshot[],
): Map<string, number> {
  const map = new Map<string, number>();
  if (unitSnapshots.length === 0) return map;

  const raw = board.trimEnd();
  const sourceLines = raw.length > 0 ? raw.split("\n") : [];
  const sourceColumns = sourceLines.reduce((max, line) => Math.max(max, line.length), 0);
  const sourceRows = sourceLines.length;
  const columns = Math.max(MAX_BOARD_SIZE.columns, sourceColumns);
  const rows = Math.max(MAX_BOARD_SIZE.rows, sourceRows);
  const leftPad = Math.floor((columns - sourceColumns) / 2);
  const topPad = Math.floor((rows - sourceRows) / 2);

  for (const unit of unitSnapshots) {
    const boardX = leftPad + unit.x + 1;
    const boardY = topPad + unit.y + 1;
    const tileIndex = boardY * columns + boardX;
    map.set(unit.unitId.toLowerCase(), tileIndex);
  }

  return map;
}

export function buildUnitDirectionMap(
  unitSnapshots: readonly LevelSessionUnitSnapshot[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const unit of unitSnapshots) {
    map.set(unit.unitId.toLowerCase(), unit.direction);
  }
  return map;
}
