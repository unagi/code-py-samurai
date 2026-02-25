import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { GITHUB_ISSUES_URL } from "./site-links";

interface Props {
  readonly children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Fallback UI rendered when an unhandled error is caught. */
function FallbackContent({ error }: { readonly error: Error | null }) {
  const { t } = useTranslation();

  return (
    <div className="error-fallback">
      <img
        src="/assets/brand/title-logo.png"
        alt="Python侍"
        className="error-fallback-logo"
      />
      <h1 className="error-fallback-title">{t("errorBoundary.title")}</h1>
      <p className="error-fallback-description">
        {t("errorBoundary.description")}
      </p>
      <div className="error-fallback-actions">
        <button
          type="button"
          className="error-fallback-btn"
          onClick={() => globalThis.location.reload()}
        >
          {t("errorBoundary.reload")}
        </button>
        <a
          href={GITHUB_ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="error-fallback-link"
        >
          <i className="bi bi-github" /> {t("errorBoundary.reportBug")}
        </a>
      </div>
      {error && (
        <details className="error-fallback-details">
          <summary>{t("errorBoundary.details")}</summary>
          <pre>{error.message}</pre>
        </details>
      )}
    </div>
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("PySamurai error boundary caught:", error, info);
  }

  render(): ReactNode {
    return (
      <>
        {this.state.hasError
          ? <FallbackContent error={this.state.error} />
          : this.props.children}
      </>
    );
  }
}
