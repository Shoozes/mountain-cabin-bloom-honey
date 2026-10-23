import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { pages404Plugin } from "./scripts/pages-404.mjs";

const PAGES_BASE = "/mountain-cabin-bloom-honey/";
function isPagesBuild(mode: string): boolean {
  // Prerender starts an inner preview without --mode; retain the selected base.
  const pages = mode === "pages" || process.env.GROUT_PAGES_BUILD === "1";
  if (pages) process.env.GROUT_PAGES_BUILD = "1";
  return pages;
}

// Both builds are portable static sites in dist/client; no hosting adapter.
export default defineConfig(({ mode }) => ({
  base: isPagesBuild(mode) ? PAGES_BASE : "/",
  server: { host: "0.0.0.0", port: 8080, strictPort: true },
  preview: { host: "127.0.0.1", port: 8081, strictPort: true },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart({
      pages: [{ path: "/" }, { path: "/gallery" }, { path: "/studio" }, { path: "/examples" }],
      prerender: { enabled: true, crawlLinks: false, failOnError: true },
    }),
    ...(isPagesBuild(mode) ? [pages404Plugin()] : []),
    viteReact(),
  ],
}));
