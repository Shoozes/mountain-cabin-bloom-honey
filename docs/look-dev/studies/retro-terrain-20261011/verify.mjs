import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {generateRetroTerrain, composeRetroTerrain} from '../../../../src/shader/retro-terrain.mjs';
import {encodeMaterialPng} from '../../../../scripts/material-png.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function reviewImages() {
  const kits = [1204, 1215, 1233].map(seed => generateRetroTerrain({seed}));
  const images = new Map(kits[0].tiles.slice(0,3).map(tile => [tile.id + '.png', tile]));
  images.set('grass-dirt-atlas.png', kits[0].atlas);
  images.set('connected-patch.png', composeRetroTerrain(kits[0], [[0,0,0,1,1],[0,1,1,1,1],[0,1,0,0,1],[1,1,0,0,0],[1,1,1,0,0]]));
  const variants = {width:192,height:192,data:new Uint8Array(192*192*4)};
  const repeats = {width:768,height:256,data:new Uint8Array(768*256*4)};
  for (let seed=0;seed<3;seed++) for(let family=0;family<3;family++) {
    const tile=kits[seed].tiles[family];
    for(let y=0;y<64;y++) variants.data.set(tile.data.subarray(y*64*4,(y+1)*64*4),((seed*64+y)*192+family*64)*4);
  }
  for(let family=0;family<3;family++)for(let y=0;y<256;y++)for(let x=0;x<256;x++) {
    const at=((y%64)*64+x%64)*4;
    repeats.data.set(kits[0].tiles[family].data.subarray(at,at+4),(y*768+family*256+x)*4);
  }
  images.set('seed-variants.png', variants); images.set('surface-repeats.png', repeats);
  return images;
}
async function verify() {
  const index=JSON.parse(await fs.readFile(path.join(here,'study.json'),'utf8'));
  assert.equal(index.visualReview,'unapproved');
  for(const source of index.sources) {
    const content=(await fs.readFile(path.join(root,source.path),'utf8')).replaceAll('\r\n','\n');
    assert.equal(hash(content),source.sha256,'Source snapshot changed: '+source.path);
  }
  const expected=reviewImages();
  assert.equal(index.files.length,expected.size);
  for(const file of index.files) {
    const bytes=await fs.readFile(path.join(here,file.path));
    assert.equal(bytes.length,file.bytes);assert.equal(hash(bytes),file.sha256);
    assert.deepEqual(bytes,encodeMaterialPng(expected.get(file.path)),file.path+' differs from authoring source');
  }
  console.log(JSON.stringify({status:'passed',originalReviewImages:expected.size,seeds:[1204,1215,1233],artwork:'unapproved'}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await verify();
