/** Native-grid block materials for resource-pack style terrain tiles. */
export const VOXEL_SURFACE_FAMILIES = Object.freeze([
  'grass', 'dirt', 'stone', 'cobble', 'sand', 'planks', 'bark', 'brick',
]);
export const VOXEL_NATIVE_SIZE = 16;
export const VOXEL_SURFACE_SIZES = Object.freeze([16, 32, 64, 128, 256, 512]);
export const VOXEL_DEFAULTS = Object.freeze({
  id: 'voxel-surface', family: 'grass', seed: 1204, size: 16, palette: 'earth',
  strataScale: 4, fracture: .28, relief: .35, roughness: .9,
});
/** @typedef {'grass'|'dirt'|'stone'|'cobble'|'sand'|'planks'|'bark'|'brick'} VoxelFamily */
/** @typedef {{id:'voxel-surface',family:VoxelFamily,seed:number,size:number,palette:'earth'|'slate'|'ochre',strataScale:number,fracture:number,relief:number,roughness:number}} VoxelRecipe */
/** @typedef {{width:number,height:number,data:Uint8Array}} VoxelPixels */
/** @typedef {{index:number,geometry:number,rough:number,joint:number}} VoxelSample */

const PALETTE_SHIFT = Object.freeze({ earth: [0, 0, 0], slate: [-.09, .015, .09], ochre: [.075, .015, -.055] });
// Hand-authored short ramps: shadow, body, light, and a restrained accent.
const RAMPS = Object.freeze({
  grass: ['#3f5d2d', '#55743a', '#688a45', '#7d9b50', '#96ad65'],
  dirt: ['#493b31', '#69503a', '#8b6847', '#ad865d', '#c4a47b'],
  stone: ['#565956', '#686c68', '#7c8079', '#92978c', '#a7ac9f'],
  cobble: ['#4d514b', '#6b7067', '#878b7f', '#a0a493', '#b5b7a7'],
  sand: ['#b0a16d', '#c1b07b', '#d0bf89', '#dccd9a', '#e8dcac'],
  planks: ['#69502c', '#927039', '#af8b4c', '#c3a064', '#d3b77c'],
  bark: ['#43332d', '#62453a', '#805b47', '#a27857', '#bd9a70'],
  brick: ['#55443e', '#9d8e7b', '#a95e4b', '#bd7359', '#cb8c6a'],
});
/** @param {number} n @param {number} [lo] @param {number} [hi] */
const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
/** @param {number} n @param {number} p */
const wrap = (n, p) => (n % p + p) % p;
/** @param {number} x @param {number} y @param {number} seed @param {number} [salt] */
function hash(x, y, seed, salt = 0) {
  let h = Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77) ^ seed ^ Math.imul(salt + 1, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}
/** @param {number} x @param {number} y @param {number} seed @param {number} [salt] */
const unit = (x, y, seed, salt = 0) => hash(x, y, seed, salt) / 0x1_0000_0000;
/** @param {VoxelFamily} family @param {'earth'|'slate'|'ochre'} paletteName @returns {number[][]} */
function palette(family, paletteName) {
  const shift = PALETTE_SHIFT[paletteName];
  return RAMPS[family].map((hex) => {
    const rgb = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
    return rgb.map((v, i) => Math.round(clamp(v / 255 + shift[i]) * 255));
  });
}
/** @param {number} x @param {number} y @param {number} count @param {number} seed */
function cellAt(x, y, count, seed) {
  const u = (x + .5) / 16, v = (y + .5) / 16, gx = u * count, gy = v * count;
  const ix = Math.floor(gx), iy = Math.floor(gy);
  let best = Infinity, runner = Infinity, ownerX = 0, ownerY = 0, owner = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = ix + ox, cy = iy + oy, wx = wrap(cx, count), wy = wrap(cy, count);
    const jx = .18 + unit(wx, wy, seed, 1) * .64, jy = .18 + unit(wx, wy, seed, 2) * .64;
    const dx = gx - cx - jx, dy = gy - cy - jy, d = dx * dx + dy * dy;
    if (d < best) { runner = best; best = d; ownerX = wx; ownerY = wy; owner = unit(wx, wy, seed, 3); }
    else if (d < runner) runner = d;
  }
  return { edge: clamp((Math.sqrt(runner) - Math.sqrt(best)) / .27), owner, ownerX, ownerY, localX: gx - ix, localY: gy - iy };
}
/** @param {VoxelRecipe} recipe @param {number} x @param {number} y @returns {VoxelSample} */
function sampleNative(recipe, x, y) {
  const { family, seed, fracture } = recipe;
  const count = Math.round(recipe.strataScale) + 1, cell = cellAt(x, y, count, seed);
  // Authored stepped marks add subordinate clusters to broad material masses.
  // Every placement and motif wraps on the same native16 period.
  const marks = ['0010011101000000', '0000111001100000', '0100011000110000', '0000001101100100'];
  const period = recipe.strataScale < 3 ? 8 : recipe.strataScale < 6 ? 4 : 2;
  /** @param {number} salt */
  const mark = (salt) => {
    const px = wrap(x + hash(0, 0, seed, salt) % 16, 16), py = wrap(y + hash(1, 0, seed, salt) % 16, 16);
    const cx = Math.floor(px / period), cy = Math.floor(py / period);
    const motif = marks[hash(cx, cy, seed, salt) % marks.length];
    return motif[Math.floor((py % period) * 4 / period) * 4 + Math.floor((px % period) * 4 / period)] === '1';
  };
  const row = Math.floor(y * count / 16), rowKey = wrap(row, count);
  const col = Math.floor(x * count / 16), colKey = wrap(col, count);
  let index, joint = 0, geometry = .5, rough = .5;
  switch (family) {
    case 'grass': {
      index = mark(22) ? 3 : mark(24) ? 1 : 2;
      if (cell.owner > .8 && !mark(23)) index--;
      geometry = .48 + index * .025;
      rough = .52 + cell.owner * .1;
      break;
    }
    case 'dirt': {
      joint = (1 - cell.edge) * fracture;
      index = mark(26) ? 3 : mark(27) ? 0 : cell.owner > .6 ? 2 : 1;
      geometry = .46 + cell.owner * .12 - joint * .15;
      rough = .42 + cell.owner * .22;
      break;
    }
    case 'stone': {
      const seam = 1 - cell.edge;
      joint = seam * fracture * .72;
      index = mark(28) ? 3 : mark(29) ? 1 : 2;
      if (joint > .5) index = 0;
      geometry = .48 + cell.owner * .1 - joint * .12;
      rough = .48 + cell.owner * .22;
      break;
    }
    case 'cobble': {
      const seam = 1 - cell.edge;
      joint = seam * (.65 + fracture * .35);
      index = joint > .5 ? 0 : cell.owner > .5 ? 2 : 1;
      if (cell.edge > .6 && mark(30)) index++;
      geometry = .45 + cell.owner * .13 - joint * .1;
      rough = .52 + cell.owner * .2;
      break;
    }
    case 'sand': {
      const patch = unit(colKey, rowKey, seed, 31);
      index = mark(32) ? 3 : mark(33) ? 1 : 2;
      geometry = .49 + (patch - .5) * .025;
      rough = .72 + patch * .12;
      break;
    }
    case 'planks': {
      const rowHeight = [8, 8, 4, 4, 4, 2, 2, 2][Math.round(recipe.strataScale) - 1], plankWidth = rowHeight * 2;
      const plankRow = Math.floor(y / rowHeight), rowCount = 16 / rowHeight, rowKey = wrap(plankRow, rowCount);
      const localY = y % rowHeight, offset = rowKey % 2 ? plankWidth / 2 : 0;
      const shiftedX = x + offset, board = wrap(Math.floor(shiftedX / plankWidth), 16 / plankWidth), localX = shiftedX % plankWidth;
      const seam = localY === 0 || localX === 0;
      joint = seam ? fracture : 0;
      const knot = localY === rowHeight - 2 && localX > 1 && localX < 5 && unit(board, plankRow, seed, 41) > .5;
      index = seam && fracture > .18 ? 0 : knot ? 1 : mark(42) ? 3 : 2;
      geometry = .5 + (knot ? .035 : .01) - joint * .07;
      rough = .4 + unit(board, plankRow, seed, 43) * .18;
      break;
    }
    case 'bark': {
      const grooveWidth = [8, 8, 4, 4, 4, 2, 2, 2][Math.round(recipe.strataScale) - 1];
      const barkRow = wrap(Math.floor(y / 4), 4);
      const groove = wrap(x + Math.floor(unit(0, barkRow, seed, 51) * 3), grooveWidth);
      const crack = groove === 0 || (groove === 1 && unit(groove, barkRow, seed, 52) > .7);
      joint = crack ? fracture : 0;
      index = crack ? 0 : mark(53) ? 3 : mark(56) ? 1 : 2;
      geometry = crack ? .4 : .58 + unit(x, y, seed, 54) * .04;
      rough = .5 + unit(Math.floor(x / 2), barkRow, seed, 55) * .22;
      break;
    }
    case 'brick': {
      const brickHeight = [8, 8, 4, 4, 4, 2, 2, 2][Math.round(recipe.strataScale) - 1], brickWidth = brickHeight * 2;
      const brickRow = Math.floor(y / brickHeight), rowCount = 16 / brickHeight, rowKey = wrap(brickRow, rowCount);
      const localY = y % brickHeight, offset = rowKey % 2 ? brickWidth / 2 : 0;
      const shiftedX = x + offset, localX = shiftedX % brickWidth;
      const mortar = localY === 0 || localX === 0;
      joint = mortar ? .7 + fracture * .3 : 0;
      index = mortar ? 1 : mark(61) ? 3 : 2;
      geometry = mortar ? .43 : .58 + unit(Math.floor(x / 2), rowKey, seed, 62) * .05;
      rough = .46 + unit(Math.floor(x / 2), rowKey, seed, 63) * .18;
      break;
    }
    default: throw Error('Unknown voxel material family');
  }
  if (fracture > 0 && family !== 'cobble' && family !== 'brick' && family !== 'planks' && family !== 'bark' && unit(x, y, seed, 70) < fracture * .035) {
    index = Math.max(0, index - 1);
  }
  return { index, geometry, rough, joint };
}

/** @param {unknown} input @returns {VoxelRecipe} */
export function validateVoxelRecipe(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Expected a voxel material recipe object');
  const allowed = Object.keys(VOXEL_DEFAULTS);
  if (Object.keys(input).some((key) => !allowed.includes(key))) throw Error('Unknown voxel material setting');
  const recipe = /** @type {VoxelRecipe} */ ({ ...VOXEL_DEFAULTS, ...input });
  if (recipe.id !== 'voxel-surface' || !VOXEL_SURFACE_FAMILIES.includes(recipe.family) ||
      !Number.isInteger(recipe.seed) || recipe.seed < 0 || recipe.seed > 0xffff_ffff ||
      !VOXEL_SURFACE_SIZES.includes(recipe.size) || !Object.hasOwn(PALETTE_SHIFT, recipe.palette))
    throw Error('Invalid voxel material identity, family, seed, size or palette');
  for (const [key, min, max] of /** @type {[keyof Pick<VoxelRecipe,'strataScale'|'fracture'|'relief'|'roughness'>,number,number][]} */ ([['strataScale', 1, 8], ['fracture', 0, 1], ['relief', 0, 1], ['roughness', .05, 1]]))
    if (!Number.isFinite(recipe[key]) || recipe[key] < min || recipe[key] > max) throw Error('Invalid voxel material ' + key);
  return recipe;
}

/** @param {VoxelPixels} map @param {number} size @returns {VoxelPixels} */
function enlarge(map, size) {
  if (size === 16) return map;
  const scale = size / 16, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const from = (Math.floor(y / scale) * 16 + Math.floor(x / scale)) * 4;
    data.set(map.data.subarray(from, from + 4), (y * size + x) * 4);
  }
  return { width: size, height: size, data };
}

/** @param {unknown} input @returns {{recipe:VoxelRecipe,channels:Record<'albedo'|'height'|'normal'|'roughness',VoxelPixels>,heights:Float32Array,nativeSize:16}} */
export function generateVoxelMaterial(input = {}) {
  const recipe = validateVoxelRecipe(input), ramps = palette(recipe.family, recipe.palette);
  /** @type {Record<'albedo'|'height'|'normal'|'roughness',VoxelPixels>} */
  const native = /** @type {Record<'albedo'|'height'|'normal'|'roughness',VoxelPixels>} */ (Object.fromEntries(['albedo', 'height', 'normal', 'roughness'].map((key) => [key, { width: 16, height: 16, data: new Uint8Array(16 * 16 * 4) }])));
  const heights = new Float32Array(16 * 16), /** @type {VoxelSample[]} */ samples = new Array(16 * 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const at = y * 16 + x, sample = sampleNative(recipe, x, y);
    samples[at] = sample;
    heights[at] = clamp(.5 + (sample.geometry - .5) * recipe.relief);
    const rgb = ramps[sample.index] ?? ramps[ramps.length - 1];
    native.albedo.data.set([...rgb, 255], at * 4);
  }
  /** @param {number} x @param {number} y */
  const atHeight = (x, y) => heights[wrap(y, 16) * 16 + wrap(x, 16)];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const at = y * 16 + x, offset = at * 4, sample = samples[at];
    const dx = (atHeight(x + 1, y) - atHeight(x - 1, y)) * 16 * .08;
    const dy = (atHeight(x, y + 1) - atHeight(x, y - 1)) * 16 * .08;
    const length = Math.hypot(dx, dy, 1), h = Math.round(heights[at] * 255);
    native.height.data.set([h, h, h, 255], offset);
    native.normal.data.set([Math.round((-.5 * dx / length + .5) * 255), Math.round((-.5 * dy / length + .5) * 255), Math.round((.5 / length + .5) * 255), 255], offset);
    const rough = Math.round(clamp(recipe.roughness + sample.rough * .08 + sample.joint * .025 - .06) * 255);
    native.roughness.data.set([rough, rough, rough, 255], offset);
  }
  const channels = /** @type {Record<'albedo'|'height'|'normal'|'roughness',VoxelPixels>} */ (Object.fromEntries(Object.entries(native).map(([key, map]) => [key, enlarge(map, recipe.size)])));
  const scaledHeights = recipe.size === 16 ? heights : (() => {
    const scale = recipe.size / 16, out = new Float32Array(recipe.size * recipe.size);
    for (let y = 0; y < recipe.size; y++) for (let x = 0; x < recipe.size; x++) out[y * recipe.size + x] = heights[Math.floor(y / scale) * 16 + Math.floor(x / scale)];
    return out;
  })();
  return { recipe, channels, heights: scaledHeights, nativeSize: 16 };
}
