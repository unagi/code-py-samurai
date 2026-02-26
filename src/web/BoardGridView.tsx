import type { CSSProperties, ReactElement } from "react";

import type { DamagePopup, SpriteOverride } from "./board-effects";
import type { BoardGridData, BoardTile } from "./board-grid";
import { buildBoardDisplayGrid, type BoardDisplayGridData } from "./board-display-grid";
import { buildTileStatsText, type StatsFormatter } from "./board-stats";
import type { TranslateFn } from "./log-format";
import {
  CHAR_SPRITES,
  SPRITE_FRAME_MS,
  getSamuraiIdleFramePath,
  resolveSpriteStateSrc,
} from "./sprite-config";
import {
  computeDeterministicAnimationOffsetMs,
  computeDeterministicJitteredCycleMs,
  computeFrameMsFromCycle,
  computeSpriteFrameIndex,
  type SpriteDir,
} from "./sprite-utils";

const IDLE_SPRITE_CYCLE_MS = 1400;
const IDLE_SPRITE_CYCLE_JITTER_RATIO = 0.15;

interface BoardGridViewProps {
  boardGrid: BoardGridData;
  boardGridStyle: CSSProperties;
  displayGrid?: BoardDisplayGridData;
  t: TranslateFn;
  damagePopupsByTile: ReadonlyMap<number, DamagePopup[]>;
  spriteOverrideByTile: ReadonlyMap<number, SpriteOverride>;
  spriteDirByTile: ReadonlyMap<number, SpriteDir>;
  samuraiFrame: number;
  samuraiHealth: number | null;
  samuraiMaxHealth: number | null;
  statsFmt: StatsFormatter;
  tileSizePx: number;
}

interface SpriteVisual {
  src?: string;
  frames: number;
  currentFrame: number;
}

function getDisplaySymbol(tile: BoardTile): string {
  if (tile.emoji) return tile.emoji;
  if (tile.symbol === " ") return "\u00a0";
  return tile.symbol;
}

function buildHoverText(tile: BoardTile, tileAlt: string, tileStats: string | null): string | null {
  if (!tileStats) return null;
  if (tile.kind === "samurai") return null;
  return `${tileAlt.toUpperCase()}  ${tileStats}`;
}

function computeTileAnimationSeed(index: number, tile: BoardTile): number {
  let seed = (index + 1) >>> 0;
  for (let i = 0; i < tile.kind.length; i++) {
    seed = Math.imul(seed ^ tile.kind.charCodeAt(i), 16777619) >>> 0;
  }
  seed = Math.imul(seed ^ tile.symbol.charCodeAt(0), 16777619) >>> 0;
  return seed >>> 0;
}

function resolveBaseTileVisual(
  tile: BoardTile,
  override: SpriteOverride | undefined,
  spriteDir: SpriteDir,
  _samuraiFrame: number,
  tileAnimationSeed: number,
): SpriteVisual {
  const ownSpriteConfig = CHAR_SPRITES[tile.kind];
  if (!ownSpriteConfig) {
    return { src: tile.assetPath, frames: 1, currentFrame: 0 };
  }

  if (override) {
    return { src: undefined, frames: 1, currentFrame: 0 };
  }

  const src = resolveSpriteStateSrc(ownSpriteConfig.idle, spriteDir);
  const frames = ownSpriteConfig.idle.frames;
  const idleCycleMs = computeDeterministicJitteredCycleMs(
    tileAnimationSeed ^ 0x9e3779b9,
    IDLE_SPRITE_CYCLE_MS,
    IDLE_SPRITE_CYCLE_JITTER_RATIO,
  );
  const idleFrameMs = computeFrameMsFromCycle(frames, idleCycleMs, SPRITE_FRAME_MS);
  const cycleMs = frames * idleFrameMs;
  const phaseOffsetMs = computeDeterministicAnimationOffsetMs(tileAnimationSeed, cycleMs);
  const currentFrame = computeSpriteFrameIndex(Date.now() + phaseOffsetMs, frames, idleFrameMs, true);
  return { src, frames, currentFrame };
}

function resolveOverlayVisual(
  override: SpriteOverride | undefined,
  spriteDir: SpriteDir,
): SpriteVisual {
  if (!override) {
    return { src: undefined, frames: 1, currentFrame: 0 };
  }

  const overrideSpriteConfig = CHAR_SPRITES[override.kind];
  if (!overrideSpriteConfig) {
    return { src: undefined, frames: 1, currentFrame: 0 };
  }

  const stateConfig = overrideSpriteConfig[override.state] ?? overrideSpriteConfig.idle;
  const src = resolveSpriteStateSrc(stateConfig, spriteDir);
  const frames = stateConfig.frames;

  if (frames <= 1) {
    return { src, frames, currentFrame: 0 };
  }

  const elapsed = Date.now() - override.startedAt;
  const currentFrame = computeSpriteFrameIndex(elapsed, frames, SPRITE_FRAME_MS, false);
  return { src, frames, currentFrame };
}

function buildSpriteSheetStyle(visual: SpriteVisual): CSSProperties {
  return {
    backgroundImage: `url(${visual.src})`,
    backgroundSize: `${visual.frames * 100}% 100%`,
    backgroundPositionX: `${(visual.currentFrame / (visual.frames - 1)) * 100}%`,
  };
}

function renderBaseTileVisual(
  baseVisual: SpriteVisual,
  overlaySrc: string | undefined,
  tileAlt: string,
  displaySymbol: string,
  tileSizePx: number,
): ReactElement | null {
  if (baseVisual.src) {
    if (baseVisual.frames <= 1) {
      return <img src={baseVisual.src} alt={tileAlt} className="tile-image" />;
    }

    return (
      <div
        className="tile-sprite-sheet"
        role="img"
        aria-label={tileAlt}
        style={buildSpriteSheetStyle(baseVisual)}
      />
    );
  }

  if (overlaySrc) {
    return null;
  }

  return (
    <span
      className="tile-fallback"
      style={{ fontSize: `${Math.round(tileSizePx * 0.7)}px` }}
      aria-hidden="true"
    >
      {displaySymbol}
    </span>
  );
}

function renderOverlayVisual(
  overlay: SpriteVisual,
  tileAlt: string,
): ReactElement | null {
  if (!overlay.src) {
    return null;
  }

  if (overlay.frames <= 1) {
    return <img src={overlay.src} alt={tileAlt} className="tile-image tile-sprite-overlay" />;
  }

  return (
    <div
      className="tile-sprite-sheet tile-sprite-overlay"
      role="img"
      aria-label={tileAlt}
      style={buildSpriteSheetStyle(overlay)}
    />
  );
}

function BoardTileCell(props: Readonly<{
  tile: BoardTile;
  index: number;
  damagePopupsByTile: ReadonlyMap<number, DamagePopup[]>;
  spriteOverrideByTile: ReadonlyMap<number, SpriteOverride>;
  spriteDirByTile: ReadonlyMap<number, SpriteDir>;
  samuraiFrame: number;
  samuraiHealth: number | null;
  samuraiMaxHealth: number | null;
  statsFmt: StatsFormatter;
  tileSizePx: number;
  t: TranslateFn;
}>): ReactElement {
  const {
    tile,
    index,
    damagePopupsByTile,
    spriteOverrideByTile,
    spriteDirByTile,
    samuraiFrame,
    samuraiHealth,
    samuraiMaxHealth,
    statsFmt,
    tileSizePx,
    t,
  } = props;

  const displaySymbol = getDisplaySymbol(tile);
  const tilePopups = damagePopupsByTile.get(index) ?? [];
  const tileStats = buildTileStatsText(tile.kind, samuraiHealth, samuraiMaxHealth, statsFmt);
  const tileAlt = t(tile.altKey) + (tile.displaySuffix ?? "");
  const hoverText = buildHoverText(tile, tileAlt, tileStats);

  const override = spriteOverrideByTile.get(index);
  const spriteDir = spriteDirByTile.get(index) ?? "right";
  const tileAnimationSeed = computeTileAnimationSeed(index, tile);
  const baseVisual = resolveBaseTileVisual(tile, override, spriteDir, samuraiFrame, tileAnimationSeed);
  const overlay = resolveOverlayVisual(override, spriteDir);

  return (
    <div
      key={`${index}-${tile.kind}-${tile.symbol}`}
      className={`board-tile tile-${tile.kind}${hoverText ? " has-tooltip" : ""}`}
      title={tileAlt}
      aria-label={tileAlt}
      data-tooltip={hoverText ?? undefined}
      tabIndex={hoverText ? 0 : undefined}
    >
      {renderBaseTileVisual(baseVisual, overlay.src, tileAlt, displaySymbol, tileSizePx)}
      {renderOverlayVisual(overlay, tileAlt)}
      {tilePopups.map((popup) => (
        <span
          key={popup.id}
          className={`damage-popup${popup.variant === "heal" ? " damage-popup-heal" : ""}`}
          aria-hidden="true"
        >
          {popup.text}
        </span>
      ))}
    </div>
  );
}

export function BoardGridView(props: Readonly<BoardGridViewProps>): ReactElement {
  const {
    boardGrid,
    boardGridStyle,
    displayGrid,
    t,
    damagePopupsByTile,
    spriteOverrideByTile,
    spriteDirByTile,
    samuraiFrame,
    samuraiHealth,
    samuraiMaxHealth,
    statsFmt,
    tileSizePx,
  } = props;
  const visibleGrid = displayGrid ?? buildBoardDisplayGrid(boardGrid, "full");

  return (
    <div
      className="board-grid"
      role="img"
      aria-label={t("board.ariaLabel", { rows: visibleGrid.rows, columns: visibleGrid.columns })}
      style={boardGridStyle}
    >
      {visibleGrid.tiles.map(({ tile, originalIndex }) => (
        <BoardTileCell
          key={`${originalIndex}-${tile.kind}-${tile.symbol}`}
          tile={tile}
          index={originalIndex}
          damagePopupsByTile={damagePopupsByTile}
          spriteOverrideByTile={spriteOverrideByTile}
          spriteDirByTile={spriteDirByTile}
          samuraiFrame={samuraiFrame}
          samuraiHealth={samuraiHealth}
          samuraiMaxHealth={samuraiMaxHealth}
          statsFmt={statsFmt}
          tileSizePx={tileSizePx}
          t={t}
        />
      ))}
    </div>
  );
}
