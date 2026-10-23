import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { inflateSync } from 'node:zlib';
import { generateMaterial, materialVersion, MATERIAL_RECIPES } from '../src/shader/material.mjs';
import { VOXEL_SURFACE_FAMILIES } from '../src/shader/material-voxel.mjs';
import { bakeMaterial } from './bake-material.mjs';

function decodePng(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20), parts = [];
  for (let p = 8; p < bytes.length;) {
    const n = bytes.readUInt32BE(p), type = bytes.toString('ascii', p + 4, p + 8);
    if (type === 'IDAT') parts.push(bytes.subarray(p + 8, p + 8 + n));
    p += n + 12;
  }
  const stride = width * 4, rows = inflateSync(Buffer.concat(parts)), data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const at = y * (stride + 1), filter = rows[at];
    for (let x = 0; x < stride; x++) {
      const raw = rows[at + 1 + x], left = x >= 4 ? data[y * stride + x - 4] : 0;
      const up = y ? data[(y - 1) * stride + x] : 0;
      const upperLeft = y && x >= 4 ? data[(y - 1) * stride + x - 4] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upperLeft, a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - upperLeft);
        predictor = a <= b && a <= c ? left : b <= c ? up : upperLeft;
      } else assert.equal(filter, 0, 'known PNG filter');
      data[y * stride + x] = (raw + predictor) & 255;
    }
  }
  return { width, height, data };
}

test('browser diagnostics preserve the full default matrix and fail closed on invalid selections', () => {
  const plan = (args) => JSON.parse(execFileSync(process.execPath, [path.resolve('scripts/test-material-voxel-browser.mjs'), '--print-selection', ...args], {encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}));
  assert.deepEqual(plan([]), {families:[...VOXEL_SURFACE_FAMILIES],seeds:[1204,1215,1233],sizes:[32,512],qualification:true});
  assert.deepEqual(plan(['--quick']), {families:['grass'],seeds:[1204],sizes:[32],qualification:false});
  for(const args of [['--quick','--quick'],['--unknown'],['--mode','bad'],['--mode'],['--dev','--mode','root']])assert.throws(()=>plan(args));
});

test('voxel registry and CLI default to a single native 16px recipe with source identity', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'voxel-material-cli-'));
  try {
    assert.equal(MATERIAL_RECIPES['voxel-surface'], 'Minecraft-style · 16 px');
    assert.equal(materialVersion('voxel-surface'), 'voxel-surface/1');
    const cliOut = path.join(output, 'cli');
    const printed = execFileSync(process.execPath, [path.resolve('scripts/bake-material.mjs'), '--recipe', 'voxel-surface', '--variant-set', 'single', '--out', cliOut], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true, timeout: 40000 });
    const result = JSON.parse(printed.trim()), manifest = JSON.parse(await fs.readFile(path.join(result.directory, 'material.json'), 'utf8'));
    assert.equal(manifest.generator, 'voxel-surface/1');
    assert.deepEqual({ id: manifest.recipe.id, family: manifest.recipe.family, seed: manifest.recipe.seed, size: manifest.recipe.size }, { id: 'voxel-surface', family: 'grass', seed: 1204, size: 16 });
    assert.ok(manifest.sources.some((source) => source.path === 'src/shader/material-voxel.mjs'));
    assert.equal(manifest.files.filter((file) => file.channel !== 'contact-sheet').length, 4);
  } finally { await fs.rm(output, { recursive: true, force: true }); }
});

test('all eight families bake four exact native channel PNGs; 32px is integer enlargement', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'voxel-material-families-'));
  try {
    for (const family of VOXEL_SURFACE_FAMILIES) {
      const recipe = { id: 'voxel-surface', family }, baked = await bakeMaterial({ recipe, output: path.join(output, family), variantSet: 'single' });
      const generated = generateMaterial(recipe);
      assert.equal(baked.manifest.recipe.size, 16, `${family} default size`);
      assert.equal(baked.manifest.files.filter((file) => file.channel !== 'contact-sheet').length, 4);
      for (const file of baked.manifest.files.filter((entry) => entry.channel !== 'contact-sheet')) {
        const png = decodePng(await fs.readFile(path.join(baked.directory, file.path)));
        assert.deepEqual([png.width, png.height], [16, 16]);
        assert.ok(png.data.equals(Buffer.from(generated.channels[file.channel].data)), `${family}/${file.channel} exact RGBA`);
      }
    }
    const recipe32 = { id: 'voxel-surface', family: 'planks', size: 32 };
    const baked32 = await bakeMaterial({ recipe: recipe32, output: path.join(output, 'planks32'), variantSet: 'single' });
    const generated32 = generateMaterial(recipe32);
    for (const file of baked32.manifest.files.filter((entry) => entry.channel !== 'contact-sheet')) {
      const png = decodePng(await fs.readFile(path.join(baked32.directory, file.path)));
      assert.deepEqual([png.width, png.height], [32, 32]);
      assert.ok(png.data.equals(Buffer.from(generated32.channels[file.channel].data)), `${file.channel} 32px bytes`);
    }
  } finally { await fs.rm(output, { recursive: true, force: true }); }
});

test('voxel cache reuse validates source metadata and channel bytes', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'voxel-material-cache-'));
  try {
    const recipe = { id: 'voxel-surface', family: 'stone' }, first = await bakeMaterial({ recipe, output, variantSet: 'single' });
    assert.equal((await bakeMaterial({ recipe, output, variantSet: 'single' })).reused, true);
    const manifestPath = path.join(first.directory, 'material.json'), original = await fs.readFile(manifestPath, 'utf8');
    const changedSource = JSON.parse(original); changedSource.sources.find((source) => source.path === 'src/shader/material-voxel.mjs').sha256 = '0'.repeat(64);
    await fs.writeFile(manifestPath, JSON.stringify(changedSource));
    await assert.rejects(bakeMaterial({ recipe, output, variantSet: 'single' }), /identity|source/i);
    await fs.writeFile(manifestPath, original);
    const target = first.manifest.files.find((file) => file.channel === 'albedo'), targetPath = path.join(first.directory, target.path), saved = await fs.readFile(targetPath);
    await fs.writeFile(targetPath, Buffer.from('corrupt'));
    await assert.rejects(bakeMaterial({ recipe, output, variantSet: 'single' }), /incomplete|byte metadata|differs/i);
    await fs.writeFile(targetPath, saved);
    assert.equal((await bakeMaterial({ recipe, output, variantSet: 'single' })).reused, true);
  } finally { await fs.rm(output, { recursive: true, force: true }); }
});

test('voxel-only 16px contract rejects old IDs and invalid voxel inputs before output mutation', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'voxel-material-invalid-'));
  try {
    for (const recipe of [{ id: 'hd2d-cliff', size: 16 }, { id: 'style-surface', family: 'grass', style: 'hd2d', size: 16 }, { id: 'realistic-surface', size: 16 }, { id: 'wrong-id', size: 16 }, { id: 'voxel-surface', size: 24 }, { id: 'voxel-surface', family: 'water' }, { id: 'voxel-surface', structure: 'clumps' }]) {
      const output = path.join(root, `invalid-${Math.random().toString(16).slice(2)}`);
      await assert.rejects(bakeMaterial({ recipe, output, variantSet: 'single' }));
      await assert.rejects(fs.stat(output), { code: 'ENOENT' });
    }
    const abortedOutput = path.join(root, 'aborted');
    await assert.rejects(bakeMaterial({ recipe: { id: 'voxel-surface' }, output: abortedOutput, signal: AbortSignal.abort(Error('cancel voxel bake')), variantSet: 'single' }), /cancel voxel bake/);
    await assert.rejects(fs.stat(abortedOutput), { code: 'ENOENT' });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('active voxel bake cancellation removes pending output and preserves prior completed bakes', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'voxel-material-cancel-'));
  try {
    const initial = await bakeMaterial({ recipe: { id: 'voxel-surface' }, output, variantSet: 'single' });
    const before = await fs.readFile(path.join(initial.directory, 'material.json'));
    const abort = new AbortController(), pending = bakeMaterial({ recipe: { id: 'voxel-surface', family: 'brick', seed: 99 }, output, variantSet: 'single', signal: abort.signal });
    const timer = setTimeout(() => abort.abort(Error('cancel active voxel bake')), 0);
    try { await assert.rejects(pending, /cancel active voxel bake/); }
    finally { clearTimeout(timer); }
    assert.deepEqual(await fs.readFile(path.join(initial.directory, 'material.json')), before);
    assert.equal((await fs.readdir(output)).some((name) => name.startsWith('.pending-')), false);
  } finally { await fs.rm(output, { recursive: true, force: true }); }
});
