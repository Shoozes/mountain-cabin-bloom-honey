import assert from "node:assert/strict";
import { verifyOutlineControls } from "./verify-art-outline-browser.mjs";
import { verifyComponentImport } from "./verify-art-components-browser.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { preview } from "vite";
import { mergeAppEnv, readAppEnv } from "./with-app-env.mjs";
import { ART_SOURCE_PATHS, bakeArt } from "./bake-art.mjs";
import { renderFrame, buildArtExport, encodePortablePng } from "../packages/grout-art/index.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  arg = (name) => {
    const i = process.argv.indexOf(name);
    return i < 0 ? null : process.argv[i + 1];
  },
  proof = path.resolve(arg("--proof-out") ?? ".artifacts/proof/art-import"),
  mode = arg("--dev-url") ? "dev" : "built";
const sha = (b) => createHash("sha256").update(b).digest("hex"),
  receipt = { mode, checks: [], sources: [], started: new Date().toISOString() };
let server, browser;
const sourceFiles = [
  ...ART_SOURCE_PATHS,
  "src/art/sprite-import.ts",
  "src/components/art-sprite-import.tsx",
  "src/components/art-sprite-components.tsx",
  "scripts/verify-art-components-browser.mjs",
  "src/components/art-outline.tsx",
  "scripts/verify-art-outline-browser.mjs",
  "src/components/art-studio.tsx",
  "src/art/studio.css",
  "scripts/test-art-import-browser.mjs",
];
const readRecipe = async (page) => {
  await page.waitForFunction(() => {
    try {
      return JSON.parse(document.querySelector("textarea")?.value).format === "grout-art/1";
    } catch {
      return false;
    }
  });
  return JSON.parse(
    await page.getByLabel("Recipe JSON, including custom technique source").inputValue(),
  );
};
async function waitPixels(page, r, index = 0) {
  const expected = sha(renderFrame(r, index).data);
  await page.waitForFunction(async (expected) => {
    const c = document.querySelector(".art-main-canvas");
    if (!c) return false;
    return (
      [
        ...new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            c.getContext("2d").getImageData(0, 0, c.width, c.height).data,
          ),
        ),
      ]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("") === expected
    );
  }, expected);
}
const filesFrom = (layers) =>
  layers.map((data, i) => ({
    name: `original-layer-${i}.gif`,
    mimeType: "image/gif",
    buffer: Buffer.from(data, "base64"),
  }));
function unzip(bytes) {
  const files = new Map();
  for (let p = 0; p + 30 < bytes.length && bytes.readUInt32LE(p) === 0x04034b50;) {
    const n = bytes.readUInt16LE(p + 26),
      e = bytes.readUInt16LE(p + 28),
      size = bytes.readUInt32LE(p + 18),
      at = p + 30 + n + e;
    files.set(bytes.toString("utf8", p + 30, p + 30 + n), bytes.subarray(at, at + size));
    p = at + size;
  }
  return files;
}
async function pngPixels(page, bytes) {
  return page.evaluate(async (b) => {
    const im = await createImageBitmap(
      new Blob([Uint8Array.from(atob(b), (c) => c.charCodeAt(0))], { type: "image/png" }),
    );
    try {
      const c = document.createElement("canvas");
      c.width = im.width;
      c.height = im.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(im, 0, 0);
      return [...ctx.getImageData(0, 0, c.width, c.height).data];
    } finally {
      im.close();
    }
  }, bytes.toString("base64"));
}
try {
  await fs.mkdir(proof, { recursive: true });
  for (const p of sourceFiles)
    receipt.sources.push({ path: p, sha256: sha(await fs.readFile(path.join(root, p))) });
  let url = arg("--dev-url");
  if (!url) {
    Object.assign(process.env, mergeAppEnv(readAppEnv(root), process.env));
    server = await preview({
      root,
      mode: "pages",
      preview: { host: "127.0.0.1", port: 0, open: false },
    });
    url = `http://127.0.0.1:${server.httpServer.address().port}/mountain-cabin-bloom-honey/`;
  }
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-unsafe-webgpu"],
  });
  receipt.browser = browser.version();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const modules = new Map();
  for (const p of ART_SOURCE_PATHS)
    modules.set(path.basename(p), await fs.readFile(path.join(root, p)));
  await context.route("**/__art-sdk/**", async (route) => {
    const bytes = modules.get(new URL(route.request().url()).pathname.split("/").pop());
    await route.fulfill({
      status: bytes ? 200 : 404,
      contentType: "application/javascript",
      body: bytes ?? "not found",
    });
  });
  const page = await context.newPage();
  const errors = [];
  receipt.pageErrors = errors;
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url + "studio");
  await page.getByText("Import sprites & layers", { exact: true }).click();
  await page.getByRole("combobox", { name: /Renderer/ }).selectOption("cpu");
  const base = await readRecipe(page),
    fixture = JSON.parse(
      await fs.readFile(path.join(root, "scripts/fixtures/art-import-original-gifs.json"), "utf8"),
    );
  const images = page.getByLabel("Sprite images", { exact: true });
  await images.setInputFiles(filesFrom(fixture.layers));
  await page.getByLabel("Sprite layout", { exact: true }).selectOption("grid");
  await page.getByRole("button", { name: "Convert to recipe", exact: true }).click();
  await page.getByText("Imported 4 frames and 2 editable layers.", { exact: true }).waitFor();
  const recipe = await readRecipe(page);
  await waitPixels(page, recipe);
  assert.equal(recipe.layers.length, 2);
  assert.deepEqual(recipe.importedSprite.durationsMs, [250, 500]);
  assert.equal(recipe.clips["sprite-000"].fps, 4);
  // Validate against independently known original fixture geometry.
  for (let i = 0; i < 4; i++) {
    const p = renderFrame(recipe, i);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        assert.deepEqual(
          [...p.data.subarray((y * 16 + x) * 4, (y * 16 + x + 1) * 4)],
          x >= 4 && x < 10 && y >= 4 && y < 10
            ? x === 4 + Math.floor(i / 2)
              ? [240, 32, 48, 255]
              : [40, 60, 200, 255]
            : [0, 0, 0, 0],
        );
  }
  await page.getByRole("button", { name: "Undo (Ctrl or Command plus Z)", exact: true }).click();
  await waitPixels(page, base, 1);
  await page
    .getByRole("button", { name: "Redo (Ctrl or Command plus Shift plus Z)", exact: true })
    .click();
  await waitPixels(page, recipe);
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("grout-art-studio/1")).importedSprite?.animationFrames === 2,
  );
  await page.reload();
  await waitPixels(page, recipe);
  assert.deepEqual(await readRecipe(page), recipe);
  // Exact portable rendering of every imported frame, plus the optional outline graph.
  const results = await page.evaluate(async (r) => {
    const api = await import("/__art-sdk/index.mjs"),
      browser = await import("/__art-sdk/browser.mjs");
    let comparisons = 0;
    for (const backend of ["webgl2", "webgpu"]) {
      const renderer = await browser.createRenderer({ backend });
      try {
        if (renderer.backend !== backend) throw Error("Missing " + backend);
        for (let i = 0; i < r.frames.length; i++) {
          const a = api.renderFrame(r, i),
            b = await renderer.render(r, i);
          if (a.data.some((n, j) => n !== b.data[j])) throw Error("Pixel mismatch");
          comparisons++;
        }
        const outlined = structuredClone(r),
          source = outlined.layers[0].part;
        outlined.palette.border = "#000000";
        outlined.parts.border = [
          { op: "outline", part: source, role: "border" },
          { op: "use", part: source },
        ];
        outlined.frames[0].layers[outlined.layers[0].id].part = "border";
        const a = api.renderFrame(outlined),
          b = await renderer.render(outlined);
        if (a.data.some((n, j) => n !== b.data[j])) throw Error("Outline mismatch");
        comparisons++;
      } finally {
        renderer.dispose();
      }
    }
    return comparisons;
  }, recipe);
  assert.equal(results, 10);
  receipt.checks.push(
    "layered animated GIF exact geometry; timeline, undo/redo, recovery; 10 CPU/GLSL/WGSL frame and outline comparisons",
  );
  await page.getByText("Import sprites & layers", { exact: true }).click();
  await images.setInputFiles({
    name: "invalid.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("bad"),
  });
  await page.getByRole("button", { name: "Convert to recipe", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "valid PNG or GIF" }).waitFor();
  assert.deepEqual(await readRecipe(page), recipe);
  // Unsupported GIF decoding fails visibly instead of dropping animation frames.
  await page.evaluate(() => {
    globalThis.savedImageDecoder = globalThis.ImageDecoder;
    globalThis.ImageDecoder = undefined;
  });
  await images.setInputFiles(filesFrom(fixture.layers));
  await page.getByRole("button", { name: "Convert to recipe", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "unavailable in this browser" }).waitFor();
  await page.evaluate(() => {
    globalThis.ImageDecoder = globalThis.savedImageDecoder;
    delete globalThis.savedImageDecoder;
  });
  const sheet = buildArtExport(recipe).sheet,
    png = Buffer.from(await encodePortablePng(sheet));
  await images.setInputFiles({ name: "original-sheet.png", mimeType: "image/png", buffer: png });
  // Delay only the asynchronous decode; cancellation must preserve the current recipe.
  await page.evaluate(() => {
    globalThis.savedCreateImageBitmap = globalThis.createImageBitmap;
    globalThis.createImageBitmap = async (...args) => {
      await new Promise((r) => setTimeout(r, 1200));
      return globalThis.savedCreateImageBitmap(...args);
    };
  });
  await page.getByRole("button", { name: "Convert to recipe", exact: true }).click();
  await page.getByRole("button", { name: "Cancel import", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Import cancelled" }).waitFor();
  assert.deepEqual(await readRecipe(page), recipe);
  await page.evaluate(() => {
    globalThis.createImageBitmap = globalThis.savedCreateImageBitmap;
    delete globalThis.savedCreateImageBitmap;
  });
  await page.getByLabel("Sprite layout", { exact: true }).selectOption("grid");
  await page.getByRole("button", { name: "Convert to recipe", exact: true }).click();
  await page.getByText("Imported 6 frames and 1 editable layers.", { exact: true }).waitFor();
  let pngRecipe = await readRecipe(page);
  for (let i = 0; i < 4; i++) assert.deepEqual(renderFrame(pngRecipe, i), renderFrame(recipe, i));
  receipt.checks.push(
    "malformed file, unavailable GIF decoder, cancellation/retry preserve source; PNG grid visible pixels exact",
  );
  const outlined = await verifyOutlineControls({
    page,
    recipe: pngRecipe,
    animatedRecipe: recipe,
    readRecipe,
    waitPixels,
    proof,
    mode,
  });
  pngRecipe = outlined.recipe;
  receipt.outlineGpuComparisons = outlined.gpu;
  receipt.checks.push(
    "outline color/width/corners, toggle, undo/redo, recovery, source guard, rapid edits, all frames and mobile controls; 72 exact animated CPU/GPU comparisons",
  );
  // Export through Studio then compare every PNG to the CPU CLI bake.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export atlas kit", exact: true }).click();
  const file = await download;
  const zip = unzip(await fs.readFile(await file.path()));
  const cli = await bakeArt({ recipe: pngRecipe, output: path.join(proof, "bake") });
  assert.deepEqual(JSON.parse(zip.get("recipe.json").toString()), pngRecipe);
  assert.equal(JSON.parse(zip.get("atlas.json").toString()).outline.baked, true);
  await page.getByText("Import sprites & layers", { exact: true }).click();
  await page.getByLabel("Sprite layout", {exact:true}).selectOption("grid");
  for (const [name, bytes] of zip)
    if (name.endsWith(".png"))
      assert.deepEqual(
        await pngPixels(page, bytes),
        await pngPixels(page, await fs.readFile(path.join(cli.directory, name))),
      );
  receipt.checks.push("imported sprite browser/CLI decoded PNG equality");
  await page.screenshot({ path: path.join(proof, mode + "-import-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await images.setInputFiles(filesFrom(fixture.layers));
  await page.getByRole("button", { name: "Move original-layer-0.gif up", exact: true }).click();
  await page.getByRole("button", { name: "Convert to recipe", exact: true }).click();
  await page.getByText("Imported 4 frames and 2 editable layers.", { exact: true }).waitFor();
  const reordered = await readRecipe(page);
  assert.equal(reordered.layers[0].name, "original-layer-1");
  assert.deepEqual(
    [...renderFrame(reordered).data.subarray((4 * 16 + 4) * 4, (4 * 16 + 5) * 4)],
    [40, 60, 200, 255],
  );
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(proof, mode + "-import-mobile.png"), fullPage: true });
  receipt.checks.push("mobile 390x844 import, layer reorder, no horizontal overflow");
  receipt.components = await verifyComponentImport({ page, previous: reordered, readRecipe, waitPixels, bakeArt, pngPixels, proof, mode });
  receipt.checks.push("loose PNG detection/connectivity, explicit groups/padding/anchors, source and atlas reconstruction; undo/recovery, failure/cancel/retry, CPU/GLSL/WGSL and browser/CLI parity; desktop/mobile");
  // Optional local supplied assets: exact conversion, retained outside fixtures.
  const supplied = arg("--user-layers");
  if (supplied) {
    const files = [3, 2, 1, 0].map((i) => path.join(supplied, `chibi-layered-${i}.gif`));
    await images.setInputFiles(files);
    await page.getByRole("button", { name: "Convert to recipe", exact: true }).click();
    await page.getByText("Imported 36 frames and 4 editable layers.", { exact: true }).waitFor();
    const r = await readRecipe(page);
    assert.equal(Object.keys(r.clips).length, 9);
    assert.deepEqual(r.importedSprite.durationsMs, [250, 250, 250, 250]);
    await fs.mkdir(path.join(proof, "user-import"), { recursive: true });
    await fs.writeFile(
      path.join(proof, "user-import/chibi-layered.recipe.json"),
      JSON.stringify(r, null, 2) + "\n",
    );
    await fs.writeFile(
      path.join(proof, "user-import/chibi-layered-sheet.png"),
      await encodePortablePng(buildArtExport(r).sheet),
    );
    receipt.userImport = {
      recipe: "user-import/chibi-layered.recipe.json",
      frames: r.frames.length,
      layers: r.layers.length,
      clips: Object.keys(r.clips).length,
    };
  }
  assert.deepEqual(errors, []);
  receipt.success = true;
} catch (error) {
  receipt.error = error.stack;
  throw error;
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  receipt.finished = new Date().toISOString();
  await fs.writeFile(
    path.join(proof, mode + "-import-receipt.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
}
console.log(JSON.stringify(receipt, null, 2));
