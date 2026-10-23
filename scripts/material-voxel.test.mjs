import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateVoxelMaterial, validateVoxelRecipe, VOXEL_DEFAULTS,
  VOXEL_NATIVE_SIZE, VOXEL_SURFACE_FAMILIES, VOXEL_SURFACE_SIZES,
} from '../src/shader/material-voxel.mjs';

test('voxel recipes have a strict schema, canonical 16px default and bounded controls', () => {
  assert.deepEqual(validateVoxelRecipe(), VOXEL_DEFAULTS);
  assert.equal(VOXEL_NATIVE_SIZE, 16);
  assert.deepEqual(VOXEL_SURFACE_SIZES, [16, 32, 64, 128, 256, 512]);
  for (const input of [null, [], { id: 'style-surface' }, { style: 'hd2d' }, { structure: 'clumps' }, { extra: 1 }, { family: 'water' }, { seed: -1 }, { seed: 2 ** 32 }, { size: 24 }, { palette: 'bad' }, { strataScale: 0 }, { fracture: 1.1 }, { relief: -1 }, { roughness: 0 }])
    assert.throws(() => validateVoxelRecipe(input));
});

test('all eight native families are deterministic, opaque, finite-palette and distinct', () => {
  const outputs = [];
  for (const family of VOXEL_SURFACE_FAMILIES) {
    const a = generateVoxelMaterial({ ...VOXEL_DEFAULTS, family });
    const b = generateVoxelMaterial({ ...VOXEL_DEFAULTS, family });
    assert.deepEqual(Object.keys(a.channels).sort(), ['albedo', 'height', 'normal', 'roughness']);
    for (const map of Object.values(a.channels)) {
      assert.deepEqual([map.width, map.height], [16, 16]);
      assert.equal(map.data.length, 16 * 16 * 4);
      for (let i = 3; i < map.data.length; i += 4) assert.equal(map.data[i], 255);
    }
    const colors = new Set();
    for (let i = 0; i < a.channels.albedo.data.length; i += 4) colors.add([...a.channels.albedo.data.subarray(i, i + 3)].join(','));
    assert.ok(colors.size <= 8, `${family} ramp stays finite`);
    assert.deepEqual(a.channels, b.channels);
    assert.deepEqual(a.heights, b.heights);
    outputs.push(Buffer.from(a.channels.albedo.data).toString('hex'));
  }
  assert.equal(new Set(outputs).size, VOXEL_SURFACE_FAMILIES.length, 'each material has a legible family-specific layout');
});

test('seed and structure scale vary native patterns across every family', () => {
  for (const family of VOXEL_SURFACE_FAMILIES) {
    const base = generateVoxelMaterial({ ...VOXEL_DEFAULTS, family });
    const seeded = generateVoxelMaterial({ ...VOXEL_DEFAULTS, family, seed: 1215 });
    const scaled = generateVoxelMaterial({ ...VOXEL_DEFAULTS, family, strataScale: 7 });
    assert.notDeepEqual(base.channels.albedo, seeded.channels.albedo, `${family} seed changes placement`);
    assert.notDeepEqual(base.channels.albedo, scaled.channels.albedo, `${family} scale changes cadence`);
  }
});

test('palette, fracture, relief and roughness each affect only their intended channels', () => {
  const base = generateVoxelMaterial({ ...VOXEL_DEFAULTS, family: 'cobble' });
  const palette = generateVoxelMaterial({ ...VOXEL_DEFAULTS, family: 'cobble', palette: 'slate' });
  const fracture = generateVoxelMaterial({ ...VOXEL_DEFAULTS, family: 'cobble', fracture: .9 });
  const relief = generateVoxelMaterial({ ...VOXEL_DEFAULTS, family: 'cobble', relief: .9 });
  const roughness = generateVoxelMaterial({ ...VOXEL_DEFAULTS, family: 'cobble', roughness: .2 });
  assert.notDeepEqual(base.channels.albedo, palette.channels.albedo);
  for (const key of ['height', 'normal', 'roughness']) assert.deepEqual(base.channels[key], palette.channels[key]);
  assert.notDeepEqual(base.channels.albedo, fracture.channels.albedo);
  assert.notDeepEqual(base.channels.height, fracture.channels.height);
  assert.notDeepEqual(base.channels.roughness, fracture.channels.roughness);
  for (const key of ['albedo', 'roughness']) assert.deepEqual(base.channels[key], relief.channels[key]);
  assert.notDeepEqual(base.channels.height, relief.channels.height);
  assert.notDeepEqual(base.channels.normal, relief.channels.normal);
  for (const key of ['albedo', 'height', 'normal']) assert.deepEqual(base.channels[key], roughness.channels[key]);
  assert.notDeepEqual(base.channels.roughness, roughness.channels.roughness);
});

test('larger sizes are exact nearest integer enlargement of every native channel and height', () => {
  const native = generateVoxelMaterial({ ...VOXEL_DEFAULTS, family: 'planks' });
  for (const size of VOXEL_SURFACE_SIZES.slice(1)) {
    const output = generateVoxelMaterial({ ...VOXEL_DEFAULTS, family: 'planks', size });
    assert.equal(output.nativeSize, 16);
    for (const [channel, pixels] of Object.entries(output.channels)) {
      const original = native.channels[channel].data;
      assert.deepEqual([pixels.width, pixels.height], [size, size]);
      for (let y = 0; y < size; y += Math.max(1, Math.floor(size / 11))) for (let x = 0; x < size; x += Math.max(1, Math.floor(size / 11))) {
        const from = (Math.floor(y / (size / 16)) * 16 + Math.floor(x / (size / 16))) * 4;
        assert.deepEqual([...pixels.data.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)], [...original.subarray(from, from + 4)]);
      }
    }
    for (let y = 0; y < size; y += 3) for (let x = 0; x < size; x += 3) {
      const expected = native.heights[Math.floor(y / (size / 16)) * 16 + Math.floor(x / (size / 16))];
      assert.equal(output.heights[y * size + x], expected);
    }
  }
});

test('native wrapped normals use wrapped height derivatives at tile edges', () => {
  const result = generateVoxelMaterial({ ...VOXEL_DEFAULTS, family: 'brick', relief: .9 });
  const at = (x, y) => result.heights[((y + 16) % 16) * 16 + (x + 16) % 16];
  for (const [x, y] of [[0, 0], [15, 15], [0, 8], [8, 0]]) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 16 * .08;
    const dy = (at(x, y + 1) - at(x, y - 1)) * 16 * .08;
    const length = Math.hypot(dx, dy, 1), p = (y * 16 + x) * 4;
    assert.equal(result.channels.normal.data[p], Math.round((-.5 * dx / length + .5) * 255));
    assert.equal(result.channels.normal.data[p + 1], Math.round((-.5 * dy / length + .5) * 255));
  }
});
