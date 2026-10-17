import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { importSpriteComponents, renderFrame, encodePortablePng, buildArtExport, extractFrame } from "../packages/grout-art/index.mjs";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const unzip = bytes => {
  const files = new Map();
  for (let at = 0; at + 30 < bytes.length && bytes.readUInt32LE(at) === 0x04034b50;) {
    const length = bytes.readUInt16LE(at + 26), extra = bytes.readUInt16LE(at + 28), size = bytes.readUInt32LE(at + 18), start = at + 30 + length + extra;
    files.set(bytes.toString("utf8", at + 30, at + 30 + length), bytes.subarray(start, start + size));
    at = start + size;
  }
  return files;
};

/** Original geometric fixtures only: ring, enclosed dot, detached trim and diagonals. */
export function componentStudyPixels() {
  const width = 24, height = 16, data = new Uint8Array(width * height * 4);
  const put = (x, y, rgb) => data.set([...rgb, 255], (y * width + x) * 4);
  for (let y = 1; y <= 7; y++) for (let x = 1; x <= 7; x++) if (x === 1 || x === 7 || y === 1 || y === 7) put(x, y, [0, 0, 0]);
  for (let y = 1; y <= 3; y++) for (let x = 14; x <= 16; x++) put(x, y, [219, 83, 52]);
  put(4, 4, [53, 141, 199]);
  put(15, 6, [219, 83, 52]);
  put(20, 10, [53, 141, 199]); put(21, 11, [53, 141, 199]);
  for (let y = 12; y <= 13; y++) for (let x = 2; x <= 3; x++) put(x, y, [219, 83, 52]);
  return { width, height, data };
}

export async function verifyComponentImport({ page, previous, readRecipe, waitPixels, bakeArt, pngPixels, proof, mode }) {
  const panel = page.locator(".art-sprite-import");
  if (!(await panel.evaluate(node => node.open))) await panel.locator("summary").first().click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel("Sprite layout", { exact: true }).selectOption("components");
  const source = componentStudyPixels(), png = Buffer.from(await encodePortablePng(source));
  const images = page.getByLabel("Sprite images", { exact: true });
  await images.setInputFiles({ name: "original-components.png", mimeType: "image/png", buffer: png });

  // A held decoder makes cancellation observable without racing small inputs.
  await page.evaluate(() => {
    window.componentBitmap = window.createImageBitmap;
    window.createImageBitmap = async (...args) => {
      await new Promise(resolve => setTimeout(resolve, 800));
      return window.componentBitmap(...args);
    };
  });
  try {
    await page.getByRole("button", { name: "Find pieces", exact: true }).click();
    await page.getByRole("button", { name: "Cancel import", exact: true }).click();
    await panel.getByRole("alert").filter({ hasText: "Import cancelled" }).waitFor();
    assert.deepEqual(await readRecipe(page), previous);
  } finally {
    await page.evaluate(() => { window.createImageBitmap = window.componentBitmap; delete window.componentBitmap; });
  }
  await page.getByRole("button", { name: "Find pieces", exact: true }).click();
  await page.getByText("6 pieces · 6 sprite groups", { exact: true }).waitFor();
  await page.getByLabel("Piece connectivity", { exact: true }).selectOption("4");
  await page.getByRole("button", { name: "Find pieces", exact: true }).click();
  await page.getByText("7 pieces · 7 sprite groups", { exact: true }).waitFor();
  await page.getByLabel("Piece connectivity", { exact: true }).selectOption("8");
  await page.getByRole("button", { name: "Find pieces", exact: true }).click();
  await page.getByText("6 pieces · 6 sprite groups", { exact: true }).waitFor();
  await page.getByLabel("Piece 4 group", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Convert pieces to recipe", exact: true }).click();
  await panel.getByRole("alert").filter({ hasText: "Group numbers" }).waitFor();
  assert.deepEqual(await readRecipe(page), previous);
  await page.getByLabel("Piece 4 group", { exact: true }).fill("2");
  await page.getByLabel("Piece padding", { exact: true }).fill("2");
  await page.getByLabel("Use custom import anchor", { exact: true }).check();
  await page.getByLabel("Piece anchor X", { exact: true }).fill("5");
  await page.getByLabel("Piece anchor Y", { exact: true }).fill("9");
  const advanced = page.locator(".art-advanced");
  if (!(await advanced.evaluate(node => node.open))) await advanced.locator("summary").first().click();
  await page.getByLabel("Recipe JSON, including custom technique source").fill("{pending component source");
  assert.equal(await page.getByRole("button", { name: "Find pieces", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Convert pieces to recipe", exact: true }).isDisabled(), true);
  await advanced.getByRole("button", { name: "Reset text", exact: true }).click();
  await page.getByLabel("Detected sprite pieces", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(proof, mode + "-components-review-desktop.png"), fullPage: true });

  // Throttle only yielding SDK work so an in-flight conversion can be cancelled.
  await page.evaluate(() => {
    window.componentTimer = window.setTimeout;
    window.setTimeout = (fn, delay, ...args) => window.componentTimer(fn, delay === 0 ? 120 : delay, ...args);
  });
  try {
    await page.getByRole("button", { name: "Convert pieces to recipe", exact: true }).click();
    await page.getByRole("button", { name: "Cancel import", exact: true }).click();
    await panel.getByRole("alert").filter({ hasText: "Import cancelled" }).waitFor();
    assert.deepEqual(await readRecipe(page), previous);
  } finally {
    await page.evaluate(() => { window.setTimeout = window.componentTimer; delete window.componentTimer; });
  }
  await page.getByRole("button", { name: "Convert pieces to recipe", exact: true }).click();
  await page.getByText("Imported 5 frames and 1 editable layers.", { exact: true }).waitFor();
  const recipe = await readRecipe(page);
  const expected = await importSpriteComponents(source, { name: "original-components", sourceName: "original-components.png", sourceSha256: sha(png), connectivity: 8, groups: [[0], [1, 3], [2], [4], [5]], padding: 2, anchor: [5, 9] });
  assert.deepEqual(recipe, expected);
  await waitPixels(page, recipe);
  const reconstructed = new Uint8Array(source.data.length), kit = buildArtExport(recipe);
  for (const region of recipe.importedSprite.regions) {
    const frame = extractFrame(kit.atlas, region.frame);
    for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
      const at = (y * frame.width + x) * 4;
      if (frame.data[at + 3]) reconstructed.set(frame.data.subarray(at, at + 4), ((region.y + y - region.offset[1]) * source.width + region.x + x - region.offset[0]) * 4);
    }
  }
  assert.deepEqual(reconstructed, source.data);
  assert.equal(renderFrame(recipe, 0).data[(5 * recipe.width + 5) * 4 + 3], 0, "ring crop must exclude the enclosed, separately grouped dot");
  await page.getByRole("button", { name: "Undo (Ctrl or Command plus Z)", exact: true }).click();
  await waitPixels(page, previous);
  await page.getByRole("button", { name: "Redo (Ctrl or Command plus Shift plus Z)", exact: true }).click();
  await waitPixels(page, recipe);
  await page.reload();
  await waitPixels(page, recipe);
  assert.deepEqual(await readRecipe(page), recipe);
  const gpu = await page.evaluate(async recipe => {
    const sdk = await import("/__art-sdk/index.mjs");
    let matches = 0;
    for (const backend of ["webgl2", "webgpu"]) {
      const renderer = await sdk.createRenderer({ backend });
      try {
        if (renderer.backend !== backend) throw Error(`Unavailable ${backend}`);
        for (let index = 0; index < recipe.frames.length; index++) {
          const expected = sdk.renderFrame(recipe, index), actual = await renderer.render(recipe, index);
          if (expected.data.some((value, i) => value !== actual.data[i])) throw Error("Component GPU pixels differ");
          matches++;
        }
      } finally { renderer.dispose(); }
    }
    return matches;
  }, recipe);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export atlas kit", exact: true }).click();
  const zip = unzip(await fs.readFile(await (await download).path()));
  const cli = await bakeArt({ recipe, output: path.join(proof, "component-bake") });
  assert.deepEqual(JSON.parse(zip.get("recipe.json").toString()), recipe);
  const atlas = JSON.parse(zip.get("atlas.json").toString());
  assert.equal(atlas.provenance.importedSprite.format, "sprite-components/1");
  assert.ok(atlas.sources.some(source => /components/.test(source.path)));
  for (const [file, bytes] of zip) if (file.endsWith(".png")) assert.deepEqual(await pngPixels(page, bytes), await pngPixels(page, await fs.readFile(path.join(cli.directory, file))));

  // Failed PNG input keeps the recovered import, then narrow controls can retry.
  const bad = { width: 1, height: 1, data: new Uint8Array([2, 4, 8, 128]) };
  await page.getByText("Import sprites & layers", { exact: true }).click();
  await page.getByLabel("Sprite layout", { exact: true }).selectOption("components");
  await images.setInputFiles({ name: "partial.png", mimeType: "image/png", buffer: Buffer.from(await encodePortablePng(bad)) });
  await page.getByRole("button", { name: "Find pieces", exact: true }).click();
  await panel.getByRole("alert").filter({ hasText: "Partial transparency" }).waitFor();
  assert.deepEqual(await readRecipe(page), recipe);
  await page.setViewportSize({ width: 390, height: 844 });
  await images.setInputFiles({ name: "original-components.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Find pieces", exact: true }).click();
  await page.getByText("6 pieces · 6 sprite groups", { exact: true }).waitFor();
  await page.getByLabel("Piece 4 group", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Convert pieces to recipe", exact: true }).scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(proof, mode + "-components-review-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Convert pieces to recipe", exact: true }).click();
  await page.getByText("Imported 5 frames and 1 editable layers.", { exact: true }).waitFor();
  assert.equal((await readRecipe(page)).importedSprite.regions.length, 5);
  return { gpu, frames: recipe.frames.length, reconstructedSourceSha256: sha(reconstructed), browserCliPngEquality: true };
}
