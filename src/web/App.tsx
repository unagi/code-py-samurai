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
import { BoardGridView } from "./BoardGridView";
import {
  type DamagePopup,
  type SpriteOverride,
} from "./board-effects";
import { buildBoardGrid } from "./board-grid";
import { buildBoardDisplayGrid, type BoardDisplayMode } from "./board-display-grid";
import { createCodeEditor } from "./code-editor";
import { type StatsFormatter } from "./board-stats";
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
import { ResultModal } from "./ResultModal";
import {
  SAMURAI_IDLE_FRAME_COUNT,
  SAMURAI_IDLE_FRAME_MS,
  SPRITE_CAPABLE_KINDS,
  SPRITE_FRAME_MS,
} from "./sprite-config";
import { absoluteDirToSpriteDir, type SpriteDir } from "./sprite-utils";
import { useGameController } from "./use-game-controller";

function buildStarterPlayerCode(comment: string): string {
  return `class Player:\n    def play_turn(self, samurai):\n        ${comment}\n        pass`;
}

const BOARD_TILE_GAP_PX = 2;
const BOARD_TILE_BASE_SIZE_PX = 80;
const COMPACT_BOARD_VIEWPORT_WIDTH_THRESHOLD_PX = 1080;
const BOARD_DESC_PANEL_HEIGHT_PX = 56;
const BOARD_LOG_PANEL_HEIGHT_PX = 160;
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
  const [boardViewportWidthPx, setBoardViewportWidthPx] = useState(0);
  const [samuraiFrame, setSamuraiFrame] = useState(0);
  const [canScrollLevelProgressLeft, setCanScrollLevelProgressLeft] = useState(false);
  const [canScrollLevelProgressRight, setCanScrollLevelProgressRight] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const boardViewportRef = useRef<HTMLDivElement | null>(null);
  const levelProgressScrollRef = useRef<HTMLDivElement | null>(null);
  const activeLevelStepRef = useRef<HTMLButtonElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);

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
  const shouldCompactBoardByWidth = boardViewportWidthPx > 0 && boardViewportWidthPx < COMPACT_BOARD_VIEWPORT_WIDTH_THRESHOLD_PX;
  const boardDisplayMode: BoardDisplayMode = shouldCompactBoardByWidth ? "floor-only" : "full";
  const boardDisplayGrid = useMemo(
    () => buildBoardDisplayGrid(boardGrid, boardDisplayMode),
    [boardGrid, boardDisplayMode],
  );
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
      const cols = Math.max(boardDisplayGrid.columns, 1);
      const availableWidth = Math.max(0, viewport.clientWidth);
      setBoardViewportWidthPx((prev) => (prev === availableWidth ? prev : availableWidth));
      const tileByWidth = (availableWidth - BOARD_TILE_GAP_PX * (cols - 1)) / cols;
      const computed = Math.max(1, Math.floor(Math.min(tileByWidth, BOARD_TILE_BASE_SIZE_PX)));
      setTileSizePx(computed);
    };

    computeTileSize();
    const observer = new ResizeObserver(computeTileSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [boardDisplayGrid.columns, boardDisplayGrid.rows]);

  const boardGridStyle = useMemo(() => {
    return {
      gridTemplateColumns: `repeat(${Math.max(boardDisplayGrid.columns, 1)}, ${tileSizePx}px)`,
      gridTemplateRows: `repeat(${Math.max(boardDisplayGrid.rows, 1)}, ${tileSizePx}px)`,
      gap: `${BOARD_TILE_GAP_PX}px`,
    } as CSSProperties;
  }, [boardDisplayGrid.columns, boardDisplayGrid.rows, tileSizePx]);
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
    setIsSettingsMenuOpen(false);
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

  useEffect(() => {
    if (!isSettingsMenuOpen) return;

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (settingsMenuRef.current?.contains(target)) return;
      if (settingsTriggerRef.current?.contains(target)) return;
      setIsSettingsMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setIsSettingsMenuOpen(false);
      settingsTriggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSettingsMenuOpen]);

  useEffect(() => {
    const scroller = levelProgressScrollRef.current;
    if (!scroller) return;

    const updateScrollState = (): void => {
      const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      setCanScrollLevelProgressLeft(scroller.scrollLeft > 1);
      setCanScrollLevelProgressRight(scroller.scrollLeft < maxScrollLeft - 1);
    };

    updateScrollState();

    const handleScroll = (): void => updateScrollState();
    scroller.addEventListener("scroll", handleScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => updateScrollState());
    resizeObserver.observe(scroller);
    if (scroller.firstElementChild instanceof HTMLElement) {
      resizeObserver.observe(scroller.firstElementChild);
    }

    return () => {
      scroller.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, [allLevelSteps.length]);

  useEffect(() => {
    const scroller = levelProgressScrollRef.current;
    const active = activeLevelStepRef.current;
    if (!scroller || !active) return;
    active.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [currentGlobalLevel]);

  const scrollLevelProgressBy = (direction: -1 | 1): void => {
    const scroller = levelProgressScrollRef.current;
    if (!scroller) return;
    const stepPx = Math.max(220, Math.floor(scroller.clientWidth * 0.68));
    scroller.scrollBy({ left: direction * stepPx, behavior: "smooth" });
  };

  const handleLanguageChange = (lang: string): void => {
    void i18n.changeLanguage(lang);
    setIsSettingsMenuOpen(false);
  };

  const levelDescKey = `levels.${towerName}.${localLevel}.description`;
  const levelTipKey = `levels.${towerName}.${localLevel}.tip`;
  const levelClueKey = `levels.${towerName}.${localLevel}.clue`;
  const hasClue = i18n.exists(levelClueKey);

  return (
    <>
      <header className="app-header-band">
        <div className="layout app-header-layout">
          <section className="hero">
            <div className="hero-line" />
            <h1>{t("app.title")} ⚔️🐱</h1>
            <div className="hero-line" />
          </section>

          <div className="top-controls">
            <div className="top-controls-main">
              <nav className="level-progress" aria-label={t("nav.levelProgress")}>
                <button
                  type="button"
                  className="level-progress-nav level-progress-nav-left"
                  onClick={() => scrollLevelProgressBy(-1)}
                  disabled={!canScrollLevelProgressLeft}
                  aria-label={`${t("nav.levelProgress")} ←`}
                >
                  <i className="bi bi-chevron-left" aria-hidden="true" />
                </button>
                <div className="level-progress-shell">
                  <span
                    className={`level-progress-fade level-progress-fade-left${canScrollLevelProgressLeft ? " visible" : ""}`}
                    aria-hidden="true"
                  />
                  <span
                    className={`level-progress-fade level-progress-fade-right${canScrollLevelProgressRight ? " visible" : ""}`}
                    aria-hidden="true"
                  />
                  <div className="level-progress-scroll" ref={levelProgressScrollRef}>
                    <div className="level-progress-track">
                      {allLevelSteps.map((globalLvl, index) => {
                        const isActive = globalLvl === currentGlobalLevel;
                        const isCleared = globalLvl < samuraiLevel && !isActive;
                        const isLocked = !isLevelAccessible(globalLvl);
                        const showsCompletedPath = globalLvl < samuraiLevel;

                        let className = "progress-step";
                        if (isActive) className += " active";
                        else if (isCleared) className += " cleared";
                        if (isLocked) className += " locked";

                        const connectorClass = showsCompletedPath
                          ? "progress-connector progress-connector-cleared"
                          : "progress-connector progress-connector-locked";

                        return (
                          <div key={globalLvl} className="progress-node-group">
                            <button
                              ref={isActive ? activeLevelStepRef : undefined}
                              type="button"
                              className={className}
                              disabled={isPlaying || isLocked}
                              onClick={() => goToLevel(globalLvl)}
                              aria-label={isLocked
                                ? t("nav.levelLocked", { level: globalLvl })
                                : t("board.lv", { level: globalLvl })}
                              aria-current={isActive ? "step" : undefined}
                            >
                              <span className="progress-step-number">{String(globalLvl).padStart(2, "0")}</span>
                              {isCleared ? (
                                <span className="progress-step-badge" aria-hidden="true">
                                  <i className="bi bi-check" />
                                </span>
                              ) : null}
                              {isLocked ? (
                                <span className="progress-step-lock" aria-hidden="true">
                                  <i className="bi bi-lock-fill" />
                                </span>
                              ) : null}
                            </button>
                            {index < allLevelSteps.length - 1 ? <span className={connectorClass} aria-hidden="true" /> : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="level-progress-nav level-progress-nav-right"
                  onClick={() => scrollLevelProgressBy(1)}
                  disabled={!canScrollLevelProgressRight}
                  aria-label={`${t("nav.levelProgress")} →`}
                >
                  <i className="bi bi-chevron-right" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
          <div className="top-controls-side">
            <div className="settings-menu-container">
              <button
                ref={settingsTriggerRef}
                type="button"
                className="settings-trigger"
                aria-label={t("app.settings")}
                aria-haspopup="dialog"
                aria-expanded={isSettingsMenuOpen}
                onClick={() => setIsSettingsMenuOpen((prev) => !prev)}
              >
                <i className="bi bi-gear-fill" aria-hidden="true" />
              </button>
              {isSettingsMenuOpen ? (
                <div className="settings-menu-panel" ref={settingsMenuRef} aria-label={t("app.settings")}>
                  <div className="settings-menu-arrow" aria-hidden="true" />
                  <div className="settings-menu-section">
                    <label className="settings-menu-label" htmlFor="settings-language-select">
                      {t("nav.language")}
                    </label>
                    <select
                      id="settings-language-select"
                      className="settings-language-select"
                      value={i18n.language}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      aria-label={t("nav.language")}
                    >
                      <option value="en">EN</option>
                      <option value="ja">JA</option>
                    </select>
                  </div>
                  <div className="settings-menu-divider" aria-hidden="true" />
                  <button
                    type="button"
                    className="settings-menu-danger"
                    onClick={handleClearData}
                    disabled={isPlaying}
                  >
                    <span className="icon-label"><i className="bi bi-trash3" />{t("app.clearData")}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="layout app-main-layout">
        <section className="workspace">
          <article className="console-panel">
            <div
              id="board"
              className="board-viewport"
              ref={boardViewportRef}
              style={{
                "--board-desc-height": `${BOARD_DESC_PANEL_HEIGHT_PX}px`,
                "--board-log-height": `${BOARD_LOG_PANEL_HEIGHT_PX}px`,
              } as CSSProperties}
            >
              <div className="board-status">
                <span className="status-chip">
                  {t("board.samurai")} {t(samuraiRank.key)} {t("board.lv", { level: samuraiLevel })}  {t("board.hp", { current: samuraiHealth ?? "--", max: samuraiMaxHealth ?? "--" })}  {t("board.atk", { value: 5 })}
                </span>
                {hoveredEnemyStats ? <span className="status-chip status-chip-sub">{hoveredEnemyStats}</span> : null}
              </div>
              <section className="board-description-panel" aria-label={t("board.heading")}>
                <p className="board-description-text">{t(levelDescKey)}</p>
              </section>
              <div className="board-stage">
                <BoardGridView
                  boardGrid={boardGrid}
                  boardGridStyle={boardGridStyle}
                  displayGrid={boardDisplayGrid}
                  t={t}
                  damagePopupsByTile={damagePopupsByTile}
                  spriteOverrideByTile={spriteOverrideByTile}
                  spriteDirByTile={spriteDirByTile}
                  samuraiFrame={samuraiFrame}
                  samuraiHealth={samuraiHealth}
                  samuraiMaxHealth={samuraiMaxHealth}
                  statsFmt={statsFmt}
                  tileSizePx={tileSizePx}
                  onHoveredEnemyStatsChange={setHoveredEnemyStats}
                />
              </div>
              <section className="board-log-panel" aria-label={t("logs.heading")}>
                <pre id="logs">{formattedLogs || t("logs.empty")}</pre>
              </section>
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
            </div>
          </article>
        </div>
        <aside className="api-panel api-panel-standalone" aria-labelledby="api-block-heading">
          <h3 id="api-block-heading">📚 {t("editor.apiHeading")}</h3>
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
      </section>

        <ResultModal
          isOpen={showResultModal}
          result={result}
          t={t}
          hasClue={hasClue}
          levelClueKey={levelClueKey}
          hasNextLevel={hasNextLevel}
          onRetry={() => {
            setShowResultModal(false);
            startLevel();
          }}
          onNextLevel={() => goToLevel(currentGlobalLevel + 1)}
          onClose={() => setShowResultModal(false)}
        />
      </main>
    </>
  );
}
