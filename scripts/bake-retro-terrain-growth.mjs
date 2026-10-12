import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {setTimeout as pause} from 'node:timers/promises';
import {describeRetroGrowth, generateRetroGrowth, RETRO_GROWTH_VERSION, validateRetroGrowthRecipe} from '../src/shader/retro-terrain-growth.mjs';
import {encodeMaterialPng} from './material-png.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_RECIPE_BYTES = 64 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

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

function makeAssets(kit) {
  const terrain = describeRetroGrowth(kit);
  const tileAssets = kit.tiles.map(tile => ({path: `${tile.id}.png`, width: tile.width, height: tile.height, pixels: tile.data}));
  const atlasAssets = kit.atlases.map(atlas => ({path: `${atlas.id}.png`, width: atlas.width, height: atlas.height, pixels: atlas.data}));
  const assets = [...tileAssets, ...atlasAssets].map(({path: file, width, height, pixels}) => {
    const data = encodeMaterialPng({width, height, data: pixels});
    return {path: file, width, height, rgbaSha256: hash(pixels), bytes: data.length, sha256: hash(data), data};
  });
  return {terrain, assets};
}

async function publishOwned(pending,final,signal) {
  // Windows scanners can briefly hold a just-written directory. Keep publication atomic.
  const delays=[50,150,350];
  for(let attempt=0;;attempt++) {
    signal?.throwIfAborted();
    try {await fs.rename(pending,final);return attempt+1;}
    catch(error) {
      if(!['EPERM','EACCES'].includes(error?.code)||attempt===delays.length)throw error;
      await pause(delays[attempt],undefined,{signal});
    }
  }
}

/** @param {{recipe?:unknown,output?:string,signal?:AbortSignal}} options */
export async function bakeRetroTerrainGrowth({recipe: input = {}, output, signal} = {}) {
  if (typeof output !== 'string' || !output.trim()) throw Error('An explicit output directory is required');
  const recipe = validateRetroGrowthRecipe(input);
  signal?.throwIfAborted();
  const destination = path.resolve(output);
  await fs.mkdir(destination, {recursive: true});
  const sources = [];
  for (const relative of ['src/shader/retro-terrain.mjs', 'src/shader/retro-terrain-growth.mjs', 'scripts/bake-retro-terrain-growth.mjs', 'scripts/material-png.mjs']) {
    sources.push({path: relative, sha256: hash(await fs.readFile(path.join(root, relative)))});
  }
  const identity = hash(JSON.stringify({recipe, generator: RETRO_GROWTH_VERSION, sources}));
  const final = path.join(destination, `retro-terrain-growth-${identity.slice(0, 12)}`);
  const pending = path.join(destination, `.pending-${randomUUID()}`);
  signal?.throwIfAborted();
  const kit = generateRetroGrowth(recipe), {terrain, assets} = makeAssets(kit);
  const recipeBytes = Buffer.from(`${JSON.stringify(recipe, null, 2)}\n`);
  const expectedFiles = [...assets.map(({path: file, width, height, rgbaSha256, bytes, sha256}) => ({path: file, width, height, rgbaSha256, bytes, sha256})),
    {path: 'recipe.json', bytes: recipeBytes.length, sha256: hash(recipeBytes)}];
  const terrainBytes = Buffer.from(`${JSON.stringify({...terrain, identity, generator: RETRO_GROWTH_VERSION, sources,
    files: expectedFiles}, null, 2)}\n`);
  const manifest = JSON.parse(terrainBytes.toString('utf8'));

  let exists = true;
  try { await fs.stat(final); } catch (error) { if (error?.code === 'ENOENT') exists = false; else throw error; }
  if (exists) {
    let old;
    try { old = JSON.parse((await readBounded(path.join(final, 'terrain.json'), MAX_MANIFEST_BYTES, 'Cached terrain manifest')).toString('utf8')); }
    catch (error) { if (error instanceof Error && error.message.includes('byte limit')) throw error; throw Error('Existing terrain output is incomplete'); }
    signal?.throwIfAborted();
    let oldRecipe;
    try { oldRecipe = validateRetroGrowthRecipe(old?.recipe); } catch { throw Error('Existing terrain output identity or metadata differs'); }
    if (!old || old.format !== terrain.format || old.identity !== identity || old.generator !== RETRO_GROWTH_VERSION ||
      JSON.stringify(oldRecipe) !== JSON.stringify(recipe) || JSON.stringify(old.sources) !== JSON.stringify(sources) ||
      old.visualReview !== 'unapproved' || JSON.stringify(old.provenance) !== JSON.stringify(terrain.provenance) ||
      JSON.stringify(old.tiles) !== JSON.stringify(terrain.tiles) || JSON.stringify(old.atlas) !== JSON.stringify(terrain.atlas) ||
      JSON.stringify(old.atlases) !== JSON.stringify(terrain.atlases) || JSON.stringify(old.pathBits) !== JSON.stringify(terrain.pathBits) ||
      JSON.stringify(old.files) !== JSON.stringify(expectedFiles))
      throw Error('Existing terrain output identity or metadata differs');
    for (const descriptor of expectedFiles) {
      signal?.throwIfAborted();
      const expected = descriptor.path === 'recipe.json' ? recipeBytes : assets.find(asset => asset.path === descriptor.path)?.data;
      if (!expected) throw Error('Invalid cached terrain asset path');
      let bytes;
      try { bytes = await readExpected(path.join(final, descriptor.path), expected, `Cached ${descriptor.path}`); }
      catch (error) { if (error instanceof Error && error.message.includes('byte metadata differs')) throw error; throw Error('Existing terrain output is incomplete'); }
      if (!bytes.equals(expected) || descriptor.bytes !== bytes.length || descriptor.sha256 !== hash(bytes)) throw Error('Existing terrain output differs from deterministic generated bytes');
    }
    const cachedManifestBytes = await readExpected(path.join(final, 'terrain.json'), terrainBytes, 'Cached terrain manifest');
    if (!cachedManifestBytes.equals(terrainBytes)) throw Error('Existing terrain output differs from deterministic generated bytes');
    return {directory: final, manifest: old, reused: true};
  }

  await fs.mkdir(pending);
  try {
    for (const asset of assets) { signal?.throwIfAborted(); await fs.writeFile(path.join(pending, asset.path), asset.data); }
    await fs.writeFile(path.join(pending, 'recipe.json'), recipeBytes);
    await fs.writeFile(path.join(pending, 'terrain.json'), terrainBytes);
    signal?.throwIfAborted();
    const publicationAttempts=await publishOwned(pending,final,signal);
    return {directory: final, manifest, reused: false,publicationAttempts};
  } catch (error) {
    if (path.dirname(pending) !== destination || !path.basename(pending).startsWith('.pending-')) throw Error('Invalid temporary ownership');
    await fs.rm(pending, {recursive: true, force: true});
    throw error;
  }
}

export function parseRetroTerrainGrowthArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    if (!['--seed', '--out', '--recipe', '--palette'].includes(flag) || value === undefined || options[flag] !== undefined) throw Error('Usage: --seed <uint32> --out <directory> [--recipe <json path>] [--palette original|heath|riverbed]');
    options[flag] = value;
  }
  if (options['--seed'] === undefined || options['--out'] === undefined) throw Error('Usage: --seed <uint32> --out <directory> [--recipe <json path>] [--palette original|heath|riverbed]');
  if (!/^(0|[1-9]\d*)$/.test(options['--seed']) || Number(options['--seed']) > 0xffffffff) throw Error('--seed must be an unsigned 32-bit integer');
  if (options['--palette'] !== undefined && !['original', 'heath', 'riverbed'].includes(options['--palette'])) throw Error('--palette must be original, heath or riverbed');
  return options;
}

async function main() {
  const options = parseRetroTerrainGrowthArgs(process.argv.slice(2));
  let recipe = {id: 'retro-terrain-growth', seed: Number(options['--seed']), palette: options['--palette'] ?? 'original'};
  if (options['--recipe']) {
    const supplied = JSON.parse((await readBounded(path.resolve(options['--recipe']), MAX_RECIPE_BYTES, 'Recipe file')).toString('utf8'));
    const validated = validateRetroGrowthRecipe(supplied);
    if (validated.seed !== recipe.seed) throw Error('--seed conflicts with recipe seed');
    if (options['--palette'] !== undefined && validated.palette !== options['--palette']) throw Error('--palette conflicts with recipe palette');
    recipe = validated;
  }
  const controller = new AbortController(), cancel = () => controller.abort(Error('Retro terrain growth bake cancelled'));
  process.once('SIGINT', cancel);
  try {
    const result = await bakeRetroTerrainGrowth({recipe, output: options['--out'], signal: controller.signal});
    console.log(JSON.stringify({directory: result.directory, identity: result.manifest.identity, files: result.manifest.files.length, reused: result.reused,publicationAttempts:result.publicationAttempts??0}));
  } finally { process.removeListener('SIGINT', cancel); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
