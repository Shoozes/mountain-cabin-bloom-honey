import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {generateRetroGrowth,composeRetroGrowth,composeRetroSurfaceVariants,TERRAIN_SAMPLE,PATH_SAMPLE} from '../../../../src/shader/retro-terrain-growth.mjs';
import {encodeMaterialPng} from '../../../../scripts/material-png.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function reviewImages(){
  const kits=[1204,1215,1233].map(seed=>generateRetroGrowth({seed,palette:'heath'}));
  const images=new Map(kits[0].tiles.slice(19,22).map(tile=>[tile.id+'.png',tile]));
  const native={width:192,height:128,data:new Uint8Array(192*128*4)};
  for(let row=0;row<2;row++)for(let family=0;family<3;family++)for(let y=0;y<64;y++){
    const tile=kits[0].tiles[row*19+family];
    native.data.set(tile.data.subarray(y*256,(y+1)*256),((row*64+y)*192+family*64)*4);
  }
  images.set('curated-surfaces.png',native);
  images.set('gravel-path-atlas.png',kits[0].atlases[2]);
  images.set('connected-paths.png',composeRetroGrowth(kits[0],TERRAIN_SAMPLE,PATH_SAMPLE));
  images.set('weathered-paths.png',composeRetroGrowth(kits[0],TERRAIN_SAMPLE,PATH_SAMPLE,{weathered:true}));
  images.set('varied-weathered-paths.png',composeRetroGrowth(kits[0],TERRAIN_SAMPLE,PATH_SAMPLE,{weathered:true,variation:true}));
  const variants={width:192,height:192,data:new Uint8Array(192*192*4)};
  const repeats={width:768,height:512,data:new Uint8Array(768*512*4)};
  for(let seed=0;seed<3;seed++)for(let family=0;family<3;family++)for(let y=0;y<64;y++){
    const tile=kits[seed].tiles[19+family];
    variants.data.set(tile.data.subarray(y*256,(y+1)*256),((seed*64+y)*192+family*64)*4);
  }
  for(let variant=0;variant<2;variant++)for(let family=0;family<3;family++)for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const at=((y%64)*64+x%64)*4,tile=kits[0].tiles[variant*19+family];
    repeats.data.set(tile.data.subarray(at,at+4),((variant*256+y)*768+family*256+x)*4);
  }
  images.set('weathered-seeds.png',variants);images.set('surface-repeats.png',repeats);
  const varied={width:768,height:256,data:new Uint8Array(768*256*4)},riverbed={width:192,height:64,data:new Uint8Array(192*64*4)};
  const riverKit=generateRetroGrowth({palette:'riverbed'});
  for(const [i,family] of ['dirt','grass','gravel'].entries()){
    const patch=composeRetroSurfaceVariants(kits[0],family),tile=riverKit.tiles[19+i];
    for(let y=0;y<256;y++)varied.data.set(patch.data.subarray(y*256*4,(y+1)*256*4),(y*768+i*256)*4);
    for(let y=0;y<64;y++)riverbed.data.set(tile.data.subarray(y*256,(y+1)*256),((y*192+i*64)*4));
  }
  images.set('varied-surfaces.png',varied);images.set('riverbed-colors.png',riverbed);
  return images;
}
async function verify(){
  const index=JSON.parse(await fs.readFile(path.join(here,'study.json'),'utf8'));
  assert.equal(index.visualReview,'unapproved');assert.deepEqual(index.restrictedInputs,[]);
  for(const source of index.sources){
    const text=(await fs.readFile(path.join(root,source.path),'utf8')).replaceAll('\r\n','\n');
    assert.equal(hash(text),source.sha256,'Source changed: '+source.path);
  }
  const expected=reviewImages();assert.equal(expected.size,index.files.length);
  for(const file of index.files){
    const bytes=await fs.readFile(path.join(here,file.path));assert.equal(bytes.length,file.bytes);assert.equal(hash(bytes),file.sha256);
    assert.deepEqual(bytes,encodeMaterialPng(expected.get(file.path)),file.path+' differs from source');
  }
  console.log(JSON.stringify({status:'passed',originalReviewImages:expected.size,seeds:[1204,1215,1233],artwork:'unapproved'}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await verify();
