import test from "node:test";
import assert from "node:assert/strict";
import { detectSpriteComponents, importSpriteComponents, renderFrame, buildArtExport, extractFrame, parseRecipe } from "../packages/grout-art/index.mjs";

const clear = [71, 82, 93, 0];
const px = (width, height, colors) => ({ width, height, data: Uint8ClampedArray.from(colors.flat()) });
const blank = (w, h) => Array.from({ length: w * h }, () => clear);
const at = (w, a, x, y, color) => { a[y * w + x] = color; };
const rgbaAt = (image, x, y) => [...image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];

test("component detection uses hard alpha, first-visible row-major IDs and selected connectivity", async () => {
  const colors = blank(3, 3); at(3, colors, 0, 0, [0, 0, 0, 255]); at(3, colors, 1, 1, [9, 8, 7, 255]);
  const image = px(3, 3, colors);
  const four = await detectSpriteComponents(image, { connectivity: 4 }), eight = await detectSpriteComponents(image);
  assert.equal(eight.connectivity, 8);
  assert.deepEqual(Object.keys(four), ["width", "height", "connectivity", "components"]);
  assert.deepEqual(four.components, [
    { id: 0, x: 0, y: 0, width: 1, height: 1, pixels: 1 },
    { id: 1, x: 1, y: 1, width: 1, height: 1, pixels: 1 },
  ]);
  assert.deepEqual(eight.components, [{ id: 0, x: 0, y: 0, width: 2, height: 2, pixels: 2 }]);
});

test("default component frames preserve black palette index zero, color, edges, holes and overlapping boxes", async () => {
  const w = 13, h = 13, colors = blank(w, h), black = [0, 0, 0, 255], red = [240, 20, 30, 255], blue = [20, 50, 220, 255];
  for (let y = 1; y < 10; y++) for (let x = 1; x < 10; x++) if (x === 1 || y === 1 || x === 9 || y === 9) at(w, colors, x, y, black);
  at(w, colors, 5, 5, red); // enclosed but disconnected from the ring under 8-connectivity
  at(w, colors, 12, 12, blue); // single pixel on the far edge
  const image = px(w, h, colors), recipe = await importSpriteComponents(image, { padding: 0 });
  assert.equal(recipe.frames.length, 3);
  assert.equal(recipe.importedSprite.format, "sprite-components/1");
  assert.equal(recipe.importedSprite.frameOrder, "component-row-major");
  assert.equal(recipe.palette.color000, "#000000");
  const ring = renderFrame(recipe, 0), dot = renderFrame(recipe, 1), edge = renderFrame(recipe, 2);
  assert.deepEqual([ring.width, ring.height, ...ring.data], [9, 9, ...Uint8Array.from(Array.from({ length: 81 }, (_, i) => i % 9 === 0 || i % 9 === 8 || i < 9 || i >= 72 ? black : [0, 0, 0, 0]).flat())]);
  assert.deepEqual(rgbaAt(dot, 0, 0), red);
  assert.deepEqual(rgbaAt(edge, 0, 0), blue);
  assert.equal(ring.data[(4 * 9 + 4) * 4 + 3], 0);
  const kit = buildArtExport(recipe);
  for (const frame of kit.frames) assert.deepEqual([...extractFrame(kit.atlas, frame.name).data], [...frame.data]);
});

test("explicit groups retain group order, canonical member order and exact whole-sheet reconstruction", async () => {
  const w = 6, colors = blank(w, 2), red = [201, 30, 20, 255], blue = [10, 40, 210, 255], green = [30, 190, 70, 255];
  at(w, colors, 0, 0, red); at(w, colors, 2, 0, blue); at(w, colors, 5, 1, green);
  const image = px(w, 2, colors);
  const options = { groups: [[2, 0], [1]], padding: 1, anchor: [1, 2], sourceSha256: "a".repeat(64), sourceName: "sheet.png" };
  const recipe = await importSpriteComponents(image, options);
  assert.deepEqual(await importSpriteComponents(image, options), recipe);
  assert.equal(recipe.importedSprite.frameOrder, "component-groups");
  assert.deepEqual(recipe.importedSprite.regions.map((r) => r.components), [[0, 2], [1]]);
  assert.deepEqual(recipe.frames.map((f) => f.name), ["frame-000", "frame-001"]);
  assert.deepEqual(recipe.frames.map((f) => f.anchor), [[1, 2], [1, 2]]);
  assert.deepEqual(recipe.importedSprite.source, { name: "sheet.png", sha256: "a".repeat(64), width: w, height: 2, frames: 1 });
  assert.deepEqual(parseRecipe(recipe), recipe);
  const reconstructed = blank(w, 2);
  for (const region of recipe.importedSprite.regions) {
    const frame = renderFrame(recipe, recipe.frames.findIndex((f) => f.name === region.frame));
    assert.equal(frame.width, recipe.width);
    for (let fy = 0; fy < frame.height; fy++) for (let fx = 0; fx < frame.width; fx++) {
      const c = rgbaAt(frame, fx, fy);
      if (c[3]) at(w, reconstructed, region.x + fx - region.offset[0], region.y + fy - region.offset[1], c);
    }
  }
  const normalizedSource = Array.from(image.data, (n, i) => image.data[Math.floor(i / 4) * 4 + 3] === 0 ? 0 : n);
  const rawReconstruction = reconstructed.flat();
  const normalizedReconstruction = rawReconstruction.map((n, i) => rawReconstruction[Math.floor(i / 4) * 4 + 3] === 0 ? 0 : n);
  assert.deepEqual(normalizedReconstruction, normalizedSource);
});

test("invalid transparency, empty inputs, malformed groups and resource limits reject", async () => {
  await assert.rejects(detectSpriteComponents(px(1, 1, [[1, 2, 3, 0]])), /no opaque pixels/);
  await assert.rejects(detectSpriteComponents(px(1, 1, [[1, 2, 3, 64]])), /Partial transparency/);
  const image = px(3, 1, [[1, 2, 3, 255], clear, [4, 5, 6, 255]]);
  for (const groups of [[[0], [0]], [[0]], [[0], [2]], [[0], [1], [2]], [[]]])
    await assert.rejects(importSpriteComponents(image, { groups }));
  await assert.rejects(importSpriteComponents(image, { connectivity: 6 }), /Connectivity/);
  await assert.rejects(importSpriteComponents(image, { padding: 33 }), /Padding/);
  await assert.rejects(importSpriteComponents(image, { anchor: [0] }), /Anchor/);
  await assert.rejects(importSpriteComponents(image, { extra: true }), /Unknown/);
  await assert.rejects(detectSpriteComponents({ ...image, extra: true }), /Unknown pixel input/);
  await assert.rejects(importSpriteComponents(image, {}, { unsupported: true }), /Unknown control option/);
  await assert.rejects(detectSpriteComponents({ width: 2, height: 1, data: new Uint8Array(4) }), /tightly packed/);
  await assert.rejects(detectSpriteComponents({ width: 1025, height: 1024, data: new Uint8Array(1025 * 1024 * 4) }), /decoded source pixels/);
  const many = blank(31, 31);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (x * 2 < 31 && y * 2 < 31) at(31, many, x * 2, y * 2, [1, 2, 3, 255]);
  await assert.rejects(importSpriteComponents(px(31, 31, many), { padding: 32 }), /output exceeds/);
  const tooMany = blank(35, 35);
  for (let y = 0; y < 33; y++) for (let x = 0; x < 33; x++) if (x % 2 === 0 && y % 2 === 0) at(35, tooMany, x, y, [1, 2, 3, 255]);
  await assert.rejects(detectSpriteComponents(px(35, 35, tooMany)), /at most 256/);
  await assert.rejects(importSpriteComponents(px(513, 1, Array(513).fill([1, 2, 3, 255])), { padding: 0 }), /Frame width/);
  const colors = Array.from({ length: 257 }, (_, i) => [i & 255, i >> 8, 0, 255]);
  await assert.rejects(importSpriteComponents(px(257, 1, colors), { padding: 0 }), /256 visible colors/);
});

test("detection and conversion cancel before work and during yielded loops", async () => {
  const sample = px(1, 1, [[1, 2, 3, 255]]);
  await assert.rejects(detectSpriteComponents(sample, {}, { signal: AbortSignal.abort() }), { name: "AbortError" });
  await assert.rejects(importSpriteComponents(sample, {}, { signal: AbortSignal.abort() }), { name: "AbortError" });
  const image = px(128, 128, Array(128 * 128).fill([8, 9, 10, 255]));
  const detectController = new AbortController(), detecting = detectSpriteComponents(image, {}, { signal: detectController.signal });
  setTimeout(() => detectController.abort(), 1);
  await assert.rejects(detecting, { name: "AbortError" });
  const side = 481, sparse = blank(side, side);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) at(side, sparse, 15 + x * 30, 15 + y * 30, [8, 9, 10, 255]);
  const conversionInput = px(side, side, sparse), convertController = new AbortController(), originalSetTimeout = globalThis.setTimeout;
  let zeroTimers = 0;
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay === 0 && ++zeroTimers === 113) convertController.abort();
    return originalSetTimeout(callback, delay, ...args);
  };
  try {
    await assert.rejects(importSpriteComponents(conversionInput, { padding: 0 }, { signal: convertController.signal }), { name: "AbortError" });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});
