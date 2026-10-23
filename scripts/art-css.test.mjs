import test from "node:test";
import assert from "node:assert/strict";
import { buildArtCss } from "../packages/grout-art/css.mjs";
import { buildArtExport } from "../packages/grout-art/export.mjs";
import { createExampleRecipe, createTravelerRecipe } from "../packages/grout-art/traveler.mjs";

test("CSS frames use source boxes, trim offsets, packed pages and anchor metadata", () => {
  const kit = buildArtExport(createTravelerRecipe());
  const { css, metadata } = buildArtCss(kit, { classPrefix: "game_sprite" });
  assert.equal(metadata.format, "grout-art-css/1");
  assert.equal(metadata.path, "atlas.css");
  assert.equal(metadata.classPrefix, "game_sprite");
  assert.deepEqual(metadata.sourceSize, { width: kit.recipe.width, height: kit.recipe.height });
  assert.equal(metadata.frames.length, kit.recipe.frames.length);
  for (const frame of metadata.frames) {
    const source = kit.recipe.frames.find((entry) => entry.name === frame.name);
    assert.deepEqual(frame.anchor, source.anchor);
    const selector = `.${metadata.classPrefix}-frame-${frame.name}`, start = css.indexOf(selector), end = css.indexOf("}", start), rule = css.slice(start, end);
    assert.ok(rule.includes(`width:${kit.recipe.width}px`));
    assert.ok(rule.includes(`height:${kit.recipe.height}px`));
    assert.ok(css.includes(`url("atlas-${frame.page}.png")`));
  }
  const trimmed = kit.atlas.frames.find((frame) => frame.trim.x || frame.trim.y);
  assert.ok(trimmed, "fixture contains a trimmed frame");
  const selector = `.${metadata.classPrefix}-frame-${trimmed.name}::before`;
  const rule = css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)) + 1);
  assert.ok(rule.includes(`left:${trimmed.trim.x}px`));
  assert.ok(rule.includes(`top:${trimmed.trim.y}px`));
  assert.ok(rule.includes(`background-position:-${trimmed.x}px -${trimmed.y}px`));
  assert.ok(rule.includes(`background-size:${kit.atlas.pages[trimmed.pageIndex].width}px ${kit.atlas.pages[trimmed.pageIndex].height}px`));
  assert.ok(css.includes("overflow:hidden"));
  assert.ok(css.includes("image-rendering:pixelated"));
});

test("multipage frame classes reference the matching packed atlas image", () => {
  const kit = buildArtExport(createTravelerRecipe(), { atlas: { maxWidth: 24, maxHeight: 24 } });
  assert.ok(kit.atlas.pages.length > 1);
  const { css, metadata } = buildArtCss(kit);
  assert.equal(metadata.frames.length, kit.atlas.frames.length);
  for (const frame of kit.atlas.frames) {
    const page = kit.atlas.pages[frame.pageIndex];
    const selector = `.${metadata.classPrefix}-frame-${frame.name}::before`;
    const start = css.indexOf(selector), end = css.indexOf("}", start), rule = css.slice(start, end);
    assert.ok(rule.includes(`url("atlas-${page.index}.png")`), frame.name);
    assert.ok(rule.includes(`background-size:${page.width}px ${page.height}px`), frame.name);
  }
});

test("clip CSS keeps repeated holds and reports exact fps and fractional duration", () => {
  const recipe = createTravelerRecipe(), names = recipe.frames.slice(0, 2).map((frame) => frame.name);
  recipe.clips = { held: { frames: [names[0], names[1], names[1]], fps: 2 } };
  const kit = buildArtExport(recipe), { css, metadata } = buildArtCss(kit, { classPrefix: "tiny" });
  const clip = metadata.clips[0];
  assert.deepEqual(clip, { name: "held", selector: ".tiny-clip-held", frames: [names[0], names[1], names[1]], fps: 2, durationSeconds: 1.5 });
  assert.match(css, /\.tiny-clip-held\{[^}]*width:/);
  assert.ok(css.includes("animation:tiny-play-held 1.5s infinite"));
  const keyframes = css.slice(css.indexOf("@keyframes tiny-play-held{"));
  assert.ok(keyframes.includes("0%{"));
  assert.ok(keyframes.includes("33.333333%{"));
  assert.ok(keyframes.includes("66.666667%{"));
  assert.ok(keyframes.includes("100%{"));
  assert.equal((keyframes.match(/animation-timing-function:steps\(1,end\)/g) ?? []).length, 3);
});

test("CSS export accepts empty clip maps, validates prefixes and cancellation, and enforces its byte budget", () => {
  const recipe = createExampleRecipe("geometry");
  recipe.clips = {};
  const kit = buildArtExport(recipe), noClips = buildArtCss(kit);
  assert.deepEqual(noClips.metadata.clips, []);
  assert.ok(!noClips.css.includes("@keyframes"));
  for (const classPrefix of ["", "9sprite", "has space", "x;body", "x".repeat(65)])
    assert.throws(() => buildArtCss(kit, { classPrefix }), /prefix/);
  assert.throws(() => buildArtCss(kit, { signal: AbortSignal.abort(Error("cancel CSS")) }), /cancel CSS/);

  const crowded = createTravelerRecipe(), first = crowded.frames[0].name;
  crowded.clips = Object.fromEntries(Array.from({ length: 24 }, (_, index) => [`long${index}`, {
    frames: Array(4096).fill(first), fps: 60,
  }]));
  assert.throws(() => buildArtCss(buildArtExport(crowded)), /exceeds 2 MiB/);
});
