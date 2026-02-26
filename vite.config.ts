import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dns from "node:dns";
import path from "node:path";

// Ensure localhost resolves to 127.0.0.1 (IPv4) on Windows.
// See: https://github.com/vitejs/vite/issues/18469
dns.setDefaultResultOrder("ipv4first");

export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/code-py-samurai/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": path.resolve(__dirname, "src/engine"),
      "@utils": path.resolve(__dirname, "src/utils"),
    },
  },
});
