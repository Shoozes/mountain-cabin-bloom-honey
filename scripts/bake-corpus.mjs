#!/usr/bin/env node
/**
 * Bake the P0 public PNG corpus into public/textures/.
 *
 * Re-run: npm run bake:corpus
 *
 * Headless Chromium draws with ShaderMill.drawUtil the same way mill Save /
 * PNG catalog does (square exportSize canvas, repeat forced to 1, time 0,
 * snapshot, toBlob image/png). Not part of `npm run build` — Vercel has no
 * WebGL step. Commit the PNGs. Do not add a LICENSE here.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { build } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Locked P0 recipe. Pixel look uses the chunk grid; other looks are smooth. */
export const RECIPE = {
  exportSize: 256,
  palette: "style",
  seed: 1204,
  scale: 1,
  wear: 0.35,
  time: 0,
  repeat: 1,
  pixelLook: "pixel",
  pixelPixels: 32,
  smoothPixels: 0,
};

/** 36 keep ids, plan table order. Needs-ref ids are not in this list. */
export const KEEP_IDS = [
  "brick",
  "stone",
  "metal",
  "wood",
  "grass",
  "water",
  "sand",
  "sawn-oak",
  "toon-plank",
  "knot-comic",
  "crack-comic",
  "dark-panels",
  "buttered",
  "herringbone",
  "basket",
  "subway",
  "chevron",
  "diamond",
  "mosaic",
  "cobble",
  "hex-bond",
  "honeycomb",
  "gravel",
  "clay",
  "moss",
  "granite",
  "shingle",
  "pantile",
  "terrazzo",
  "slate",
  "brushed",
  "tread",
  "vent",
  "anodized",
  "bark",
  "cork",
];

/** Optional look strip: heroes only, non-pixel looks, pixels 0. */
export const LOOK_STRIP_IDS = ["brick", "stone", "subway", "mosaic"];
export const LOOK_STRIP_LOOKS = ["painted", "real", "poster"];

/** Held needs-ref heroes. Never bake these in P0. */
export const HELD_IDS = ["dirt", "concrete", "rust", "ice"];

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function corpusJobs() {
  for (const id of [...KEEP_IDS, ...LOOK_STRIP_IDS]) {
    if (HELD_IDS.includes(id)) throw new Error(`refusing to bake held id ${id}`);
  }
  const base = {
    exportSize: RECIPE.exportSize,
    palette: RECIPE.palette,
    seed: RECIPE.seed,
    scale: RECIPE.scale,
    wear: RECIPE.wear,
    time: RECIPE.time,
    repeat: RECIPE.repeat,
  };
  const jobs = [
    ...KEEP_IDS.map((id) => ({
      ...base,
      id,
      look: RECIPE.pixelLook,
      pixels: RECIPE.pixelPixels,
    })),
    ...LOOK_STRIP_IDS.flatMap((id) =>
      LOOK_STRIP_LOOKS.map((look) => ({
        ...base,
        id,
        look,
        pixels: RECIPE.smoothPixels,
      })),
    ),
  ];
  const paths = new Set();
  for (const job of jobs) {
    const key = `${job.look}/${job.id}`;
    if (paths.has(key)) throw new Error(`duplicate bake job ${key}`);
    paths.add(key);
  }
  return jobs;
}

export function readSourceTip() {
  const fromEnv = process.env.BAKE_SOURCE_TIP?.trim();
  if (fromEnv) return fromEnv;
  try {
    return execSync("git rev-parse origin/main", { encoding: "utf8", cwd: root }).trim();
  } catch {
    return execSync("git rev-parse HEAD", { encoding: "utf8", cwd: root }).trim();
  }
}

function pngSize(buf) {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_MAGIC)) return null;
  if (buf.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function manifestEntry(job, drawn) {
  const category = drawn.category;
  if (!category || !/^[A-Za-z]+$/.test(category)) {
    throw new Error(`bad category for ${job.id}: ${category || "(empty)"}`);
  }
  if (drawn.id !== job.id) throw new Error(`draw id mismatch for ${job.id}`);
  const path = `textures/${job.look}/${category.toLowerCase()}/${job.id}.png`;
  return {
    id: job.id,
    name: drawn.name,
    category,
    look: job.look,
    pixels: job.pixels,
    exportSize: job.exportSize,
    palette: job.palette,
    seed: job.seed,
    scale: job.scale,
    wear: job.wear,
    repeat: job.repeat,
    path,
  };
}

async function bundleDrawPage() {
  const dir = await mkdtemp(join(tmpdir(), "grout-bake-"));
  await build({
    configFile: false,
    root,
    publicDir: false,
    logLevel: "warn",
    resolve: {
      alias: { "@": join(root, "src") },
    },
    build: {
      outDir: dir,
      emptyOutDir: true,
      copyPublicDir: false,
      minify: false,
      sourcemap: false,
      lib: {
        entry: join(root, "scripts/bake-draw.ts"),
        name: "GroutBake",
        formats: ["iife"],
        fileName: () => "bake-draw.js",
      },
    },
  });
  await writeFile(
    join(dir, "index.html"),
    '<!doctype html><meta charset="utf-8"><script src="./bake-draw.js"></script>\n',
  );
  return dir;
}

async function launchBrowser() {
  const args = [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ];
  const attempts = [
    { channel: "chrome", headless: true, args },
    { headless: true, args },
  ];
  let last;
  for (const options of attempts) {
    try {
      return await chromium.launch(options);
    } catch (error) {
      last = error;
    }
  }
  throw last;
}

async function drawAll(jobs) {
  const dir = await bundleDrawPage();
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto(pathToFileURL(join(dir, "index.html")).href, { waitUntil: "load" });
    const ready = await page.evaluate(() => typeof window.__groutBake?.init === "function");
    if (!ready) {
      throw new Error(
        `bake page did not install __groutBake (${pageErrors.join("; ") || "no page error"})`,
      );
    }
    await page.evaluate(() => window.__groutBake.init());
    const drawn = [];
    for (const job of jobs) {
      const result = await page.evaluate((item) => window.__groutBake.drawOne(item), job);
      if (!result?.pngBase64) {
        throw new Error(`${job.look}/${job.id}: ${result?.error || "empty PNG"}`);
      }
      const entry = manifestEntry(job, result);
      const bytes = Buffer.from(result.pngBase64, "base64");
      const size = pngSize(bytes);
      if (!size || size.width !== job.exportSize || size.height !== job.exportSize) {
        throw new Error(
          `${entry.path}: expected ${job.exportSize} PNG, got ${size ? `${size.width}x${size.height}` : "invalid"}`,
        );
      }
      drawn.push({ entry, bytes });
      console.log(`${entry.path}  ${bytes.length} bytes`);
    }
    await page.evaluate(() => window.__groutBake.dispose());
    return drawn;
  } finally {
    await browser.close();
    await rm(dir, { recursive: true, force: true });
  }
}

function writeCorpus(drawn, sourceTip) {
  for (const item of drawn) {
    const dest = join(root, "public", item.entry.path);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, item.bytes);
  }
  const manifest = {
    format: "grout-corpus/1",
    sourceTip,
    files: drawn.map((item) => item.entry),
  };
  const manifestPath = join(root, "public/textures/manifest.json");
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export async function bakeCorpus() {
  const jobs = corpusJobs();
  if (jobs.length !== KEEP_IDS.length + LOOK_STRIP_IDS.length * LOOK_STRIP_LOOKS.length) {
    throw new Error(`expected 48 bake jobs, got ${jobs.length}`);
  }
  const sourceTip = readSourceTip();
  if (!/^[0-9a-f]{7,40}$/.test(sourceTip)) {
    throw new Error(`sourceTip is not a git SHA: ${sourceTip}`);
  }
  const drawn = await drawAll(jobs);
  const manifest = writeCorpus(drawn, sourceTip);
  console.log(`wrote ${manifest.files.length} PNGs + public/textures/manifest.json @ ${sourceTip}`);
  return manifest;
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(resolve(entry)).href === import.meta.url;
}

if (invokedDirectly()) {
  bakeCorpus().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
