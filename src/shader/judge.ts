export type Sample = {
  mean: [number, number, number];
  std: number;
  hue: number[];
  energy: number;
  aniso: number;
};

export type RefDef = {
  id: string;
  label: string;
  file: string;
  styles: string[];
};

export const JUDGE_REFS: RefDef[] = [
  {
    id: "brick",
    label: "Brick",
    file: "/judge/brick.jpg",
    styles: ["brick", "herringbone", "basket", "chevron", "diamond", "hex-bond", "honeycomb", "pantile", "shingle"],
  },
  {
    id: "stone",
    label: "Stone",
    file: "/judge/stone.jpg",
    styles: ["stone", "cobble", "gravel", "terrazzo"],
  },
  {
    id: "metal",
    label: "Metal",
    file: "/judge/metal.jpg",
    styles: ["metal", "brushed", "tread", "vent", "anodized"],
  },
  {
    id: "plank",
    label: "Plank",
    file: "/judge/plank.jpg",
    styles: ["wood", "bark", "cork"],
  },
  {
    id: "oak",
    label: "Oak",
    file: "/judge/oak.jpg",
    styles: ["sawn-oak"],
  },
  {
    id: "panels",
    label: "Dark panels",
    file: "/judge/panels.jpg",
    styles: ["dark-panels"],
  },
  {
    id: "toon",
    label: "Toon wood",
    file: "/judge/toon.jpg",
    styles: ["toon-plank", "knot-comic", "crack-comic"],
  },
  {
    id: "grass",
    label: "Grass",
    file: "/judge/grass.jpg",
    styles: ["grass", "moss"],
  },
  {
    id: "sand",
    label: "Sand",
    file: "/judge/sand.jpg",
    styles: ["sand", "clay"],
  },
  {
    id: "water",
    label: "Water",
    file: "/judge/water.jpg",
    styles: ["water"],
  },
  {
    id: "granite",
    label: "Granite",
    file: "/judge/granite.jpg",
    styles: ["granite"],
  },
  {
    id: "slate",
    label: "Slate",
    file: "/judge/slate.jpg",
    styles: ["slate"],
  },
];

const REF_BY_STYLE = new Map<string, RefDef>();
for (const ref of JUDGE_REFS) {
  for (const id of ref.styles) REF_BY_STYLE.set(id, ref);
}

export function refForStyle(id: string): RefDef | undefined {
  return REF_BY_STYLE.get(id);
}

function lum(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function readFeatures(data: Uint8ClampedArray, w: number, h: number): Sample {
  const n = w * h;
  let mr = 0;
  let mg = 0;
  let mb = 0;
  const hue = [0, 0, 0, 0, 0, 0];
  let hueN = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 4] ?? 0;
    const g = data[i * 4 + 1] ?? 0;
    const b = data[i * 4 + 2] ?? 0;
    mr += r;
    mg += g;
    mb += b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d < 8 || max < 12) continue;
    let h = 0;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    if (h < 0) h += 6;
    const bin = Math.min(5, Math.floor(h));
    hue[bin] = (hue[bin] ?? 0) + 1;
    hueN += 1;
  }
  mr /= n;
  mg /= n;
  mb /= n;
  if (hueN > 0) {
    for (let i = 0; i < 6; i++) hue[i] = (hue[i] ?? 0) / hueN;
  }
  let varSum = 0;
  let gx = 0;
  let gy = 0;
  const at = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return lum(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = at(x, y);
      varSum += (l - lum(mr, mg, mb)) ** 2;
      if (x + 1 < w) gx += Math.abs(at(x + 1, y) - l);
      if (y + 1 < h) gy += Math.abs(at(x, y + 1) - l);
    }
  }
  const edges = gx + gy;
  return {
    mean: [mr, mg, mb],
    std: Math.sqrt(varSum / n),
    hue,
    energy: edges / n,
    aniso: edges > 1 ? gx / edges : 0.5,
  };
}

export function seamError(data: Uint8ClampedArray, w: number, h: number): number {
  let err = 0;
  let count = 0;
  const pix = (x: number, y: number, c: number) => data[(y * w + x) * 4 + c] ?? 0;
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      err += Math.abs(pix(0, y, c) - pix(w - 1, y, c));
      count += 1;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      err += Math.abs(pix(x, 0, c) - pix(x, h - 1, c));
      count += 1;
    }
  }
  return err / count / 255;
}

export function matchScore(a: Sample, b: Sample): number {
  const color =
    1 -
    Math.min(
      1,
      Math.hypot(a.mean[0] - b.mean[0], a.mean[1] - b.mean[1], a.mean[2] - b.mean[2]) / 180,
    );
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < 6; i++) {
    const av = a.hue[i] ?? 0;
    const bv = b.hue[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const hue = na < 1e-6 || nb < 1e-6 ? 0.5 : dot / (Math.sqrt(na) * Math.sqrt(nb));
  const detail = 1 - Math.min(1, Math.abs(a.std - b.std) / 50);
  const energy = 1 - Math.min(1, Math.abs(a.energy - b.energy) / 30);
  const aniso = 1 - Math.abs(a.aniso - b.aniso);
  return 0.42 * color + 0.28 * hue + 0.12 * detail + 0.08 * energy + 0.1 * aniso;
}

export const SEAM_MAX = 0.16;
export const MATCH_MIN = 0.58;

export function verdict(seam: number, match: number | null, flat: boolean, compiled: boolean): { pass: boolean; reason: string } {
  if (!compiled) return { pass: false, reason: "shader failed" };
  if (match === null) return { pass: false, reason: "no reference" };
  if (flat) return { pass: false, reason: "too flat" };
  if (seam > SEAM_MAX) return { pass: false, reason: "seam" };
  if (match < MATCH_MIN) return { pass: false, reason: "unlike reference" };
  return { pass: true, reason: "matches" };
}
