import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { activeNotices, type Notice } from "./notices";

const STORAGE_KEY = "py-samurai:dismissed-notices";

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage may be unavailable in private browsing
  }
}

function isExpired(notice: Notice): boolean {
  if (!notice.expiresAt) return false;
  return new Date(notice.expiresAt).getTime() < Date.now();
}

/**
 * Renders a single-line notice strip for each active (non-dismissed, non-expired) notice.
 * Renders nothing when there are no notices to show.
 */
export default function NoticeLine() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(readDismissed);

  const visible = activeNotices.filter(
    (n) => !dismissed.includes(n.id) && !isExpired(n),
  );

  const handleDismiss = useCallback(
    (id: string) => {
      const next = [...dismissed, id];
      setDismissed(next);
      writeDismissed(next);
    },
    [dismissed],
  );

  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((notice) => (
        <div
          key={notice.id}
          className={`notice-line notice-line-${notice.severity}`}
          role="status"
        >
          <i
            className={
              notice.severity === "warning"
                ? "bi bi-exclamation-triangle-fill"
                : "bi bi-info-circle-fill"
            }
          />
          <span className="notice-line-message">
            {t(notice.messageKey)}
            {notice.link && (
              <>
                {" "}
                <a
                  href={notice.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {notice.linkLabelKey ? t(notice.linkLabelKey) : notice.link}
                </a>
              </>
            )}
          </span>
          <button
            type="button"
            className="notice-line-dismiss"
            aria-label={t("notices.dismiss")}
            onClick={() => handleDismiss(notice.id)}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
      ))}
    </>
  );
}
