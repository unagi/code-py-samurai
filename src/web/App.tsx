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
  const boardDisplayMode: BoardDisplayMode = boardViewportWidthPx > 0 && boardViewportWidthPx < COMPACT_BOARD_VIEWPORT_WIDTH_THRESHOLD_PX
    ? "floor-only"
    : "full";
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
      const rows = Math.max(boardDisplayGrid.rows, 1);
      const availableWidth = Math.max(0, viewport.clientWidth);
      const isHeightClamped = viewport.scrollHeight > viewport.clientHeight + 1;
      const availableHeight = isHeightClamped
        ? Math.max(0, viewport.clientHeight - BOARD_LOG_PANEL_HEIGHT_PX)
        : Number.POSITIVE_INFINITY;
      setBoardViewportWidthPx((prev) => (prev === availableWidth ? prev : availableWidth));
      const tileByWidth = (availableWidth - BOARD_TILE_GAP_PX * (cols - 1)) / cols;
      const tileByHeight = Number.isFinite(availableHeight)
        ? (availableHeight - BOARD_TILE_GAP_PX * (rows - 1)) / rows
        : Number.POSITIVE_INFINITY;
      const computed = Math.max(1, Math.floor(Math.min(tileByWidth, tileByHeight, BOARD_TILE_BASE_SIZE_PX)));
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
            <div
              id="board"
              className="board-viewport"
              ref={boardViewportRef}
              style={{ "--board-log-height": `${BOARD_LOG_PANEL_HEIGHT_PX}px` } as CSSProperties}
            >
              <div className="board-status">
                <span className="status-chip">
                  {t("board.samurai")} {t(samuraiRank.key)} {t("board.lv", { level: samuraiLevel })}  {t("board.hp", { current: samuraiHealth ?? "--", max: samuraiMaxHealth ?? "--" })}  {t("board.atk", { value: 5 })}
                </span>
                {hoveredEnemyStats ? <span className="status-chip status-chip-sub">{hoveredEnemyStats}</span> : null}
              </div>
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
  );
}
