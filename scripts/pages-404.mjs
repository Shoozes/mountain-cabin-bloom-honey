/**
 * GitHub Pages serves `<site>/404.html` for any path it can't resolve. The
 * Pages build (`vite build --mode pages`) emits that page into the client
 * output root (`dist/client/404.html`); it sends visitors to the PNG gallery
 * via a meta refresh plus a JS redirect, both built from Vite's `base`.
 *
 * Only vite.config.ts's Pages mode registers `pages404Plugin`, so the default
 * (Vercel) `npm run build` never emits it.
 */

/** Normalise a Vite base to "/…/" form. */
export function normalizeBase(base = "/") {
  let out = String(base || "/");
  if (!out.startsWith("/")) out = `/${out}`;
  if (!out.endsWith("/")) out = `${out}/`;
  return out;
}

/** Gallery URL under `base`, with the trailing slash Pages serves directly. */
export function pagesGalleryUrl(base = "/") {
  return `${normalizeBase(base)}gallery/`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderPages404Html(base = "/") {
  const target = pagesGalleryUrl(base);
  const attr = escapeHtml(target);
  // JSON string literal, with "<" escaped so it can't close the script tag.
  const js = JSON.stringify(target).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Not found · Grout Shader</title>
<meta http-equiv="refresh" content="0; url=${attr}">
<link rel="icon" href="${escapeHtml(normalizeBase(base))}favicon.svg" type="image/svg+xml">
<link rel="canonical" href="${attr}">
<script>location.replace(${js});</script>
<style>html{color-scheme:dark;background:#11100e;color:#ece7df;font:15px/1.5 ui-sans-serif,system-ui,sans-serif}body{margin:0;display:grid;min-height:100vh;place-items:center}a{color:inherit}</style>
</head>
<body>
<p>Page not found. Taking you to the <a href="${attr}">texture gallery</a>…</p>
</body>
</html>
`;
}

/** Vite plugin: emit `404.html` at the client output root for the Pages build. */
export function pages404Plugin() {
  let base = "/";
  return {
    name: "grout:pages-404",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    generateBundle() {
      // Client output only (dist/client); never the SSR bundle.
      const env = this.environment;
      if (env && env.name !== "client") return;
      this.emitFile({ type: "asset", fileName: "404.html", source: renderPages404Html(base) });
    },
  };
}
