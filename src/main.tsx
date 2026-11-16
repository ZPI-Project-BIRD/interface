import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import SessionApp from "./SessionApp";
import { initializeTheme } from "./stores/themeStore";

const disposeTheme = initializeTheme();
if (import.meta.hot) import.meta.hot.dispose(disposeTheme);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionApp />
  </StrictMode>,
);
