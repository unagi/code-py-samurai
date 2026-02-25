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

/** Strip Vite BASE_URL prefix and trailing slashes to get a route-level path. */
const getRoutePath = (pathname: string): string => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  let value = pathname;
  if (base && value.startsWith(base)) {
    value = value.slice(base.length);
  }
  if (!value.startsWith("/")) {
    value = "/" + value;
  }
  while (value.length > 1 && value.endsWith("/")) {
    value = value.slice(0, -1);
  }
  return value;
};

const pathname = getRoutePath(globalThis.location.pathname);
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
