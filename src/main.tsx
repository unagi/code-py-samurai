import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "bootstrap-icons/font/bootstrap-icons.css";
import "./web/styles.css";
import "./i18n/config";
import App from "./web/App";
import ReferencePage from "./web/ReferencePage";

const API_REFERENCE_PATH = "/reference/python-api";

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
const rootNode = pathname === API_REFERENCE_PATH ? <ReferencePage /> : <App />;

createRoot(container).render(
  <StrictMode>
    {rootNode}
  </StrictMode>,
);
