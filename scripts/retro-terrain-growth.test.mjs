import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {RETRO_PALETTES, generateRetroTerrain} from '../src/shader/retro-terrain.mjs';
import {generateRetroGrowth, gravelPathMask, composeRetroGrowth, composeRetroSurfaceVariants, variationSeeds, describeRetroGrowth, validateRetroGrowthRecipe, generateTerrainKit, GROWTH_PALETTES, PATH_SAMPLE, TERRAIN_SAMPLE} from '../src/shader/retro-terrain-growth.mjs';
const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/retro-terrain-v1.json',import.meta.url)));
const digest=data=>createHash('sha256').update(data).digest('hex');
const edge=(data,side)=>Array.from({length:64},(_,i)=>data[side===0?i:side===1?i*64+63:side===2?4032+i:i*64]);
function component(data) {
  const start=data.findIndex(Boolean),seen=new Set(),pending=start<0?[]:[start];
  while(pending.length){const at=pending.pop();if(seen.has(at))continue;seen.add(at);
    const x=at%64,y=Math.floor(at/64);
    for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(nx>=0&&nx<64&&ny>=0&&ny<64&&data[ny*64+nx]&&!seen.has(ny*64+nx))pending.push(ny*64+nx);
  }
  return seen.size;
}
test('growth recipe is separate, bounded and dispatches classic recipes unchanged',()=>{
  assert.deepEqual(validateRetroGrowthRecipe(),{id:'retro-terrain-growth',seed:1204,palette:'original'});
  for(const value of [null,[],{id:'retro-terrain'},{seed:-1},{seed:2**32},{seed:'1204'},{source:'bought.png'}])assert.throws(()=>validateRetroGrowthRecipe(value));
  assert.deepEqual(generateTerrainKit({id:'retro-terrain',seed:1204}),generateRetroTerrain({seed:1204}));
  for(const mask of [-1,16,.5,'3'])assert.throws(()=>gravelPathMask(mask));
  for(const palette of ['bought',[],{},0])assert.throws(()=>validateRetroGrowthRecipe({palette}));
});
test('independent heath and riverbed ramps change colors while preserving every footprint',()=>{
  const original=generateRetroGrowth();
  for(const palette of ['heath','riverbed']){
    const kit=generateRetroGrowth({palette}),allowed=new Set(Object.values(GROWTH_PALETTES[palette]).flat().map(hex=>hex.slice(1)));
    assert.deepEqual(describeRetroGrowth(kit).palettes,GROWTH_PALETTES[palette]);
    for(const family of ['grass','dirt','gravel'])assert.equal(GROWTH_PALETTES[palette][family].length,RETRO_PALETTES[family].length);
    for(let i=0;i<70;i++){
      const tile=kit.tiles[i],base=original.tiles[i];
      for(let at=0;at<tile.data.length;at+=4){
        assert.equal(tile.data[at+3],base.data[at+3]);
        if(tile.data[at+3])assert.ok(allowed.has(Buffer.from(tile.data.subarray(at,at+3)).toString('hex')));
      }
      if(i!==38&&i!==54)assert.notEqual(digest(tile.data),digest(base.data));
      assert.deepEqual(tile.terrainMask,base.terrainMask);
    }
  }
});
for(const expected of baseline.cases){
  test(`growth seed ${expected.seed}: classic preservation, deterministic wear, alpha and native palettes`,()=>{
    const kit=generateRetroGrowth({seed:expected.seed}),again=generateRetroGrowth({seed:expected.seed});
    assert.equal(kit.tiles.length,70);assert.equal(new Set(kit.tiles.map(tile=>tile.id)).size,70);
    const classic=generateRetroTerrain({seed:expected.seed});
    for(const tile of classic.tiles)assert.equal(digest(tile.data),expected.tiles[tile.id]);
    assert.equal(digest(classic.atlas.data),expected.atlas);
    for(let i=0;i<3;i++)assert.notEqual(digest(kit.tiles[i].data),digest(classic.tiles[i].data),'The new drawings must be separately authored');
    for(const [i,tile] of kit.tiles.entries()){
      assert.equal(tile.width,64);assert.equal(tile.height,64);assert.equal(tile.data.length,16384);
      assert.equal(digest(tile.data),digest(again.tiles[i].data));
      const families=tile.family==='grass-dirt'||tile.family==='grass'?['grass','dirt']:tile.family==='gravel'||tile.family==='gravel-path'?['gravel','dirt']:['dirt'];
      const palette=new Set(families.flatMap(f=>RETRO_PALETTES[f]).map(hex=>hex.slice(1)));
      for(let at=0;at<tile.data.length;at+=4){
        if(i>=38){assert.ok(tile.data[at+3]===0||tile.data[at+3]===255);assert.equal(tile.data[at+3]>0,!!tile.terrainMask[at/4]);}
        else assert.equal(tile.data[at+3],255);
        if(!tile.data[at+3])assert.deepEqual([...tile.data.subarray(at,at+3)],[0,0,0]);
        else assert.ok(palette.has(Buffer.from(tile.data.subarray(at,at+3)).toString('hex')));
      }
    }
    for(let i=0;i<19;i++)assert.notEqual(digest(kit.tiles[19+i].data),digest(kit.tiles[i].data));
    for(let mask=0;mask<16;mask++)assert.deepEqual(kit.tiles[22+mask].terrainMask,kit.tiles[3+mask].terrainMask);
    for(let mask=1;mask<16;mask++)assert.notEqual(digest(kit.tiles[38+mask].data),digest(kit.tiles[54+mask].data));
  });
  test(`growth seed ${expected.seed}: every port and bend has one connected footprint`,()=>{
    const masks=Array.from({length:16},(_,mask)=>gravelPathMask(mask,expected.seed).data);
    for(let mask=0;mask<16;mask++){
      assert.equal(component(masks[mask]),masks[mask].reduce((a,b)=>a+b,0));
      for(let side=0;side<4;side++)assert.deepEqual(edge(masks[mask],side),Array.from({length:64},(_,i)=>mask&(1<<side)&&i>=22&&i<=41?1:0));
    }
    for(let a=0;a<16;a++)for(let b=0;b<16;b++){
      if(!!(a&2)===!!(b&8))assert.deepEqual(edge(masks[a],1),edge(masks[b],3));
      if(!!(a&4)===!!(b&1))assert.deepEqual(edge(masks[a],2),edge(masks[b],0));
    }
  });
}
test('growth descriptor maps all four atlases, roles and path alpha explicitly',()=>{
  const kit=generateRetroGrowth(),manifest=describeRetroGrowth(kit);
  assert.equal(manifest.generator,'retro-terrain-growth/1');assert.equal(manifest.visualReview,'unapproved');assert.deepEqual(manifest.provenance.restrictedInputs,[]);
  assert.deepEqual(manifest.pathBits,{N:1,E:2,S:4,W:8});assert.equal(manifest.pathPortWidth,20);
  for(const [atlasIndex,offset] of [3,22,38,54].entries())for(let mask=0;mask<16;mask++){
    const tile=kit.tiles[offset+mask],atlas=kit.atlases[atlasIndex],x=mask%4*64,y=Math.floor(mask/4)*64;
    const mapping=manifest.tiles[offset+mask].atlas;assert.equal(mapping.x,x);assert.equal(mapping.y,y);
    if(atlasIndex>0)assert.equal(mapping.path,atlas.id+'.png');
    for(let row=0;row<64;row++)assert.deepEqual(atlas.data.subarray(((y+row)*256+x)*4,((y+row)*256+x+64)*4),tile.data.subarray(row*256,(row+1)*256));
    if(atlasIndex>=2){assert.equal(manifest.tiles[offset+mask].alpha,'cutout');assert.equal(manifest.tiles[offset+mask].pathMask,mask);assert.equal(manifest.tiles[offset+mask].wrap,'matching-ports');}
  }
});
test('connected patch composites every pixel and rejects incompatible ports',()=>{
  const kit=generateRetroGrowth();
  for(const weathered of [false,true]){
    const patch=composeRetroGrowth(kit,TERRAIN_SAMPLE,PATH_SAMPLE,{weathered});assert.equal(patch.width,256);assert.equal(patch.height,256);
    for(let y=0;y<4;y++)for(let x=0;x<4;x++){
      const mask=TERRAIN_SAMPLE[y][x]+2*TERRAIN_SAMPLE[y][x+1]+4*TERRAIN_SAMPLE[y+1][x+1]+8*TERRAIN_SAMPLE[y+1][x];
      const terrain=kit.tiles[(weathered?22:3)+mask],path=kit.tiles[(weathered?54:38)+PATH_SAMPLE[y][x]];
      for(let py=0;py<64;py++)for(let px=0;px<64;px++){
        const at=(py*64+px)*4,source=path.data[at+3]?path.data:terrain.data;
        assert.deepEqual(patch.data.subarray(((y*64+py)*256+x*64+px)*4,((y*64+py)*256+x*64+px)*4+4),source.subarray(at,at+4));
      }
    }
  }
  assert.throws(()=>composeRetroGrowth(kit,[[0,0,0],[0,0,0]],[[2,0]]),/east\/west/);
  assert.throws(()=>composeRetroGrowth(kit,[[0,0],[0,0],[0,0]],[[4],[0]]),/north\/south/);
  for(const [corners,paths] of [[[],[]],[[[0,1],[1]],[[0]]],[[[0,0],[0,0]],[[16]]],[[[0,0],[0,0]],[]]])assert.throws(()=>composeRetroGrowth(kit,corners,paths));
});
test('multi-seed variation preserves ports, finite colors and reproducible native pixels',()=>{
  const kit=generateRetroGrowth({palette:'heath'}),seeds=variationSeeds(kit.recipe.seed);
  assert.deepEqual(seeds,[1204,1215,1233,1251]);assert.deepEqual(variationSeeds(0xffffffff),[0xffffffff,10,28,46]);
  const base=gravelPathMask(15,seeds[0]);
  for(const seed of seeds)for(let side=0;side<4;side++)assert.deepEqual(edge(gravelPathMask(15,seed).data,side),edge(base.data,side));
  const allowed=new Set(Object.values(GROWTH_PALETTES.heath).flat().map(hex=>hex.slice(1)));
  for(const weathered of [false,true]){
    const options={weathered,variation:true},patch=composeRetroGrowth(kit,TERRAIN_SAMPLE,PATH_SAMPLE,options);
    assert.deepEqual(patch,composeRetroGrowth(kit,TERRAIN_SAMPLE,PATH_SAMPLE,options));
    assert.notEqual(digest(patch.data),digest(composeRetroGrowth(kit,TERRAIN_SAMPLE,PATH_SAMPLE,{weathered}).data));
    for(let at=0;at<patch.data.length;at+=4){assert.equal(patch.data[at+3],255);assert.ok(allowed.has(Buffer.from(patch.data.subarray(at,at+3)).toString('hex')));}
  }
  for(const family of ['dirt','grass','gravel']){
    const patch=composeRetroSurfaceVariants(kit,family);assert.equal(patch.width,256);assert.equal(patch.height,256);
    const cells=new Set();for(let y=0;y<4;y++)for(let x=0;x<4;x++){
      const data=new Uint8Array(16384);for(let row=0;row<64;row++)data.set(patch.data.subarray(((y*64+row)*256+x*64)*4,((y*64+row)*256+x*64+64)*4),row*256);
      cells.add(digest(data));
    }
    assert.equal(cells.size,4,'Variation must actually use four authored seeds');
  }
  assert.throws(()=>composeRetroSurfaceVariants(kit,'metal'));
});
