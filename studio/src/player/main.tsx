import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PlayerApp } from "./PlayerApp";
import "./player.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlayerApp />
  </StrictMode>,
);