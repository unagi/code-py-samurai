import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { type EditorView } from "codemirror";

import type { SamuraiAbilitySet } from "../engine/types";
import {
  getTowerAndLocalFromGlobal,
  getSamuraiAbilitiesAtGlobalLevel,
  getSamuraiRank,
  samuraiAbilitiesToEngineAbilities,
} from "../engine/samurai-abilities";
import { towers } from "../levels";
import {
  type DamagePopup,
  type SpriteOverride,
} from "./board-effects";
import { buildBoardGrid } from "./board-grid";
import { createCodeEditor } from "./code-editor";
import { buildTileStatsText, type StatsFormatter } from "./board-stats";
import { formatLogEntry } from "./log-format";
import {
  buildSamuraiLevel,
  clearStoredAppData,
  migrateToGlobalLevel,
  readPlayerCodeStorage,
  readProgressStorage,
  writePlayerCodeStorage,
  writeProgressStorage,
} from "./progress-storage";
import {
  CHAR_SPRITES,
  SAMURAI_IDLE_FRAME_COUNT,
  SAMURAI_IDLE_FRAME_MS,
  SPRITE_CAPABLE_KINDS,
  SPRITE_FRAME_MS,
  getSamuraiIdleFramePath,
} from "./sprite-config";
import { absoluteDirToSpriteDir, resolveSpriteDir, type SpriteDir } from "./sprite-utils";
import { useGameController } from "./use-game-controller";

function buildStarterPlayerCode(comment: string): string {
  return `class Player:\n    def play_turn(self, samurai):\n        ${comment}\n        pass`;
}

const BOARD_TILE_GAP_PX = 2;
const TOTAL_LEVELS = towers.reduce((sum, t) => sum + t.levelCount, 0);

export default function App() {
  const { t, i18n } = useTranslation();
  const initialProgress = readProgressStorage();
  const [currentGlobalLevel, setCurrentGlobalLevel] = useState(() => {
    return migrateToGlobalLevel(initialProgress, TOTAL_LEVELS);
  });
  const [samuraiLevel, setSamuraiLevel] = useState<number>(() => {
    return buildSamuraiLevel(initialProgress);
  });

  const { towerName, localLevel } = useMemo(
    () => getTowerAndLocalFromGlobal(currentGlobalLevel),
    [currentGlobalLevel],
  );
  const isLevelAccessible = (globalLvl: number): boolean => globalLvl <= samuraiLevel;
  const [speedMs, setSpeedMs] = useState(450);
  const starterCode = buildStarterPlayerCode(t("starterCode.comment"));
  const [playerCode, setPlayerCode] = useState(() => readPlayerCodeStorage(starterCode));
  const [hoveredEnemyStats, setHoveredEnemyStats] = useState<string | null>(null);
  const [tileSizePx, setTileSizePx] = useState(20);
  const [samuraiFrame, setSamuraiFrame] = useState(0);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const boardViewportRef = useRef<HTMLDivElement | null>(null);

  const selectedTower = useMemo(() => {
    return towers.find((item) => item.name === towerName) ?? towers[0];
  }, [towerName]);
  const level = useMemo(() => {
    return selectedTower.getLevel(localLevel) ?? selectedTower.levels[0];
  }, [selectedTower, localLevel]);
  const unlockedSamuraiAbilities = useMemo<SamuraiAbilitySet>(() => {
    return getSamuraiAbilitiesAtGlobalLevel(samuraiLevel);
  }, [samuraiLevel]);
  const unlockedEngineAbilities = useMemo(
    () => samuraiAbilitiesToEngineAbilities(unlockedSamuraiAbilities),
    [unlockedSamuraiAbilities],
  );
  const {
    isPlaying,
    canPlay,
    board,
    logEntries,
    result,
    samuraiHealth,
    samuraiMaxHealth,
    damagePopups,
    spriteOverrides,
    showResultModal,
    setIsCodeDirty,
    setShowResultModal,
    handlePlay,
    handlePause,
    handleReset,
    startLevel,
    stopTimer,
    expireDamagePopups,
    expireSpriteOverrides,
    unitTileIndexMapRef,
    unitDirectionMapRef,
  } = useGameController({
    level,
    playerCode,
    unlockedEngineAbilities,
    currentGlobalLevel,
    totalLevels: TOTAL_LEVELS,
    speedMs,
    spriteCapableKinds: SPRITE_CAPABLE_KINDS,
    setSamuraiLevel,
    onResetVisualState: () => setHoveredEnemyStats(null),
  });
  const availableMethods = useMemo(
    () => unlockedSamuraiAbilities.skills.map((item) => `samurai.${item}`),
    [unlockedSamuraiAbilities.skills],
  );
  const availableProperties = useMemo(
    () => unlockedSamuraiAbilities.stats.map((item) => `samurai.${item}`),
    [unlockedSamuraiAbilities.stats],
  );
  const statsFmt: StatsFormatter = useMemo(() => ({
    hp: (current, max) => t("board.hp", { current, max }),
    atk: (value) => t("board.atk", { value }),
  }), [t]);
  const boardGrid = useMemo(() => buildBoardGrid(board), [board]);
  const formattedLogs = useMemo(() => {
    if (logEntries.length === 0) return "";
    return logEntries.map((entry) => formatLogEntry(entry, t)).join("\n");
  }, [logEntries, t]);
  const allLevelSteps = useMemo(() => {
    return Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1);
  }, []);
  const hasNextLevel = currentGlobalLevel < TOTAL_LEVELS;
  const samuraiRank = useMemo(() => getSamuraiRank(samuraiLevel), [samuraiLevel]);
  useLayoutEffect(() => {
    const viewport = boardViewportRef.current;
    if (!viewport) return;

    const computeTileSize = (): void => {
      const cols = Math.max(boardGrid.columns, 1);
      const rows = Math.max(boardGrid.rows, 1);
      const availableWidth = Math.max(0, viewport.clientWidth);
      const availableHeight = Math.max(0, viewport.clientHeight);
      const tileByWidth = (availableWidth - BOARD_TILE_GAP_PX * (cols - 1)) / cols;
      const tileByHeight = (availableHeight - BOARD_TILE_GAP_PX * (rows - 1)) / rows;
      const computed = Math.max(1, Math.floor(Math.min(tileByWidth, tileByHeight)));
      setTileSizePx(computed);
    };

    computeTileSize();
    const observer = new ResizeObserver(computeTileSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [boardGrid.columns, boardGrid.rows]);

  const boardGridStyle = useMemo(() => {
    return {
      gridTemplateColumns: `repeat(${Math.max(boardGrid.columns, 1)}, ${tileSizePx}px)`,
      gridTemplateRows: `repeat(${Math.max(boardGrid.rows, 1)}, ${tileSizePx}px)`,
      gap: `${BOARD_TILE_GAP_PX}px`,
    } as CSSProperties;
  }, [boardGrid.columns, boardGrid.rows, tileSizePx]);
  /** タイルインデックス → 最新のスプライトオーバーライド */
  const spriteOverrideByTile = useMemo(() => {
    const map = new Map<number, SpriteOverride>();
    // 同じタイルに複数オーバーライドがある場合、最新のもの（後ろ）を優先
    for (const o of spriteOverrides) {
      map.set(o.tileIndex, o);
    }
    return map;
  }, [spriteOverrides]);

  /** tileIndex → SpriteDir (エンジンの facing direction から算出) */
  const spriteDirByTile = useMemo(() => {
    const map = new Map<number, SpriteDir>();
    const idxMap = unitTileIndexMapRef.current;
    const dirMap = unitDirectionMapRef.current;
    for (const [unitId, tileIdx] of idxMap) {
      const absDir = dirMap.get(unitId);
      if (absDir) map.set(tileIdx, absoluteDirToSpriteDir(absDir));
    }
    return map;
    // spriteOverrides を deps に入れることでターン毎に再計算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spriteOverrides, board]);

  const damagePopupsByTile = useMemo(() => {
    const grouped = new Map<number, DamagePopup[]>();
    for (const popup of damagePopups) {
      const list = grouped.get(popup.tileIndex);
      if (list) {
        list.push(popup);
      } else {
        grouped.set(popup.tileIndex, [popup]);
      }
    }
    return grouped;
  }, [damagePopups]);

  const goToLevel = (globalLvl: number): void => {
    if (globalLvl < 1 || globalLvl > TOTAL_LEVELS) return;
    if (!isLevelAccessible(globalLvl)) return;
    stopTimer();
    setShowResultModal(false);
    setCurrentGlobalLevel(globalLvl);
  };

  const applyCodeToEditor = (code: string): void => {
    const view = editorViewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === code) return;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: code,
      },
    });
  };

  const handleClearData = (): void => {
    const ok = globalThis.confirm(t("app.clearDataConfirm"));
    if (!ok) return;

    stopTimer();
    setShowResultModal(false);
    setHoveredEnemyStats(null);
    clearStoredAppData();

    setCurrentGlobalLevel(1);
    setSamuraiLevel(1);
    setPlayerCode(starterCode);
    applyCodeToEditor(starterCode);
    setIsCodeDirty(true);
  };

  useEffect(() => {
    if (!editorHostRef.current) return;

    editorViewRef.current = createCodeEditor(editorHostRef.current, playerCode, (code) => {
      setPlayerCode(code);
      setIsCodeDirty(true);
    });

    return () => {
      stopTimer();
      if (editorViewRef.current) {
        editorViewRef.current.destroy();
        editorViewRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const animationTimer = globalThis.setInterval(() => {
      setSamuraiFrame((prev) => (prev + 1) % SAMURAI_IDLE_FRAME_COUNT);
    }, SAMURAI_IDLE_FRAME_MS);
    return () => globalThis.clearInterval(animationTimer);
  }, []);

  // 統合タイマー: ポップアップ/オーバーライド期限切れ + スプライトフレーム更新トリガー
  // spriteRenderTick は参照不要だが、state更新による再レンダリングでフレーム進行させる
  const [, setSpriteRenderTick] = useState(0);

  useEffect(() => {
    const timer = globalThis.setInterval(() => {
      expireDamagePopups();
      expireSpriteOverrides();
      setSpriteRenderTick((prev) => (prev + 1) % 1000);
    }, SPRITE_FRAME_MS);
    return () => globalThis.clearInterval(timer);
  }, []);

  useEffect(() => {
    writeProgressStorage(currentGlobalLevel, samuraiLevel);
  }, [currentGlobalLevel, samuraiLevel]);

  useEffect(() => {
    writePlayerCodeStorage(playerCode);
  }, [playerCode]);

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const levelDescKey = `levels.${towerName}.${localLevel}.description`;
  const levelTipKey = `levels.${towerName}.${localLevel}.tip`;
  const levelClueKey = `levels.${towerName}.${localLevel}.clue`;
  const hasClue = i18n.exists(levelClueKey);

  return (
    <main className="layout">
      <section className="hero">
        <div className="hero-line" />
        <h1>{t("app.title")} ⚔️🐱</h1>
        <div className="hero-line" />
        <select
          className="lang-selector"
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          aria-label={t("nav.language")}
        >
          <option value="en">EN</option>
          <option value="ja">JA</option>
        </select>
      </section>

      <div className="top-controls">
        <div className="top-controls-main">
          <nav className="level-progress" aria-label={t("nav.levelProgress")}>
            {allLevelSteps.map((globalLvl) => {
              const isActive = globalLvl === currentGlobalLevel;
              const isCleared = globalLvl < samuraiLevel && !isActive;
              const isLocked = !isLevelAccessible(globalLvl);

              let className = "progress-step";
              if (isActive) className += " active";
              else if (isCleared) className += " cleared";
              if (isLocked) className += " locked";

              return (
                <button
                  key={globalLvl}
                  type="button"
                  className={className}
                  disabled={isPlaying || isLocked}
                  onClick={() => goToLevel(globalLvl)}
                  aria-label={isLocked
                    ? t("nav.levelLocked", { level: globalLvl })
                    : t("board.lv", { level: globalLvl })}
                >
                  {t("board.lv", { level: globalLvl })}
                  {isActive ? <i className="bi bi-geo-alt-fill" /> : null}
                  {isCleared ? <i className="bi bi-check-lg" /> : null}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="top-controls-side">
          <button type="button" className="danger-button" onClick={handleClearData} disabled={isPlaying}>
            <span className="icon-label"><i className="bi bi-trash3" />{t("app.clearData")}</span>
          </button>
        </div>
      </div>

      <section className="workspace">
          <article className="console-panel">
            <div className="console-header">
              <h2>🗺️ {t("board.heading")}</h2>
              <p className="description">{t(levelDescKey)}</p>
            </div>
            <div id="board" className="board-viewport" ref={boardViewportRef} style={{ aspectRatio: `${boardGrid.columns} / ${boardGrid.rows}` }}>
              <div className="board-status">
                <span className="status-chip">
                  {t("board.samurai")} {t(samuraiRank.key)} {t("board.lv", { level: samuraiLevel })}  {t("board.hp", { current: samuraiHealth ?? "--", max: samuraiMaxHealth ?? "--" })}  {t("board.atk", { value: 5 })}
                </span>
                {hoveredEnemyStats ? <span className="status-chip status-chip-sub">{hoveredEnemyStats}</span> : null}
              </div>
              <div
                className="board-grid"
                role="img"
                aria-label={t("board.ariaLabel", { rows: boardGrid.rows, columns: boardGrid.columns })}
                style={boardGridStyle}
              >
                {boardGrid.tiles.map((tile, index) => {
                  const displaySymbol = tile.emoji ?? (tile.symbol === " " ? "\u00a0" : tile.symbol);
                  const tilePopups = damagePopupsByTile.get(index) ?? [];
                  const tileStats = buildTileStatsText(tile.kind, samuraiHealth, samuraiMaxHealth, statsFmt);
                  const tileAlt = t(tile.altKey);

                  // スプライトオーバーライド判定
                  const override = spriteOverrideByTile.get(index);
                  const overrideSpriteConfig = override ? CHAR_SPRITES[override.kind] : undefined;
                  const ownSpriteConfig = CHAR_SPRITES[tile.kind];
                  const spriteDir: SpriteDir = spriteDirByTile.get(index) ?? "right";

                  // ベースタイル画像 (床・壁・idle スプライト等)
                  let baseTileImageSrc: string | undefined;
                  if (tile.kind === "samurai") {
                    baseTileImageSrc = getSamuraiIdleFramePath(samuraiFrame);
                  } else if (!override && ownSpriteConfig) {
                    // オーバーライドなし & 自身がスプライト対応キャラ → idle (方向付き)
                    baseTileImageSrc = resolveSpriteDir(ownSpriteConfig.idle.pathTemplate, spriteDir);
                  } else if (override && ownSpriteConfig) {
                    // オーバーライドあり & タイルがキャラ本人 → オーバーライドで上書き（下にベース不要）
                    baseTileImageSrc = undefined;
                  } else {
                    // 通常タイル（床・壁等）
                    baseTileImageSrc = tile.assetPath;
                  }

                  // オーバーライドスプライト (attack / damaged / death)
                  let overlaySrc: string | undefined;
                  let overlayFrames = 1;
                  let overlayCurrentFrame = 0;
                  if (override && overrideSpriteConfig) {
                    const stateConfig = overrideSpriteConfig[override.state];
                    overlaySrc = resolveSpriteDir(stateConfig.pathTemplate, spriteDir);
                    overlayFrames = stateConfig.frames;
                    if (overlayFrames > 1) {
                      const elapsed = Date.now() - override.startedAt;
                      overlayCurrentFrame = Math.min(
                        Math.floor(elapsed / SPRITE_FRAME_MS),
                        overlayFrames - 1,
                      );
                    }
                  }

                  return (
                    <div
                      key={`${index}-${tile.kind}-${tile.symbol}`}
                      className={`board-tile tile-${tile.kind}`}
                      title={tileAlt}
                      aria-label={tileAlt}
                      onMouseEnter={() => {
                        if (!tileStats) return;
                        if (tile.kind === "samurai") return;
                        setHoveredEnemyStats(`${tileAlt.toUpperCase()}  ${tileStats}`);
                      }}
                      onMouseLeave={() => setHoveredEnemyStats(null)}
                      onFocus={() => {
                        if (!tileStats) return;
                        if (tile.kind === "samurai") return;
                        setHoveredEnemyStats(`${tileAlt.toUpperCase()}  ${tileStats}`);
                      }}
                      onBlur={() => setHoveredEnemyStats(null)}
                    >
                      {/* ベースタイル（床・壁・idle スプライト） */}
                      {baseTileImageSrc ? (
                        <img src={baseTileImageSrc} alt={tileAlt} className="tile-image" />
                      ) : !overlaySrc ? (
                        <span className="tile-fallback" style={{ fontSize: `${Math.round(tileSizePx * 0.7)}px` }} aria-hidden="true">{displaySymbol}</span>
                      ) : null}

                      {/* オーバーレイ: スプライト状態 (attack / damaged / death) */}
                      {overlaySrc && overlayFrames <= 1 ? (
                        <img src={overlaySrc} alt={tileAlt} className="tile-image tile-sprite-overlay" />
                      ) : overlaySrc && overlayFrames > 1 ? (
                        <div
                          className="tile-sprite-sheet tile-sprite-overlay"
                          role="img"
                          aria-label={tileAlt}
                          style={{
                            backgroundImage: `url(${overlaySrc})`,
                            backgroundSize: `${overlayFrames * 100}% 100%`,
                            backgroundPositionX: `${(overlayCurrentFrame / (overlayFrames - 1)) * 100}%`,
                          }}
                        />
                      ) : null}
                      {tilePopups.map((popup) => (
                        <span key={popup.id} className="damage-popup" aria-hidden="true">
                          {popup.text}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="console-controls">
              <button onClick={handlePlay} disabled={isPlaying || !canPlay}>
                <span className="icon-label"><i className="bi bi-play-fill" />{t("controls.play")}</span>
              </button>
              <button onClick={handlePause} disabled={!isPlaying}>
                <span className="icon-label"><i className="bi bi-pause-fill" />{isPlaying ? t("controls.pause") : t("controls.paused")}</span>
              </button>
              <button onClick={handleReset}>
                <span className="icon-label"><i className="bi bi-arrow-repeat" />{t("controls.reset")}</span>
              </button>
              <label className="speed-label">
                <span className="icon-label"><i className="bi bi-lightning-charge-fill" />{t("controls.speed")}</span>
                <select
                  value={speedMs}
                  disabled={isPlaying}
                  onChange={(e) => setSpeedMs(Number(e.target.value))}
                >
                  <option value={700}>{t("controls.slow")}</option>
                  <option value={450}>{t("controls.normal")}</option>
                  <option value={220}>{t("controls.fast")}</option>
                </select>
              </label>
            </div>
          </article>
        <div className="bottom-columns">
          <article className="editor-panel">
            <div className="player-code-header">
              <h3>👨‍💻 {t("editor.heading")}</h3>
              <div className="tip-anchor">
                <button type="button" className="tip-trigger" aria-describedby="tips-popover">
                  <span className="icon-label"><i className="bi bi-lightbulb-fill" />{t("editor.tips")}</span>
                </button>
                <aside id="tips-popover" className="tips-popover" role="tooltip">
                  <h4>💡 {t("editor.tip")}</h4>
                  <p>{t(levelTipKey)}</p>
                  {hasClue ? (
                    <>
                      <h4>🧭 {t("editor.clue")}</h4>
                      <p>{t(levelClueKey)}</p>
                    </>
                  ) : null}
                </aside>
              </div>
            </div>
            <div className="editor-layout">
              <div className="editor-main">
                <div ref={editorHostRef} className="editor-host" />
                <p className="code-note">{t("editor.codeNote")}</p>
              </div>
              <aside className="api-panel">
                <h4>📚 {t("editor.apiHeading")}</h4>
                <h4>{t("editor.methods")}</h4>
                <ul className="api-list">
                  {availableMethods.length > 0 ? (
                    availableMethods.map((item) => <li key={item}>{item}</li>)
                  ) : (
                    <li>{t("editor.none")}</li>
                  )}
                </ul>
                <h4>{t("editor.properties")}</h4>
                <ul className="api-list">
                  {availableProperties.length > 0 ? (
                    availableProperties.map((item) => <li key={item}>{item}</li>)
                  ) : (
                    <li>{t("editor.none")}</li>
                  )}
                </ul>
              </aside>
            </div>
          </article>
          <article className="logs-panel">
            <h2>🖥️ {t("logs.heading")}</h2>
            <pre id="logs">{formattedLogs || t("logs.empty")}</pre>
          </article>
        </div>
      </section>

      {showResultModal && result ? (
        <dialog className="modal-backdrop" open aria-label={t("result.heading")}>
          <article className="modal-card">
            <h3>🏁 {t("result.heading")}</h3>
            <p className="result-status">{result.passed ? t("result.clear") : t("result.failed")}</p>
            <ul>
              <li>{t("result.turns")}: {result.turns}</li>
              <li>{t("result.totalScore")}: {result.totalScore}</li>
              <li>{t("result.timeBonus")}: {result.timeBonus}</li>
              <li>{t("result.grade")}: {result.grade ?? "-"}</li>
            </ul>
            {!result.passed && hasClue ? (
              <p className="clue-box">
                <strong>{t("result.clue")}</strong> {t(levelClueKey)}
              </p>
            ) : null}
            <div className="controls">
              <button
                onClick={() => {
                  setShowResultModal(false);
                  startLevel();
                }}
              >
                <span className="icon-label"><i className="bi bi-arrow-repeat" />{t("result.retry")}</span>
              </button>
              {result.passed && hasNextLevel ? (
                <button onClick={() => goToLevel(currentGlobalLevel + 1)}>
                  <span className="icon-label"><i className="bi bi-skip-forward-fill" />{t("result.next")}</span>
                </button>
              ) : (
                <button onClick={() => setShowResultModal(false)}>
                  <span className="icon-label"><i className="bi bi-check2-circle" />{t("result.close")}</span>
                </button>
              )}
            </div>
          </article>
        </dialog>
      ) : null}
    </main>
  );
}
