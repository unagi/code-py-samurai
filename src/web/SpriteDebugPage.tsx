import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { BoardGridView } from "./BoardGridView";
import {
  SPRITE_OVERRIDE_MS,
  type DamagePopup,
  type SpriteOverride,
  type SpriteState,
} from "./board-effects";
import type { BoardGridData, BoardTile } from "./board-grid";
import type { StatsFormatter } from "./board-stats";
import type { TranslateFn } from "./log-format";
import {
  SAMURAI_IDLE_FRAME_COUNT,
  SAMURAI_IDLE_FRAME_MS,
  SPRITE_FRAME_MS,
} from "./sprite-config";
import { unitAnimationTypeSpecs, type UnitAnimationTypeSpec } from "./sprite-debug-unit-animation-specs";
import {
  type DebugSpriteButtonState,
  type SpriteDebugCardSpec,
  buildSpriteDebugCardSpecs,
  buildSpriteDebugUnsupportedUnitSpecs,
} from "./sprite-debug-data";
import { type SpriteDir } from "./sprite-utils";
import "./sprite-debug.css";

type DebugFilter = "all" | "preview-only" | "unsupported-only";
type CaptiveLocalState = "bound" | "rescued";

const EMPTY_DAMAGE_POPUPS: ReadonlyMap<number, DamagePopup[]> = new Map();
const NOOP_HOVER = (): void => {};
const DEFAULT_TILE_SIZE_PX = 80;
const OTHER_UNIT_KINDS = new Set(["samurai", "captive"]);
const ENEMY_EMOJI_KINDS = new Set(["archer", "wizard"]);
const DEBUG_ANIMATION_BUTTON_ORDER: readonly DebugSpriteButtonState[] = ["idle", "death", "attack", "damaged"];

interface EnemyPreviewGroup {
  kind: string;
  renderMode: "sprite" | "emoji";
  cards: SpriteDebugCardSpec[];
}

const SAMURAI_SLOT_SPECS = [
  { id: "west", label: "WEST", spriteDir: "left" as const },
  { id: "east", label: "EAST", spriteDir: "right" as const },
  { id: "north", label: "NORTH", spriteDir: "right" as const },
  { id: "south", label: "SOUTH", spriteDir: "left" as const },
] as const;

function getAnimationTypeLabelFromDebugState(state: DebugSpriteButtonState): "Idle" | "Offence" | "Damaged" | "Disappear" {
  if (state === "idle") return "Idle";
  if (state === "attack") return "Offence";
  if (state === "damaged") return "Damaged";
  return "Disappear";
}

function getAnimationTypeLabelFromCaptiveState(state: CaptiveLocalState): "Idle" | "Disappear" {
  return state === "bound" ? "Idle" : "Disappear";
}

const DEBUG_STATS_FORMATTER: StatsFormatter = {
  hp: (current, max) => `HP ${current}/${max}`,
  atk: (value) => `ATK ${value}`,
};

const TILE_SPEC_BY_KIND: Readonly<Record<string, BoardTile>> = {
  samurai: { symbol: "@", kind: "samurai", altKey: "tiles.samurai" },
  sludge: { symbol: "s", kind: "sludge", altKey: "tiles.sludge" },
  "thick-sludge": { symbol: "S", kind: "thick-sludge", altKey: "tiles.thickSludge" },
  captive: { symbol: "C", kind: "captive", altKey: "tiles.captive" },
  floor: { symbol: " ", kind: "floor", altKey: "tiles.empty", assetPath: "/assets/tiles/cave-floor.png" },
};

function buildSingleTileBoardGrid(kind: string): BoardGridData {
  const tile = TILE_SPEC_BY_KIND[kind];
  if (!tile) {
    throw new Error(`Unsupported debug sprite kind: ${kind}`);
  }
  return { columns: 1, rows: 1, tiles: [tile] };
}

function hasStateSupport(card: SpriteDebugCardSpec, state: DebugSpriteButtonState): boolean {
  return card.supportedStates.includes(state);
}

function buildSpriteOverrideForCard(
  card: SpriteDebugCardSpec,
  state: SpriteState,
  id: number,
  now: number,
): SpriteOverride {
  return {
    id,
    tileIndex: 0,
    kind: card.kind,
    state,
    startedAt: now,
    expiresAt: now + SPRITE_OVERRIDE_MS,
  };
}

export default function SpriteDebugPage() {
  const { t } = useTranslation();
  const cardSpecs = useMemo(() => buildSpriteDebugCardSpecs(), []);
  const unsupportedUnits = useMemo(() => buildSpriteDebugUnsupportedUnitSpecs(), []);
  const boardGridByKind = useMemo(() => {
    return new Map<string, BoardGridData>(
      cardSpecs.map((card) => [card.kind, buildSingleTileBoardGrid(card.kind)]),
    );
  }, [cardSpecs]);
  const enemyCards = useMemo(
    () => cardSpecs.filter((card) => !OTHER_UNIT_KINDS.has(card.kind)),
    [cardSpecs],
  );
  const otherUnitCards = useMemo(
    () => cardSpecs.filter((card) => OTHER_UNIT_KINDS.has(card.kind)),
    [cardSpecs],
  );

  const [filter, setFilter] = useState<DebugFilter>("all");
  const [isPlaying, setIsPlaying] = useState(true);
  const [showTileBackground, setShowTileBackground] = useState(true);
  const [tileSizePx, setTileSizePx] = useState(DEFAULT_TILE_SIZE_PX);
  const [samuraiFrame, setSamuraiFrame] = useState(0);
  const [cardOverrides, setCardOverrides] = useState<Readonly<Record<string, SpriteOverride>>>({});
  const [captiveLocalStates, setCaptiveLocalStates] = useState<Readonly<Record<string, CaptiveLocalState>>>({});
  const nextOverrideIdRef = useRef(1);
  const [, setSpriteRenderTick] = useState(0);

  const boardGridStyle = useMemo<CSSProperties>(() => ({
    gridTemplateColumns: `repeat(1, ${tileSizePx}px)`,
    gridTemplateRows: `repeat(1, ${tileSizePx}px)`,
    gap: "0px",
  }), [tileSizePx]);
  const captivePreviewTileSizePx = 80;
  const captivePreviewBoardGridStyle = useMemo<CSSProperties>(() => ({
    gridTemplateColumns: `repeat(1, ${captivePreviewTileSizePx}px)`,
    gridTemplateRows: `repeat(1, ${captivePreviewTileSizePx}px)`,
    gap: "0px",
  }), [captivePreviewTileSizePx]);

  const boardTranslate: TranslateFn = (key, opts) => t(key, opts);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = globalThis.setInterval(() => {
      setSamuraiFrame((prev) => (prev + 1) % SAMURAI_IDLE_FRAME_COUNT);
    }, SAMURAI_IDLE_FRAME_MS);
    return () => globalThis.clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = globalThis.setInterval(() => {
      const now = Date.now();
      setCardOverrides((prev) => {
        let changed = false;
        const next: Record<string, SpriteOverride> = {};
        for (const [cardId, override] of Object.entries(prev)) {
          if (override.expiresAt > now) {
            next[cardId] = override;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      setSpriteRenderTick((prev) => (prev + 1) % 1000);
    }, SPRITE_FRAME_MS);
    return () => globalThis.clearInterval(timer);
  }, [isPlaying]);

  const visibleEnemyCards = useMemo(() => {
    if (filter === "unsupported-only") return [] as SpriteDebugCardSpec[];
    return enemyCards;
  }, [enemyCards, filter]);
  const visibleEnemyGroups = useMemo<EnemyPreviewGroup[]>(() => {
    const groups = new Map<string, SpriteDebugCardSpec[]>();
    for (const card of visibleEnemyCards) {
      const existing = groups.get(card.kind);
      if (existing) {
        existing.push(card);
        continue;
      }
      groups.set(card.kind, [card]);
    }

    const sortOrder: Readonly<Record<SpriteDebugCardSpec["dir"], number>> = {
      left: 0,
      right: 1,
      none: 2,
    };

    const spriteGroups = Array.from(groups.entries()).map(([kind, cards]) => ({
      kind,
      renderMode: "sprite" as const,
      cards: [...cards].sort((a, b) => sortOrder[a.dir] - sortOrder[b.dir]),
    }));
    const emojiEnemyGroups = unsupportedUnits
      .filter((unit) => ENEMY_EMOJI_KINDS.has(unit.kind))
      .map((unit) => ({
        kind: unit.kind,
        renderMode: "emoji" as const,
        cards: [] as SpriteDebugCardSpec[],
      }));

    return [...spriteGroups, ...emojiEnemyGroups];
  }, [unsupportedUnits, visibleEnemyCards]);
  const visibleOtherUnitCards = useMemo(() => {
    if (filter === "unsupported-only") return [] as SpriteDebugCardSpec[];
    return otherUnitCards;
  }, [otherUnitCards, filter]);
  const visibleSamuraiCards = useMemo(() => {
    const sortOrder: Readonly<Record<SpriteDebugCardSpec["dir"], number>> = {
      left: 0,
      right: 1,
      none: 2,
    };
    return visibleOtherUnitCards
      .filter((card) => card.kind === "samurai")
      .sort((a, b) => sortOrder[a.dir] - sortOrder[b.dir]);
  }, [visibleOtherUnitCards]);
  const visibleCaptiveCards = useMemo(
    () => visibleOtherUnitCards.filter((card) => card.kind === "captive"),
    [visibleOtherUnitCards],
  );
  const visibleUnsupportedUnits = useMemo(() => (
    unsupportedUnits.filter((unit) => !ENEMY_EMOJI_KINDS.has(unit.kind))
  ), [unsupportedUnits]);
  const showUnsupportedSection = filter !== "preview-only";
  const showPreviewSection = filter !== "unsupported-only";

  const handleTriggerStateForCards = (cards: readonly SpriteDebugCardSpec[], state: DebugSpriteButtonState): void => {
    const targetCardIds = new Set(cards.map((card) => card.id));
    setCardOverrides((prev) => {
      const next: Record<string, SpriteOverride> = {};
      for (const [cardId, override] of Object.entries(prev)) {
        if (!targetCardIds.has(cardId)) {
          next[cardId] = override;
        }
      }
      if (state === "idle") {
        return next;
      }

      const now = Date.now();
      for (const card of cards) {
        if (!hasStateSupport(card, state)) continue;
        next[card.id] = buildSpriteOverrideForCard(card, state as SpriteState, nextOverrideIdRef.current++, now);
      }
      return next;
    });
  };

  const handleReset = (): void => {
    setCardOverrides({});
    setCaptiveLocalStates({});
    setSamuraiFrame(0);
  };

  const handleCaptiveLocalState = (card: SpriteDebugCardSpec, state: CaptiveLocalState): void => {
    setCaptiveLocalStates((prev) => ({ ...prev, [card.id]: state }));
    // Captive local preview is not driven by generic sprite override states.
    setCardOverrides((prev) => {
      if (!(card.id in prev)) return prev;
      const next = { ...prev };
      delete next[card.id];
      return next;
    });
  };

  const renderCaptivePreviewPanel = (card: SpriteDebugCardSpec, captiveLocalState: CaptiveLocalState | null) => {
    const spriteDirByTile = new Map<number, SpriteDir>();
    spriteDirByTile.set(0, card.spriteDir);
    const captiveBoardGrid = boardGridByKind.get("captive");
    if (!captiveBoardGrid) return null;
    const floorBoardGrid: BoardGridData = { columns: 1, rows: 1, tiles: [TILE_SPEC_BY_KIND.floor] };
    const commonProps = {
      boardGridStyle: captivePreviewBoardGridStyle,
      t: boardTranslate,
      damagePopupsByTile: EMPTY_DAMAGE_POPUPS,
      spriteOverrideByTile: new Map<number, SpriteOverride>(),
      spriteDirByTile,
      samuraiFrame,
      samuraiHealth: 20,
      samuraiMaxHealth: 20,
      statsFmt: DEBUG_STATS_FORMATTER,
      tileSizePx: captivePreviewTileSizePx,
      onHoveredEnemyStatsChange: NOOP_HOVER,
    } as const;
    const isIdleActive = captiveLocalState !== "rescued";
    const isDisappearActive = !isIdleActive;
    const previewBoardGrid = isIdleActive ? captiveBoardGrid : floorBoardGrid;

    return (
      <div className="sprite-debug-captive-preview-panel">
        <div className="sprite-debug-captive-preview-top">
          <div className="sprite-debug-captive-preview-row">
            {([
              { id: "slot-none", label: "NONE", active: true },
              { id: "slot-2", label: "", active: false },
              { id: "slot-3", label: "", active: false },
              { id: "slot-4", label: "", active: false },
            ] as const).map((slot) => {
              const isNoneSlot = slot.active;
              return (
                <div key={`${card.id}-${slot.id}`} className="sprite-debug-captive-preview-col">
                  <div className={`sprite-debug-captive-preview-box${isNoneSlot ? " sprite-debug-captive-preview-box-active" : ""}`}>
                    {isNoneSlot ? (
                      <BoardGridView boardGrid={previewBoardGrid} {...commonProps} />
                    ) : (
                      <div className="sprite-debug-captive-preview-placeholder" aria-hidden="true" />
                    )}
                    <div
                      className={`sprite-debug-captive-preview-caption${slot.label ? "" : " sprite-debug-captive-preview-caption-empty"}`}
                      aria-hidden={slot.label ? undefined : "true"}
                    >
                      {slot.label || "\u00a0"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sprite-debug-captive-animation-buttons" role="group" aria-label={`${card.id} captive animation buttons`}>
            <button
              type="button"
              className={isIdleActive ? "sprite-debug-button-active" : undefined}
              onClick={() => handleCaptiveLocalState(card, "bound")}
            >
              <span className="icon-label">
                <i className="bi bi-play-fill" aria-hidden="true" />
                {getAnimationTypeLabelFromCaptiveState("bound")}
              </span>
            </button>
            <button
              type="button"
              className={isDisappearActive ? "sprite-debug-button-active" : undefined}
              onClick={() => handleCaptiveLocalState(card, "rescued")}
            >
              <span className="icon-label">
                <i className="bi bi-play-fill" aria-hidden="true" />
                {getAnimationTypeLabelFromCaptiveState("rescued")}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderEnemyPreviewPanel = (group: EnemyPreviewGroup, currentState: DebugSpriteButtonState) => {
    const boardGrid = boardGridByKind.get(group.kind);
    if (group.renderMode === "sprite" && !boardGrid) return null;
    const isEmojiFallbackGroup = group.renderMode === "emoji";

    const slots = [
      { id: "west", card: group.cards.find((card) => card.spriteDir === "left") ?? null, label: "WEST" },
      { id: "east", card: group.cards.find((card) => card.spriteDir === "right") ?? null, label: "EAST" },
      { id: "slot-3", card: null, label: "" },
      { id: "slot-4", card: null, label: "" },
    ] as const;

    return (
      <div className="sprite-debug-enemy-preview-panel">
        <div className="sprite-debug-enemy-preview-top">
          <div className="sprite-debug-captive-preview-row">
            {slots.map((slot) => {
              const isActiveSlot = slot.card !== null;
              let slotContent = <div className="sprite-debug-captive-preview-placeholder" aria-hidden="true" />;

              if (slot.card && boardGrid) {
                const spriteDirByTile = new Map<number, SpriteDir>();
                spriteDirByTile.set(0, slot.card.spriteDir);
                const spriteOverrideByTile = new Map<number, SpriteOverride>();
                const override = cardOverrides[slot.card.id];
                if (override) {
                  spriteOverrideByTile.set(0, override);
                }
                slotContent = (
                  <BoardGridView
                    boardGrid={boardGrid}
                    boardGridStyle={boardGridStyle}
                    t={boardTranslate}
                    damagePopupsByTile={EMPTY_DAMAGE_POPUPS}
                    spriteOverrideByTile={spriteOverrideByTile}
                    spriteDirByTile={spriteDirByTile}
                    samuraiFrame={samuraiFrame}
                    samuraiHealth={20}
                    samuraiMaxHealth={20}
                    statsFmt={DEBUG_STATS_FORMATTER}
                    tileSizePx={tileSizePx}
                    onHoveredEnemyStatsChange={NOOP_HOVER}
                  />
                );
              }

              return (
                <div key={`${group.kind}-${slot.id}`} className="sprite-debug-captive-preview-col">
                  <div className={`sprite-debug-captive-preview-box${isActiveSlot ? " sprite-debug-captive-preview-box-active" : ""}`}>
                    {slotContent}
                    <div
                      className={`sprite-debug-captive-preview-caption${slot.label ? "" : " sprite-debug-captive-preview-caption-empty"}`}
                      aria-hidden={slot.label ? undefined : "true"}
                    >
                      {slot.label || "\u00a0"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sprite-debug-enemy-animation-buttons" role="group" aria-label={`${group.kind} enemy animation buttons`}>
            {DEBUG_ANIMATION_BUTTON_ORDER.map((state) => (
              <button
                key={`${group.kind}-anim-${state}`}
                type="button"
                className={currentState === state ? "sprite-debug-button-active" : undefined}
                onClick={() => handleTriggerStateForCards(group.cards, state)}
                disabled={isEmojiFallbackGroup}
              >
                <span className="icon-label">
                  <i className="bi bi-play-fill" aria-hidden="true" />
                  {getAnimationTypeLabelFromDebugState(state)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderUnitAnimationSpecArt = (spec: UnitAnimationTypeSpec, keyPrefix: string) => {
    if (spec.artLayout === "enemy-grid") {
      return (
        <div className="sprite-debug-captive-spec-art">
          <div className="sprite-debug-enemy-spec-art-grid">
            {spec.previewImageSrcs.length > 0 ? (
              spec.previewImageSrcs.map((src) => (
                <img
                  key={`${keyPrefix}-${spec.animationType}-${src}`}
                  src={src}
                  alt=""
                  aria-hidden="true"
                  className="sprite-debug-motion-file-preview"
                />
              ))
            ) : (
              <>
                <div className="sprite-debug-enemy-spec-art-empty" aria-hidden="true" />
                <div className="sprite-debug-enemy-spec-art-empty" aria-hidden="true" />
              </>
            )}
          </div>
        </div>
      );
    }

    if (spec.artLayout === "samurai-grid") {
      return (
        <div className="sprite-debug-captive-spec-art">
          <div className="sprite-debug-samurai-spec-art-grid">
            {spec.previewImageSrcs.length > 0 ? (
              spec.previewImageSrcs.map((src) => (
                <img
                  key={`${keyPrefix}-${spec.animationType}-${src}`}
                  src={src}
                  alt=""
                  aria-hidden="true"
                  className="sprite-debug-motion-file-preview"
                />
              ))
            ) : (
              <div className="sprite-debug-samurai-spec-art-empty" aria-hidden="true" />
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="sprite-debug-captive-spec-art">
        {spec.previewImageSrcs.length > 0 ? (
          spec.previewImageSrcs.map((src) => (
            <img
              key={`${keyPrefix}-${spec.animationType}-${src}`}
              src={src}
              alt=""
              aria-hidden="true"
              className="sprite-debug-motion-file-preview"
            />
          ))
        ) : (
          <div className="sprite-debug-samurai-spec-art-empty" aria-hidden="true" />
        )}
      </div>
    );
  };

  const renderUnitFooter = (
    specs: readonly UnitAnimationTypeSpec[],
    ariaLabel: string,
    keyPrefix: string,
  ) => {
    return (
      <div className="sprite-debug-motion-coverage" aria-label={ariaLabel}>
        <ul className="sprite-debug-captive-spec-list">
          {specs.map((spec) => (
            <li key={`${keyPrefix}-${spec.animationType}`} className="sprite-debug-captive-spec-item">
              <div className="sprite-debug-captive-spec-header">
                <code>{spec.animationType.toLowerCase()}</code>
                <span
                  className={`sprite-debug-coverage-chip ${
                    spec.status === "ok" ? "sprite-debug-coverage-chip-ok" : "sprite-debug-coverage-chip-ng"
                  }`}
                >
                  {spec.status.toUpperCase()}
                </span>
              </div>
              <dl className="sprite-debug-captive-spec-grid">
                <dt>trigger</dt>
                <dd>{spec.trigger}</dd>
                <dt>sprite file</dt>
                <dd>
                  <div className="sprite-debug-enemy-spec-file-list">
                    {spec.spriteFiles.map((file) => <code key={`${keyPrefix}-${spec.animationType}-${file}`}>{file}</code>)}
                  </div>
                </dd>
                <dt>Frame count</dt>
                <dd>{spec.frameCountText}</dd>
                <dt>モーション要求仕様</dt>
                <dd>{spec.motionSpec}</dd>
                <dt>実装</dt>
                <dd>{spec.implementation}</dd>
              </dl>
              {renderUnitAnimationSpecArt(spec, keyPrefix)}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderSamuraiPreviewPanel = (cards: readonly SpriteDebugCardSpec[], currentState: DebugSpriteButtonState) => {
    const boardGrid = boardGridByKind.get("samurai");
    if (!boardGrid) return null;

    return (
      <div className="sprite-debug-samurai-preview-panel">
        <div className="sprite-debug-samurai-preview-top">
          <div className="sprite-debug-captive-preview-row">
            {SAMURAI_SLOT_SPECS.map((slot) => {
              const card = cards.find((item) => item.spriteDir === slot.spriteDir) ?? null;
              const spriteDirByTile = new Map<number, SpriteDir>();
              if (card) {
                spriteDirByTile.set(0, card.spriteDir);
              }
              const spriteOverrideByTile = new Map<number, SpriteOverride>();
              if (card) {
                const override = cardOverrides[card.id];
                if (override) {
                  spriteOverrideByTile.set(0, override);
                }
              }

              return (
                <div key={`samurai-slot-${slot.id}`} className="sprite-debug-captive-preview-col">
                  <div className="sprite-debug-captive-preview-box sprite-debug-captive-preview-box-active">
                    {card ? (
                      <BoardGridView
                        boardGrid={boardGrid}
                        boardGridStyle={captivePreviewBoardGridStyle}
                        t={boardTranslate}
                        damagePopupsByTile={EMPTY_DAMAGE_POPUPS}
                        spriteOverrideByTile={spriteOverrideByTile}
                        spriteDirByTile={spriteDirByTile}
                        samuraiFrame={samuraiFrame}
                        samuraiHealth={20}
                        samuraiMaxHealth={20}
                        statsFmt={DEBUG_STATS_FORMATTER}
                        tileSizePx={captivePreviewTileSizePx}
                        onHoveredEnemyStatsChange={NOOP_HOVER}
                      />
                    ) : (
                      <div className="sprite-debug-captive-preview-placeholder" aria-hidden="true" />
                    )}
                    <div className="sprite-debug-captive-preview-caption">{slot.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sprite-debug-samurai-animation-buttons" role="group" aria-label="samurai animation buttons">
            {DEBUG_ANIMATION_BUTTON_ORDER.map((state) => {
              const enabled = state === "idle";
              return (
                <button
                  key={`samurai-anim-${state}`}
                  type="button"
                  className={currentState === state ? "sprite-debug-button-active" : undefined}
                  onClick={() => handleTriggerStateForCards(cards, state)}
                  disabled={!enabled}
                >
                  <span className="icon-label">
                    <i className="bi bi-play-fill" aria-hidden="true" />
                    {getAnimationTypeLabelFromDebugState(state)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className={`sprite-debug-page${showTileBackground ? "" : " sprite-debug-page-tile-off"}`}>
      <header className="sprite-debug-header">
        <div>
          <p className="sprite-debug-eyebrow">DEBUG</p>
          <h1>Sprite Debug</h1>
          <p className="sprite-debug-summary">
            ゲーム表示ロジック（`BoardGridView`）経由で idle/attack/damaged/death を確認します。
          </p>
        </div>
        <div className="sprite-debug-summary-cards" aria-label="sprite debug summary">
          <div className="sprite-debug-summary-card">
            <span>プレビューカード</span>
            <strong>{cardSpecs.length}</strong>
          </div>
          <div className="sprite-debug-summary-card">
            <span>未対応ユニット</span>
            <strong>{unsupportedUnits.length}</strong>
          </div>
          <div className="sprite-debug-summary-card">
            <span>再生状態</span>
            <strong>{isPlaying ? "再生中" : "停止中"}</strong>
          </div>
        </div>
      </header>

      <section className="sprite-debug-panel" aria-label="デバッグ操作">
        <div className="sprite-debug-controls">
          <button type="button" onClick={() => setIsPlaying((prev) => !prev)}>
            {isPlaying ? "一時停止" : "再生"}
          </button>
          <button type="button" onClick={handleReset}>
            リセット
          </button>
          <label className="sprite-debug-toggle">
            <input
              type="checkbox"
              checked={showTileBackground}
              onChange={(e) => setShowTileBackground(e.target.checked)}
            />
            <span>タイル背景</span>
          </label>
          <label className="sprite-debug-field">
            <span>表示</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as DebugFilter)}
            >
              <option value="all">すべて</option>
              <option value="preview-only">プレビューのみ</option>
              <option value="unsupported-only">未対応のみ</option>
            </select>
          </label>
          <label className="sprite-debug-field">
            <span>タイルサイズ</span>
            <select
              value={tileSizePx}
              onChange={(e) => setTileSizePx(Number(e.target.value))}
            >
              <option value={64}>64px</option>
              <option value={80}>80px</option>
              <option value={96}>96px</option>
              <option value={120}>120px</option>
            </select>
          </label>
        </div>
      </section>

      {showPreviewSection ? (
        <section className="sprite-debug-panel" aria-labelledby="sprite-debug-preview-title">
          <div className="sprite-debug-panel-header">
            <h2 id="sprite-debug-preview-title">スプライト確認</h2>
          </div>
          <div className="sprite-debug-grid sprite-debug-grid-wide-cards">
            {visibleSamuraiCards.length > 0 ? (() => {
              const currentOverride = visibleSamuraiCards
                .map((card) => cardOverrides[card.id])
                .find((override) => Boolean(override));
              const currentState: DebugSpriteButtonState = currentOverride ? currentOverride.state : "idle";

              return (
                <article key="samurai-group" className="sprite-debug-card sprite-debug-card-samurai">
                  <header className="sprite-debug-card-header">
                    <div>
                      <h3>samurai</h3>
                    </div>
                    <span
                      className={`sprite-debug-state-chip${currentState === "idle" ? "" : " sprite-debug-state-chip-active"}`}
                    >
                      {currentState}
                    </span>
                  </header>
                  {renderSamuraiPreviewPanel(visibleSamuraiCards, currentState)}
                  {renderUnitFooter(
                    unitAnimationTypeSpecs({ kind: "samurai" }),
                    "samurai game motion coverage",
                    "samurai",
                  )}
                </article>
              );
            })() : null}

            {visibleEnemyGroups.map((group) => {
              const currentOverride = group.cards
                .map((card) => cardOverrides[card.id])
                .find((override) => Boolean(override));
              const currentState: DebugSpriteButtonState = currentOverride ? currentOverride.state : "idle";
              return (
                <article
                  key={`enemy-group-${group.kind}`}
                  className="sprite-debug-card sprite-debug-card-enemy"
                >
                  <header className="sprite-debug-card-header">
                    <div>
                      <h3>{group.kind}</h3>
                    </div>
                    <span
                      className={`sprite-debug-state-chip${currentState === "idle" ? "" : " sprite-debug-state-chip-active"}`}
                    >
                      {currentState}
                    </span>
                  </header>
                  {renderEnemyPreviewPanel(group, currentState)}
                  {renderUnitFooter(
                    unitAnimationTypeSpecs({
                      kind: group.kind,
                      renderMode: group.renderMode,
                      cards: group.cards,
                    }),
                    `${group.kind} enemy game motion coverage`,
                    group.kind,
                  )}
                </article>
              );
            })}
            {visibleCaptiveCards.map((card) => {
              const override = cardOverrides[card.id];
              let captiveLocalState: CaptiveLocalState | null = null;
              if (card.kind === "captive") {
                captiveLocalState = captiveLocalStates[card.id] ?? "bound";
              }
              let currentStateLabel = override ? override.state : "idle";
              if (card.kind === "captive") {
                currentStateLabel = captiveLocalState === "rescued" ? "disappear" : "idle";
              }

              return (
                <article key={card.id} className="sprite-debug-card sprite-debug-card-captive">
                  <header className="sprite-debug-card-header">
                    <div>
                      <h3>{card.kind}</h3>
                    </div>
                    <span
                      className={`sprite-debug-state-chip${currentStateLabel === "idle" ? "" : " sprite-debug-state-chip-active"}`}
                    >
                      {currentStateLabel}
                    </span>
                  </header>

                  {renderCaptivePreviewPanel(card, captiveLocalState)}
                  {renderUnitFooter(
                    unitAnimationTypeSpecs({ kind: card.kind }),
                    `${card.id} captive game motion coverage`,
                    card.id,
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {showUnsupportedSection ? (
        <section className="sprite-debug-panel" aria-labelledby="sprite-debug-unsupported-title">
          <div className="sprite-debug-panel-header">
            <h2 id="sprite-debug-unsupported-title">未対応（Emoji/Fallback）</h2>
            <p>ゲームではスプライトロジック未対応のため、プレビュー対象外として表示しています。</p>
          </div>
          <ul className="sprite-debug-unsupported-list">
            {visibleUnsupportedUnits.map((unit) => (
              <li key={unit.kind} className="sprite-debug-unsupported-item">
                <code>{unit.kind}</code>
                <span>{unit.renderMode}</span>
                <span>{unit.reason === "sprite logic not implemented" ? "sprite logic 未実装" : unit.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
