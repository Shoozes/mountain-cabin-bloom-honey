import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {bakeRetroTerrainGrowth, parseRetroTerrainGrowthArgs} from './bake-retro-terrain-growth.mjs';
import {generateRetroGrowth} from '../src/shader/retro-terrain-growth.mjs';

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
    assert.equal(filtered[row], 0, 'encoder writes unfiltered RGBA rows');
    filtered.copy(data, y * stride, row + 1, row + stride + 1);
  }
  return {width, height, data};
}

test('growth bake emits 70 tiles, four atlases and exact reusable PNG bytes while pinning the classic generator', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'retro-terrain-growth-bake-'));
  try {
    const inputRecipe = {id: 'retro-terrain-growth', seed: 1204}, recipe = {...inputRecipe, palette: 'original'};
    const generated = generateRetroGrowth(inputRecipe);
    assert.equal(hash((await fs.readFile(new URL('../src/shader/retro-terrain.mjs', import.meta.url),'utf8')).replaceAll('\r\n','\n')), '76fa9fb6e1053954828cbb35f893a29160c8e4cd92a7ef125fa40ff7aa10f9d2', 'classic generator remains pinned to the reviewed original source');
    const first = await bakeRetroTerrainGrowth({recipe: inputRecipe, output});
    assert.equal(first.reused, false);
    assert.equal(first.manifest.format, 'retro-terrain-pack/1');
    assert.equal(first.manifest.generator, 'retro-terrain-growth/1');
    assert.equal(first.manifest.visualReview, 'unapproved');
    assert.equal(first.manifest.files.length, 75);
    assert.equal(first.manifest.tiles.length, 70);
    assert.equal(first.manifest.atlases.length, 4);
    assert.deepEqual(first.manifest.provenance.restrictedInputs, []);
    const expectedSources = ['src/shader/retro-terrain.mjs', 'src/shader/retro-terrain-growth.mjs', 'scripts/bake-retro-terrain-growth.mjs', 'scripts/material-png.mjs'];
    assert.deepEqual(first.manifest.sources.map(source => source.path), expectedSources);
    for (const [index, tile] of generated.tiles.entries()) {
      const descriptor = first.manifest.files.find(file => file.path === `${tile.id}.png`);
      assert.ok(descriptor, tile.id);
      const png = await fs.readFile(path.join(first.directory, descriptor.path)), decoded = decodePng(png);
      assert.equal(decoded.width, tile.width); assert.equal(decoded.height, tile.height);
      assert.deepEqual(decoded.data, Buffer.from(tile.data));
      assert.equal(descriptor.rgbaSha256, hash(tile.data)); assert.equal(descriptor.sha256, hash(png)); assert.equal(descriptor.bytes, png.length);
      assert.equal(first.manifest.files[index].path, `${tile.id}.png`);
      if (index >= 38) {
        for (let at = 3; at < tile.data.length; at += 4) assert.ok(tile.data[at] === 0 || tile.data[at] === 255);
        assert.ok(tile.data.some((value, at) => at % 4 === 3 && value === 0));
      }
    }
    for (const atlas of generated.atlases) {
      const descriptor = first.manifest.files.find(file => file.path === `${atlas.id}.png`);
      assert.ok(descriptor);
      const png = await fs.readFile(path.join(first.directory, descriptor.path));
      assert.equal(descriptor.rgbaSha256, hash(atlas.data));
      assert.deepEqual(decodePng(png).data, Buffer.from(atlas.data));
    }
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(first.directory, 'recipe.json'), 'utf8')), recipe);
    assert.equal((await fs.readdir(first.directory)).length, 76);
    const reused = await bakeRetroTerrainGrowth({recipe: inputRecipe, output});
    assert.equal(reused.reused, true); assert.equal(reused.directory, first.directory);
    assert.deepEqual(reused.manifest, first.manifest);
  } finally { await fs.rm(output, {recursive: true, force: true}); }
});

test('cache rejects coordinated descriptor edits, altered, missing and oversized assets before unbounded reads', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'retro-terrain-growth-tamper-'));
  try {
    const first = await bakeRetroTerrainGrowth({output}), manifestPath = path.join(first.directory, 'terrain.json');
    const originalManifest = await fs.readFile(manifestPath), manifest = JSON.parse(originalManifest);
    manifest.files[0].rgbaSha256 = '0'.repeat(64);
    manifest.files[0].sha256 = '1'.repeat(64);
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(bakeRetroTerrainGrowth({output}), /identity or metadata differs/i);
    await fs.writeFile(manifestPath, originalManifest);

    const target = path.join(first.directory, first.manifest.files[0].path), originalPng = await fs.readFile(target);
    await fs.writeFile(target, Buffer.from('broken png'));
    await assert.rejects(bakeRetroTerrainGrowth({output}), /byte metadata differs/i);
    await fs.writeFile(target, originalPng);
    await fs.unlink(target);
    await assert.rejects(bakeRetroTerrainGrowth({output}), /incomplete/i);
    await fs.writeFile(target, originalPng);
    await fs.truncate(target, originalPng.length + 8 * 1024 * 1024);
    let oversizedRead = false;
    const originalReadFile = fs.readFile;
    fs.readFile = async function(file, ...args) { if (path.resolve(String(file)) === path.resolve(target)) oversizedRead = true; return originalReadFile.call(fs, file, ...args); };
    try { await assert.rejects(bakeRetroTerrainGrowth({output}), /byte metadata differs/i); assert.equal(oversizedRead, false); }
    finally { fs.readFile = originalReadFile; }
    assert.ok((await fs.readdir(output)).includes(path.basename(first.directory)));
    await fs.writeFile(target, originalPng);
    assert.equal((await bakeRetroTerrainGrowth({output})).reused, true);
  } finally { await fs.rm(output, {recursive: true, force: true}); }
});

test('abort before and during publication removes only the owned pending directory', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'retro-terrain-growth-abort-'));
  try {
    const complete = await bakeRetroTerrainGrowth({output}), before = AbortSignal.abort(Error('stop now'));
    await assert.rejects(bakeRetroTerrainGrowth({output, signal: before}), /stop now/);
    const controller = new AbortController(), originalWriteFile = fs.writeFile;
    fs.writeFile = async function(...args) {
      const result = await originalWriteFile.apply(fs, args);
      if (String(args[0]).includes('.pending-')) controller.abort(Error('cancel during write'));
      return result;
    };
    try { await assert.rejects(bakeRetroTerrainGrowth({recipe: {id: 'retro-terrain-growth', seed: 99}, output, signal: controller.signal}), /cancel during write/); }
    finally { fs.writeFile = originalWriteFile; }
    assert.deepEqual(await fs.readdir(output), [path.basename(complete.directory)]);
    assert.ok(await fs.stat(path.join(complete.directory, 'terrain.json')));
  } finally { await fs.rm(output, {recursive: true, force: true}); }
});

test('atomic publication retries temporary Windows locks within a bound and cleans up on failure or abort', async () => {
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'retro-terrain-growth-lock-')),originalRename=fs.rename;
  try {
    await fs.writeFile(path.join(output,'owner.txt'),'preserve');
    let calls=0;
    fs.rename=async(...args)=>{calls++;if(calls<3)throw Object.assign(Error('temporary scanner lock'),{code:calls===1?'EPERM':'EACCES'});return originalRename(...args);};
    const completed=await bakeRetroTerrainGrowth({output});assert.equal(completed.publicationAttempts,3);assert.equal(calls,3);
    calls=0;fs.rename=async()=>{calls++;throw Object.assign(Error('persistent scanner lock'),{code:'EPERM'});};
    await assert.rejects(bakeRetroTerrainGrowth({output,recipe:{seed:1205}}),/persistent scanner lock/);assert.equal(calls,4);
    const controller=new AbortController();calls=0;
    fs.rename=async()=>{calls++;controller.abort();throw Object.assign(Error('cancelled scanner lock'),{code:'EPERM'});};
    await assert.rejects(bakeRetroTerrainGrowth({output,recipe:{seed:1206},signal:controller.signal}),/aborted/i);assert.equal(calls,1);
    calls=0;fs.rename=async()=>{calls++;throw Object.assign(Error('storage fault'),{code:'EIO'});};
    await assert.rejects(bakeRetroTerrainGrowth({output,recipe:{seed:1207}}),/storage fault/);assert.equal(calls,1);
    assert.deepEqual((await fs.readdir(output)).sort(),['owner.txt',path.basename(completed.directory)].sort());
    assert.equal(await fs.readFile(path.join(output,'owner.txt'),'utf8'),'preserve');
  } finally {fs.rename=originalRename;await fs.rm(output,{recursive:true,force:true});}
});

test('growth CLI validates uint32 seed, normalized and matching palettes, bounded recipes and performs no writes for invalid input', async () => {
  assert.deepEqual(parseRetroTerrainGrowthArgs(['--seed', '4294967295', '--out', 'cache']), {'--seed': '4294967295', '--out': 'cache'});
  assert.deepEqual(parseRetroTerrainGrowthArgs(['--seed', '9', '--out', 'cache', '--palette', 'heath']), {'--seed': '9', '--out': 'cache', '--palette': 'heath'});
  for (const args of [[], ['--seed', '-1', '--out', 'x'], ['--seed', '1.5', '--out', 'x'], ['--seed', '4294967296', '--out', 'x'], ['--seed', '1', '--out', 'x', '--wat', 'x'], ['--seed', '1', '--seed', '2', '--out', 'x']])
    assert.throws(() => parseRetroTerrainGrowthArgs(args), /Usage:|unsigned 32-bit/i);
  assert.throws(() => parseRetroTerrainGrowthArgs(['--seed', '1', '--out', 'x', '--palette', 'cosmic']), /palette must be original, heath or riverbed/i);

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'retro-terrain-growth-cli-'));
  try {
    const recipe = path.join(root, 'recipe.json'); await fs.writeFile(recipe, JSON.stringify({id: 'retro-terrain-growth', seed: 7}));
    const output = path.join(root, 'out');
    const ok = spawnSync(process.execPath, ['scripts/bake-retro-terrain-growth.mjs', '--seed', '7', '--recipe', recipe, '--palette', 'original', '--out', output], {cwd: path.resolve('.'), encoding: 'utf8'});
    assert.equal(ok.status, 0, ok.stderr); assert.equal(JSON.parse(ok.stdout).files, 75);
    const originalOutput = JSON.parse(ok.stdout).directory;
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(originalOutput, 'recipe.json'), 'utf8')), {id: 'retro-terrain-growth', seed: 7, palette: 'original'});
    const conflict = spawnSync(process.execPath, ['scripts/bake-retro-terrain-growth.mjs', '--seed', '8', '--recipe', recipe, '--out', output], {cwd: path.resolve('.'), encoding: 'utf8'});
    assert.equal(conflict.status, 1); assert.match(conflict.stderr, /conflicts/i);

    const paintedRecipe = path.join(root, 'heath.json'); await fs.writeFile(paintedRecipe, JSON.stringify({id: 'retro-terrain-growth', seed: 8, palette: 'heath'}));
    const paintedOut = path.join(root, 'painted');
    const painted = spawnSync(process.execPath, ['scripts/bake-retro-terrain-growth.mjs', '--seed', '8', '--recipe', paintedRecipe, '--out', paintedOut], {cwd: path.resolve('.'), encoding: 'utf8'});
    assert.equal(painted.status, 0, painted.stderr);
    const paintedDirectory = JSON.parse(painted.stdout).directory;
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(paintedDirectory, 'recipe.json'), 'utf8')), {id: 'retro-terrain-growth', seed: 8, palette: 'heath'});
    const explicitOut = path.join(root, 'explicit-palette');
    const explicitPalette = spawnSync(process.execPath, ['scripts/bake-retro-terrain-growth.mjs', '--seed', '9', '--palette', 'riverbed', '--out', explicitOut], {cwd: path.resolve('.'), encoding: 'utf8'});
    assert.equal(explicitPalette.status, 0, explicitPalette.stderr);
    const explicitDirectory = JSON.parse(explicitPalette.stdout).directory;
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(explicitDirectory, 'recipe.json'), 'utf8')), {id: 'retro-terrain-growth', seed: 9, palette: 'riverbed'});
    const beforeMismatch = await fs.readdir(paintedOut);
    const paletteConflict = spawnSync(process.execPath, ['scripts/bake-retro-terrain-growth.mjs', '--seed', '8', '--recipe', paintedRecipe, '--palette', 'riverbed', '--out', paintedOut], {cwd: path.resolve('.'), encoding: 'utf8'});
    assert.equal(paletteConflict.status, 1); assert.match(paletteConflict.stderr, /palette conflicts/i);
    assert.deepEqual(await fs.readdir(paintedOut), beforeMismatch);

    const preserved = path.join(root, 'preserved'); await fs.mkdir(preserved); await fs.writeFile(path.join(preserved, 'owner.txt'), 'keep');
    const invalidRecipe = path.join(root, 'invalid.json'); await fs.writeFile(invalidRecipe, JSON.stringify({id: 'retro-terrain-growth', seed: 7, extra: true}));
    const invalid = spawnSync(process.execPath, ['scripts/bake-retro-terrain-growth.mjs', '--seed', '7', '--recipe', invalidRecipe, '--out', preserved], {cwd: path.resolve('.'), encoding: 'utf8'});
    assert.equal(invalid.status, 1);
    const unknownPalette = spawnSync(process.execPath, ['scripts/bake-retro-terrain-growth.mjs', '--seed', '7', '--palette', 'cosmic', '--out', preserved], {cwd: path.resolve('.'), encoding: 'utf8'});
    assert.equal(unknownPalette.status, 1); assert.match(unknownPalette.stderr, /palette must be original, heath or riverbed/i);
    const oversizedRecipe = path.join(root, 'oversized.json'); await fs.writeFile(oversizedRecipe, JSON.stringify({id: 'retro-terrain-growth', seed: 7, padding: 'x'.repeat(70 * 1024)}));
    const oversized = spawnSync(process.execPath, ['scripts/bake-retro-terrain-growth.mjs', '--seed', '7', '--recipe', oversizedRecipe, '--out', preserved], {cwd: path.resolve('.'), encoding: 'utf8'});
    assert.equal(oversized.status, 1); assert.match(oversized.stderr, /exceeds its byte limit/i);
    assert.deepEqual(await fs.readdir(preserved), ['owner.txt']); assert.equal(await fs.readFile(path.join(preserved, 'owner.txt'), 'utf8'), 'keep');
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});
