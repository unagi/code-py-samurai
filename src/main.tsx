import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "bootstrap-icons/font/bootstrap-icons.css";
import "./web/styles.css";
import App from "./web/App";

const container = document.querySelector<HTMLDivElement>("#app");
if (!container) {
  throw new Error("#app was not found");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
