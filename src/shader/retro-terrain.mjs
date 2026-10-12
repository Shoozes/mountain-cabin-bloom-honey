// Original native-grid drawings. This module never reads reference images.
export const RETRO_VERSION = 'retro-terrain/1';
export const RETRO_SIZE = 64;
export const RETRO_PALETTES = Object.freeze({
  grass: ['#162d24','#1c3b29','#244c2e','#2f5a33','#3d6939','#507a43','#678d50','#85a665'],
  dirt: ['#2a211c','#36281e','#413024','#4b3728','#553f2d','#604733','#6b513a','#775c43','#83684d','#907658','#a08665','#b09979'],
  gravel: ['#262724','#34362f','#414337','#4e5144','#5b5e50','#696b5a','#797b68','#8b8c75','#9b9b83','#aba98f','#bab69b','#ccc5aa'],
});
const wrap = (n, period) => (n % period + period) % period;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function hash(x, y, seed) {
  let h = Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77) ^ seed;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, y, cells, seed) {
  const u = x / RETRO_SIZE * cells, v = y / RETRO_SIZE * cells;
  const ix = Math.floor(u), iy = Math.floor(v);
  const smooth = t => t * t * (3 - 2 * t);
  const a = smooth(u - ix), b = smooth(v - iy);
  const sample = (i, j) => hash(wrap(i, cells), wrap(j, cells), seed);
  const top = sample(ix, iy) * (1 - a) + sample(ix + 1, iy) * a;
  const bottom = sample(ix, iy + 1) * (1 - a) + sample(ix + 1, iy + 1) * a;
  return top * (1 - b) + bottom * b;
}
export function validateRetroRecipe(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Expected a retro terrain recipe');
  if (Object.keys(input).some(key => !['id', 'seed'].includes(key))) throw Error('Unknown retro terrain setting');
  const recipe = {id: 'retro-terrain', seed: 1204, ...input};
  if (recipe.id !== 'retro-terrain' || !Number.isInteger(recipe.seed) || recipe.seed < 0 || recipe.seed > 0xffffffff)
    throw Error('Retro terrain seed must be an unsigned 32-bit integer');
  return recipe;
}
function surface(family, seed) {
  const indices = new Uint8Array(RETRO_SIZE * RETRO_SIZE);
  const mark = (x, y, color) => { indices[wrap(y, RETRO_SIZE) * RETRO_SIZE + wrap(x, RETRO_SIZE)] = color; };
  for (let y = 0; y < RETRO_SIZE; y++) for (let x = 0; x < RETRO_SIZE; x++) {
    const broad = noise(x, y, 8, seed + 11), grain = noise(x, y, 32, seed + 41);
    if (family === 'dirt') {
      const fleck = hash(x, y, seed + 71);
      mark(x, y, clamp(Math.round(4 + broad * 3 + (grain - .5) * 3 + (fleck < .12 ? -2 : fleck > .92 ? 1 : 0)), 1, 10));
    } else if (family === 'grass') mark(x, y, broad < .38 ? 2 : broad > .68 ? 4 : 3);
    else mark(x, y, hash(x, y, seed + 17) < .3 ? 0 : 1);
  }
  if (family === 'grass') {
    // Connected forked strokes, with varied gaps rather than a repeating stamp grid.
    for (let i = 0; i < 270; i++) {
      const x = Math.floor(hash(i, 0, seed + 101) * RETRO_SIZE), y = Math.floor(hash(i, 1, seed + 101) * RETRO_SIZE);
      const length = 2 + Math.floor(hash(i, 2, seed + 101) * 3);
      const tone = 4 + Math.floor(hash(i, 3, seed + 101) * 3), direction = hash(i, 4, seed + 101) < .22 ? -1 : 1;
      for (let step = 0; step < length; step++) {
        mark(x + direction * Math.floor(step / 2), y - step, step === length - 1 ? Math.min(7, tone + 1) : tone);
        if (step < length - 1) mark(x + direction * Math.floor(step / 2) - direction, y - step, Math.max(1, tone - 2));
      }
      mark(x + direction, y - 1, Math.max(3, tone - 1));
    }
  }
  if (family === 'gravel') {
    // Packed, irregular stone cells; toroidal distance continues each shape across the tile.
    const sites = Array.from({length: 100}, (_, i) => ({
      x: (i % 10 + .12 + hash(i, 0, seed + 211) * .76) * RETRO_SIZE / 10,
      y: (Math.floor(i / 10) + .12 + hash(i, 1, seed + 211) * .76) * RETRO_SIZE / 10,
      body: 4 + Math.floor(hash(i, 2, seed + 211) * 5),
    }));
    for (let y = 0; y < RETRO_SIZE; y++) for (let x = 0; x < RETRO_SIZE; x++) {
      let first = Infinity, second = Infinity, owner, dx = 0, dy = 0;
      for (const site of sites) {
        const sx = wrap(x - site.x + RETRO_SIZE / 2, RETRO_SIZE) - RETRO_SIZE / 2;
        const sy = wrap(y - site.y + RETRO_SIZE / 2, RETRO_SIZE) - RETRO_SIZE / 2;
        const distance = sx * sx + sy * sy;
        if (distance < first) { second = first; first = distance; owner = site; dx = sx; dy = sy; }
        else if (distance < second) second = distance;
      }
      const edge = Math.sqrt(second) - Math.sqrt(first);
      const plane = dx + dy < -1.2 ? 1 : dx + dy > 1.8 ? -1 : 0;
      const grain = hash(x, y, seed + 227) > .87 ? 1 : 0;
      mark(x, y, edge < .33 ? 1 : clamp(owner.body + plane + grain - (edge < .72 ? 1 : 0), 2, 10));
    }
  }
  const colors = RETRO_PALETTES[family].map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  const data = new Uint8Array(RETRO_SIZE * RETRO_SIZE * 4);
  for (let i = 0; i < indices.length; i++) data.set([...colors[indices[i]], 255], i * 4);
  return {width: RETRO_SIZE, height: RETRO_SIZE, data};
}
export function retroTransitionMask(mask, seed = 1204) {
  if (!Number.isInteger(mask) || mask < 0 || mask > 15) throw Error('Invalid grass/dirt corner mask');
  validateRetroRecipe({seed});
  const result = new Uint8Array(RETRO_SIZE * RETRO_SIZE);
  const corners = [1, 2, 4, 8].map(bit => mask & bit ? 1 : 0);
  for (let y = 0; y < RETRO_SIZE; y++) for (let x = 0; x < RETRO_SIZE; x++) {
    const u = x / (RETRO_SIZE - 1), v = y / (RETRO_SIZE - 1);
    const envelope = 16 * u * (1 - u) * v * (1 - v);
    let coverage = corners[0] * (1 - u) * (1 - v) + corners[1] * u * (1 - v) + corners[2] * u * v + corners[3] * (1 - u) * v;
    // Interior-only irregularity leaves each boundary determined solely by its corner pair.
    coverage += (noise(x, y, 8, seed + 307) - .5) * .3 * envelope;
    if (mask === 5 || mask === 10) coverage -= .22 * envelope;
    result[y * RETRO_SIZE + x] = mask === 15 || (mask !== 0 && coverage > .5) ? 1 : 0;
  }
  return result;
}
export function generateRetroTerrain(input = {}) {
  const recipe = validateRetroRecipe(input);
  const tiles = ['dirt', 'grass', 'gravel'].map(family => ({id: family, role: 'surface', family, ...surface(family, recipe.seed)}));
  const atlas = {width: RETRO_SIZE * 4, height: RETRO_SIZE * 4, data: new Uint8Array(RETRO_SIZE * RETRO_SIZE * 16 * 4)};
  for (let cornerMask = 0; cornerMask < 16; cornerMask++) {
    const terrainMask = retroTransitionMask(cornerMask, recipe.seed), data = new Uint8Array(RETRO_SIZE * RETRO_SIZE * 4);
    for (let i = 0; i < terrainMask.length; i++) data.set(tiles[terrainMask[i]].data.subarray(i * 4, i * 4 + 4), i * 4);
    const tile = {id: 'grass-dirt-' + cornerMask, role: 'transition', family: 'grass-dirt', cornerMask, terrainMask, width: RETRO_SIZE, height: RETRO_SIZE, data};
    tiles.push(tile);
    const ax = cornerMask % 4 * RETRO_SIZE, ay = Math.floor(cornerMask / 4) * RETRO_SIZE;
    for (let y = 0; y < RETRO_SIZE; y++) atlas.data.set(data.subarray(y * RETRO_SIZE * 4, (y + 1) * RETRO_SIZE * 4), ((ay + y) * atlas.width + ax) * 4);
  }
  return {recipe, tiles, atlas};
}
export function describeRetroTerrain(kit) {
  return {
    format: 'retro-terrain-pack/1', generator: RETRO_VERSION, recipe: kit.recipe, tileSize: RETRO_SIZE,
    visualReview: 'unapproved', provenance: {author: 'original procedural work for our projects', restrictedInputs: [], training: false},
    appearance: 'Authored retro color with small plane highlights; not unlit PBR albedo',
    sampling: {filter: 'nearest', colorSpace: 'srgb'}, palettes: RETRO_PALETTES,
    cornerBits: {NW: 1, NE: 2, SE: 4, SW: 8}, diagonalPolicy: 'disconnected grass corners',
    tiles: kit.tiles.map(({id, role, family, cornerMask, width, height}) => ({id, role, family, ...(cornerMask === undefined ? {wrap: 'repeat'} : {cornerMask, wrap: 'matching-corners'}), path: id + '.png', width, height,
      ...(cornerMask === undefined ? {} : {atlas: {x: cornerMask % 4 * RETRO_SIZE, y: Math.floor(cornerMask / 4) * RETRO_SIZE}})})),
    atlas: {path: 'grass-dirt-atlas.png', width: kit.atlas.width, height: kit.atlas.height, columns: 4, rows: 4},
  };
}
export function composeRetroTerrain(kit, corners) {
  if (!Array.isArray(corners) || corners.length < 2 || corners.length > 17 || !Array.isArray(corners[0]) || corners[0].length < 2 || corners[0].length > 17 || corners.some(row => !Array.isArray(row) || row.length !== corners[0].length || row.some(value => value !== 0 && value !== 1))) throw Error('Expected a rectangular 0/1 corner grid, 2–17 corners per side');
  const width = (corners[0].length - 1) * RETRO_SIZE, height = (corners.length - 1) * RETRO_SIZE, data = new Uint8Array(width * height * 4);
  for (let y = 0; y < corners.length - 1; y++) for (let x = 0; x < corners[0].length - 1; x++) {
    const mask = corners[y][x] + corners[y][x + 1] * 2 + corners[y + 1][x + 1] * 4 + corners[y + 1][x] * 8;
    const tile = kit.tiles[3 + mask];
    for (let row = 0; row < RETRO_SIZE; row++) data.set(tile.data.subarray(row * RETRO_SIZE * 4, (row + 1) * RETRO_SIZE * 4), ((y * RETRO_SIZE + row) * width + x * RETRO_SIZE) * 4);
  }
  return {width, height, data};
}
