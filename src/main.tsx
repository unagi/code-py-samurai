import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "bootstrap-icons/font/bootstrap-icons.css";
import "./web/styles.css";
import "./i18n/config";
import App from "./web/App";
import { readThemeStorage } from "./web/progress-storage";
import ReferencePage from "./web/ReferencePage";
import ErrorBoundary from "./web/ErrorBoundary";
import SpriteDebugPage from "./web/SpriteDebugPage";

const API_REFERENCE_PATH = "/reference/python-api";
const SPRITE_DEBUG_PATH = "/_debug";

const container = document.querySelector<HTMLDivElement>("#app");
if (!container) {
  throw new Error("#app was not found");
}

const normalizePathname = (pathname: string): string => {
  let value = pathname;
  while (value.length > 1 && value.endsWith("/")) {
    value = value.slice(0, -1);
  }
  return value;
};

const pathname = normalizePathname(globalThis.location.pathname);
const theme = readThemeStorage();
if (theme === "everforest-dark") {
  document.documentElement.removeAttribute("data-theme");
} else {
  document.documentElement.dataset.theme = theme;
}
let rootNode = <App />;
if (pathname === API_REFERENCE_PATH) {
  rootNode = <ReferencePage />;
} else if (pathname === SPRITE_DEBUG_PATH) {
  rootNode = <SpriteDebugPage />;
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      {rootNode}
    </ErrorBoundary>
  </StrictMode>,
);
