import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import captiveGameplay from "@engine/unit-data/captive.gameplay.json";
import samuraiGameplay from "@engine/unit-data/samurai.gameplay.json";
import sludgeGameplay from "@engine/unit-data/sludge.gameplay.json";
import thickSludgeGameplay from "@engine/unit-data/thick-sludge.gameplay.json";

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
import {
  unitAnimationTypeSpecs,
  unitPreviewSlotSpecs,
  type UnitAnimationType,
  type UnitAnimationTypeSpec,
} from "./sprite-debug-unit-animation-specs";
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
const ENEMY_EMOJI_KINDS = new Set(["archer"]);
interface EnemyPreviewGroup {
  kind: string;
  renderMode: "sprite" | "emoji";
  cards: SpriteDebugCardSpec[];
}

type UnitPreviewPanelVariant = "captive" | "enemy" | "samurai";

interface UnitPreviewPanelSlotView {
  id: string;
  label: string;
  isActiveSlot: boolean;
  boardGrid: BoardGridData | null;
  spriteDir: SpriteDir | null;
  spriteOverride: SpriteOverride | null;
  boardGridStyle: CSSProperties;
  tileSizePx: number;
}

interface UnitPreviewPanelButtonView {
  id: string;
  label: UnitAnimationType;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface UnitPreviewPanelView {
  variant: UnitPreviewPanelVariant;
  buttonColumns: 2 | 4;
  buttonsAriaLabel: string;
  slots: readonly UnitPreviewPanelSlotView[];
  buttons: readonly UnitPreviewPanelButtonView[];
}

function animationTypeToDebugState(animationType: UnitAnimationType): DebugSpriteButtonState {
  if (animationType === "Idle") return "idle";
  if (animationType === "Offence") return "attack";
  if (animationType === "Damaged") return "damaged";
  return "death";
}

const DEBUG_STATS_FORMATTER: StatsFormatter = {
  hp: (current, max) => `HP ${current}/${max}`,
  atk: (value) => `ATK ${value}`,
};

const SLUDGE_DEBUG_ALT_KEY = `tiles.${sludgeGameplay.nameKey}`;
const THICK_SLUDGE_DEBUG_ALT_KEY = `tiles.${thickSludgeGameplay.nameKey}`;
const CAPTIVE_DEBUG_ALT_KEY = `tiles.${captiveGameplay.nameKey}`;
const SAMURAI_DEBUG_ALT_KEY = `tiles.${samuraiGameplay.nameKey}`;

const TILE_SPEC_BY_KIND: Readonly<Record<string, BoardTile>> = {
  [samuraiGameplay.kind]: { symbol: samuraiGameplay.symbol, kind: samuraiGameplay.kind, altKey: SAMURAI_DEBUG_ALT_KEY },
  [sludgeGameplay.kind]: {
    symbol: sludgeGameplay.symbol,
    kind: sludgeGameplay.kind,
    altKey: SLUDGE_DEBUG_ALT_KEY,
  },
  [thickSludgeGameplay.kind]: {
    symbol: thickSludgeGameplay.symbol,
    kind: thickSludgeGameplay.kind,
    altKey: THICK_SLUDGE_DEBUG_ALT_KEY,
  },
  [captiveGameplay.kind]: {
    symbol: captiveGameplay.symbol,
    kind: captiveGameplay.kind,
    altKey: CAPTIVE_DEBUG_ALT_KEY,
  },
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
  const unitPreviewTileSizePx = 80;
  const unitPreviewBoardGridStyle = useMemo<CSSProperties>(() => ({
    gridTemplateColumns: `repeat(1, ${unitPreviewTileSizePx}px)`,
    gridTemplateRows: `repeat(1, ${unitPreviewTileSizePx}px)`,
    gap: "0px",
  }), [unitPreviewTileSizePx]);

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

  const padUnitPreviewSlots = (slots: readonly UnitPreviewPanelSlotView[]): UnitPreviewPanelSlotView[] => {
    const padded = [...slots];
    while (padded.length < 4) {
      padded.push({
        id: `placeholder-${padded.length + 1}`,
        label: "",
        isActiveSlot: false,
        boardGrid: null,
        spriteDir: null,
        spriteOverride: null,
        boardGridStyle: unitPreviewBoardGridStyle,
        tileSizePx: unitPreviewTileSizePx,
      });
    }
    return padded;
  };

  const renderUnitPreviewPanel = (view: UnitPreviewPanelView) => {
    const panelClass = "sprite-debug-unit-preview-panel";
    const topClass = "sprite-debug-unit-preview-top";
    const buttonsClass = `sprite-debug-unit-animation-buttons is-cols-${view.buttonColumns}`;
    const slots = padUnitPreviewSlots(view.slots);

    return (
      <div className={panelClass}>
        <div className={topClass}>
          <div className="sprite-debug-unit-preview-row">
            {slots.map((slot) => {
              let slotContent = <div className="sprite-debug-unit-preview-placeholder" aria-hidden="true" />;

              if (slot.boardGrid && slot.spriteDir) {
                const spriteDirByTile = new Map<number, SpriteDir>();
                spriteDirByTile.set(0, slot.spriteDir);
                const spriteOverrideByTile = new Map<number, SpriteOverride>();
                if (slot.spriteOverride) {
                  spriteOverrideByTile.set(0, slot.spriteOverride);
                }
                slotContent = (
                  <BoardGridView
                    boardGrid={slot.boardGrid}
                    boardGridStyle={slot.boardGridStyle}
                    t={boardTranslate}
                    damagePopupsByTile={EMPTY_DAMAGE_POPUPS}
                    spriteOverrideByTile={spriteOverrideByTile}
                    spriteDirByTile={spriteDirByTile}
                    samuraiFrame={samuraiFrame}
                    samuraiHealth={20}
                    samuraiMaxHealth={20}
                    statsFmt={DEBUG_STATS_FORMATTER}
                    tileSizePx={slot.tileSizePx}
                    onHoveredEnemyStatsChange={NOOP_HOVER}
                  />
                );
              }

              return (
                <div key={`${view.variant}-${slot.id}`} className="sprite-debug-unit-preview-col">
                  <div className={`sprite-debug-unit-preview-box${slot.isActiveSlot ? " sprite-debug-unit-preview-box-active" : ""}`}>
                    {slotContent}
                    <div
                      className={`sprite-debug-unit-preview-caption${slot.label ? "" : " sprite-debug-unit-preview-caption-empty"}`}
                      aria-hidden={slot.label ? undefined : "true"}
                    >
                      {slot.label || "\u00a0"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className={buttonsClass} role="group" aria-label={view.buttonsAriaLabel}>
            {view.buttons.map((button) => (
              <button
                key={button.id}
                type="button"
                className={button.active ? "sprite-debug-button-active" : undefined}
                onClick={button.onClick}
                disabled={button.disabled}
              >
                <span className="icon-label">
                  <i className="bi bi-play-fill" aria-hidden="true" />
                  {button.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const buildUnitPreviewPanelSlots = (params: {
    panelKey: string;
    slotDefs: ReturnType<typeof unitPreviewSlotSpecs>;
    cards: readonly SpriteDebugCardSpec[];
    boardGrid: BoardGridData | null;
    boardGridStyle: CSSProperties;
    tileSizePx: number;
    hideBoard?: boolean;
  }): UnitPreviewPanelSlotView[] => {
    return params.slotDefs.map((slotDef, index) => {
      const card = slotDef.spriteDir
        ? (params.cards.find((item) => item.spriteDir === slotDef.spriteDir) ?? null)
        : null;
      const spriteOverride = !params.hideBoard && card ? (cardOverrides[card.id] ?? null) : null;

      return {
        id: `${params.panelKey}-slot-${index + 1}`,
        label: slotDef.label,
        isActiveSlot: true,
        boardGrid: !params.hideBoard && card && params.boardGrid ? params.boardGrid : null,
        spriteDir: card?.spriteDir ?? slotDef.spriteDir,
        spriteOverride,
        boardGridStyle: params.boardGridStyle,
        tileSizePx: params.tileSizePx,
      };
    });
  };

  const renderUnitAnimationSpecArt = (spec: UnitAnimationTypeSpec, keyPrefix: string) => {
    if (spec.artLayout === "pair-grid") {
      return (
        <div className="sprite-debug-unit-spec-art">
          <div className="sprite-debug-unit-spec-art-grid-pair">
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
                <div className="sprite-debug-unit-spec-art-empty" aria-hidden="true" />
                <div className="sprite-debug-unit-spec-art-empty" aria-hidden="true" />
              </>
            )}
          </div>
        </div>
      );
    }

    if (spec.artLayout === "quad-grid") {
      return (
        <div className="sprite-debug-unit-spec-art">
          <div className="sprite-debug-unit-spec-art-grid-quad">
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
              <div className="sprite-debug-unit-spec-art-empty" aria-hidden="true" />
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="sprite-debug-unit-spec-art">
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
          <div className="sprite-debug-unit-spec-art-empty" aria-hidden="true" />
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
      <div className="sprite-debug-motion-coverage sprite-debug-unit-motion-coverage" aria-label={ariaLabel}>
        <ul className="sprite-debug-unit-spec-list">
          {specs.map((spec) => (
            <li key={`${keyPrefix}-${spec.animationType}`} className="sprite-debug-unit-spec-item">
              <div className="sprite-debug-unit-spec-header">
                <code>{spec.animationType.toLowerCase()}</code>
                <span
                  className={`sprite-debug-coverage-chip ${
                    spec.status === "ok" ? "sprite-debug-coverage-chip-ok" : "sprite-debug-coverage-chip-ng"
                  }`}
                >
                  {spec.status.toUpperCase()}
                </span>
              </div>
              <dl className="sprite-debug-unit-spec-grid">
                <dt>trigger</dt>
                <dd>{spec.trigger}</dd>
                <dt>sprite file</dt>
                <dd>
                  <div className="sprite-debug-unit-spec-file-list">
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
              const animationSpecs = unitAnimationTypeSpecs({ kind: "samurai" });
              const samuraiBoardGrid = boardGridByKind.get("samurai") ?? null;
              const samuraiPreviewSlots = buildUnitPreviewPanelSlots({
                panelKey: "samurai",
                slotDefs: unitPreviewSlotSpecs({ kind: "samurai" }),
                cards: visibleSamuraiCards,
                boardGrid: samuraiBoardGrid,
                boardGridStyle: unitPreviewBoardGridStyle,
                tileSizePx: unitPreviewTileSizePx,
              });

              return (
                <article key="samurai-group" className="sprite-debug-card sprite-debug-unit-card sprite-debug-card-samurai">
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
                  {renderUnitPreviewPanel({
                    variant: "samurai",
                    buttonColumns: 4,
                    buttonsAriaLabel: "samurai animation buttons",
                    slots: samuraiPreviewSlots,
                    buttons: animationSpecs.map((spec) => {
                      const state = animationTypeToDebugState(spec.animationType);
                      return {
                        id: `samurai-anim-${spec.animationType}`,
                        label: spec.animationType,
                        active: currentState === state,
                        disabled: spec.animationType !== "Idle",
                        onClick: () => handleTriggerStateForCards(visibleSamuraiCards, state),
                      };
                    }),
                  })}
                  {renderUnitFooter(
                    animationSpecs,
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
              const animationSpecs = unitAnimationTypeSpecs({
                kind: group.kind,
                renderMode: group.renderMode,
                cards: group.cards,
              });
              const enemyBoardGrid = boardGridByKind.get(group.kind) ?? null;
              const previewPanel = (
                <>{renderUnitPreviewPanel({
                  variant: "enemy",
                  buttonColumns: 4,
                  buttonsAriaLabel: `${group.kind} enemy animation buttons`,
                  slots: buildUnitPreviewPanelSlots({
                    panelKey: group.kind,
                    slotDefs: unitPreviewSlotSpecs({ kind: group.kind, renderMode: group.renderMode }),
                    cards: group.cards,
                    boardGrid: enemyBoardGrid,
                    boardGridStyle,
                    tileSizePx,
                  }),
                  buttons: animationSpecs.map((spec) => {
                    const state = animationTypeToDebugState(spec.animationType);
                    return {
                      id: `${group.kind}-anim-${spec.animationType}`,
                      label: spec.animationType,
                      active: currentState === state,
                      disabled: group.renderMode === "emoji",
                      onClick: () => handleTriggerStateForCards(group.cards, state),
                    };
                  }),
                })}</>
              );
              return (
                <article
                  key={`enemy-group-${group.kind}`}
                  className="sprite-debug-card sprite-debug-unit-card sprite-debug-card-enemy"
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
                  {group.renderMode === "sprite" && !enemyBoardGrid ? null : previewPanel}
                  {renderUnitFooter(
                    animationSpecs,
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
              const currentCaptiveLocalState = captiveLocalState ?? "bound";
              const animationSpecs = unitAnimationTypeSpecs({ kind: card.kind });
              const captiveBoardGrid = boardGridByKind.get("captive") ?? null;

              return (
                <article key={card.id} className="sprite-debug-card sprite-debug-unit-card sprite-debug-card-captive">
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

                  {renderUnitPreviewPanel({
                    variant: "captive",
                    buttonColumns: 2,
                    buttonsAriaLabel: `${card.id} captive animation buttons`,
                    slots: buildUnitPreviewPanelSlots({
                      panelKey: card.id,
                      slotDefs: unitPreviewSlotSpecs({ kind: "captive" }),
                      cards: [card],
                      boardGrid: captiveBoardGrid,
                      boardGridStyle: unitPreviewBoardGridStyle,
                      tileSizePx: unitPreviewTileSizePx,
                      hideBoard: currentCaptiveLocalState === "rescued",
                    }),
                    buttons: animationSpecs.map((spec) => ({
                      id: `${card.id}-anim-${spec.animationType}`,
                      label: spec.animationType,
                      active:
                        (spec.animationType === "Idle" && currentCaptiveLocalState === "bound")
                        || (spec.animationType === "Disappear" && currentCaptiveLocalState === "rescued"),
                      onClick: () => handleCaptiveLocalState(card, spec.animationType === "Disappear" ? "rescued" : "bound"),
                    })),
                  })}
                  {renderUnitFooter(
                    animationSpecs,
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
