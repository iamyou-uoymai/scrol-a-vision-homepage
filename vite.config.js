import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        homepage: resolve(root, "index.html"),
        studio: resolve(root, "studio/index.html"),
        player: resolve(root, "player/index.html"),
      },
      output: {
        assetFileNames: (assetInfo) => assetInfo.name === "hero-scene.jpg"
          ? "assets/hero-scene.jpg"
          : "assets/[name]-[hash][extname]",
      },
    },
  },
});