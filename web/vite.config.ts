import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@shared": path.resolve(root, "../src/shared"),
      cn: path.resolve(root, "src/lib/utils.ts"),
    },
  },
  build: {
    outDir: path.resolve(root, "../dist/miniapp"),
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
  },
  server: {
    host: true,
    port: 5173,
  },
});
