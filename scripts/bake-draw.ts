/**
 * Browser half of `scripts/bake-corpus.mjs`.
 *
 * Mirrors PNG catalog export in `src/components/mill-app.tsx`:
 * `ShaderMill.drawUtil` on a square canvas, `repeat` forced to 1, `time` 0,
 * then `snapshot` + `toBlob("image/png")`.
 */
import { STYLES, lookValue, resolvePalette } from "@/shader/catalog";
import { hexToRgb, ShaderMill, type DrawParams } from "@/shader/engine";

export type BakeDrawJob = {
  id: string;
  look: string;
  pixels: number;
  exportSize: number;
  palette: string;
  seed: number;
  scale: number;
  wear: number;
  repeat: number;
  time: number;
};

export type BakeDrawResult = {
  id: string;
  name: string;
  category: string;
  pngBase64: string | null;
  error?: string;
};

declare global {
  interface Window {
    __groutBake: {
      init: () => void;
      drawOne: (job: BakeDrawJob) => Promise<BakeDrawResult>;
      dispose: () => void;
    };
  }
}

const byId = new Map(STYLES.map((style) => [style.id, style]));

let display: HTMLCanvasElement | null = null;
let util: HTMLCanvasElement | null = null;
let mill: ShaderMill | null = null;

function snapshot(source: HTMLCanvasElement) {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  const ctx = copy.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);
  return copy;
}

function canvasPngBase64(source: HTMLCanvasElement): Promise<string | null> {
  return new Promise((resolve) => {
    source.toBlob(async (blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      resolve(btoa(binary));
    }, "image/png");
  });
}

function init() {
  display = document.createElement("canvas");
  util = document.createElement("canvas");
  document.body.append(display, util);
  mill = new ShaderMill(display, util);
}

async function drawOne(job: BakeDrawJob): Promise<BakeDrawResult> {
  if (!mill || !util) {
    return {
      id: job.id,
      name: "",
      category: "",
      pngBase64: null,
      error: "bake canvas is not ready",
    };
  }
  const style = byId.get(job.id);
  if (!style) {
    return {
      id: job.id,
      name: "",
      category: "",
      pngBase64: null,
      error: `unknown style ${job.id}`,
    };
  }
  util.width = job.exportSize;
  util.height = job.exportSize;
  const colors = resolvePalette(style, job.palette).map(hexToRgb) as DrawParams["colors"];
  const params: DrawParams = {
    seed: job.seed,
    scale: job.scale,
    pixels: job.pixels,
    wear: job.wear,
    repeat: 1,
    time: 0,
    look: lookValue(job.look),
    colors,
  };
  const ok = mill.drawUtil(util, style, params);
  if (!ok) {
    return {
      id: job.id,
      name: style.name,
      category: style.category,
      pngBase64: null,
      error: mill.error(style.id) ?? "drawUtil failed",
    };
  }
  const shot = snapshot(util);
  const pngBase64 = shot ? await canvasPngBase64(shot) : null;
  if (!pngBase64) {
    return {
      id: job.id,
      name: style.name,
      category: style.category,
      pngBase64: null,
      error: "could not encode PNG",
    };
  }
  return { id: job.id, name: style.name, category: style.category, pngBase64 };
}

function dispose() {
  mill?.dispose();
  for (const canvas of [display, util]) {
    canvas?.getContext("webgl")?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  mill = null;
  display = null;
  util = null;
}

window.__groutBake = { init, drawOne, dispose };
