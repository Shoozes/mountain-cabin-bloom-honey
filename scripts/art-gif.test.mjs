import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildArtGifs } from "../packages/grout-art/gif.mjs";
import { buildArtExport } from "../packages/grout-art/export.mjs";
import { importSpritePixels } from "../packages/grout-art/import.mjs";
import { createExampleRecipe, createTravelerRecipe } from "../packages/grout-art/traveler.mjs";

function makeKit({ fps = 8, framePixels, frames = ["study"], clipFrames = frames, width = 16, height = 16 } = {}) {
  const recipe = createExampleRecipe("geometry");
  recipe.width = width; recipe.height = height;
  recipe.clips = { walk: { frames: clipFrames, fps } };
  recipe.frames = frames.map((name) => ({ ...recipe.frames[0], name }));
  const kit = buildArtExport(recipe);
  if (framePixels) kit.frames.forEach((frame, i) => { frame.data = Uint8Array.from(framePixels[i]); });
  return kit;
}

function solid(r, g, b, a = 255, count = 16 * 16) {
  const data = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) data.set([r, g, b, a], i * 4);
  return data;
}

function parseBlocks(gif) {
  const bytes = gif.data, gce = [], localFlags = [];
  let at = 13, packed = bytes[10];
  if (packed & 0x80) at += 3 * (2 ** ((packed & 7) + 1));
  const skipSubBlocks = () => { while (bytes[at]) at += bytes[at++] + 1; at++; };
  while (at < bytes.length && bytes[at] !== 0x3b) {
    const marker = bytes[at++];
    if (marker === 0x21) {
      const label = bytes[at++];
      if (label === 0xf9) { gce.push(bytes[at + 1]); at += 6; }
      else { at += 1 + bytes[at]; skipSubBlocks(); }
    } else if (marker === 0x2c) {
      const flags = bytes[at + 8]; localFlags.push(flags); at += 9;
      if (flags & 0x80) at += 3 * (2 ** ((flags & 7) + 1));
      at++; skipSubBlocks();
    } else throw Error(`unexpected GIF block 0x${marker.toString(16)}`);
  }
  return { gce, localFlags };
}

test("GIF metadata, loop extension, exact source dimensions and cumulative 8/60 fps delays", async () => {
  const eight = await buildArtGifs(makeKit({ frames: ["study", "held"], clipFrames: ["study", "held", "held"], fps: 8 }));
  assert.deepEqual(eight.metadata, {
    format: "grout-art-gif/1", loop: "infinite", timing: "rounded-cumulative-centiseconds", palette: "exact-per-frame",
    clips: [{ name: "walk", path: "clip-walk.gif", width: 16, height: 16, fps: 8, frames: ["study", "held", "held"], delaysCs: [13, 12, 13], durationCs: 38, transparent: true }],
  });
  assert.equal(eight.files[0].name, "clip-walk.gif");
  assert.equal(new TextDecoder().decode(eight.files[0].data.subarray(0, 6)), "GIF89a");
  assert.ok([...eight.files[0].data].some((byte, i, all) => byte === 0x4e && all[i + 1] === 0x45 && all[i + 2] === 0x54 && all[i + 3] === 0x53));
  assert.deepEqual(parseBlocks(eight.files[0]).gce.map((packed) => packed >> 2 & 7), [2, 2, 2]);

  const sixty = await buildArtGifs(makeKit({ frames: ["study"], clipFrames: Array(60).fill("study"), fps: 60 }));
  const delays = sixty.metadata.clips[0].delaysCs;
  assert.equal(delays.length, 60);
  assert.ok(delays.every((delay) => delay === 1 || delay === 2));
  assert.equal(sixty.metadata.clips[0].durationCs, 100);
  assert.ok(Math.abs(delays.reduce((sum, delay) => sum + delay, 0) / 100 - 1) <= 0.005);
});

test("LZW width growth stays stable across random 256-color frame-local palettes", async () => {
  const colors = (base) => {
    const pixels = new Uint8Array(128 * 128 * 4); let state = base + 17;
    for (let i = 0; i < pixels.length / 4; i++) {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      const index = state & 255, value = base + index;
      pixels.set([value >> 8, value & 255, (index * 19) & 255, 255], i * 4);
    }
    return pixels;
  };
  const kit = makeKit({ width: 128, height: 128, frames: ["one", "two"], framePixels: [colors(0), colors(256)] });
  const result = await buildArtGifs(kit), gif = result.files[0].data;
  assert.equal(createHash("sha256").update(gif).digest("hex"), "89bb07642bd9d1c69a96f38131b39febc898e3d0343799d6a74e1eaacae71895",
    "randomized 128x128 palette fixture crosses LZW code-width boundaries");
  assert.equal(result.metadata.clips[0].transparent, false);
  assert.equal((gif[10] & 0x80) !== 0, true, "global background table present");
  const imageFlags = parseBlocks(result.files[0]).localFlags;
  assert.equal(imageFlags.length, 2);
  assert.ok(imageFlags.every((flags) => (flags & 0x80) !== 0), "each frame has its own local color table");
  assert.ok(gif.length > 1000);
});

test("transparency reserves palette index zero throughout the clip and rejects partial alpha or overflow", async () => {
  const partlyTransparent = solid(12, 34, 56);
  partlyTransparent.set([0, 0, 0, 0], 0);
  const clip = await buildArtGifs(makeKit({ frames: ["opaque", "trans"], framePixels: [solid(90, 80, 70), partlyTransparent] }));
  assert.equal(clip.metadata.clips[0].transparent, true);
  const packed = parseBlocks(clip.files[0]).gce;
  assert.equal(packed.length, 2);
  assert.ok(packed.every((value) => (value & 1) === 1), "transparent index enabled even on opaque frames");

  const partial = solid(1, 2, 3); partial[3] = 128;
  await assert.rejects(buildArtGifs(makeKit({ framePixels: [partial] })), /fully opaque or fully transparent/);
  const overflow = new Uint8Array(17 * 16 * 4);
  for (let i = 0; i < 256; i++) overflow.set([i, i ^ 0xaa, i ^ 0x55, 255], i * 4);
  overflow.set([0, 0, 0, 0], 256 * 4);
  await assert.rejects(buildArtGifs(makeKit({ width: 17, framePixels: [overflow] })), /255 supported with transparency/);
});

test("recipe/kit bounds, unsafe names, aggregate pixel budget and abort cleanup are explicit", async () => {
  await assert.rejects(buildArtGifs(null), /packed art export kit/);
  const kit = makeKit(); kit.frames[0].name = "mismatch";
  await assert.rejects(buildArtGifs(kit), /invalid frame data/);

  const wide = createExampleRecipe("geometry"); wide.width = 65; wide.height = 65;
  wide.clips = { walk: { frames: Array(4096).fill("study"), fps: 8 } };
  await assert.rejects(buildArtGifs(buildArtExport(wide)), /aggregate decoded clip pixels/);

  const unsafe = buildArtExport(createTravelerRecipe());
  unsafe.recipe.clips = { "bad/name": { frames: [unsafe.recipe.frames[0].name], fps: 8 } };
  await assert.rejects(buildArtGifs(unsafe), /invalid identifier/);
  await assert.rejects(buildArtGifs(makeKit(), { signal: AbortSignal.abort(Error("pre-abort")) }), /pre-abort/);

  const big = makeKit({ frames: ["study"], clipFrames: Array(1000).fill("study") });
  const controller = new AbortController();
  const pending = buildArtGifs(big, { signal: controller.signal });
  setTimeout(() => controller.abort(Error("active abort")), 0);
  await assert.rejects(pending, /active abort/);
});

test("32 MiB output ceiling is reachable within recipe and decoded-pixel budgets", async () => {
  const data = new Uint8Array(16 * 16 * 4);
  let state = 7;
  for (let i = 0; i < 256; i++) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    data.set([state & 255, 0, 0, 255], i * 4);
  }
  const recipe = await importSpritePixels({ width: 16, height: 16, data }, { fps: 8, name: "Budget probe" });
  const frameName = recipe.frames[0].name;
  recipe.clips = Object.fromEntries(Array.from({ length: 8 }, (_, i) =>
    [`c${i}`, { frames: Array(4096).fill(frameName), fps: 8 }],
  ));
  const kit = buildArtExport(recipe);
  assert.ok(Buffer.byteLength(JSON.stringify(kit.recipe)) < 2 * 1024 * 1024, "recipe remains below parseRecipe's 2 MiB limit");
  assert.equal(8 * 4096 * 16 * 16, 8_388_608, "aggregate decoded clip pixels remain below 16,777,216");

  // Keep the encoder's cooperative async checkpoints while avoiding thousands of
  // wall-clock timer delays in this synthetic, output-budget-only regression.
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback) => { queueMicrotask(callback); return 0; };
  try { await assert.rejects(buildArtGifs(kit), /GIF output exceeds 32 MiB/); }
  finally { globalThis.setTimeout = originalSetTimeout; }
});
