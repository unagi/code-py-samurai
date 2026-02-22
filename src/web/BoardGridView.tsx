import type { CSSProperties, ReactElement } from "react";

import type { DamagePopup, SpriteOverride } from "./board-effects";
import type { BoardGridData, BoardTile } from "./board-grid";
import { buildTileStatsText, type StatsFormatter } from "./board-stats";
import type { TranslateFn } from "./log-format";
import {
  CHAR_SPRITES,
  SPRITE_FRAME_MS,
  getSamuraiIdleFramePath,
} from "./sprite-config";
import { resolveSpriteDir, type SpriteDir } from "./sprite-utils";

interface BoardGridViewProps {
  boardGrid: BoardGridData;
  boardGridStyle: CSSProperties;
  t: TranslateFn;
  damagePopupsByTile: ReadonlyMap<number, DamagePopup[]>;
  spriteOverrideByTile: ReadonlyMap<number, SpriteOverride>;
  spriteDirByTile: ReadonlyMap<number, SpriteDir>;
  samuraiFrame: number;
  samuraiHealth: number | null;
  samuraiMaxHealth: number | null;
  statsFmt: StatsFormatter;
  tileSizePx: number;
  onHoveredEnemyStatsChange: (value: string | null) => void;
}

interface OverlayVisual {
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

function resolveBaseTileImageSrc(
  tile: BoardTile,
  override: SpriteOverride | undefined,
  spriteDir: SpriteDir,
  samuraiFrame: number,
): string | undefined {
  if (tile.kind === "samurai") {
    return getSamuraiIdleFramePath(samuraiFrame);
  }

  const ownSpriteConfig = CHAR_SPRITES[tile.kind];
  if (!ownSpriteConfig) {
    return tile.assetPath;
  }

  if (override) {
    return undefined;
  }

  return resolveSpriteDir(ownSpriteConfig.idle.pathTemplate, spriteDir);
}

function resolveOverlayVisual(
  override: SpriteOverride | undefined,
  spriteDir: SpriteDir,
): OverlayVisual {
  if (!override) {
    return { src: undefined, frames: 1, currentFrame: 0 };
  }

  const overrideSpriteConfig = CHAR_SPRITES[override.kind];
  if (!overrideSpriteConfig) {
    return { src: undefined, frames: 1, currentFrame: 0 };
  }

  const stateConfig = overrideSpriteConfig[override.state];
  const src = resolveSpriteDir(stateConfig.pathTemplate, spriteDir);
  const frames = stateConfig.frames;

  if (frames <= 1) {
    return { src, frames, currentFrame: 0 };
  }

  const elapsed = Date.now() - override.startedAt;
  const currentFrame = Math.min(Math.floor(elapsed / SPRITE_FRAME_MS), frames - 1);
  return { src, frames, currentFrame };
}

function renderBaseTileVisual(
  baseTileImageSrc: string | undefined,
  overlaySrc: string | undefined,
  tileAlt: string,
  displaySymbol: string,
  tileSizePx: number,
): ReactElement | null {
  if (baseTileImageSrc) {
    return <img src={baseTileImageSrc} alt={tileAlt} className="tile-image" />;
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
  overlay: OverlayVisual,
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
      style={{
        backgroundImage: `url(${overlay.src})`,
        backgroundSize: `${overlay.frames * 100}% 100%`,
        backgroundPositionX: `${(overlay.currentFrame / (overlay.frames - 1)) * 100}%`,
      }}
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
  onHoveredEnemyStatsChange: (value: string | null) => void;
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
    onHoveredEnemyStatsChange,
  } = props;

  const displaySymbol = getDisplaySymbol(tile);
  const tilePopups = damagePopupsByTile.get(index) ?? [];
  const tileStats = buildTileStatsText(tile.kind, samuraiHealth, samuraiMaxHealth, statsFmt);
  const tileAlt = t(tile.altKey);
  const hoverText = buildHoverText(tile, tileAlt, tileStats);

  const override = spriteOverrideByTile.get(index);
  const spriteDir = spriteDirByTile.get(index) ?? "right";
  const baseTileImageSrc = resolveBaseTileImageSrc(tile, override, spriteDir, samuraiFrame);
  const overlay = resolveOverlayVisual(override, spriteDir);

  const handleHoverStart = (): void => {
    if (!hoverText) return;
    onHoveredEnemyStatsChange(hoverText);
  };

  const handleHoverEnd = (): void => {
    onHoveredEnemyStatsChange(null);
  };

  return (
    <div
      key={`${index}-${tile.kind}-${tile.symbol}`}
      className={`board-tile tile-${tile.kind}`}
      title={tileAlt}
      aria-label={tileAlt}
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleHoverEnd}
      onFocus={handleHoverStart}
      onBlur={handleHoverEnd}
    >
      {renderBaseTileVisual(baseTileImageSrc, overlay.src, tileAlt, displaySymbol, tileSizePx)}
      {renderOverlayVisual(overlay, tileAlt)}
      {tilePopups.map((popup) => (
        <span key={popup.id} className="damage-popup" aria-hidden="true">
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
    t,
    damagePopupsByTile,
    spriteOverrideByTile,
    spriteDirByTile,
    samuraiFrame,
    samuraiHealth,
    samuraiMaxHealth,
    statsFmt,
    tileSizePx,
    onHoveredEnemyStatsChange,
  } = props;

  return (
    <div
      className="board-grid"
      role="img"
      aria-label={t("board.ariaLabel", { rows: boardGrid.rows, columns: boardGrid.columns })}
      style={boardGridStyle}
    >
      {boardGrid.tiles.map((tile, index) => (
        <BoardTileCell
          key={`${index}-${tile.kind}-${tile.symbol}`}
          tile={tile}
          index={index}
          damagePopupsByTile={damagePopupsByTile}
          spriteOverrideByTile={spriteOverrideByTile}
          spriteDirByTile={spriteDirByTile}
          samuraiFrame={samuraiFrame}
          samuraiHealth={samuraiHealth}
          samuraiMaxHealth={samuraiMaxHealth}
          statsFmt={statsFmt}
          tileSizePx={tileSizePx}
          t={t}
          onHoveredEnemyStatsChange={onHoveredEnemyStatsChange}
        />
      ))}
    </div>
  );
}
