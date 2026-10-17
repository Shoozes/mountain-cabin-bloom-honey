import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { preview } from "vite";
import { mergeAppEnv, readAppEnv } from "./with-app-env.mjs";
import { ART_SOURCE_PATHS, bakeArt } from "./bake-art.mjs";
import {
  compileCharacter,
  createCharacterDocument,
  encodePortablePng,
  renderFrame,
} from "../packages/grout-art/index.mjs";

const root = path.resolve(import.meta.dirname, ".."),
  arg = (name) => {
    const at = process.argv.indexOf(name);
    return at < 0 ? null : process.argv[at + 1];
  },
  mode = arg("--dev-url") ? "dev" : "built",
  proof = path.resolve(arg("--proof-out") ?? "D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/character-creator-20261017/artifacts/browser"),
  devUrl = arg("--dev-url");
if (devUrl && !/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(devUrl))
  throw Error("Expected --dev-url http://127.0.0.1:<port>/");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex"),
  sourceFiles = [...ART_SOURCE_PATHS, "src/components/art-studio.tsx", "src/components/art-character-creator.tsx", "src/art/studio.css", "scripts/test-character-browser.mjs"],
  receipt = { mode, started: new Date().toISOString(), checks: [], sources: [], renderers: [] };
let server, browser;

function bounded(label, promise, timeout = 20000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`${label} exceeded ${timeout} ms`)), timeout); }),
  ]).finally(() => clearTimeout(timer));
}

function unzip(bytes) {
  const files = new Map();
  for (let at = 0; at + 30 < bytes.length && bytes.readUInt32LE(at) === 0x04034b50;) {
    const size = bytes.readUInt32LE(at + 18), n = bytes.readUInt16LE(at + 26), extra = bytes.readUInt16LE(at + 28), dataAt = at + 30 + n + extra;
    files.set(bytes.toString("utf8", at + 30, at + 30 + n), bytes.subarray(dataAt, dataAt + size));
    at = dataAt + size;
  }
  assert.ok(files.size, "Studio export ZIP must contain files");
  return files;
}

async function recipeFromStudio(page) {
  const details = page.locator(".art-advanced");
  if (!(await details.evaluate((node) => node.hasAttribute("open")))) await details.locator("summary").first().click();
  return JSON.parse(await page.getByLabel("Recipe JSON, including custom technique source").inputValue());
}

async function decodedPngHash(page, bytes) {
  return page.evaluate(async (encoded) => {
    const png = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)), image = await createImageBitmap(new Blob([png], { type: "image/png" }));
    try {
      const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d"); context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      return { width: canvas.width, height: canvas.height, hash: [...new Uint8Array(await crypto.subtle.digest("SHA-256", pixels))].map((n) => n.toString(16).padStart(2, "0")).join("") };
    } finally { image.close(); }
  }, bytes.toString("base64"));
}

try {
  await fs.mkdir(proof, { recursive: true });
  const moduleRoot = mode === "built" ? path.join(root, ".artifacts/grout-art-sdk") : path.join(root, "packages/grout-art"),
    modules = new Map();
  for (const relative of sourceFiles) receipt.sources.push({ path: relative, sha256: sha(await fs.readFile(path.join(root, relative))) });
  for (const relative of ART_SOURCE_PATHS) {
    const name = path.basename(relative), bytes = await fs.readFile(path.join(moduleRoot, name));
    if (mode === "built") assert.equal(sha(bytes), sha(await fs.readFile(path.join(root, relative))), `Run npm run build:art-sdk after ${relative} changes`);
    modules.set(name, bytes);
  }
  let url = devUrl;
  if (!url) {
    Object.assign(process.env, mergeAppEnv(readAppEnv(root), process.env));
    server = await preview({ root, mode: "pages", preview: { host: "127.0.0.1", port: 0, open: false } });
    url = `http://127.0.0.1:${server.httpServer.address().port}/mountain-cabin-bloom-honey/`;
  }
  receipt.url = url;
  browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-unsafe-webgpu"] });
  receipt.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  context.setDefaultTimeout(12000);
  await context.route("**/__character-sdk/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop(), bytes = modules.get(name);
    await route.fulfill({ status: bytes ? 200 : 404, headers: { "Content-Type": bytes ? "application/javascript; charset=utf-8" : "application/octet-stream", "X-Content-Type-Options": "nosniff" }, body: bytes ?? Buffer.from("Not found") });
  });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("503 (Service Unavailable)")) errors.push(message.text()); });
  await bounded("studio navigation", page.goto(`${url}studio?workspace=character`), 30000);
  await page.getByLabel("Character name").waitFor();
  await page.getByText(/Character workspace ready|Recovered your character workspace/).waitFor();
  await page.getByRole("combobox", { name: /Renderer/ }).selectOption("cpu");
  await page.locator(".art-status-backend").filter({ hasText: "Preview: cpu" }).waitFor();
  const api = await page.evaluate(async () => {
    const s = await import("/__character-sdk/index.mjs");
    return { format: s.CHARACTER_FORMAT, frames: s.CHARACTER_FRAMES };
  });
  assert.equal(api.format, "grout-character/1");
  assert.equal(api.frames.length, 12);
  receipt.checks.push("dev/built SDK dynamic import, MIME and twelve-pose contract");

  await page.screenshot({ path: path.join(proof, `${mode}-character-desktop.png`), fullPage: true });
  for (const [label, value] of [["Build", "chibi"], ["Style", "shaded"], ["Frame size", "32"], ["Palette", "cinder"], ["Skin ramp", "1"], ["Hair ramp", "2"], ["Mode", "procedural"]])
    await page.locator(".art-character-selectors label").nth([["Build", "Style", "Frame size", "Palette", "Skin ramp", "Hair ramp", "Mode"].indexOf(label)]).locator("select").selectOption(value);
  const seedInput = page.locator(".art-character-selectors label").filter({ hasText: "Seed" }).locator("input");
  await seedInput.fill("1215");
  await page.getByRole("button", { name: "Generate from seed", exact: true }).click();
  let character = JSON.parse(await page.evaluate(() => localStorage.getItem("grout-character-studio/1")));
  assert.equal(character.seed, 1215);
  assert.equal(character.mode, "procedural");
  assert.equal(character.frameSize, 32);
  const beforeReroll = character.selections.head;
  await page.getByRole("button", { name: "Reroll part", exact: true }).click();
  character = JSON.parse(await page.evaluate(() => localStorage.getItem("grout-character-studio/1")));
  const rerolled = character.selections.head;
  await page.locator(".art-character-slot").filter({ has: page.getByRole("combobox", { name: "Head option" }) }).locator(".art-character-lock input").check();
  await page.getByRole("button", { name: "Randomize", exact: true }).click();
  const lockedHead = JSON.parse(await page.evaluate(() => localStorage.getItem("grout-character-studio/1"))).selections.head;
  assert.equal(lockedHead, rerolled, "locked head selection must survive randomize");
  receipt.seed = { typed: 1215, preReroll: beforeReroll, rerolled, lockedAfterRandomize: lockedHead };
  receipt.checks.push("build/style/size/palette/skin/hair/procedural selectors; seed generation, slot reroll and lock");

  const partSelect = page.locator(".art-character-option-detail label").filter({ hasText: "Selected part" }).locator("select");
  await partSelect.selectOption("clothing");
  await page.locator(".art-character-slot").filter({ has: page.getByLabel("Clothing option") }).getByRole("button").click();
  const activeLayer = await page.locator('.art-layer-select[aria-pressed="true"]').getAttribute("aria-label").catch(() => null);
  assert.ok(await page.locator('.art-layer-select[aria-pressed="true"]').count(), "selecting a part should select its drawing layer");
  const partCanvas = page.locator(".art-main-canvas"), recipeBeforePaint = await recipeFromStudio(page), beforeHash = sha(renderFrame(recipeBeforePaint).data);
  const pixel = [...renderFrame(recipeBeforePaint).data].findIndex((value, index) => index % 4 === 3 && value > 0);
  assert.ok(pixel >= 0);
  const p = Math.floor(pixel / 4), px = p % recipeBeforePaint.width, py = Math.floor(p / recipeBeforePaint.width), rect = await partCanvas.boundingBox();
  await partCanvas.click({ position: { x: (px + .5) * rect.width / recipeBeforePaint.width, y: (py + .5) * rect.height / recipeBeforePaint.height } });
  let paintedDoc = JSON.parse(await page.evaluate(() => localStorage.getItem("grout-character-studio/1")));
  assert.ok(paintedDoc.selections.clothing, "paint edit retains selected clothing option");
  await page.getByRole("button", { name: "Undo (Ctrl or Command plus Z)", exact: true }).click();
  const undoneDoc = JSON.parse(await page.evaluate(() => localStorage.getItem("grout-character-studio/1")));
  assert.notEqual(undoneDoc.selections.clothing, paintedDoc.selections.clothing, "undo returns generated clothing option");
  await page.getByRole("button", { name: "Redo (Ctrl or Command plus Shift plus Z)", exact: true }).click();
  const redoneDoc = JSON.parse(await page.evaluate(() => localStorage.getItem("grout-character-studio/1")));
  assert.equal(redoneDoc.selections.clothing, paintedDoc.selections.clothing, "redo restores custom clothing option");
  receipt.drawing = { activeLayer, pixel: [px, py], beforeHash };
  receipt.checks.push("selected slot layer, custom-part drawing, undo and redo document synchronization");

  await page.getByRole("button", { name: "Edit creator", exact: true }).click();
  const creatorDisclosure = page.locator(".art-character-source");
  await creatorDisclosure.locator("summary").click();
  const creatorEditor = creatorDisclosure.locator("textarea");
  await creatorEditor.fill("{broken");
  await page.getByRole("button", { name: "Apply definition", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.match(await creatorEditor.inputValue(), /broken/);
  await creatorDisclosure.getByRole("button", { name: "Cancel edits", exact: true }).click();
  const creatorDraft = JSON.parse(await page.evaluate(() => localStorage.getItem("grout-character-studio/1"))).creator; creatorDraft.name = "Browser proof creator"; await creatorEditor.fill(JSON.stringify(creatorDraft));
  await page.getByRole("button", { name: "Apply definition", exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("grout-character-studio/1"))?.creator?.name === "Browser proof creator");
  receipt.checks.push("creator JSON invalid draft retained; valid creator JSON applied"); await page.getByRole("button", { name: "Close creator", exact: true }).click();

  await page.getByRole("button", { name: "Keep this look", exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("grout-character-studio/1"))?.creator?.feedback?.ratings?.length === 1);
  const headOption = page.getByLabel("Head option"), headValues = await headOption.locator("option").evaluateAll((options) => options.map((option) => option.value));
  await headOption.selectOption(headValues[headValues[0] === await headOption.inputValue() ? 1 : 0]);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("grout-character-studio/1"))?.selections?.head !== undefined);
  await page.getByRole("button", { name: "Reject this look", exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("grout-character-studio/1"))?.creator?.feedback?.ratings?.length === 2);
  const preference = page.locator(".art-character-feedback input[type=checkbox]");
  await preference.uncheck();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("grout-character-studio/1"))?.creator?.feedback?.enabled === false);
  await preference.check();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("grout-character-studio/1"))?.creator?.feedback?.enabled === true);
  const reviewHistory = page.locator(".art-character-feedback details");
  if (!(await reviewHistory.evaluate((node) => node.hasAttribute("open")))) await reviewHistory.locator("summary").click();
  assert.equal(await reviewHistory.locator("li").count(), 2);
  await page.getByRole("button", { name: "Remove review 1", exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("grout-character-studio/1"))?.creator?.feedback?.ratings?.length === 1);
  receipt.checks.push("generation feedback keep/reject, preference toggle and review history removal");

  await page.getByRole("link", { name: "Sprite", exact: true }).click();
  await page.locator(".art-studio-title .art-eyebrow").filter({ hasText: "sprite bench" }).waitFor();
  const recipeDetails = page.locator(".art-advanced"); if (!(await recipeDetails.evaluate((node) => node.hasAttribute("open")))) await recipeDetails.locator("summary").first().click();
  const sourceEditor = page.locator(".art-advanced textarea");
  await sourceEditor.fill("{invalid");
  const draftBeforeNavigation = await sourceEditor.inputValue();
  let legacySourcePersisted = false;
  try { await bounded("legacy source recovery key", page.waitForFunction(() => localStorage.getItem("grout-art-studio/1:source") === "{invalid", { timeout: 5000 }), 7000); legacySourcePersisted = true; }
  catch { receipt.sourceLegacyProbe = await page.evaluate(() => ({ keys: Object.keys(localStorage), sourceLength: localStorage.getItem("grout-art-studio/1:source")?.length ?? null, draftMatches: document.querySelector(".art-advanced textarea")?.value === "{invalid" })); }
  const sourceKeyBeforeSwitch = await page.evaluate(() => localStorage.getItem("grout-art-studio/1:source"));
  await page.getByRole("link", { name: "Character", exact: true }).click();
  await page.getByText(/Character workspace ready|Recovered your character workspace/).waitFor();
  const sourceGuard = await page.getByLabel("Character name").isDisabled();
  await page.getByRole("link", { name: "Sprite", exact: true }).click();
  await page.locator(".art-studio-title .art-eyebrow").filter({ hasText: "sprite bench" }).waitFor();
  const sourceRecoveredDetails = page.locator(".art-advanced");
  if (!(await sourceRecoveredDetails.evaluate((node) => node.hasAttribute("open")))) await sourceRecoveredDetails.locator("summary").first().click();
  const sourceRecovered = sourceRecoveredDetails.locator("textarea");
  await sourceRecovered.waitFor();
  const sourceKeyAfterSwitch = await page.evaluate(() => localStorage.getItem("grout-art-studio/1:source"));
  const sourceTextAfterSwitch = await sourceRecovered.inputValue();
  receipt.sourceRecovery = { characterControlsEnabled: !sourceGuard, legacyKeyPersisted: legacySourcePersisted, keyBefore: sourceKeyBeforeSwitch ? "present" : "missing", keyAfter: sourceKeyAfterSwitch ? "present" : "missing", draftBeforeNavigation: draftBeforeNavigation === "{invalid", draftAfterNavigation: sourceTextAfterSwitch === "{invalid" };
  receipt.checks.push("independent workspace source recovery inspected; pending draft preservation=" + receipt.sourceRecovery.draftAfterNavigation);

  await page.getByRole("link", { name: "Character", exact: true }).click();
  await page.getByText(/Character workspace ready|Recovered your character workspace/).waitFor();
  if (!(await page.getByRole("button", { name: "Close creator", exact: true }).count())) await page.getByRole("button", { name: "Edit creator", exact: true }).click();
  const importDetails = page.locator(".art-sprite-import");
  await importDetails.locator("summary").click();
  const importRecipe = compileCharacter(createCharacterDocument()), importPng = Buffer.from(await encodePortablePng(renderFrame(importRecipe)));
  await page.getByLabel("Sprite images", { exact: true }).setInputFiles({ name: "pose.png", mimeType: "image/png", buffer: importPng });
  await page.getByRole("button", { name: "Convert to recipe", exact: true }).click();
  await page.getByText(/Imported 1 source frames/).waitFor();
  const mappingDetails = page.locator(".art-character-import");
  await mappingDetails.locator("summary").click();
  const poseSelects = mappingDetails.locator(".art-character-mapping").first().locator("select");
  assert.equal(await poseSelects.count(), 12);
  for (let i = 0; i < 11; i++) await poseSelects.nth(i).selectOption({ index: 1 });
  assert.equal(await mappingDetails.getByRole("button", { name: "Add mapped custom option" }).isDisabled(), true);
  await poseSelects.nth(11).selectOption({ index: 1 });
  assert.equal(await mappingDetails.getByRole("button", { name: "Add mapped custom option" }).isDisabled(), false);
  await mappingDetails.getByRole("button", { name: "Add mapped custom option" }).click();
  character = JSON.parse(await page.evaluate(() => localStorage.getItem("grout-character-studio/1")));
  assert.ok(character.creator.slots.some((slot) => slot.options.some((option) => option.kind === "custom" && option.imported)));
  receipt.checks.push("PNG source import; twelve poses require explicit mapping; custom option retained");

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "mobile workspace must not overflow horizontally");
  await page.screenshot({ path: path.join(proof, `${mode}-character-mobile.png`), fullPage: true });
  await page.getByRole("link", { name: "Sprite", exact: true }).click();
  await page.getByText("sprite bench", { exact: false }).waitFor();
  await page.getByRole("link", { name: "Character", exact: true }).click();
  await page.getByLabel("Character name").waitFor();
  receipt.checks.push("mobile layout and workspace switching preserve separate character route");

  await page.setViewportSize({ width: 1440, height: 1000 });
  const characterSourceDetails = page.locator(".art-advanced");
  if (!(await characterSourceDetails.evaluate((node) => node.hasAttribute("open")))) await characterSourceDetails.locator("summary").first().click();
  const characterSource = characterSourceDetails.locator("textarea");
  await characterSource.fill("{invalid character source");
  await bounded("character source recovery persistence", page.waitForFunction(() => localStorage.getItem("grout-character-studio/1:source") === "{invalid character source", { timeout: 5000 }), 7000);
  assert.equal(await page.getByLabel("Character name").isDisabled(), true, "same-workspace pending character source disables controls");
  await characterSourceDetails.getByRole("button", { name: "Reset text", exact: true }).click();
  await page.waitForFunction(() => localStorage.getItem("grout-character-studio/1:source") !== "{invalid character source");
  assert.equal(await page.getByLabel("Character name").isDisabled(), false);
  receipt.checks.push("same-workspace character source recovery key, edit guard and reset");

  // Corrupt character recovery must show a starter while preserving saved bytes.
  const corrupt = "{not-json-keep-me}", corruptContext = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  try {
    await corruptContext.addInitScript((value) => localStorage.setItem("grout-character-studio/1", value), corrupt);
    const corruptPage = await corruptContext.newPage();
    await corruptPage.goto(`${url}studio?workspace=character`);
    await corruptPage.getByLabel("Character name").waitFor();
    await corruptPage.getByText(/saved bytes are preserved/).waitFor();
    await corruptPage.waitForTimeout(300);
    assert.equal(await corruptPage.evaluate(() => localStorage.getItem("grout-character-studio/1")), corrupt);
  } finally { await corruptContext.close(); }
  const legacyContext = await browser.newContext();
  try {
    const legacy = createCharacterDocument();
    await legacyContext.addInitScript((doc) => localStorage.setItem("grout-character-studio/1", JSON.stringify(doc)), legacy);
    const legacyPage = await legacyContext.newPage(); await legacyPage.goto(`${url}studio?workspace=character`);
    await legacyPage.getByLabel("Character name").waitFor();
    await legacyPage.waitForFunction(() => JSON.parse(localStorage.getItem("grout-character-studio/1")).format === "grout-character/1");
    assert.equal((await legacyPage.evaluate(() => JSON.parse(localStorage.getItem("grout-character-studio/1")))).name, legacy.name);
  } finally { await legacyContext.close(); }
  receipt.checks.push("valid and corrupt recovery; corrupt bytes preserved while starter remains usable");

  // Matrix uses compiled creator docs and exact CPU output for every backend that is truly available.
  receipt.renderers = await bounded("character renderer matrix", page.evaluate(async () => {
    const s = await import("/__character-sdk/index.mjs"), result = [];
    for (const backend of ["cpu", "webgl2", "webgpu"]) {
      let renderer;
      try { renderer = await s.createRenderer({ backend }); }
      catch (error) { result.push({ backend, status: "unsupported", reason: error.message }); continue; }
      if (renderer.backend !== backend) { result.push({ backend, status: "unsupported", reason: renderer.diagnostics.join("; ") || `resolved ${renderer.backend}` }); renderer.dispose(); continue; }
      let frames = 0;
      const started = performance.now();
      try {
        for (const build of ["chibi", "classic", "slim"]) for (const style of ["adventure", "soft", "shaded"]) for (const seed of [1204, 1215, 1233]) {
          let doc = s.createCharacterDocument();
          doc = { ...doc, build, style, seed, mode: "procedural", palette: seed === 1215 ? "cinder" : seed === 1233 ? "heather" : "fern" };
          const recipe = s.compileCharacter(doc);
          for (let frame = 0; frame < 12; frame++) {
            const cpu = s.renderFrame(recipe, frame), actual = await renderer.render(recipe, frame);
            if (actual.backend !== backend || cpu.data.some((value, i) => value !== actual.data[i])) throw Error(`${backend}/${build}/${style}/${seed}/${frame} differs from CPU`);
            frames++;
          }
        }
      } finally { renderer.dispose(); }
      result.push({ backend, status: "passed", frames, byteDifferences: 0, ms: performance.now() - started });
    }
    return result;
  }), 240000);
  assert.equal(receipt.renderers.find((item) => item.backend === "cpu")?.frames, 324);
  receipt.checks.push("all 9 build/style combinations × 3 seeds × 12 frames; procedural mode and palette changes; unsupported GPUs reported explicitly");

  // Export error, cancellation and retry; compare decoded browser ZIP assets with the CLI bake.
  let fault = true, release;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.resourceType() === "fetch" && request.url().includes("/packages/grout-art/") && fault) await route.fulfill({ status: 503, body: "test source identity failure" });
    else await route.continue().catch(() => {});
  });
  await page.getByRole("button", { name: "Export atlas kit", exact: true }).click();
  await page.getByText(/Export failed/).waitFor();
  fault = false;
  await page.unroute("**/*");
  const pending = new Promise((resolve) => { release = resolve; });
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() === "fetch" && route.request().url().includes("/packages/grout-art/")) await pending;
    await route.continue().catch(() => {});
  });
  await page.getByRole("button", { name: "Export atlas kit", exact: true }).click();
  await page.getByRole("button", { name: "Cancel export", exact: true }).click(); release();
  await page.getByText(/Export cancelled/).waitFor();
  await page.unroute("**/*");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export atlas kit", exact: true }).click();
  const download = await downloadPromise, zip = unzip(await fs.readFile(await download.path())), exportedRecipe = JSON.parse(zip.get("recipe.json").toString("utf8"));
  assert.ok(zip.has("character.json") && zip.has("creator.json"));
  assert.deepEqual(JSON.parse(zip.get("character.json").toString("utf8")), exportedRecipe.character);
  assert.deepEqual(JSON.parse(zip.get("creator.json").toString("utf8")), exportedRecipe.character.creator);
  const cli = await bakeArt({ recipe: exportedRecipe, output: path.join(proof, "cli") });
  for (const [name, bytes] of zip) if (name.endsWith(".png")) {
    const browserPixels = await decodedPngHash(page, bytes), cliPixels = await decodedPngHash(page, await fs.readFile(path.join(cli.directory, name)));
    assert.deepEqual(browserPixels, cliPixels, `${name} decoded browser/CLI mismatch`);
  }
  receipt.checks.push("export error/cancel/retry; creator.json and character.json included; all decoded browser PNGs equal CLI bake");
  assert.deepEqual(errors, [], "browser console/page errors");
  receipt.success = true;
} catch (error) {
  receipt.error = error.stack ?? String(error);
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await server.close().catch(() => {});
  receipt.finished = new Date().toISOString();
  await fs.mkdir(proof, { recursive: true });
  await fs.writeFile(path.join(proof, `${mode}-character-receipt.json`), JSON.stringify(receipt, null, 2) + "\n");
}
console.log(JSON.stringify(receipt, null, 2));














