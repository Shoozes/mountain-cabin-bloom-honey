/**
 * Tile wrap error in 0..1.
 *
 * `seamEdgeL1` is the previous metric: mean per-channel |left−right| and
 * |top−bottom|, divided by 255. Opposite edges are averaged together, so a
 * break on one axis or on only a few rows is diluted.
 *
 * `seamError` is at least that value. It also rises when either of these is
 * worse than the busiest interior sample (a continuous texture does not pick
 * up a new penalty just for being contrasty):
 *
 * - Thin band. First-order steps across the wrap and two pixels inward on
 *   each side, minus the strongest step farther inside that same row or
 *   column. The score uses the worst 3-long window along the edge, so a
 *   one-pixel speck is softened and a 3px break is not.
 * - Corners. Range of the 2×2 where the four tile corners meet, minus the
 *   range of the busiest interior 2×2.
 *
 * The reported number is the max of those three, clamped to 1. A hard step
 * that runs the full length of one axis now scores that step (channel delta
 * / 255) instead of half of it. `SEAM_MAX` stays 0.16 because the unit did
 * not change. When both axes match and the wrap is no worse than the
 * interior, the number matches `seamEdgeL1`.
 */

/** Wrap cut plus two pixels inward on each side. Also the window length. */
export const SEAM_BAND = 3;

export type SeamParts = {
  edge: number;
  band: number;
  corner: number;
  seam: number;
};

function chan(data: Uint8ClampedArray, w: number, x: number, y: number, c: number): number {
  return data[(y * w + x) * 4 + c] ?? 0;
}

function meanAbs(
  data: Uint8ClampedArray,
  w: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let sum = 0;
  for (let c = 0; c < 3; c++) {
    sum += Math.abs(chan(data, w, x0, y0, c) - chan(data, w, x1, y1, c));
  }
  return sum / 3;
}

/** Previous edge-only L1, in 0..1. Returns 1 when the buffer is not a tile. */
export function seamEdgeL1(data: Uint8ClampedArray, w: number, h: number): number {
  if (w < 2 || h < 2) return 1;
  let err = 0;
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      err += Math.abs(chan(data, w, 0, y, c) - chan(data, w, w - 1, y, c));
      count += 1;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      err += Math.abs(chan(data, w, x, 0, c) - chan(data, w, x, h - 1, c));
      count += 1;
    }
  }
  return err / count / 255;
}

function lineExcess(length: number, stepAt: (index: number) => number): number {
  if (length < SEAM_BAND * 2 + 1) return 0;
  let seam = 0;
  let interior = 0;
  for (let i = 0; i < length; i++) {
    const step = stepAt(i);
    const dist = Math.min(i + 1, length - 1 - i);
    if (dist < SEAM_BAND) seam = Math.max(seam, step);
    else interior = Math.max(interior, step);
  }
  return Math.max(0, seam - interior);
}

function worstWindow(values: number[], band: number): number {
  const n = values.length;
  if (n === 0) return 0;
  const width = Math.min(band, n);
  let sum = 0;
  for (let i = 0; i < width; i++) sum += values[i] ?? 0;
  let best = sum / width;
  for (let start = 1; start < n; start++) {
    sum += (values[(start + width - 1) % n] ?? 0) - (values[start - 1] ?? 0);
    const mean = sum / width;
    if (mean > best) best = mean;
  }
  return best;
}

function bandScore(data: Uint8ClampedArray, w: number, h: number): number {
  const horizontal: number[] = [];
  for (let y = 0; y < h; y++) {
    horizontal.push(lineExcess(w, (x) => meanAbs(data, w, x, y, (x + 1) % w, y)));
  }
  const vertical: number[] = [];
  for (let x = 0; x < w; x++) {
    vertical.push(lineExcess(h, (y) => meanAbs(data, w, x, y, x, (y + 1) % h)));
  }
  return Math.max(worstWindow(horizontal, SEAM_BAND), worstWindow(vertical, SEAM_BAND)) / 255;
}

function rgbRange(
  data: Uint8ClampedArray,
  w: number,
  pts: ReadonlyArray<readonly [number, number]>,
): number {
  let acc = 0;
  for (let c = 0; c < 3; c++) {
    let lo = 255;
    let hi = 0;
    for (const [x, y] of pts) {
      const v = chan(data, w, x, y, c);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    acc += hi - lo;
  }
  return acc / 3;
}

function cornerScore(data: Uint8ClampedArray, w: number, h: number): number {
  if (w < 2 || h < 2) return 0;
  let interior = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      interior = Math.max(
        interior,
        rgbRange(data, w, [
          [x, y],
          [x + 1, y],
          [x, y + 1],
          [x + 1, y + 1],
        ]),
      );
    }
  }
  const wrap = rgbRange(data, w, [
    [w - 1, h - 1],
    [0, h - 1],
    [w - 1, 0],
    [0, 0],
  ]);
  return Math.max(0, wrap - interior) / 255;
}

export function seamParts(data: Uint8ClampedArray, w: number, h: number): SeamParts {
  if (w < 2 || h < 2) return { edge: 1, band: 0, corner: 0, seam: 1 };
  const edge = seamEdgeL1(data, w, h);
  const band = bandScore(data, w, h);
  const corner = cornerScore(data, w, h);
  return { edge, band, corner, seam: Math.min(1, Math.max(edge, band, corner)) };
}

export function seamError(data: Uint8ClampedArray, w: number, h: number): number {
  return seamParts(data, w, h).seam;
}
