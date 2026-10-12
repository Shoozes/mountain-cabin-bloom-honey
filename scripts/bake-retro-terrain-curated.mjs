import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {setTimeout as pause} from 'node:timers/promises';
import {curatedArtSource, describeCuratedTerrain, generateCuratedTerrain, CURATED_VERSION, validateCuratedRecipe} from '../src/shader/retro-terrain-curated.mjs';
import {GROUT_AUTOTILE_NOTICE} from '../src/shader/retro-autotile.mjs';
import {encodeMaterialPng} from './material-png.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAX_RECIPE_BYTES = 64 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = [
  'src/shader/retro-terrain-art.mjs',
  'src/shader/retro-autotile.mjs',
  'src/shader/retro-terrain-curated.mjs',
  'src/shader/retro-terrain.mjs',
  'src/shader/retro-terrain-growth.mjs',
  'scripts/bake-retro-terrain-curated.mjs',
  'scripts/material-png.mjs',
];

async function readBounded(file, maxBytes, label) {
  let handle;
  try {
    handle = await fs.open(file, 'r');
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxBytes) throw Error(`${label} exceeds its byte limit`);
    const bytes = Buffer.alloc(stat.size + 1);
    const {bytesRead} = await handle.read(bytes, 0, bytes.length, 0);
    if (bytesRead !== stat.size) throw Error(`${label} changed while being read`);
    return bytes.subarray(0, bytesRead);
  } finally { await handle?.close(); }
}

async function readExpected(file, expected, label) {
  let handle;
  try {
    handle = await fs.open(file, 'r');
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size !== expected.length) throw Error(`${label} byte metadata differs`);
    const bytes = Buffer.alloc(expected.length + 1);
    const {bytesRead} = await handle.read(bytes, 0, bytes.length, 0);
    if (bytesRead !== expected.length) throw Error(`${label} changed while being read`);
    return bytes.subarray(0, bytesRead);
  } finally { await handle?.close(); }
}

function jsonBytes(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`); }

function makeAssets(kit) {
  const terrain = describeCuratedTerrain(kit);
  const images = [
    ...kit.tiles.map(image => ({...image, path: `${image.id}.png`})),
    ...kit.atlases.map(image => ({...image, path: `${image.id}.png`})),
    ...kit.templates.map(image => ({...image, path: `${image.id}.png`})),
    ...kit.previews.map(image => ({...image, path: `${image.id}.png`})),
  ];
  const seen = new Set();
  for (const image of images) {
    if (typeof image.path !== 'string' || !/^[a-z0-9][a-z0-9-]*\.png$/.test(image.path) || seen.has(image.path)) throw Error('Generated curated asset path is invalid or duplicated');
    seen.add(image.path);
    if (!Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 1 || image.height < 1 || !(image.data instanceof Uint8Array) || image.data.length !== image.width * image.height * 4) throw Error(`Invalid generated curated image: ${image.path}`);
  }
  const assets = images.map(({path: file, width, height, data: pixels}) => {
    const data = encodeMaterialPng({width, height, data: pixels});
    return {path: file, width, height, rgbaSha256: hash(pixels), bytes: data.length, sha256: hash(data), data};
  });
  const artSourceBytes = jsonBytes(curatedArtSource(kit));
  assets.push({path: 'art-source.json', bytes: artSourceBytes.length, sha256: hash(artSourceBytes), data: artSourceBytes});
  const licenseBytes = Buffer.from(`${GROUT_AUTOTILE_NOTICE}\n`);
  assets.push({path: 'LICENSE-Grout.txt', bytes: licenseBytes.length, sha256: hash(licenseBytes), data: licenseBytes});
  return {terrain, assets};
}

async function publishOwned(pending, final, signal) {
  const delays = [50, 150, 350];
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try { await fs.rename(pending, final); return attempt + 1; }
    catch (error) {
      if (!['EPERM', 'EACCES'].includes(error?.code) || attempt === delays.length) throw error;
      await pause(delays[attempt], undefined, {signal});
    }
  }
}

/** @param {{recipe?:unknown,output?:string,signal?:AbortSignal}} options */
export async function bakeRetroTerrainCurated({recipe: input = {}, output, signal} = {}) {
  if (typeof output !== 'string' || !output.trim()) throw Error('An explicit output directory is required');
  const recipe = validateCuratedRecipe(input);
  signal?.throwIfAborted();
  const sources = [];
  for (const relative of sourcePaths) sources.push({path: relative, sha256: hash(await fs.readFile(path.join(root, relative)))});
  const kit = generateCuratedTerrain(recipe), {terrain, assets} = makeAssets(kit);
  const recipeBytes = jsonBytes(recipe);
  const expectedFiles = [...assets.map(({path: file, width, height, rgbaSha256, bytes, sha256}) => ({path: file, ...(width === undefined ? {} : {width, height}), ...(rgbaSha256 === undefined ? {} : {rgbaSha256}), bytes, sha256})),
    {path: 'recipe.json', bytes: recipeBytes.length, sha256: hash(recipeBytes)}];
  const identity = hash(JSON.stringify({recipe, generator: CURATED_VERSION, sources}));
  const terrainBytes = jsonBytes({...terrain, identity, generator: CURATED_VERSION, sources, files: expectedFiles});
  const manifest = JSON.parse(terrainBytes.toString('utf8'));

  signal?.throwIfAborted();
  const destination = path.resolve(output);
  await fs.mkdir(destination, {recursive: true});
  const final = path.join(destination, `retro-terrain-curated-${identity.slice(0, 12)}`);
  const pending = path.join(destination, `.pending-${randomUUID()}`);
  let exists = true;
  try { await fs.stat(final); } catch (error) { if (error?.code === 'ENOENT') exists = false; else throw error; }
  if (exists) {
    let old;
    try { old = JSON.parse((await readBounded(path.join(final, 'terrain.json'), MAX_MANIFEST_BYTES, 'Cached curated terrain manifest')).toString('utf8')); }
    catch (error) { if (error instanceof Error && error.message.includes('byte limit')) throw error; throw Error('Existing curated terrain output is incomplete'); }
    signal?.throwIfAborted();
    let oldRecipe;
    try { oldRecipe = validateCuratedRecipe(old?.recipe); } catch { throw Error('Existing curated terrain output identity or metadata differs'); }
    if (!old || old.format !== terrain.format || old.identity !== identity || old.generator !== CURATED_VERSION ||
      JSON.stringify(oldRecipe) !== JSON.stringify(recipe) || JSON.stringify(old.sources) !== JSON.stringify(sources) ||
      old.visualReview !== 'unapproved' || JSON.stringify(old.provenance) !== JSON.stringify(terrain.provenance) ||
      JSON.stringify(old.tiles) !== JSON.stringify(terrain.tiles) || JSON.stringify(old.atlases) !== JSON.stringify(terrain.atlases) ||
      JSON.stringify(old.templates) !== JSON.stringify(terrain.templates) || JSON.stringify(old.previews) !== JSON.stringify(terrain.previews) ||
      JSON.stringify(old.files) !== JSON.stringify(expectedFiles)) throw Error('Existing curated terrain output identity or metadata differs');
    for (const descriptor of expectedFiles) {
      signal?.throwIfAborted();
      const expected = descriptor.path === 'recipe.json' ? recipeBytes : assets.find(asset => asset.path === descriptor.path)?.data;
      if (!expected) throw Error('Invalid cached curated terrain asset path');
      let bytes;
      try { bytes = await readExpected(path.join(final, descriptor.path), expected, `Cached ${descriptor.path}`); }
      catch (error) { if (error instanceof Error && error.message.includes('byte metadata differs')) throw error; throw Error('Existing curated terrain output is incomplete'); }
      if (!bytes.equals(expected) || descriptor.bytes !== bytes.length || descriptor.sha256 !== hash(bytes)) throw Error('Existing curated terrain output differs from deterministic generated bytes');
    }
    const cachedManifestBytes = await readExpected(path.join(final, 'terrain.json'), terrainBytes, 'Cached curated terrain manifest');
    if (!cachedManifestBytes.equals(terrainBytes)) throw Error('Existing curated terrain output differs from deterministic generated bytes');
    return {directory: final, manifest: old, reused: true};
  }

  await fs.mkdir(pending);
  try {
    for (const asset of assets) { signal?.throwIfAborted(); await fs.writeFile(path.join(pending, asset.path), asset.data); }
    await fs.writeFile(path.join(pending, 'recipe.json'), recipeBytes);
    await fs.writeFile(path.join(pending, 'terrain.json'), terrainBytes);
    signal?.throwIfAborted();
    const publicationAttempts = await publishOwned(pending, final, signal);
    return {directory: final, manifest, reused: false, publicationAttempts};
  } catch (error) {
    if (path.dirname(pending) !== destination || !path.basename(pending).startsWith('.pending-')) throw Error('Invalid temporary ownership');
    await fs.rm(pending, {recursive: true, force: true});
    throw error;
  }
}

export function parseRetroTerrainCuratedArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    if (!['--seed', '--out', '--recipe', '--tile-size', '--palette'].includes(flag) || value === undefined || options[flag] !== undefined) throw Error('Usage: --seed <uint32> --out <directory> [--recipe <json path>] [--tile-size 16|64] [--palette woodland|dry-trail|cool-moor]');
    options[flag] = value;
  }
  if (options['--seed'] === undefined || options['--out'] === undefined) throw Error('Usage: --seed <uint32> --out <directory> [--recipe <json path>] [--tile-size 16|64] [--palette woodland|dry-trail|cool-moor]');
  if (!/^(0|[1-9]\d*)$/.test(options['--seed']) || Number(options['--seed']) > 0xffffffff) throw Error('--seed must be an unsigned 32-bit integer');
  if (options['--tile-size'] !== undefined && !['16', '64'].includes(options['--tile-size'])) throw Error('--tile-size must be 16 or 64');
  if (options['--palette'] !== undefined && !['woodland', 'dry-trail', 'cool-moor'].includes(options['--palette'])) throw Error('--palette must be woodland, dry-trail or cool-moor');
  return options;
}

async function main() {
  const options = parseRetroTerrainCuratedArgs(process.argv.slice(2));
  let recipe = validateCuratedRecipe({id: 'retro-terrain-curated', tileSize: options['--tile-size'] === undefined ? 16 : Number(options['--tile-size']), seed: Number(options['--seed']), palette: options['--palette'] ?? 'woodland'});
  if (options['--recipe']) {
    const supplied = validateCuratedRecipe(JSON.parse((await readBounded(path.resolve(options['--recipe']), MAX_RECIPE_BYTES, 'Recipe file')).toString('utf8')));
    if (supplied.seed !== recipe.seed) throw Error('--seed conflicts with recipe seed');
    if (options['--tile-size'] !== undefined && supplied.tileSize !== recipe.tileSize) throw Error('--tile-size conflicts with recipe tile size');
    if (options['--palette'] !== undefined && supplied.palette !== recipe.palette) throw Error('--palette conflicts with recipe palette');
    recipe = supplied;
  }
  const controller = new AbortController(), cancel = () => controller.abort(Error('Curated retro terrain bake cancelled'));
  process.once('SIGINT', cancel);
  try {
    const result = await bakeRetroTerrainCurated({recipe, output: options['--out'], signal: controller.signal});
    console.log(JSON.stringify({directory: result.directory, identity: result.manifest.identity, files: result.manifest.files.length, reused: result.reused, publicationAttempts: result.publicationAttempts ?? 0}));
  } finally { process.removeListener('SIGINT', cancel); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
