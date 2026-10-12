import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOB_BITS, BLOB_MASK_GRID, normalizeBlobMask, blobAtlasPosition, blobMaskAt, buildBlob47} from '../src/shader/retro-autotile.mjs';

const sheetSize = 96;
function put(sheet, x, y, rgba) { sheet.set(rgba, (y * sheetSize + x) * 4); }
function pixel(sheet, x, y) { return [...sheet.subarray((y * sheetSize + x) * 4, (y * sheetSize + x) * 4 + 4)]; }
function fixture() {
  const sheet = new Uint8Array(sheetSize * sheetSize * 4);
  // Base 3x3: opaque cell colors uniquely identify the source cell and pixel.
  for (let cy = 0; cy < 3; cy++) for (let cx = 0; cx < 3; cx++) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    put(sheet, cx * 16 + x, cy * 16 + y, [20 + cx * 50 + x, 20 + cy * 50 + y, 30 + cx + cy, 255]);
  }
  // Overlay template quadrants are opaque and encode their source coordinates.
  for (let cy = 0; cy < 3; cy++) for (let cx = 0; cx < 3; cx++) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    put(sheet, cx * 16 + x, 48 + cy * 16 + y, [30 + cx * 60 + x, 30 + cy * 60 + y, 70 + cx + cy, 255]);
  }
  // Inner and outer atlas quadrants/tiles use disjoint colors.
  for (let cy = 0; cy < 2; cy++) for (let cx = 0; cx < 2; cx++) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    put(sheet, 48 + cx * 16 + x, cy * 16 + y, [120 + cx * 40 + x, 120 + cy * 40 + y, 130 + cx + cy, 255]);
    put(sheet, 48 + cx * 16 + x, 32 + cy * 16 + y, [200 + cx * 20 + x, 200 + cy * 20 + y, 210 + cx + cy, 255]);
  }
  // A transparent outer-atlas texel must reveal the opaque base tile.
  put(sheet, 48, 32, [1, 2, 3, 0]);
  return sheet;
}
function expectedQuadrant(sheet, tile, qx, qy, sx, sy) {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const expected = pixel(sheet, sx + qx * 8 + x, sy + qy * 8 + y);
    const actual = [...tile.data.subarray(((qy * 8 + y) * 16 + qx * 8 + x) * 4, ((qy * 8 + y) * 16 + qx * 8 + x) * 4 + 4)];
    assert.deepEqual(actual, expected);
  }
}

test('normalization covers all 256 raw masks with the 47 legal topology masks', () => {
  const masks = new Set(Array.from({length: 256}, (_, raw) => normalizeBlobMask(raw)));
  assert.equal(masks.size, 47);
  assert.deepEqual(new Set(BLOB_MASK_GRID.flat()), masks);
  for (const invalid of [-1, 256, 1.5, '1', NaN]) assert.throws(() => normalizeBlobMask(invalid));
  assert.deepEqual(blobAtlasPosition(0), {x: 10, y: 1});
  assert.deepEqual(blobAtlasPosition(255), {x: 9, y: 2});
  assert.deepEqual(blobAtlasPosition(2), blobAtlasPosition(0), 'isolated diagonal normalizes away');
});

test('blobMaskAt gates diagonals on both adjacent cardinals and treats outside cells as empty', () => {
  const grid = [[1, 1, 0], [1, 1, 1], [0, 1, 1]];
  assert.equal(blobMaskAt(grid, 1, 1), BLOB_BITS.N | BLOB_BITS.E | BLOB_BITS.S | BLOB_BITS.W | BLOB_BITS.NW | BLOB_BITS.SE);
  assert.equal(blobMaskAt([[1, 0], [0, 1]], 0, 0), 0, 'diagonal-only neighbor is gated out');
  assert.equal(blobMaskAt([[1]], 3, 3), 0);
  for (const bad of [[], [[1], [0, 1]], [[2]]]) assert.throws(() => blobMaskAt(bad, 0, 0));
  assert.throws(() => blobMaskAt([[1]], 0.5, 0));
});

test('builder creates 47 native tiles, canonical alias mapping and atlas copies', () => {
  const sheet = fixture(), built = buildBlob47(sheet);
  assert.equal(built.tiles.length, 47);
  assert.equal(new Set(built.tiles.map(tile => tile.blobMask)).size, 47);
  assert.equal(built.mapping.length, 48);
  assert.deepEqual(built.mapping.filter(item => item.alias), [{mask: 0, x: 0, y: 3, alias: true}]);
  assert.deepEqual(built.tiles.map(tile => [tile.width, tile.height]), Array.from({length: 47}, () => [16, 16]));
  for (const entry of built.mapping) {
    const tile = built.tiles.find(item => item.blobMask === entry.mask);
    for (let y = 0; y < 16; y++) assert.deepEqual(
      built.atlas.data.subarray(((entry.y * 16 + y) * 192 + entry.x * 16) * 4, ((entry.y * 16 + y) * 192 + (entry.x + 1) * 16) * 4),
      tile.data.subarray(y * 16 * 4, (y + 1) * 16 * 4),
    );
  }
  assert.deepEqual(blobAtlasPosition(0), {x: 10, y: 1});
  const zero = built.tiles.find(tile => tile.blobMask === 0);
  for (const alias of built.mapping.filter(item => item.mask === 0)) for (let y = 0; y < 16; y++) {
    assert.deepEqual(built.atlas.data.subarray(((alias.y * 16 + y) * 192 + alias.x * 16) * 4, ((alias.y * 16 + y) * 192 + (alias.x + 1) * 16) * 4), zero.data.subarray(y * 64, (y + 1) * 64));
  }
});

test('quadrant rules select native template/inner atlas pixels and outer masks replace whole tiles', () => {
  const sheet = fixture(), built = buildBlob47(sheet), tile = mask => built.tiles.find(item => item.blobMask === mask);
  // mask 255: all quadrants take their corresponding center cell quadrant.
  const full = tile(255);
  for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) expectedQuadrant(sheet, full, qx, qy, 16, 64);
  // NW inner corner: both cardinals, absent diagonal; atlas orientation is unflipped.
  const innerNW = tile(BLOB_BITS.N | BLOB_BITS.W);
  expectedQuadrant(sheet, innerNW, 0, 0, 48, 0);
  // No cardinals for NW quadrant selects corresponding outer corner cell.
  expectedQuadrant(sheet, tile(0), 0, 0, 0, 48);
  // N absent, W present selects the north edge cell in NW quadrant.
  expectedQuadrant(sheet, tile(BLOB_BITS.W), 0, 0, 16, 48);
  // Four specified convex masks replace the entire tile from matching outer atlas tile.
  for (const [mask, cx, cy] of [[28, 0, 0], [112, 1, 0], [7, 0, 1], [193, 1, 1]]) {
    const output = tile(mask);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const outerPixel = pixel(sheet, 48 + cx * 16 + x, 32 + cy * 16 + y);
      assert.deepEqual([...output.data.subarray((y * 16 + x) * 4, (y * 16 + x) * 4 + 4)], outerPixel[3] ? outerPixel : pixel(sheet, 16 + x, 16 + y));
    }
  }
  assert.deepEqual([...tile(28).data.subarray(0, 4)], pixel(sheet, 16, 16), 'transparent outer pixel clears overlays back to base');
});

test('builder rejects wrong pixel shape, types, alpha and transparent base center', () => {
  assert.throws(() => buildBlob47(new Uint8Array(4)));
  assert.throws(() => buildBlob47(new Uint8ClampedArray(96 * 96 * 4)));
  const fractional = fixture(); fractional[3] = 128; assert.throws(() => buildBlob47(fractional));
  const transparentBase = fixture(); transparentBase[(16 * 96 + 16) * 4 + 3] = 0; assert.throws(() => buildBlob47(transparentBase));
});
