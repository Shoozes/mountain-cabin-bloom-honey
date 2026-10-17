import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createTravelerRecipe, createCharacterDocument, compileCharacter, createExampleRecipe, importSpritePixels, parseRecipe, renderFrame, buildArtExport, extractFrame, editPixel, createSpriteVariationProfile, parseSpriteVariations, applySpriteVariation, randomizeSpriteVariation, generateSpriteVariations, optimizeRecipe, measureRecipe } from "../packages/grout-art/index.mjs";
import { ART_RUNTIME_URLS } from "../packages/grout-art/metrics.mjs";
import { ART_SOURCE_PATHS, bakeArt } from "./bake-art.mjs";
const seeds = [1204, 1215, 1233];
const selected = (profile) => Object.fromEntries(profile.groups.map(group => [group.id, group.options[0].id]));
const pixels = (recipe) => recipe.frames.map((_, index) => renderFrame(recipe, index));

test("variation families reuse complete directional apparel, retaining accepted anatomy, corrections, clips and anchors", () => {
  const base = editPixel(createTravelerRecipe(), 0, "clothing", 0, 0, "accent"), before = structuredClone(base);
  const family = createSpriteVariationProfile(base);
  assert.deepEqual(family.groups.map(group => group.options.length), [3, 4, 4, 2]);
  for (const clothing of family.groups[0].options) for (const hat of family.groups[1].options) for (const palette of family.groups[2].options) for (const backpack of family.groups[3].options) {
    const variant = applySpriteVariation(base, family, { selections: { clothing: clothing.id, hat: hat.id, palette: palette.id, backpack: backpack.id } });
    assert.deepEqual(variant.frames, base.frames);
    assert.deepEqual(variant.layers, base.layers);
    assert.deepEqual(variant.clips, base.clips);
    assert.equal(variant.seed, base.seed);
    for (const key of Object.keys(base.parts).filter(key => !key.startsWith("coat-") && !key.startsWith("cap-") && !key.startsWith("bag-"))) assert.deepEqual(variant.parts[key], base.parts[key]);
    assert.deepEqual(parseRecipe(JSON.stringify(variant)), variant);
  }
  assert.deepEqual(base, before);
});
test("seeded batches and independent group streams obey locks and explicit rerolls", () => {
  const base = createTravelerRecipe(), family = createSpriteVariationProfile(base), selections = selected(family), locks = { clothing: true };
  for (const seed of seeds) {
    const first = randomizeSpriteVariation(base, family, { seed, selections, locks });
    assert.deepEqual(first, randomizeSpriteVariation(base, family, { seed, selections, locks }));
    assert.equal(first.spriteVariation.selections.clothing, selections.clothing);
    assert.deepEqual(randomizeSpriteVariation(first, family, { seed }).spriteVariation.locks, locks);
    for (const variant of generateSpriteVariations(first, family)) assert.equal(variant.spriteVariation.selections.clothing, selections.clothing);
    const reordered = { ...family, groups: [...family.groups].reverse() };
    assert.deepEqual(randomizeSpriteVariation(base, reordered, { seed, selections, locks }).spriteVariation.selections, first.spriteVariation.selections);
    const rerolled = randomizeSpriteVariation(base, family, { seed, selections, group: "hat" });
    assert.notEqual(rerolled.spriteVariation.selections.hat, selections.hat);
    assert.equal(rerolled.spriteVariation.selections.palette, selections.palette);
  }
  assert.deepEqual(generateSpriteVariations(base, family).map(variant => variant.spriteVariation.seed), seeds);
  assert.throws(() => randomizeSpriteVariation(base, family, { selections, locks, group: "clothing" }), /Unlock/);
  assert.throws(() => randomizeSpriteVariation(base, family, { selections, seed: -1 }), /uint32/);
  assert.throws(() => randomizeSpriteVariation(base, family, { selections: {}, locks }), /selection/);
});
test("invalid, partial and overlapping families reject without replacing source", () => {
  const base = createTravelerRecipe(), family = createSpriteVariationProfile(base);
  for (const modify of [
    p => p.groups[0].options.push(p.groups[0].options[0]),
    p => { p.groups[2].options[0].palette.unknown = "#abcdef"; },
    p => { delete p.groups[2].options[0].palette.cap; },
    p => { p.groups[1].options = p.groups[0].options; },
    p => { p.groups[0].options[0].parts["coat-south"] = [{ op: "use", part: "missing" }]; },
  ]) { const bad = structuredClone(family); modify(bad); assert.throws(() => parseSpriteVariations(bad, base)); }
  assert.throws(() => createSpriteVariationProfile(compileCharacter(createCharacterDocument())), /character creator/);
  assert.throws(() => generateSpriteVariations(base, family, { seeds: Array(65).fill(1204) }), /1..64/);
});
test("generic imported-style parts and palette families carry one coherent design through poses", () => {
  const base = createExampleRecipe("geometry");
  const family = createSpriteVariationProfile(base);
  family.groups[0].options.push({ id: "night", name: "Night", palette: Object.fromEntries(Object.keys(base.palette).map(role => [role, "#445566"])) });
  const variant = applySpriteVariation(base, family, { selections: { colors: "night" } });
  assert.equal(new Set(Object.values(variant.palette)).size, 1);
  assert.deepEqual(variant.parts, base.parts);
  assert.deepEqual(variant.frames, base.frames);
});
test("lossless transport restores exact authoring data, pixels, imported provenance and character integrity", async () => {
  const imported = await importSpritePixels(renderFrame(createTravelerRecipe()), { sourceName: "original-study.png", sourceSha256: "a".repeat(64) });
  const recipes = [imported, createTravelerRecipe(), compileCharacter(createCharacterDocument()), ...["geometry", "custom-technique", "variations"].map(createExampleRecipe)];
  for (const seed of seeds) for (const original of recipes) {
    const source = { ...original, seed, notes: { $art: 2, nested: { $art: "literal", value: "preserved" } } };
    // Character resolved seeds must continue to agree with their document.
    if (source.character) { source.seed = original.seed; }
    const result = await optimizeRecipe(source), restored = parseRecipe(result.document);
    assert.deepEqual(restored, parseRecipe(source));
    assert.deepEqual(pixels(restored), pixels(source));
    assert.ok(result.report.optimizedBytes <= result.report.sourceBytes);
    assert.equal(result.report.verifiedFrames, source.frames.length);
    const kit = buildArtExport(restored);
    for (let i = 0; i < source.frames.length; i++) assert.deepEqual(extractFrame(kit.atlas, source.frames[i].name), renderFrame(source, i));
  }
  const invalid = compileCharacter(createCharacterDocument()); invalid.palette.skin = "#abcdef";
  const packed = await optimizeRecipe(invalid);
  assert.throws(() => buildArtExport(packed.document), /Character source/);
});
test("lossless dictionary expansion retains independent editable copies and no-growth fallback", async () => {
  const base = createExampleRecipe("geometry");
  const small = await optimizeRecipe(base);
  assert.equal(small.report.savedBytes, 0);
  assert.equal(small.document.format, "grout-art/1");
  base.parts.clone = structuredClone(base.parts.study);
  base.parts.secondClone = structuredClone(base.parts.study);
  const restored = parseRecipe((await optimizeRecipe(base)).document);
  restored.parts.clone[0].x = 99;
  assert.notEqual(restored.parts.clone[0].x, restored.parts.secondClone[0].x);
  assert.deepEqual(base.parts.clone, base.parts.secondClone);
});
test("optimized input rejects invalid references, exponential expansion and cancellation", async () => {
  const envelope = { format: "grout-art-optimized/1", blocks: [{ $art: 0 }], root: { $art: 0 } };
  assert.throws(() => parseRecipe(envelope), /reference/);
  assert.throws(() => parseRecipe({ ...envelope, root: { $art: 2 } }), /reference/);
  const blocks = ["x".repeat(1000)];
  for (let i = 1; i < 20; i++) blocks.push([{ $art: i - 1 }, { $art: i - 1 }]);
  assert.throws(() => parseRecipe({ ...envelope, blocks, root: { $art: 19 } }), /budget/);
  await assert.rejects(optimizeRecipe(createTravelerRecipe(), { signal: AbortSignal.abort(Error("cancelled")) }), /cancelled/);
  const controller = new AbortController(), pending = optimizeRecipe(createTravelerRecipe(), { signal: controller.signal });
  setTimeout(() => controller.abort(Error("active cancellation")), 2);
  await assert.rejects(pending, /active cancellation/);
});
test("browser cost basis covers exactly the distributable SDK and compression is measured independently", async () => {
  assert.deepEqual(ART_RUNTIME_URLS.map(url => "packages/grout-art/" + path.basename(url.pathname)).sort(), [...ART_SOURCE_PATHS].sort());
  const runtimeSources = await Promise.all(ART_SOURCE_PATHS.map(file => fs.readFile(file, "utf8")));
  const metrics = await measureRecipe(createTravelerRecipe(), { runtimeSources });
  assert.ok(metrics.optimizedBytes < metrics.compactBytes);
  assert.ok(metrics.optimizedGzipBytes > 0);
  assert.equal(metrics.optimizedBundleBytes, metrics.runtimeBytes + metrics.optimizedBytes);
  await assert.rejects(measureRecipe(createTravelerRecipe(), { signal: AbortSignal.abort(Error("stop metrics")) }), /stop metrics/);
});
test("CLI accepts optimized recipes, preserves authoring exports, validates cache and packed sidecars", async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "grout-optimized-"));
  try {
    const recipe = createTravelerRecipe(), optimized = await optimizeRecipe(recipe);
    const first = await bakeArt({ recipe: optimized.document, output });
    assert.equal((await bakeArt({ recipe, output })).reused, true);
    const saved = JSON.parse(await fs.readFile(path.join(first.directory, "recipe.optimized.json"), "utf8"));
    assert.deepEqual(parseRecipe(saved), recipe);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(first.directory, "recipe.json"), "utf8")), recipe);
    await fs.appendFile(path.join(first.directory, "recipe.optimized.json"), " ");
    await assert.rejects(bakeArt({ recipe, output }), /differs/);
  } finally { await fs.rm(output, { recursive: true, force: true }); }
});
