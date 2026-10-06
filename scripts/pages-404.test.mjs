import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeBase,
  pages404Plugin,
  pagesGalleryUrl,
  renderPages404Html,
} from "./pages-404.mjs";

const BASE = "/mountain-cabin-bloom-honey/";
const TARGET = "/mountain-cabin-bloom-honey/gallery/";

test("gallery URL keeps the base and the trailing slash", () => {
  assert.equal(pagesGalleryUrl(BASE), TARGET);
  assert.equal(pagesGalleryUrl("/mountain-cabin-bloom-honey"), TARGET);
  assert.equal(pagesGalleryUrl("/"), "/gallery/");
  assert.equal(normalizeBase(""), "/");
});

test("404 page redirects to the gallery by meta refresh and by JS", () => {
  const html = renderPages404Html(BASE);
  assert.match(
    html,
    /<meta http-equiv="refresh" content="0; url=\/mountain-cabin-bloom-honey\/gallery\/">/,
  );
  assert.match(
    html,
    /<script>location\.replace\("\/mountain-cabin-bloom-honey\/gallery\/"\);<\/script>/,
  );
  assert.match(html, /<a href="\/mountain-cabin-bloom-honey\/gallery\/">/);
  assert.match(html, /href="\/mountain-cabin-bloom-honey\/favicon\.svg"/);
  assert.doesNotMatch(html, /url=\/gallery/);
});

test("404 page escapes the target in attributes and script", () => {
  const html = renderPages404Html('/x"</script><b>/');
  assert.doesNotMatch(html, /<\/script><b>/);
  assert.match(html, /&quot;&lt;\/script&gt;/);
});

test("plugin emits 404.html for the client environment only", () => {
  const plugin = pages404Plugin();
  plugin.configResolved({ base: BASE });
  const emitted = [];
  const ctx = (name) => ({ environment: { name }, emitFile: (file) => emitted.push(file) });
  plugin.generateBundle.call(ctx("ssr"));
  assert.equal(emitted.length, 0);
  plugin.generateBundle.call(ctx("client"));
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].fileName, "404.html");
  assert.match(emitted[0].source, /url=\/mountain-cabin-bloom-honey\/gallery\//);
  assert.equal(plugin.apply, "build");
});
