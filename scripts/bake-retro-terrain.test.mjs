import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {bakeRetroTerrain, parseRetroTerrainArgs} from './bake-retro-terrain.mjs';
import {generateRetroTerrain} from '../src/shader/retro-terrain.mjs';

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
    const row = y * (stride + 1), filter = filtered[row];
    assert.equal(filter, 0, 'encoder writes unfiltered RGBA rows');
    filtered.copy(data, y * stride, row + 1, row + stride + 1);
  }
  return {width, height, data};
}

test('bake emits the original 19 tiles and atlas with decoded pixels, raw hashes, and a verified reusable cache', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'retro-terrain-bake-'));
  try {
    const recipe = {id: 'retro-terrain', seed: 1204}, generated = generateRetroTerrain(recipe);
    const first = await bakeRetroTerrain({recipe, output});
    assert.equal(first.reused, false);
    assert.equal(first.manifest.format, 'retro-terrain-pack/1');
    assert.equal(first.manifest.visualReview, 'unapproved');
    assert.equal(first.manifest.files.length, 21);
    assert.equal(first.manifest.tiles.length, 19); assert.ok(first.manifest.atlas);
    assert.deepEqual(first.manifest.provenance.restrictedInputs, []);
    for (const [index, tile] of generated.tiles.entries()) {
      const descriptor = first.manifest.files.find(file => file.path === `${tile.id}.png`);
      const png = await fs.readFile(path.join(first.directory, descriptor.path)), decoded = decodePng(png);
      assert.equal(decoded.width, tile.width); assert.equal(decoded.height, tile.height);
      assert.deepEqual(decoded.data, Buffer.from(tile.data));
      assert.equal(descriptor.rgbaSha256, hash(tile.data)); assert.equal(descriptor.sha256, hash(png)); assert.equal(descriptor.bytes, png.length);
      assert.equal(first.manifest.files[index].path, `${tile.id}.png`);
    }
    const atlas = first.manifest.files.find(file => file.path === 'grass-dirt-atlas.png');
    assert.equal(atlas.rgbaSha256, hash(generated.atlas.data));
    assert.deepEqual(decodePng(await fs.readFile(path.join(first.directory, atlas.path))).data, Buffer.from(generated.atlas.data));
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(first.directory, 'recipe.json'), 'utf8')), recipe);
    const reused = await bakeRetroTerrain({recipe, output});
    assert.equal(reused.reused, true); assert.equal(reused.directory, first.directory);
    assert.equal(reused.manifest.files.length, first.manifest.files.length);
    assert.deepEqual(reused.manifest, first.manifest);
  } finally { await fs.rm(output, {recursive: true, force: true}); }
});

test('cache verification rejects coordinated manifest edits and altered or oversized PNGs without removing completed output', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'retro-terrain-tamper-'));
  try {
    const first = await bakeRetroTerrain({output}), manifestPath = path.join(first.directory, 'terrain.json');
    const originalManifest = await fs.readFile(manifestPath), manifest = JSON.parse(originalManifest);
    manifest.visualReview = 'approved';
    manifest.files[0].sha256 = '0'.repeat(64);
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(bakeRetroTerrain({output}), /identity or metadata differs/i);
    await fs.writeFile(manifestPath, originalManifest);
    const target = path.join(first.directory, first.manifest.files[0].path), originalPng = await fs.readFile(target);
    await fs.writeFile(target, Buffer.from('broken png'));
    await assert.rejects(bakeRetroTerrain({output}), /byte metadata differs/i);
    await fs.writeFile(target, originalPng);
    await fs.truncate(target, originalPng.length + 8 * 1024 * 1024);
    let oversizedRead = false;
    const originalReadFile = fs.readFile;
    fs.readFile = async function(file, ...args) { if (path.resolve(String(file)) === path.resolve(target)) oversizedRead = true; return originalReadFile.call(fs, file, ...args); };
    try { await assert.rejects(bakeRetroTerrain({output}), /byte metadata differs/i); assert.equal(oversizedRead, false); }
    finally { fs.readFile = originalReadFile; }
    assert.ok((await fs.readdir(output)).includes(path.basename(first.directory)));
    await fs.writeFile(target, originalPng);
    assert.equal((await bakeRetroTerrain({output})).reused, true);
  } finally { await fs.rm(output, {recursive: true, force: true}); }
});

test('abort before and during publication removes only the owned pending directory', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'retro-terrain-abort-'));
  try {
    const complete = await bakeRetroTerrain({output}), before = AbortSignal.abort(Error('stop now'));
    await assert.rejects(bakeRetroTerrain({output, signal: before}), /stop now/);
    const controller = new AbortController(), originalWriteFile = fs.writeFile;
    fs.writeFile = async function(...args) {
      const result = await originalWriteFile.apply(fs, args);
      if (String(args[0]).includes('.pending-')) controller.abort(Error('cancel during write'));
      return result;
    };
    try { await assert.rejects(bakeRetroTerrain({recipe: {seed: 99}, output, signal: controller.signal}), /cancel during write/); }
    finally { fs.writeFile = originalWriteFile; }
    const entries = await fs.readdir(output);
    assert.deepEqual(entries, [path.basename(complete.directory)]);
    assert.ok(await fs.stat(path.join(complete.directory, 'terrain.json')));
  } finally { await fs.rm(output, {recursive: true, force: true}); }
});

test('CLI accepts only one uint32 seed and output path, with an optional matching recipe file', async () => {
  assert.deepEqual(parseRetroTerrainArgs(['--seed', '4294967295', '--out', 'cache']), {'--seed': '4294967295', '--out': 'cache'});
  for (const args of [[], ['--seed', '-1', '--out', 'x'], ['--seed', '1.5', '--out', 'x'], ['--seed', '4294967296', '--out', 'x'], ['--seed', '1', '--out', 'x', '--wat', 'x'], ['--seed', '1', '--seed', '2', '--out', 'x']])
    assert.throws(() => parseRetroTerrainArgs(args), /Usage:|unsigned 32-bit/i);

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'retro-terrain-cli-'));
  try {
    const recipe = path.join(root, 'recipe.json'); await fs.writeFile(recipe, JSON.stringify({id: 'retro-terrain', seed: 7}));
    const ok = spawnSync(process.execPath, ['scripts/bake-retro-terrain.mjs', '--seed', '7', '--recipe', recipe, '--out', path.join(root, 'out')], {cwd: path.resolve('.'), encoding: 'utf8'});
    assert.equal(ok.status, 0, ok.stderr); assert.equal(JSON.parse(ok.stdout).files, 21);
    const conflict = spawnSync(process.execPath, ['scripts/bake-retro-terrain.mjs', '--seed', '8', '--recipe', recipe, '--out', path.join(root, 'out')], {cwd: path.resolve('.'), encoding: 'utf8'});
    assert.equal(conflict.status, 1); assert.match(conflict.stderr, /conflicts/i);
    const preserved = path.join(root, 'preserved'); await fs.mkdir(preserved); await fs.writeFile(path.join(preserved, 'owner.txt'), 'keep');
    const oversizedRecipe = path.join(root, 'oversized.json'); await fs.writeFile(oversizedRecipe, JSON.stringify({id: 'retro-terrain', seed: 7, extra: 'x'.repeat(70 * 1024)}));
    const oversized = spawnSync(process.execPath, ['scripts/bake-retro-terrain.mjs', '--seed', '7', '--recipe', oversizedRecipe, '--out', preserved], {cwd: path.resolve('.'), encoding: 'utf8'});
    assert.equal(oversized.status, 1); assert.match(oversized.stderr, /exceeds its byte limit/i);
    assert.deepEqual(await fs.readdir(preserved), ['owner.txt']); assert.equal(await fs.readFile(path.join(preserved, 'owner.txt'), 'utf8'), 'keep');
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});
