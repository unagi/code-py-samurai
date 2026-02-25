import { Trans, useTranslation } from "react-i18next";

import { GITHUB_ISSUES_URL, GITHUB_REPO_URL, ORIGINAL_REPO_URL } from "./site-links";

export default function AppFooter() {
  const { t } = useTranslation();

  return (
    <footer className="app-footer">
      <div className="app-footer-inner layout">
        <span className="app-footer-copyright">
          &copy; 2026 unagi &middot;{" "}
          <a
            href={`${GITHUB_REPO_URL}/blob/main/LICENSE`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("footer.license")}
          </a>
        </span>

        <span className="app-footer-credit">
          <Trans
            i18nKey="footer.basedOn"
            values={{ project: "ruby-warrior", author: "Ryan Bates" }}
            components={{
              projectLink: (
                <a
                  href={ORIGINAL_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              ),
            }}
          />
        </span>

        <nav className="app-footer-links" aria-label="Footer links">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("footer.source")}
          >
            <i className="bi bi-github" />
            <span>{t("footer.source")}</span>
          </a>
          <a
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className="bi bi-bug" />
            <span>{t("footer.reportBug")}</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}
