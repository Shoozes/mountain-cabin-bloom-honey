import { verifyArtVariations } from "./verify-art-variation-browser.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { preview } from "vite";
import { bakeArt, ART_SOURCE_PATHS } from "./bake-art.mjs";
import { createTravelerRecipe, getTravelerWardrobe, setTravelerWardrobe, refineTravelerWalk, renderFrame } from "../packages/grout-art/index.mjs";

const root = path.resolve(import.meta.dirname, "..");
const proofAt = process.argv.indexOf("--proof-out");
if (proofAt >= 0 && !process.argv[proofAt + 1]) throw Error("--proof-out needs a directory");
const proof =
  proofAt < 0
    ? path.join(root, ".artifacts/proof/grout-art-browser")
    : path.resolve(process.argv[proofAt + 1]);
const devAt = process.argv.indexOf("--dev-url"),
  dev = devAt < 0 ? null : process.argv[devAt + 1];
if (devAt >= 0 && !/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(dev ?? ""))
  throw Error("Expected --dev-url http://127.0.0.1:<port>/");
const sha = (b) => createHash("sha256").update(b).digest("hex"),
  receipt = {
    mode: dev ? "dev" : "built",
    started: new Date().toISOString(),
    checks: [],
    sources: [],
  };
let server, browser, observedPage;
const scratch = path.join(proof, `scratch-${process.pid}`);
function unzip(bytes) {
  const files = new Map();
  let p = 0;
  while (p + 30 < bytes.length && bytes.readUInt32LE(p) === 0x04034b50) {
    assert.equal(bytes.readUInt16LE(p + 8), 0);
    const size = bytes.readUInt32LE(p + 18),
      n = bytes.readUInt16LE(p + 26),
      extra = bytes.readUInt16LE(p + 28),
      at = p + 30 + n + extra;
    files.set(bytes.toString("utf8", p + 30, p + 30 + n), bytes.subarray(at, at + size));
    p = at + size;
  }
  assert.ok(files.size);
  return files;
}
async function canvasHash(page) {
  return page.locator(".art-main-canvas").evaluate(async (c) => {
    const bytes = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  });
}
async function waitCanvas(page, expected) {
  await page.waitForFunction(async (expected) => {
    const c = document.querySelector(".art-main-canvas");
    if (!c) return false;
    const bytes = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    return (
      [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("") === expected
    );
  }, expected);
}
async function pngHash(page, bytes) {
  return page.evaluate(async (encoded) => {
    const b = Uint8Array.from(atob(encoded), (s) => s.charCodeAt(0)),
      image = await createImageBitmap(new Blob([b], { type: "image/png" }));
    try {
      const c = document.createElement("canvas");
      c.width = image.width;
      c.height = image.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(image, 0, 0);
      return {
        width: c.width,
        height: c.height,
        hash: [
          ...new Uint8Array(
            await crypto.subtle.digest("SHA-256", ctx.getImageData(0, 0, c.width, c.height).data),
          ),
        ]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join(""),
      };
    } finally {
      image.close();
    }
  }, bytes.toString("base64"));
}
try {
  await fs.mkdir(proof, { recursive: true });
  const modules = new Map();
  for (const relative of ART_SOURCE_PATHS) {
    const name = path.basename(relative),
      bytes = await fs.readFile(path.join(root, ".artifacts/grout-art-sdk", name));
    assert.equal(
      sha(bytes),
      sha(await fs.readFile(path.join(root, relative))),
      "Run build:art-sdk after SDK edits",
    );
    modules.set(name, bytes);
    receipt.sources.push({ path: relative, sha256: sha(bytes) });
  }
  let url = dev;
  if (!url) {
    server = await preview({
      root,
      mode: "pages",
      preview: { host: "127.0.0.1", port: 0, open: false },
    });
    const port = server.httpServer.address().port;
    url = `http://127.0.0.1:${port}/mountain-cabin-bloom-honey/`;
  }
  receipt.url = url;
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
  // Test-owned route serves the copied private SDK as a real browser consumer.
  // Exact allowlist before reads; unknown paths never become executable modules.
  await context.route("**/__art-sdk/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop(),
      bytes = modules.get(name);
    await route.fulfill({
      status: bytes ? 200 : 404,
      headers: {
        "Content-Type": bytes
          ? "application/javascript; charset=utf-8"
          : "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
      body: bytes ?? Buffer.from("Not found"),
    });
  });
  const page = await context.newPage(),
    errors = [],
    faultUrls = new Set();
  observedPage = page;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") {
      const location = m.location().url;
      if (
        (location.endsWith("/__art-sdk/nope.xyz") || faultUrls.has(location)) &&
        /Failed to load resource/.test(m.text())
      )
        return;
      errors.push(m.text());
    }
  });
  await page.goto(url + "studio");
  await page
    .locator(".art-status-backend")
    .filter({ hasText: /Preview: (webgpu|webgl2|cpu)/ })
    .waitFor();
  if (!process.argv.includes("--variations-only")) {
  const delivered = await page.evaluate(async () => {
    const r = await fetch("/__art-sdk/index.mjs");
    return {
      status: r.status,
      type: r.headers.get("content-type"),
      unknown: (await fetch("/__art-sdk/nope.xyz")).status,
    };
  });
  assert.equal(delivered.status, 200);
  assert.match(delivered.type, /application\/javascript/);
  assert.equal(delivered.unknown, 404);
  receipt.checks.push("SDK browser MIME and allowlist");
  if (!process.argv.includes("--ui-only"))
    receipt.gpu = await page.evaluate(async () => {
      const s = await import("/__art-sdk/index.mjs"),
        results = { backends: [], frames: 0, wardrobeFrames: 0, techniques: 0 };
      for (const backend of ["webgl2", "webgpu"]) {
        const renderer = await s.createRenderer({ backend });
        if (renderer.backend !== backend)
          throw Error(backend + " qualification fell back: " + renderer.diagnostics.join("; "));
        let count = 0;
        const begin = performance.now();
        try {
          for (const seed of [1204, 1215, 1233])
            for (const equipment of [0, 1, 2, 3])
              for (const palette of [0, 1, 2]) {
                const r = s.createTravelerRecipe();
                r.seed = seed;
                r.layers.find((l) => l.id === "cap").visible = !!(equipment & 1);
                r.layers.find((l) => l.id === "bag").visible = !!(equipment & 2);
                if (palette === 1) r.palette.cloth = "#46647d";
                if (palette === 2) {
                  r.palette.cloth = "#8a6751";
                  r.palette.outline = "#000000";
                }
                for (let frame = 0; frame < 12; frame++) {
                  const expected = s.renderFrame(r, frame),
                    actual = await renderer.render(r, frame);
                  if (
                    actual.backend !== backend ||
                    expected.data.some((n, i) => n !== actual.data[i])
                  )
                    throw Error(`${backend}/${seed}/${equipment}/${palette}/${frame} differs`);
                  count++;
                }
              }
          for (const {id: clothing} of s.TRAVELER_CLOTHING)
            for (const {id: hat} of s.TRAVELER_HATS)
            for (const {id: palette} of s.TRAVELER_PALETTES) {
              const r = s.createTravelerRecipe({clothing,hat,palette});
              for(let frame=0;frame<12;frame++) {
                const actual=await renderer.render(r,frame),expected=s.renderFrame(r,frame);
                if(actual.backend!==backend || expected.data.some((v,i)=>v!==actual.data[i])) throw Error(`${backend}/${clothing}/${hat}/${frame} differs`);
                results.wardrobeFrames++;
              }
            }
          for (const id of ["geometry", "custom-technique", "variations"])
            for (const seed of [1204, 1215, 1233]) {
              const r = s.createExampleRecipe(id);
              r.seed = seed;
              const a = s.renderFrame(r),
                b = await renderer.render(r);
              if (a.data.some((n, i) => n !== b.data[i]))
                throw Error(backend + "/" + id + " differs");
              results.techniques++;
            }
          const r = s.createExampleRecipe("geometry");
          r.parts.dot = [{ op: "rect", x: 1, y: 1, w: 1, h: 1, role: "skin" }];
          r.parts.study = [
            { op: "outline", part: "dot", role: "outline" },
            { op: "use", part: "dot", x: 5, y: 2 },
            {
              op: "clip",
              x: 9,
              y: 0,
              w: 1,
              h: 4,
              ops: [{ op: "rect", x: 8, y: 0, w: 4, h: 4, role: "accent" }],
            },
            { op: "use", part: "dot", x: 0, y: 6, width: 4, height: 4, flipX: true, scale: 2 },
          ];
          {
            const b = await renderer.render(r);
            if (s.renderFrame(r).data.some((n, i) => n !== b.data[i]))
              throw Error("Transform mismatch " + backend);
          }
          results.techniques++;
          await renderer.render(s.createTravelerRecipe(), 0, { signal: AbortSignal.abort() }).then(
            () => {
              throw Error("Cancelled render completed");
            },
            (e) => {
              if (e.name !== "AbortError") throw e;
            },
          );
          const bad = s.createExampleRecipe("custom-technique");
          bad.techniques[0][backend === "webgl2" ? "glsl" : "wgsl"] = "invalid shader here";
          await renderer.render(bad).then(
            () => {
              throw Error("Bad shader accepted");
            },
            (e) => {
              if (!e.message.includes(bad.techniques[0].id))
                throw Error("Error missing module identity: " + e.message);
            },
          );
          await renderer.render(s.createTravelerRecipe());
          results.backends.push({
            backend,
            count,
            byteDifferences: 0,
            ms: performance.now() - begin,
          });
          results.frames += count;
        } finally {
          renderer.dispose();
        }
      }
      const gl = document.createElement("canvas").getContext("webgl2"),
        debug = gl.getExtension("WEBGL_debug_renderer_info");
      results.gl = {
        version: gl.getParameter(gl.VERSION),
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "unavailable",
      };
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      const adapter = await navigator.gpu?.requestAdapter();
      results.adapter = adapter?.info
        ? {
            vendor: adapter.info.vendor,
            architecture: adapter.info.architecture,
            device: adapter.info.device,
            description: adapter.info.description,
          }
        : null;
      return results;
    });
  if (receipt.gpu)
    receipt.checks.push(
      "864 base +864 wardrobe GPU frames +20 technique frames; cancellation; bad shader and recovery",
    );
  // Context/device loss through test-owned interception, without product debug handles.
  receipt.loss = await page.evaluate(async () => {
    const s = await import("/__art-sdk/index.mjs"),
      native = HTMLCanvasElement.prototype.getContext;
    let ownedGL;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      const c = native.call(this, kind, ...args);
      if (kind === "webgl2") ownedGL = c;
      return c;
    };
    const gl = await s.createRenderer({ backend: "webgl2" });
    HTMLCanvasElement.prototype.getContext = native;
    ownedGL.getExtension("WEBGL_lose_context").loseContext();
    await new Promise((r) => setTimeout(r, 30));
    let glLost = false;
    try {
      await gl.render(s.createTravelerRecipe());
    } catch (e) {
      glLost = /lost/i.test(e.message);
    } finally {
      gl.dispose();
    }
    const adapter = await navigator.gpu.requestAdapter(),
      device = await adapter.requestDevice(),
      request = navigator.gpu.requestAdapter.bind(navigator.gpu);
    navigator.gpu.requestAdapter = async () => ({ requestDevice: async () => device });
    let gpu;
    try {
      gpu = await s.createRenderer({ backend: "webgpu" });
    } finally {
      navigator.gpu.requestAdapter = request;
    }
    device.destroy();
    await device.lost;
    await Promise.resolve();
    let gpuLost = false;
    try {
      await gpu.render(s.createTravelerRecipe());
    } catch (e) {
      gpuLost = /lost/i.test(e.message);
    } finally {
      gpu.dispose();
    }
    return { glLost, gpuLost };
  });
  assert.deepEqual(receipt.loss, { glLost: true, gpuLost: true });
  const base = createTravelerRecipe(),
    initial = sha(renderFrame(base, 1).data);
  await waitCanvas(page, initial);
  await page.getByRole("combobox", { name: /Renderer/ }).selectOption("cpu");
  await page.locator(".art-status-backend").filter({ hasText: "Preview: cpu" }).waitFor();
  for (const direction of ["south", "west", "east", "north"]) {
    const clip = base.clips["walk-" + direction];
    await page.getByRole("combobox", {name: "Clip", exact: true}).selectOption("walk-" + direction);
    for (let slot = 0; slot < clip.frames.length; slot++) {
      await page.locator(".art-frame-button").nth(slot).click();
      await waitCanvas(page, sha(renderFrame(base, base.frames.findIndex((f) => f.name === clip.frames[slot])).data));
      assert.equal(await page.locator(".art-anchor-mark").getAttribute("title"), "Feet anchor 8, 15");
    }
    await page.getByRole("button", {name: "Play", exact: true}).click();
    const observed = await page.evaluate(() => new Promise((resolve) => {
      const start = performance.now(), slots = [];
      const tick = () => {
        const slot = [...document.querySelectorAll(".art-frame-button")].findIndex((b) => b.getAttribute("aria-current") === "true");
        if (slots.at(-1) !== slot) slots.push(slot);
        if (performance.now() - start >= 1100) resolve(slots);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));
    await page.getByRole("button", {name: "Pause", exact: true}).click();
    assert.equal(new Set(observed).size, 4, direction + " must play all four slots, including repeated pass pose");
    for (let i = 1; i < observed.length; i++) assert.equal(observed[i], (observed[i - 1] + 1) % 4);
  }
  await page.getByRole("combobox", {name: "Clip", exact: true}).selectOption("walk-south");
  await waitCanvas(page, initial);
  receipt.checks.push("four directional walk cycles: every pose matches CPU, all playback slots advance, fixed feet anchor");
  const canvas = page.locator(".art-main-canvas");
  assert.equal(await page.locator('.art-layer-select[aria-pressed="true"]').filter({hasText:'Body and boots'}).count(), 1);
  await page.getByText("Clothing & hats", {exact:true}).click();
  for(const clothing of ["coat","tunic","vest"]) for(const hat of ["cap","round","trail"]) {
    await page.getByLabel("Traveler clothing",{exact:true}).selectOption(clothing);
    await page.getByLabel("Traveler hat",{exact:true}).selectOption(hat);
    await waitCanvas(page,sha(renderFrame(createTravelerRecipe({clothing,hat}),1).data));
  }
  await page.getByRole("button",{name:"Undo (Ctrl or Command plus Z)",exact:true}).click();
  await waitCanvas(page,sha(renderFrame(createTravelerRecipe({clothing:"vest",hat:"round"}),1).data));
  await page.getByRole("button",{name:"Redo (Ctrl or Command plus Shift plus Z)",exact:true}).click();
  await waitCanvas(page,sha(renderFrame(createTravelerRecipe({clothing:"vest",hat:"trail"}),1).data));
  await page.reload();
  await waitCanvas(page,sha(renderFrame(createTravelerRecipe({clothing:"vest",hat:"trail"}),1).data));
  await page.getByText("Clothing & hats",{exact:true}).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Traveler clothing"]')?.value === "vest" && document.querySelector('[aria-label="Traveler hat"]')?.value === "trail");
  assert.equal(await page.getByLabel("Traveler clothing",{exact:true}).inputValue(),"vest");
  assert.equal(await page.getByLabel("Traveler hat",{exact:true}).inputValue(),"trail");
  await page.getByLabel("Traveler clothing",{exact:true}).selectOption("coat");
  await page.getByLabel("Traveler hat",{exact:true}).selectOption("cap");
  await waitCanvas(page,initial);
  for(const palette of ["cinder","heather","harbor"]) {
    await page.getByLabel("Traveler colors",{exact:true}).selectOption(palette);
    await waitCanvas(page,sha(renderFrame(createTravelerRecipe({palette}),1).data));
  }
  await page.getByRole("button",{name:"Undo (Ctrl or Command plus Z)",exact:true}).click();
  await waitCanvas(page,sha(renderFrame(createTravelerRecipe({palette:"heather"}),1).data));
  await page.getByRole("button",{name:"Redo (Ctrl or Command plus Shift plus Z)",exact:true}).click();
  await waitCanvas(page,sha(renderFrame(createTravelerRecipe({palette:"harbor"}),1).data));
  await page.reload();
  await waitCanvas(page,sha(renderFrame(createTravelerRecipe({palette:"harbor"}),1).data));
  await page.getByText("Clothing & hats",{exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Traveler colors"]')?.value==="harbor");
  await page.getByLabel("Traveler colors",{exact:true}).selectOption("fern");
  await waitCanvas(page,initial);
  await page.getByText("Clothing & hats",{exact:true}).click();
  receipt.checks.push("nine garments and four colorways, undo/redo, draft recovery and exact base restoration");
  // A real pre-refinement draft remains unchanged until the explicit upgrade.
  const legacy = JSON.parse(await fs.readFile(path.join(root,"scripts/fixtures/traveler-wardrobe-20261016.json"),"utf8"));
  const recoveryContext = await browser.newContext();
  try {
    await recoveryContext.addInitScript(r=>localStorage.setItem("grout-art-studio/1",JSON.stringify(r)),legacy);
    const recovered = await recoveryContext.newPage();
    await recovered.goto(url+"studio");
    await waitCanvas(recovered,sha(renderFrame(legacy,1).data));
    await recovered.getByText("Clothing & hats",{exact:true}).click();
    await recovered.getByLabel("Traveler colors",{exact:true}).selectOption("cinder");
    const coloredLegacy=setTravelerWardrobe(legacy,{palette:"cinder"});
    await waitCanvas(recovered,sha(renderFrame(coloredLegacy,1).data));
    await recovered.getByRole("button",{name:"Refine walk & backpack",exact:true}).click();
    await waitCanvas(recovered,sha(renderFrame(refineTravelerWalk(coloredLegacy),1).data));
    await recovered.getByRole("button",{name:"Undo (Ctrl or Command plus Z)",exact:true}).click();
    await waitCanvas(recovered,sha(renderFrame(coloredLegacy,1).data));
  } finally {await recoveryContext.close();}
  receipt.checks.push("historical draft pixels preserved; colorway and explicit reversible walk/pack upgrade");
  await page.locator('.art-layer-select').filter({hasText:'Backpack'}).click();
  await page.getByText('Backpack is hidden in this frame.', {exact:false}).waitFor();
  await page.locator('.art-layer-select').filter({hasText:'Body and boots'}).click();
  await canvas.click({ position: { x: 8, y: 8 } });
  await page.waitForFunction(
    () =>
      document.querySelector(".art-main-canvas").getContext("2d").getImageData(0, 0, 1, 1)
        .data[3] === 255,
  );
  const painted = await canvasHash(page);
  assert.notEqual(painted, initial);
  await page.getByRole("button", { name: "Undo (Ctrl or Command plus Z)", exact: true }).click();
  await waitCanvas(page, initial);
  await page
    .getByRole("button", { name: "Redo (Ctrl or Command plus Shift plus Z)", exact: true })
    .click();
  await waitCanvas(page, painted);
  await page.getByLabel("Onion skin", { exact: true }).check();
  assert.equal(
    await page.locator(".art-onion-canvas").evaluate((c) => getComputedStyle(c).opacity),
    "0.22",
  );
  await page.getByLabel("Onion skin", { exact: true }).uncheck();
  await page.getByLabel("Seed", { exact: true }).fill("1215");
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("grout-art-studio/1") ?? "{}").seed === 1215,
  );
  await page.reload();
  await page.getByLabel("Seed", { exact: true }).waitFor();
  await page.waitForFunction(
    () => document.querySelector(".art-seed-field input")?.value === "1215",
  );
  await page.getByText("Recipe source and technique modules", { exact: true }).click();
  const editor = page.getByRole("textbox", {
    name: "Recipe JSON, including custom technique source",
  });
  const valid = await editor.inputValue();
  const last = await canvasHash(page);
  await editor.fill("{broken");
  assert.equal(await page.getByLabel("Traveler clothing",{exact:true}).isDisabled(),true);
  assert.equal(await page.getByLabel("Traveler colors",{exact:true}).isDisabled(),true);
  await page.getByRole("button", { name: "Apply recipe", exact: true }).click();
  await page.getByText(/Recipe was not applied/).waitFor();
  assert.equal(await canvasHash(page), last);
  assert.equal(await editor.inputValue(), "{broken");
  await page.waitForFunction(() => localStorage.getItem("grout-art-studio/1:source") === "{broken");
  await page.reload();
  await page
    .locator(".art-status-backend")
    .filter({ hasText: /Preview: (webgpu|webgl2|cpu)/ })
    .waitFor();
  await page.getByText("Recipe source and technique modules", { exact: true }).click();
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="Recipe JSON, including custom technique source"]')?.value === "{broken");
  await waitCanvas(page, last);
  await editor.fill(valid);
  await page.getByRole("button", { name: "Apply recipe", exact: true }).click();
  await page.getByText("Clothing & hats",{exact:true}).click();
  await page.getByLabel("Traveler clothing",{exact:true}).selectOption("tunic");
  await page.getByLabel("Traveler hat",{exact:true}).selectOption("trail");
  await page.getByLabel("Traveler colors",{exact:true}).selectOption("cinder");
  assert.equal(await page.locator('.art-main-canvas').evaluate(c=>c.getContext('2d').getImageData(0,0,1,1).data[3]),255,"wardrobe retains painted correction");
  // Actual app export failure, cancellation, retry, and CLI decoded-pixel equality.
  let releaseFetch;
  await page.route("**/*", async (route) => {
    if (
      route.request().resourceType() === "fetch" &&
      /\.(mjs|js)(\?|$)/.test(route.request().url())
    ) {
      faultUrls.add(route.request().url());
      await route.fulfill({ status: 503, body: "Test-owned export identity failure" });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Export atlas kit", exact: true }).click();
  await page.getByText(/Export failed/).waitFor();
  await page.unroute("**/*");
  const waiting = new Promise((resolve) => (releaseFetch = resolve));
  await page.route("**/*", async (route) => {
    if (
      route.request().resourceType() === "fetch" &&
      /\.(mjs|js)(\?|$)/.test(route.request().url())
    )
      await waiting;
    await route.continue().catch(() => {});
  });
  await page.getByRole("button", { name: "Export atlas kit", exact: true }).click();
  await page.getByRole("button", { name: "Cancel export", exact: true }).click();
  releaseFetch();
  await page.getByText(/Export cancelled/).waitFor();
  await page.unroute("**/*");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export atlas kit", exact: true }).click();
  const download = await downloadPromise;
  const zip = unzip(await fs.readFile(await download.path())),
    recipe = JSON.parse(zip.get("recipe.json")),
    manifest = JSON.parse(zip.get("atlas.json"));
  assert.equal(manifest.sources.length, ART_SOURCE_PATHS.length);
  assert.equal(manifest.visualReview, "unapproved");
  assert.deepEqual(getTravelerWardrobe(recipe),{clothing:"tunic",hat:"trail",palette:"cinder",walk:"refined"});
  const cli = await bakeArt({ recipe, output: scratch });
  for (const name of [...zip.keys()].filter((n) => n.endsWith(".png"))) {
    assert.deepEqual(
      await pngHash(page, zip.get(name)),
      await pngHash(page, await fs.readFile(path.join(cli.directory, name))),
      name + " browser/CLI mismatch",
    );
  }
  assert.deepEqual(manifest.frames, JSON.parse(JSON.stringify(cli.manifest.frames)));
  assert.deepEqual(manifest.clips, cli.manifest.clips);
  receipt.checks.push(
    "pencil undo/redo onion recovery malformed JSON; export failure/cancel/retry; all PNG browser/CLI pixels and frame metadata",
  );
  await page.goto(url + "studio?example=custom-technique");
  await page
    .locator(".art-status-backend")
    .filter({ hasText: /Preview: (webgpu|webgl2|cpu)/ })
    .waitFor();
  assert.equal(await page.locator(".art-wardrobe").count(),0);
  await page.getByRole("combobox", { name: /Renderer/ }).selectOption("webgl2");
  await page.locator(".art-status-backend").filter({ hasText: "Preview: webgl2" }).waitFor();
  await page.getByText("Recipe source and technique modules", { exact: true }).click();
  const customSource = await editor.inputValue(),
    customHash = await canvasHash(page),
    broken = JSON.parse(customSource);
  broken.techniques[0].glsl = "invalid shader here";
  await editor.fill(JSON.stringify(broken));
  await page.getByRole("button", { name: "Apply recipe", exact: true }).click();
  await page.getByText(/Render failed/).waitFor();
  assert.equal(await canvasHash(page), customHash);
  await editor.fill(customSource);
  await page.getByRole("button", { name: "Apply recipe", exact: true }).click();
  await waitCanvas(page, customHash);
  for (const backend of ["cpu", "webgl2", "webgpu", "cpu"])
    await page.getByRole("combobox", { name: /Renderer/ }).selectOption(backend);
  await page.locator(".art-status-backend").filter({ hasText: "Preview: cpu" }).waitFor();
  await waitCanvas(page, customHash);
  receipt.checks.push(
    "invalid source reload; failed shader last preview/repair; rapid backend switching",
  );
  await page.goto(url + "studio?example=atlas");
  await page.getByText("12/12 frames reconstructed byte-for-byte", { exact: false }).waitFor();
  await page.goto(url + "studio?example=comparison");
  await page.getByRole("button", { name: "Compare CPU, WebGL2 and WebGPU", exact: true }).click();
  await page.getByText(/webgpu.*0 differing bytes vs CPU/).waitFor();
  await page.goto(url + "examples");
  await page.getByRole("heading", { name: "Examples and techniques", exact: true }).waitFor();
  await page.waitForLoadState("networkidle");
  const search = page.getByRole("searchbox", { name: "Search examples and techniques" });
  await search.fill("atlas");
  await page.locator(".art-result-count").filter({ hasText: "13 matching entries" }).waitFor();
  await search.fill("");
  await page.getByRole("combobox", { name: /^Migration/ }).selectOption("migrated");
  await page.locator(".art-result-count").filter({ hasText: "6 matching entries" }).waitFor();
  await page.getByRole("combobox", { name: /^Migration/ }).selectOption("all");
  assert.equal((await page.locator('a[href*="studio?example="]').count()) >= 6, true);
  await page.screenshot({
    path: path.join(proof, `${receipt.mode}-examples.png`),
    fullPage: true,
    caret: "initial",
  });
  await page.goto(url + "studio");
  await page
    .locator(".art-status-backend")
    .filter({ hasText: /Preview: (webgpu|webgl2|cpu)/ })
    .waitFor();
  await page.screenshot({
    path: path.join(proof, `${receipt.mode}-studio-desktop.png`),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(proof, `${receipt.mode}-studio-mobile.png`),
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "Mobile overflow",
  );
  await page.locator('.art-layer-select').filter({hasText:'Body and boots'}).click();
  await page.getByRole('button',{name:'Erase',exact:true}).click();
  await page.locator('.art-main-canvas').click({position:{x:8,y:8}});
  await page.waitForFunction(()=>document.querySelector('.art-main-canvas').getContext('2d').getImageData(0,0,1,1).data[3]===0);
  await page.getByRole('button',{name:'Undo (Ctrl or Command plus Z)',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.art-main-canvas').getContext('2d').getImageData(0,0,1,1).data[3]===255);
  await page.getByLabel('Seed',{exact:true}).fill('1233');
  await page.getByText("Clothing & hats",{exact:true}).click();
  await page.getByLabel("Traveler clothing",{exact:true}).selectOption("vest");
  await page.getByLabel("Traveler hat",{exact:true}).selectOption("round");
  await page.getByLabel("Traveler colors",{exact:true}).selectOption("heather");
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem("grout-art-studio/1")).palette.cap==="#cbac61");
  const mobileWardrobe = await page.evaluate(()=>JSON.parse(localStorage.getItem("grout-art-studio/1")));
  assert.deepEqual(getTravelerWardrobe(mobileWardrobe),{clothing:"vest",hat:"round",palette:"heather",walk:"refined"});
  await page.screenshot({path:path.join(proof,`${receipt.mode}-wardrobe-mobile.png`),fullPage:true});
  receipt.checks.push('mobile layer/tool edit, undo and seed control');
  await page.goto(url);
  await page.locator('a[href$="/studio"]').waitFor();
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "Legacy mill overflow",
  );
  assert.deepEqual(errors, [], "Unexpected browser errors");
  const fallback = await browser.newContext();
  await fallback.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", { value: undefined });
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (kind === "webgl2") return null;
      return native.call(this, kind, ...args);
    };
  });
  const fpage = await fallback.newPage();
  await fpage.goto(url + "studio");
  await fpage.locator(".art-status-backend").filter({ hasText: "Preview: cpu" }).waitFor();
  await fallback.close();
  receipt.checks.push(
    "desktop/mobile, working example comparison, catalog, legacy mill navigation, unavailable GPU fallback",
  );
  }
  receipt.variations = await verifyArtVariations({page, url, proof, mode: receipt.mode, unzip, pngHash, bakeArt, scratch, faultUrls});
  assert.deepEqual(errors, [], "Unexpected browser errors after variation checks");
  receipt.status = "passed";
} catch (error) {
  receipt.status = "failed";
  receipt.error = error.stack;
  if (observedPage && !observedPage.isClosed()) {
    try {
      receipt.failureView = await observedPage.evaluate(() => ({url: location.href, text: document.body.innerText.slice(0,2500), wardrobeCount: document.querySelectorAll('.art-wardrobe').length}));
      const draft = await observedPage.evaluate(() => localStorage.getItem('grout-art-studio/1'));
      if (draft) await fs.writeFile(path.join(proof,`${receipt.mode}-failure-draft.json`),draft);
      await observedPage.screenshot({path:path.join(proof,`${receipt.mode}-failure.png`),fullPage:true});
    } catch { /* Preserve the original failure if the page itself was lost. */ }
  }
  process.exitCode = 1;
  console.error(error);
} finally {
  await browser?.close();
  if (server)
    await new Promise((resolve, reject) =>
      server.httpServer.close((e) => (e ? reject(e) : resolve())),
    );
  await fs.rm(scratch, { recursive: true, force: true });
  receipt.finished = new Date().toISOString();
  await fs.mkdir(proof, { recursive: true });
  await fs.writeFile(
    path.join(proof, `${receipt.mode}-receipt.json`),
    JSON.stringify(receipt, null, 2) + "\n",
  );
}
console.log(
  JSON.stringify({
    status: receipt.status,
    mode: receipt.mode,
    checks: receipt.checks,
    gpu: receipt.gpu,
  }),
);
