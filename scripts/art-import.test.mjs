import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  importSpritePixels,
  importSpriteLayers,
  renderFrame,
  buildArtExport,
  extractFrame,
  editPixel,
  copy,
  createTravelerRecipe,
  getTravelerWardrobe,
  refineTravelerWalk,
  parseRecipe,
} from "../packages/grout-art/index.mjs";
const pixels = (w, h, values) => ({ width: w, height: h, data: Uint8Array.from(values.flat()) });
const red = [240, 32, 48, 255],
  blue = [40, 60, 200, 255],
  clear = [4, 5, 6, 0],
  black = [0, 0, 0, 255];
const read = async (name) =>
  JSON.parse(await fs.readFile(new URL("./fixtures/" + name, import.meta.url), "utf8"));
test("PNG conversion preserves visible pixels, zero palette ink, grid order and deduplicates masks", async () => {
  const input = pixels(4, 2, [black, red, black, red, clear, blue, clear, blue]);
  const r = await importSpritePixels(input, {
    frameWidth: 2,
    frameHeight: 2,
    sourceName: "original.png",
  });
  assert.equal(r.frames.length, 2);
  assert.equal(Object.keys(r.parts).length, 1);
  assert.equal(r.palette.color000, "#000000");
  assert.deepEqual([...renderFrame(r).data], [...black, ...red, 0, 0, 0, 0, ...blue]);
  assert.deepEqual(renderFrame(r), renderFrame(r, 1));
  assert.equal(r.importedSprite.sources[0].name, "original.png");
  const kit = buildArtExport(r);
  assert.match(kit.manifest.provenance.art, /user-supplied/);
  for (const f of kit.frames)
    assert.deepEqual([...extractFrame(kit.atlas, f.name).data], [...f.data]);
});
test("aligned animated layers retain source timing, independent edits and static broadcasts", async () => {
  const a = pixels(2, 1, [red, clear]),
    b = pixels(2, 1, [clear, blue]),
    base = pixels(2, 1, [black, black]);
  const r = await importSpriteLayers([
    { name: "Base", frames: [base] },
    { name: "Animated", frames: [a, b], durationsMs: [250, 500] },
  ]);
  assert.equal(r.layers.length, 2);
  assert.equal(r.frames.length, 2);
  assert.deepEqual(r.clips["sprite-000"], {
    frames: ["frame-000", "frame-001", "frame-001"],
    fps: 4,
  });
  assert.deepEqual([...renderFrame(r).data], [...red, ...black]);
  assert.deepEqual([...renderFrame(r, 1).data], [...black, ...blue]);
  const edited = editPixel(r, 0, "layer-1", 0, 0, null);
  assert.deepEqual([...renderFrame(edited).data], [...black, ...black]);
  assert.deepEqual(renderFrame(edited, 1), renderFrame(r, 1));
  assert.deepEqual(r.parts, copy(r).parts);
});
test("animated grid uses time then row-major frames and one clip per cell", async () => {
  const r = await importSpriteLayers(
    [{ frames: [pixels(2, 1, [red, blue]), pixels(2, 1, [blue, red])], durationsMs: [250, 250] }],
    { frameWidth: 1, frameHeight: 1 },
  );
  assert.deepEqual(r.clips["sprite-000"].frames, ["frame-000", "frame-002"]);
  assert.deepEqual(r.clips["sprite-001"].frames, ["frame-001", "frame-003"]);
  assert.deepEqual([...renderFrame(r, 2).data], blue);
});
test("margin, spacing, all-transparent input and 256 distinct inks remain exact", async () => {
  const rows = Array(15).fill(clear);
  rows[6] = red;
  rows[8] = blue;
  const r = await importSpritePixels(pixels(5, 3, rows), {
    frameWidth: 1,
    frameHeight: 1,
    margin: 1,
    spacing: 1,
  });
  assert.equal(r.frames.length, 2);
  assert.deepEqual([...renderFrame(r, 1).data], blue);
  const empty = await importSpritePixels(pixels(1, 1, [clear]));
  assert.deepEqual([...renderFrame(empty).data], [0, 0, 0, 0]);
  const colors = Array.from({ length: 256 }, (_, i) => [i, 0, 0, 255]);
  const many = await importSpritePixels(pixels(16, 16, colors));
  assert.equal(Object.keys(many.palette).length, 256);
  assert.deepEqual([...renderFrame(many).data], colors.flat());
});
test("invalid inputs reject explicitly, never quantize or silently flatten animation", async () => {
  const p = pixels(1, 1, [red]);
  for (const options of [
    { frameWidth: 2 },
    { frameWidth: 0 },
    { fps: 61 },
    { anchor: [0] },
    { unknown: true },
  ])
    await assert.rejects(() => importSpritePixels(p, options));
  await assert.rejects(
    () => importSpritePixels(pixels(1, 1, [[1, 2, 3, 127]])),
    /Partial transparency/,
  );
  await assert.rejects(
    () => importSpriteLayers([{ frames: [p, p], durationsMs: [17, 17] }]),
    /timing cannot/,
  );
  await assert.rejects(
    () =>
      importSpriteLayers([
        { frames: [p, p], durationsMs: [250, 250] },
        { frames: [p, p], durationsMs: [250, 500] },
      ]),
    /timings must match/,
  );
  await assert.rejects(() =>
    importSpriteLayers([
      { frames: [p, p], durationsMs: [250, 250] },
      { frames: [p, p, p], durationsMs: [250, 250, 250] },
    ]),
  );
  await assert.rejects(() => importSpritePixels(p, { sourceSha256: "oops" }), /SHA-256/);
  await assert.rejects(
    () =>
      importSpritePixels(
        pixels(
          257,
          1,
          Array.from({ length: 257 }, (_, i) => [i % 256, Math.floor(i / 256), 0, 255]),
        ),
      ),
    /256 visible colors/,
  );
  await assert.rejects(
    () => importSpritePixels({ width: 1025, height: 1024, data: new Uint8Array(1025 * 1024 * 4) }),
    /source pixels/,
  );
});
test("import cancellation interrupts the yielding conversion", async () => {
  const signal = AbortSignal.abort();
  await assert.rejects(() => importSpritePixels(pixels(1, 1, [red]), {}, { signal }), {
    name: "AbortError",
  });
  const controller = new AbortController();
  const pending = importSpritePixels(
    pixels(16, 16, Array(256).fill(red)),
    { frameWidth: 1, frameHeight: 1 },
    { signal: controller.signal },
  );
  setTimeout(() => controller.abort(), 3);
  await assert.rejects(pending, { name: "AbortError" });
});
test("optional outline is an editable recipe operation, separate from unchanged imported pixels", async () => {
  const r = await importSpritePixels(
    pixels(3, 3, [clear, clear, clear, clear, red, clear, clear, clear, clear]),
  );
  const source = r.layers[0].part;
  r.palette.outline = "#000000";
  r.parts.bordered = [
    { op: "outline", part: source, role: "outline" },
    { op: "use", part: source },
  ];
  r.frames[0].layers.sprite.part = "bordered";
  const out = renderFrame(parseRecipe(r));
  assert.deepEqual([...out.data.subarray(4, 8)], black);
  assert.deepEqual([...out.data.subarray(16, 20)], red);
  assert.equal(out.data[3], 0);
});
test("far shoe revision preserves front/back pixels and recovers preceding drafts without rewriting them", async () => {
  const old = await read("traveler-palette-feet-recipe-20261016.json"),
    now = createTravelerRecipe();
  assert.equal(getTravelerWardrobe(old).walk, "previous");
  assert.deepEqual(refineTravelerWalk(old), now);
  for (const i of [0, 1, 2, 9, 10, 11]) assert.deepEqual(renderFrame(old, i), renderFrame(now, i));
  for (const i of [3, 4, 5, 6, 7, 8]) {
    const a = renderFrame(old, i).data,
      b = renderFrame(now, i).data;
    assert.deepEqual(a.slice(0, 11 * 16 * 4), b.slice(0, 11 * 16 * 4));
    assert.notDeepEqual(a, b);
  }
  assert.deepEqual(old, await read("traveler-palette-feet-recipe-20261016.json"));
});
