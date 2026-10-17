import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";
import { pages404Plugin } from "./scripts/pages-404.mjs";

/**
 * GitHub Pages build (`vite build --mode pages`, see .github/workflows/pages.yml).
 * Pages serves the repo under a subpath, so the Pages build sets `base` and the
 * router basepath follows it. Nitro is skipped and TanStack Start prerenders
 * the routes into `dist/client/` (gitignored), a fully static site. The
 * default `npm run build` (Vercel preset, `.vercel/output`) is untouched.
 */
const PAGES_BASE = "/mountain-cabin-bloom-honey/";

function isPagesBuild(mode: string): boolean {
  // Start's prerender step boots its own `vite preview` from this config
  // without `--mode`, so the flag is mirrored into the env for that inner pass.
  const pages = mode === "pages" || process.env.GROUT_PAGES_BUILD === "1";
  if (pages) process.env.GROUT_PAGES_BUILD = "1";
  return pages;
}

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// Existing standalone texture app; npm/Gknome wrappers own startup.
export default defineConfig(({ command, isPreview, mode }) => ({
  base: isPagesBuild(mode) ? PAGES_BASE : "/",
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    // Dev-only /__app-env, read by scripts/check-auth-invariant.mjs.
    appEnvPlugin(),
    // PWA head + ?install=1 tutorial page; runs before Start/Nitro.
    grokPwaPlugin(),
    tailwindcss(),
    tanstackStart(
      isPagesBuild(mode)
        ? {
            pages: [{ path: "/" }, { path: "/gallery" }, { path: "/studio" }, { path: "/examples" }],
            prerender: { enabled: true, crawlLinks: false, failOnError: true },
          }
        : undefined,
    ),
    // Pages mode skips Nitro: TanStack Start prerenders `pages` into the
    // client output (`dist/client`), which is uploaded as-is.
    ...((command === "build" || isPreview) && !isPagesBuild(mode)
      ? [
          nitro({
            preset: "vercel",
            // Auto-registers server/middleware/* (the PWA install page +
            // manifest + head-tag middleware). Nitro v3 defaults serverDir to
            // false, so removing this silently unwires /?install=1 on deploys.
            serverDir: "./server",
          }),
        ]
      : []),
    // Pages only: dist/client/404.html, which GitHub Pages serves for unknown
    // paths; it redirects to the gallery. Never part of the Vercel build.
    ...(isPagesBuild(mode) ? [pages404Plugin()] : []),
    viteReact(),
  ],
}));
