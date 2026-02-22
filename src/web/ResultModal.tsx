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

  return (
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
        {showClue ? (
          <p className="clue-box">
            <strong>{t("result.clue")}</strong> {t(levelClueKey)}
          </p>
        ) : null}
        <div className="controls">
          <button onClick={onRetry}>
            <span className="icon-label"><i className="bi bi-arrow-repeat" />{t("result.retry")}</span>
          </button>
          {showNextButton ? (
            <button onClick={onNextLevel}>
              <span className="icon-label"><i className="bi bi-skip-forward-fill" />{t("result.next")}</span>
            </button>
          ) : (
            <button onClick={onClose}>
              <span className="icon-label"><i className="bi bi-check2-circle" />{t("result.close")}</span>
            </button>
          )}
        </div>
      </article>
    </dialog>
  );
}
