import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { buildArtSvgs, buildArtExport, createTravelerRecipe, createExampleRecipe, importSpritePixels } from "../packages/grout-art/index.mjs";
import { ART_RUNTIME_URLS } from "../packages/grout-art/metrics.mjs";
import { ART_SOURCE_PATHS } from "./bake-art.mjs";

// Independent geometry coverage check; real SVG decoding is qualified in-browser.
function coverage(file) {
  const svg = new TextDecoder().decode(file.data);
  const [, width, height] = svg.match(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="(\d+)" height="(\d+)" viewBox="0 0 \1 \2" shape-rendering="crispEdges">/);
  const data = new Uint8Array(Number(width) * Number(height) * 4), touched = new Set();
  assert.ok(!/<(?:image|script|style|foreignObject|use)|href=|onload=|data:/.test(svg));
  for (const [, color, d] of svg.matchAll(/<path fill="#([\da-f]{6})" d="([^"]*)"\/>/g)) {
    const runs = [...d.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)];
    assert.equal(runs.map(run => run[0]).join(""), d);
    const rgb = [0, 2, 4].map(at => parseInt(color.slice(at, at + 2), 16));
    for (const [, left, top, length, back] of runs) {
      assert.equal(length, back);
      for (let x = Number(left); x < Number(left) + Number(length); x++) {
        assert.ok(x < Number(width) && Number(top) < Number(height));
        const p = Number(top) * Number(width) + x;
        assert.ok(!touched.has(p), "geometry never paints a pixel twice"); touched.add(p);
        data.set([...rgb, 255], p * 4);
      }
    }
  }
  return { width: Number(width), height: Number(height), data };
}

test("SVG paths preserve all native frames, bounds, anchors, colors and outlined pixels deterministically", async () => {
  const recipe = createTravelerRecipe();
  recipe.name = '<unsafe & "name">'; // Author text never enters SVG markup.
  recipe.outline = { enabled: true, color: "#26323f", width: 2, corners: "stepped" };
  const kit = buildArtExport(recipe, { atlas: { maxWidth: 24, maxHeight: 24 } });
  assert.ok(kit.atlas.pages.length > 1);
  const result = await buildArtSvgs(kit);
  assert.deepEqual(result, await buildArtSvgs(kit));
  assert.equal(result.metadata.format, "grout-art-svg/1");
  assert.equal(result.metadata.representation, "pixel-run-paths");
  for (const [i, source] of kit.recipe.frames.entries()) {
    const frame = result.metadata.frames[i];
    assert.deepEqual(frame, { name: source.name, path: `frame-${source.name}.svg`, width: 16, height: 16, anchor: source.anchor });
    assert.equal(result.files[i].name, frame.path);
    assert.deepEqual(coverage(result.files[i]), { width: 16, height: 16, data: kit.frames[i].data });
  }
});

test("SVG preserves non-square imports, transparent holes, disjoint runs, duplicate colors and blank source-sized frames", async () => {
  const width = 7, height = 5, data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
    if ((x + y) % 3 !== 1) data.set(x % 2 ? [0, 0, 0, 255] : [243, 17, 81, 255], (y * width + x) * 4);
  const recipe = await importSpritePixels({ width, height, data });
  recipe.palette.duplicate = Object.values(recipe.palette)[0];
  recipe.frames.push({ name: "blank", anchor: [-3, 8], layers: Object.fromEntries(recipe.layers.map(l => [l.id, { visible: false }])) });
  recipe.clips = {};
  const kit = buildArtExport(recipe), result = await buildArtSvgs(kit);
  assert.deepEqual(coverage(result.files[0]), { width, height, data });
  assert.deepEqual(coverage(result.files[1]), { width, height, data: new Uint8Array(data.length) });
  assert.deepEqual(result.metadata.frames[1].anchor, [-3, 8]);
  assert.ok(!new TextDecoder().decode(result.files[1].data).includes("<path"));
});

test("SVG rejects invalid frame kits, partial alpha and unsafe source identifiers; cancellation propagates", async () => {
  const kit = buildArtExport(createExampleRecipe("geometry"));
  await assert.rejects(buildArtSvgs(null), /kit/);
  await assert.rejects(buildArtSvgs({ ...kit, frames: [] }), /do not match/);
  for (const patch of [{ name: "bad" }, { width: 3 }, { data: new Uint8Array(2) }])
    await assert.rejects(buildArtSvgs({ ...kit, frames: [{ ...kit.frames[0], ...patch }] }), /invalid frame data/);
  const alpha = structuredClone(kit); alpha.frames[0].data[3] = 127;
  await assert.rejects(buildArtSvgs(alpha), /fully opaque or fully transparent/);
  const unsafe = structuredClone(kit); unsafe.recipe.frames[0].name = "../../evil";
  await assert.rejects(buildArtSvgs(unsafe), /identifier/);
  await assert.rejects(buildArtSvgs(kit, { signal: AbortSignal.abort(Error("SVG pre-abort")) }), /SVG pre-abort/);
  const controller = new AbortController(), pending = buildArtSvgs(kit, { signal: controller.signal });
  controller.abort(Error("SVG active cancel"));
  await assert.rejects(pending, /SVG active cancel/);
});

test("SVG aggregate output budget bounds high-entropy frame kits", async () => {
  const recipe = createExampleRecipe("geometry"); recipe.width = 512; recipe.height = 512; recipe.clips = {};
  recipe.frames = Array.from({ length: 64 }, (_, i) => ({ name: `budget${i}`, anchor: [0, 0] }));
  const data = new Uint8Array(512 * 512 * 4);
  for (let p = 0; p < 512 * 512; p++) data.set(p % 2 ? [1, 2, 3, 255] : [4, 5, 6, 255], p * 4);
  // A cached frame kit shares repeated decoded pixels, avoiding redundant bakes.
  const kit = { recipe, frames: recipe.frames.map(f => ({ ...f, width: 512, height: 512, data })) };
  await assert.rejects(buildArtSvgs(kit), /SVG output exceeds 32 MiB/);
});

test("SDK measurement and baker inventories cover every executable runtime module, including SVG", async () => {
  const files = (await fs.readdir(new URL("../packages/grout-art/", import.meta.url))).filter(f => f.endsWith(".mjs")).sort();
  assert.deepEqual(ART_RUNTIME_URLS.map(url => url.pathname.split("/").at(-1)).sort(), files);
  assert.deepEqual(ART_SOURCE_PATHS.map(file => file.split("/").at(-1)).sort(), files);
});
