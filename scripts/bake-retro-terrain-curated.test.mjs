import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {bakeRetroTerrainCurated, parseRetroTerrainCuratedArgs} from './bake-retro-terrain-curated.mjs';
import {GROUT_AUTOTILE_NOTICE} from '../src/shader/retro-autotile.mjs';
import {curatedArtSource, generateCuratedTerrain, validateCuratedRecipe} from '../src/shader/retro-terrain-curated.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function decodePng(bytes) {
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  let width, height, colorType, bitDepth;
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), name = bytes.toString('ascii', offset + 4, offset + 8), body = bytes.subarray(offset + 8, offset + 8 + length);
    if (name === 'IHDR') { width = body.readUInt32BE(); height = body.readUInt32BE(4); bitDepth = body[8]; colorType = body[9]; }
    if (name === 'IDAT') chunks.push(body);
    offset += length + 12;
    if (name === 'IEND') break;
  }
  assert.equal(bitDepth, 8); assert.equal(colorType, 6);
  const filtered = inflateSync(Buffer.concat(chunks)), stride = width * 4, data = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    assert.equal(filtered[row], 0);
    filtered.copy(data, y * stride, row + 1, row + stride + 1);
  }
  return {width, height, data};
}

test('curated CLI flags validate bounded seeds, size, palette and duplicates', () => {
  assert.deepEqual(parseRetroTerrainCuratedArgs(['--seed', '4294967295', '--out', 'cache']), {'--seed': '4294967295', '--out': 'cache'});
  assert.deepEqual(parseRetroTerrainCuratedArgs(['--seed', '4', '--out', 'cache', '--tile-size', '64', '--palette', 'cool-moor']), {'--seed': '4', '--out': 'cache', '--tile-size': '64', '--palette': 'cool-moor'});
  for (const args of [[], ['--seed', '-1', '--out', 'x'], ['--seed', '1.5', '--out', 'x'], ['--seed', '4294967296', '--out', 'x'], ['--seed', '1', '--out', 'x', '--tile-size', '32'], ['--seed', '1', '--out', 'x', '--palette', 'unknown'], ['--seed', '1', '--seed', '2', '--out', 'x'], ['--seed', '1', '--out', 'x', '--wat', 'y']]) assert.throws(() => parseRetroTerrainCuratedArgs(args));
  assert.deepEqual(validateCuratedRecipe(), {id: 'retro-terrain-curated', tileSize: 16, seed: 1204, palette: 'woodland'});
});

for (const tileSize of [16, 64]) for (const palette of ['woodland', 'dry-trail', 'cool-moor']) {
  test(`curated bake ${tileSize}px ${palette}: assets decode exactly and cache reuses`, async () => {
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'retro-terrain-curated-'));
    try {
      const recipe = {id: 'retro-terrain-curated', tileSize, seed: 1204, palette}, generated = generateCuratedTerrain(recipe);
      const first = await bakeRetroTerrainCurated({recipe, output});
      assert.equal(first.reused, false);
      assert.equal(first.manifest.format, 'retro-terrain-pack/2');
      assert.equal(first.manifest.generator, 'retro-terrain-curated/1');
      assert.equal(first.manifest.visualReview, 'unapproved');
      assert.deepEqual(first.manifest.recipe, recipe);
      for (const image of [...generated.tiles, ...generated.atlases, ...generated.templates, ...generated.previews]) {
        const descriptor = first.manifest.files.find(file => file.path === `${image.id}.png`);
        assert.ok(descriptor, image.id);
        const png = await fs.readFile(path.join(first.directory, descriptor.path)), decoded = decodePng(png);
        assert.equal(decoded.width, image.width); assert.equal(decoded.height, image.height);
        assert.deepEqual(decoded.data, Buffer.from(image.data));
        assert.equal(descriptor.rgbaSha256, hash(image.data)); assert.equal(descriptor.sha256, hash(png)); assert.equal(descriptor.bytes, png.length);
      }
      const artBytes = await fs.readFile(path.join(first.directory, 'art-source.json'));
      assert.deepEqual(JSON.parse(artBytes), JSON.parse(JSON.stringify(curatedArtSource(generated))));
      assert.equal(first.manifest.files.find(file => file.path === 'art-source.json').sha256, hash(artBytes));
      const licenseBytes = await fs.readFile(path.join(first.directory, 'LICENSE-Grout.txt'));
      assert.equal(licenseBytes.toString('utf8'), `${GROUT_AUTOTILE_NOTICE}\n`);
      assert.equal(first.manifest.files.find(file => file.path === 'LICENSE-Grout.txt').sha256, hash(licenseBytes));
      assert.deepEqual(JSON.parse(await fs.readFile(path.join(first.directory, 'recipe.json'), 'utf8')), recipe);
      const reused = await bakeRetroTerrainCurated({recipe, output});
      assert.equal(reused.reused, true); assert.equal(reused.directory, first.directory);
      assert.deepEqual(reused.manifest, first.manifest);
    } finally { await fs.rm(output, {recursive: true, force: true}); }
  });
}

test('curated cache rejects tampered assets and descriptor changes', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'retro-terrain-curated-tamper-'));
  try {
    const first = await bakeRetroTerrainCurated({output}), manifestPath = path.join(first.directory, 'terrain.json');
    const originalManifest = await fs.readFile(manifestPath), manifest = JSON.parse(originalManifest);
    manifest.files[0].rgbaSha256 = '0'.repeat(64);
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(bakeRetroTerrainCurated({output}), /identity or metadata differs/i);
    await fs.writeFile(manifestPath, originalManifest);
    const target = path.join(first.directory, first.manifest.files[0].path), original = await fs.readFile(target);
    await fs.writeFile(target, Buffer.from('bad png'));
    await assert.rejects(bakeRetroTerrainCurated({output}), /byte metadata differs/i);
    await fs.writeFile(target, original);
    await fs.unlink(target);
    await assert.rejects(bakeRetroTerrainCurated({output}), /incomplete/i);
  } finally { await fs.rm(output, {recursive: true, force: true}); }
});

test('curated cancellation removes only its owned pending output', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'retro-terrain-curated-abort-'));
  try {
    const before = await bakeRetroTerrainCurated({output});
    await assert.rejects(bakeRetroTerrainCurated({recipe: {...before.manifest.recipe, seed: 9}, output, signal: AbortSignal.abort(Error('stop now'))}), /stop now/);
    const controller = new AbortController(), originalWriteFile = fs.writeFile;
    fs.writeFile = async function(...args) { const result = await originalWriteFile.apply(fs, args); if (String(args[0]).includes('.pending-')) controller.abort(Error('cancel during write')); return result; };
    try { await assert.rejects(bakeRetroTerrainCurated({recipe: {...before.manifest.recipe, seed: 10}, output, signal: controller.signal}), /cancel during write/); }
    finally { fs.writeFile = originalWriteFile; }
    assert.deepEqual(await fs.readdir(output), [path.basename(before.directory)]);
  } finally { await fs.rm(output, {recursive: true, force: true}); }
});

test('curated CLI recipe conflicts and invalid recipes fail before creating output', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'retro-terrain-curated-cli-'));
  try {
    const recipePath = path.join(root, 'recipe.json'), output = path.join(root, 'out');
    await fs.writeFile(recipePath, JSON.stringify({id: 'retro-terrain-curated', tileSize: 64, seed: 7, palette: 'dry-trail'}));
    for (const args of [
      ['--seed', '8', '--recipe', recipePath, '--out', output],
      ['--seed', '7', '--recipe', recipePath, '--tile-size', '16', '--out', output],
      ['--seed', '7', '--recipe', recipePath, '--palette', 'woodland', '--out', output],
    ]) {
      const result = spawnSync(process.execPath, ['scripts/bake-retro-terrain-curated.mjs', ...args], {cwd: path.resolve('.'), encoding: 'utf8'});
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /conflicts/i);
      await assert.rejects(fs.stat(output), {code: 'ENOENT'});
    }
    const success = spawnSync(process.execPath, ['scripts/bake-retro-terrain-curated.mjs', '--seed', '7', '--recipe', recipePath, '--out', output], {cwd: path.resolve('.'), encoding: 'utf8'});
    assert.equal(success.status, 0, success.stderr);
    const record = JSON.parse(success.stdout);
    assert.equal(record.files, (await fs.readdir(record.directory)).length - 1);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(record.directory, 'recipe.json'), 'utf8')), {id: 'retro-terrain-curated', tileSize: 64, seed: 7, palette: 'dry-trail'});
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});
