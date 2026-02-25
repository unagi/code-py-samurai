import type { ReactElement } from "react";

import type { LevelResult } from "@engine/level";

import type { TranslateFn } from "./log-format";

export interface ResultModalProps {
  isOpen: boolean;
  result: LevelResult | null;
  t: TranslateFn;
  hasClue: boolean;
  levelClueKey: string;
  hasNextLevel: boolean;
  onRetry: () => void;
  onNextLevel: () => void;
  onClose: () => void;
}

export function ResultModal(props: Readonly<ResultModalProps>): ReactElement | null {
  const {
    isOpen,
    result,
    t,
    hasClue,
    levelClueKey,
    hasNextLevel,
    onRetry,
    onNextLevel,
    onClose,
  } = props;

  if (!isOpen || !result) {
    return null;
  }

  const showClue = !result.passed && hasClue;
  const showNextButton = result.passed && hasNextLevel;
  const isHighGrade = result.grade === "S" || result.grade === "A";

  return (
    <dialog className="modal-backdrop" open aria-label={t("result.heading")}>
      <article className={`result-card ${result.passed ? "result-card--clear" : "result-card--failed"}`}>
        {/* Star decoration */}
        <div className="result-star" aria-hidden="true">
          <span className="result-star-icon">{result.passed ? "\u2b50" : "\u274c"}</span>
          <span className="result-star-sparkle result-star-sparkle--1">{"\u2728"}</span>
          <span className="result-star-sparkle result-star-sparkle--2">{"\u2728"}</span>
        </div>

        {/* Heading */}
        <h3 className="result-heading">
          {result.passed ? t("result.clear") : t("result.failed")}
        </h3>

        {/* Stat cards */}
        <div className="result-stats">
          <div className="result-stat-card">
            <span className="result-stat-label">{t("result.turns")}</span>
            <span className="result-stat-value">{result.turns}</span>
          </div>
          <div className="result-stat-card">
            <span className="result-stat-label">{t("result.totalScore")}</span>
            <span className="result-stat-value">{result.totalScore}</span>
          </div>
          <div className="result-stat-card">
            <span className="result-stat-label">{t("result.timeBonus")}</span>
            <span className="result-stat-value">{result.timeBonus}</span>
          </div>
          <div className={`result-stat-card result-stat-card--grade ${isHighGrade ? "result-stat-card--high-grade" : ""}`}>
            <span className="result-stat-label">{t("result.grade")}</span>
            <span className="result-stat-value result-grade-value">{result.grade ?? "-"}</span>
            {isHighGrade ? (
              <span className="result-grade-laurel" aria-hidden="true">{"\ud83c\udf1f"}</span>
            ) : null}
          </div>
        </div>

        {/* Clue */}
        {showClue ? (
          <p className="clue-box">
            <strong>{t("result.clue")}</strong> {t(levelClueKey)}
          </p>
        ) : null}

        {/* Action buttons */}
        <div className="result-actions">
          <button className="result-btn" onClick={onRetry}>
            <span className="icon-label"><i className="bi bi-arrow-repeat" />{t("result.retry")}</span>
          </button>
          {showNextButton ? (
            <button className="result-btn result-btn--primary" onClick={onNextLevel}>
              <span className="icon-label"><i className="bi bi-skip-forward-fill" />{t("result.next")}</span>
            </button>
          ) : (
            <button className="result-btn" onClick={onClose}>
              <span className="icon-label"><i className="bi bi-check2-circle" />{t("result.close")}</span>
            </button>
          )}
        </div>
      </article>
    </dialog>
  );
}
