/**
 * Native 16 px blob-autotile assembly based on Grout-Library's Godot 3x3
 * minimal mask table and source-sheet layout.
 * Source reference: C:/DevStuff/Grout-Library/examples/autotile-maker.html
 * at commit 34016ee18a7e9b072495d728a0be1e02caf232a6. The tile topology and
 * quadrant assembly are independently expressed here; no donor pixels/assets
 * or runtime dependency are used.
 */
export const BLOB_BITS = Object.freeze({N: 1, NE: 2, E: 4, SE: 8, S: 16, SW: 32, W: 64, NW: 128});
export const GROUT_AUTOTILE_NOTICE = `MIT License

Copyright (c) 2026 Shoozes

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

export const BLOB_MASK_GRID = Object.freeze([
  Object.freeze([16, 20, 84, 80, 213, 92, 116, 87, 28, 125, 124, 112]),
  Object.freeze([17, 21, 85, 81, 29, 127, 253, 113, 31, 119, 0, 245]),
  Object.freeze([1, 5, 69, 65, 23, 223, 247, 209, 95, 255, 221, 241]),
  Object.freeze([0, 4, 68, 64, 117, 71, 197, 93, 7, 199, 215, 193]),
]);

const TILE = 16;
const HALF = 8;
const SHEET = 96;
const MASK_TO_POSITION = new Map();
for (let y = 0; y < BLOB_MASK_GRID.length; y++) {
  for (let x = 0; x < BLOB_MASK_GRID[y].length; x++) {
    const mask = BLOB_MASK_GRID[y][x];
    if (!MASK_TO_POSITION.has(mask)) MASK_TO_POSITION.set(mask, Object.freeze({x, y}));
  }
}

function validMask(mask) {
  if (!Number.isInteger(mask) || mask < 0 || mask > 255) throw new RangeError('Blob mask must be an integer from 0 through 255');
}

export function normalizeBlobMask(raw) {
  validMask(raw);
  let normalized = raw & (BLOB_BITS.N | BLOB_BITS.E | BLOB_BITS.S | BLOB_BITS.W);
  if ((raw & BLOB_BITS.NE) && (normalized & BLOB_BITS.N) && (normalized & BLOB_BITS.E)) normalized |= BLOB_BITS.NE;
  if ((raw & BLOB_BITS.SE) && (normalized & BLOB_BITS.S) && (normalized & BLOB_BITS.E)) normalized |= BLOB_BITS.SE;
  if ((raw & BLOB_BITS.SW) && (normalized & BLOB_BITS.S) && (normalized & BLOB_BITS.W)) normalized |= BLOB_BITS.SW;
  if ((raw & BLOB_BITS.NW) && (normalized & BLOB_BITS.N) && (normalized & BLOB_BITS.W)) normalized |= BLOB_BITS.NW;
  return normalized;
}

export function blobAtlasPosition(raw) {
  const mask = normalizeBlobMask(raw);
  const position = MASK_TO_POSITION.get(mask);
  if (!position) throw new RangeError(`No blob atlas tile for normalized mask ${mask}`);
  return position;
}

export function blobMaskAt(grid, x, y) {
  if (!Array.isArray(grid) || grid.length < 1 || !Array.isArray(grid[0]) || grid[0].length < 1 || grid.some(row => !Array.isArray(row) || row.length !== grid[0].length || row.some(value => value !== 0 && value !== 1))) {
    throw new TypeError('Expected a rectangular non-empty binary grid');
  }
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new TypeError('Grid coordinates must be integers');
  const at = (gx, gy) => gy >= 0 && gy < grid.length && gx >= 0 && gx < grid[0].length && grid[gy][gx] === 1;
  const n = at(x, y - 1), e = at(x + 1, y), s = at(x, y + 1), w = at(x - 1, y);
  let mask = (n ? BLOB_BITS.N : 0) | (e ? BLOB_BITS.E : 0) | (s ? BLOB_BITS.S : 0) | (w ? BLOB_BITS.W : 0);
  if (n && e && at(x + 1, y - 1)) mask |= BLOB_BITS.NE;
  if (s && e && at(x + 1, y + 1)) mask |= BLOB_BITS.SE;
  if (s && w && at(x - 1, y + 1)) mask |= BLOB_BITS.SW;
  if (w && n && at(x - 1, y - 1)) mask |= BLOB_BITS.NW;
  return normalizeBlobMask(mask);
}

function validateSheet(sheetRGBA) {
  if (!(sheetRGBA instanceof Uint8Array) || sheetRGBA.length !== SHEET * SHEET * 4) throw new TypeError('Expected 96×96 RGBA pixels in a Uint8Array');
  for (let i = 3; i < sheetRGBA.length; i += 4) {
    if (sheetRGBA[i] !== 0 && sheetRGBA[i] !== 255) throw new RangeError('Sheet alpha must use only 0 or 255');
  }
  for (let y = 16; y < 32; y++) for (let x = 16; x < 32; x++) {
    if (sheetRGBA[(y * SHEET + x) * 4 + 3] !== 255) throw new RangeError('Base center tile must be fully opaque');
  }
}

function readPixel(sheet, x, y) {
  const i = (y * SHEET + x) * 4;
  return [sheet[i], sheet[i + 1], sheet[i + 2], sheet[i + 3]];
}

function compositePixel(dest, di, pixel) {
  if (pixel[3] === 255) dest.set(pixel, di);
}

function overlayQuadrant(sheet, tile, qx, qy, sourceX, sourceY) {
  for (let py = 0; py < HALF; py++) for (let px = 0; px < HALF; px++) {
    const pixel = readPixel(sheet, sourceX + qx * HALF + px, sourceY + qy * HALF + py);
    const di = ((qy * HALF + py) * TILE + qx * HALF + px) * 4;
    compositePixel(tile, di, pixel);
  }
}

function overlayTemplateQuadrant(sheet, tile, qx, qy, cellX, cellY) {
  overlayQuadrant(sheet, tile, qx, qy, cellX * TILE, 48 + cellY * TILE);
}

function cornerAtlasQuadrant(sheet, tile, qx, qy, cornerX, cornerY, atlasY) {
  overlayQuadrant(sheet, tile, qx, qy, 48 + cornerX * TILE, atlasY + cornerY * TILE);
}

function makeTile(sheet, mask) {
  const data = new Uint8Array(TILE * TILE * 4);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    data.set(readPixel(sheet, (1 * TILE) + x, 1 * TILE + y), (y * TILE + x) * 4);
  }

  const quadrants = [
    {qx: 0, qy: 0, cardA: BLOB_BITS.N, cardB: BLOB_BITS.W, diagonal: BLOB_BITS.NW, cornerX: 0, cornerY: 0, outerX: 0, outerY: 0},
    {qx: 1, qy: 0, cardA: BLOB_BITS.N, cardB: BLOB_BITS.E, diagonal: BLOB_BITS.NE, cornerX: 1, cornerY: 0, outerX: 2, outerY: 0},
    {qx: 0, qy: 1, cardA: BLOB_BITS.S, cardB: BLOB_BITS.W, diagonal: BLOB_BITS.SW, cornerX: 0, cornerY: 1, outerX: 0, outerY: 2},
    {qx: 1, qy: 1, cardA: BLOB_BITS.S, cardB: BLOB_BITS.E, diagonal: BLOB_BITS.SE, cornerX: 1, cornerY: 1, outerX: 2, outerY: 2},
  ];
  for (const q of quadrants) {
    const a = Boolean(mask & q.cardA), b = Boolean(mask & q.cardB), diagonal = Boolean(mask & q.diagonal);
    if (a && b && diagonal) {
      overlayTemplateQuadrant(sheet, data, q.qx, q.qy, 1, 1);
    } else if (a && b) {
      cornerAtlasQuadrant(sheet, data, q.qx, q.qy, q.cornerX, q.cornerY, 0);
    } else if (!a && !b) {
      overlayTemplateQuadrant(sheet, data, q.qx, q.qy, q.outerX, q.outerY);
    } else if (!a) {
      const cellY = q.qy === 0 ? 0 : 2;
      overlayTemplateQuadrant(sheet, data, q.qx, q.qy, 1, cellY);
    } else if (!b) {
      const cellX = q.qx === 0 ? 0 : 2;
      overlayTemplateQuadrant(sheet, data, q.qx, q.qy, cellX, 1);
    }
  }

  const outer = new Map([[28, [0, 0]], [112, [1, 0]], [7, [0, 1]], [193, [1, 1]]]).get(mask);
  if (outer) {
    const [cx, cy] = outer;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const at = (y * TILE + x) * 4;
      data.set(readPixel(sheet, TILE + x, TILE + y), at);
      compositePixel(data, at, readPixel(sheet, 48 + cx * TILE + x, 32 + cy * TILE + y));
    }
  }
  return {blobMask: mask, width: TILE, height: TILE, data};
}

export function buildBlob47(sheetRGBA) {
  validateSheet(sheetRGBA);
  const mapping = [];
  for (let y = 0; y < BLOB_MASK_GRID.length; y++) for (let x = 0; x < BLOB_MASK_GRID[y].length; x++) {
    const mask = BLOB_MASK_GRID[y][x];
    const canonical = MASK_TO_POSITION.get(mask);
    mapping.push({mask, x, y, ...(canonical.x !== x || canonical.y !== y ? {alias: true} : {})});
  }
  const tiles = [...MASK_TO_POSITION.keys()].map(mask => makeTile(sheetRGBA, mask));
  const atlas = {width: 192, height: 64, data: new Uint8Array(192 * 64 * 4)};
  for (const entry of mapping) {
    const tile = tiles.find(item => item.blobMask === entry.mask);
    for (let y = 0; y < TILE; y++) {
      const src = tile.data.subarray(y * TILE * 4, (y + 1) * TILE * 4);
      const dst = ((entry.y * TILE + y) * atlas.width + entry.x * TILE) * 4;
      atlas.data.set(src, dst);
    }
  }
  return {tiles, atlas, mapping};
}
