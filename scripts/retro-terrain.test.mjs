import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {generateRetroTerrain, retroTransitionMask, describeRetroTerrain, composeRetroTerrain, validateRetroRecipe, RETRO_PALETTES} from '../src/shader/retro-terrain.mjs';
const digest = data => createHash('sha256').update(data).digest('hex');
const edge = (mask, side) => Array.from({length: 64}, (_, i) => mask[side === 'left' ? i * 64 : side === 'right' ? i * 64 + 63 : side === 'top' ? i : 63 * 64 + i]);
function connected(mask, from, to) {
  const seen = new Set([from]), pending = [from];
  while (pending.length) {
    const at = pending.pop();
    if (at === to) return true;
    const x = at % 64, y = Math.floor(at / 64);
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      const next = ny * 64 + nx;
      if (nx >= 0 && nx < 64 && ny >= 0 && ny < 64 && mask[next] && !seen.has(next)) {seen.add(next); pending.push(next);}
    }
  }
  return false;
}
test('retro recipe rejects ambiguous inputs and remains separate from material recipes', () => {
  assert.deepEqual(validateRetroRecipe(), {id: 'retro-terrain', seed: 1204});
  for (const value of [null, [], {id: 'style-surface'}, {seed: -1}, {seed: 1.5}, {seed: 2**32}, {seed: '1204'}, {size: 128}, {source: 'texture.png'}]) assert.throws(() => validateRetroRecipe(value));
  for (const value of [-1, 16, 1.5, '1']) assert.throws(() => retroTransitionMask(value));
});
for (const seed of [1204, 1215, 1233]) {
  test(`seed ${seed}: native palette, opacity, deterministic drawing and atlas contract`, () => {
    const kit = generateRetroTerrain({seed}), again = generateRetroTerrain({seed});
    assert.equal(kit.tiles.length, 19);
    assert.equal(new Set(kit.tiles.map(tile => tile.id)).size, 19);
    for (const [index, tile] of kit.tiles.entries()) {
      assert.equal(tile.width, 64); assert.equal(tile.height, 64); assert.equal(tile.data.length, 64 * 64 * 4);
      assert.equal(digest(tile.data), digest(again.tiles[index].data));
      for (let at = 3; at < tile.data.length; at += 4) assert.equal(tile.data[at], 255);
      const palette = new Set((index < 3 ? RETRO_PALETTES[tile.family] : [...RETRO_PALETTES.dirt, ...RETRO_PALETTES.grass]).map(hex => hex.slice(1)));
      const colors = new Set();
      for (let at = 0; at < tile.data.length; at += 4) {
        const color = [...tile.data.subarray(at, at + 3)].map(value => value.toString(16).padStart(2,'0')).join('');
        assert.ok(palette.has(color)); colors.add(color);
      }
      assert.ok(colors.size <= (index < 3 ? {grass:8, dirt:12, gravel:12}[tile.family] : 20));
      if (index < 3) assert.ok(colors.size >= 4, 'Surface needs material clusters');
    }
    assert.deepEqual(kit.tiles[3].data, kit.tiles[0].data);
    assert.deepEqual(kit.tiles[18].data, kit.tiles[1].data);
    const manifest = describeRetroTerrain(kit);
    assert.equal(manifest.visualReview, 'unapproved'); assert.deepEqual(manifest.provenance.restrictedInputs, []); assert.equal(manifest.provenance.training, false);
    assert.deepEqual(manifest.cornerBits, {NW:1,NE:2,SE:4,SW:8});
    for (let mask = 0; mask < 16; mask++) {
      const tile = kit.tiles[3 + mask], x = mask % 4 * 64, y = Math.floor(mask / 4) * 64;
      assert.equal(tile.cornerMask, mask); assert.deepEqual(manifest.tiles[3 + mask].atlas, {x,y});
      for (let row = 0; row < 64; row++) assert.deepEqual(kit.atlas.data.subarray(((y+row)*256+x)*4,((y+row)*256+x+64)*4),tile.data.subarray(row*64*4,(row+1)*64*4));
    }
  });
  test(`seed ${seed}: all legal adjacencies share profiles and diagonal grass stays separate`, () => {
    const masks = Array.from({length:16},(_,mask)=>retroTransitionMask(mask,seed));
    for (let a=0;a<16;a++) for(let b=0;b<16;b++) {
      if (!!(a&2)===!!(b&1) && !!(a&4)===!!(b&8)) assert.deepEqual(edge(masks[a],'right'),edge(masks[b],'left'));
      if (!!(a&8)===!!(b&1) && !!(a&4)===!!(b&2)) assert.deepEqual(edge(masks[a],'bottom'),edge(masks[b],'top'));
    }
    assert.equal(connected(masks[5],0,4095),false);
    assert.equal(connected(masks[10],63,4032),false);
    assert.equal(masks[0].some(Boolean),false); assert.equal(masks[15].every(Boolean),true);
  });
}
test('seeds change original surfaces; connected patch uses declared tile cases', () => {
  const a=generateRetroTerrain({seed:1204}),b=generateRetroTerrain({seed:1215});
  for(let i=0;i<3;i++)assert.notEqual(digest(a.tiles[i].data),digest(b.tiles[i].data));
  const patch=composeRetroTerrain(a,[[0,1,0],[1,0,1]]);
  assert.equal(patch.width,128);assert.equal(patch.height,64);
  for(let row=0;row<64;row++){
    assert.deepEqual(patch.data.subarray(row*128*4,(row*128+64)*4),a.tiles[3+10].data.subarray(row*64*4,(row+1)*64*4));
    assert.deepEqual(patch.data.subarray((row*128+64)*4,(row+1)*128*4),a.tiles[3+5].data.subarray(row*64*4,(row+1)*64*4));
  }
  for(const input of [[],[[0,1]],[[0,2],[1,0]],[[0,1],[1]],Array.from({length:18},()=>[0,1])])assert.throws(()=>composeRetroTerrain(a,input));
});
