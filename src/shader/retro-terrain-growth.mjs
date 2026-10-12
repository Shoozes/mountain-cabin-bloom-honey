// Additive original path and wear drawings. The classic generator remains untouched.
import {generateRetroTerrain, retroTransitionMask, validateRetroRecipe, describeRetroTerrain, RETRO_PALETTES, RETRO_SIZE} from './retro-terrain.mjs';
export const RETRO_GROWTH_VERSION = 'retro-terrain-growth/1';
export const GROWTH_PALETTES = Object.freeze({
  original: RETRO_PALETTES,
  heath: {
    grass:['#222a29','#313b2d','#435135','#57633e','#6b7948','#869653','#a3b15f','#c0c777'],
    dirt:['#30202b','#402938','#51333f','#62404a','#735054','#855f5b','#967166','#aa846f','#bd987d','#cfaf91','#debea4','#edd0ba'],
    gravel:['#1d2937','#2b3949','#3b495a','#4b5b6c','#5e6d7d','#73828f','#8995a0','#9ca7ae','#aeb8bc','#bfc9ca','#d0d8d6','#e0e4dc'],
  },
  riverbed: {
    grass:['#102d33','#163d43','#1c5051','#286662','#377b70','#519283','#75aa99','#9fc4ac'],
    dirt:['#352126','#492b2b','#5e3732','#74443a','#8b5543','#a2684d','#b77d59','#ca9369','#dba97c','#e9bf94','#f0d2ad','#f7e4c8'],
    gravel:['#202b3a','#2c3a4e','#3a4c61','#4b6073','#607587','#778c98','#8fa2a8','#a7b6b7','#bfc8c4','#d0d5cc','#e0e1d6','#f0eddf'],
  },
});
export const PATH_BITS = Object.freeze({N:1, E:2, S:4, W:8});
export const PATH_SAMPLE = Object.freeze([[0,4,0,0],[2,15,10,12],[0,5,0,5],[0,3,10,9]]);
export const TERRAIN_SAMPLE = Object.freeze([[0,0,0,1,1],[0,1,1,1,1],[0,1,0,0,1],[1,1,0,0,0],[1,1,1,0,0]]);
const size = RETRO_SIZE, wrap = n => (n % size + size) % size;
const hash = (x,y,seed) => {
  let h=Math.imul(x,0x9e3779b1)^Math.imul(y,0x85ebca77)^seed;
  h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);
  return ((h^(h>>>16))>>>0)/4294967296;
};
const colors = Object.fromEntries(Object.entries(RETRO_PALETTES).map(([family,ramp])=>[family,ramp.map(hex=>[1,3,5].map(at=>parseInt(hex.slice(at,at+2),16)))]));
const paint = (data,at,family,index) => data.set([...colors[family][Math.max(0,Math.min(colors[family].length-1,index))],255],at);
// Editable native drawings: each symbol is a deliberate color role, never a sampled raster.
// The layouts leave quiet ground between marks; seeds move whole authored clusters.
const TUFTS = [
  ['   h   ',' b bb  ',' bbbbl ','  bbs  ','  s    '],
  [' h    ',' bb b ',' bbbb ',' s  bl'],
  ['    h  ','  bbb  ',' bbbbl ',' s     '],
  [' h     ',' bb  b ','  bbbbl','    s  '],
];
const GRAVEL_CLUSTERS = [
  ['  ffhh   ',' fffffbb ',' ffffbbb ',' bbbbsss ',' bss   q ','    qqq  '],
  [' ffff    ',' ffffbss ',' ffbbbss ',' bbbss   ','  ss qq  ','      q  '],
  ['   fff  ','  fffbbs',' ffffbb ',' bbbbss ',' bss q  ','   qq   '],
  ['  ff   ',' ffb qq',' bbs qq',' ss    ','    q  '],
  [' ff    ',' fbb qq',' bss qq','     q '],
  ['  fff  ',' ffbb  ',' bss qq','  s qq '],
];
const SOIL_MARKS = [
  [' ss      ',' bbbbbb  ','    bbb h'],
  ['  s     ',' bbbbb  ','  bbb  h'],
  [' bb  ','  bbh'],
  [' bbbb   ','  bb  h '],
];
const PATH_GRAVEL_LAYOUT = [[2,26,3],[11,34,4],[22,25,5],[34,32,3],[45,27,4],[57,34,5],[26,2,4],[34,12,3],[25,23,5],[32,35,4],[26,46,3],[33,58,5]];
const GRASS_LAYOUT = [[3,7,2],[8,12,0],[14,13,3],[18,9,1],[38,24,1],[42,28,2],[49,29,0],[47,35,3],[16,47,0],[20,52,2],[14,57,1],[30,4,3],[58,45,1]];
const SOIL_LAYOUT = [[10,12,0],[18,15,3],[28,17,2],[40,43,2],[46,46,0],[50,39,3],[33,3,1],[5,54,2]];
const GRAVEL_LAYOUT = [[6,4,0],[38,15,1],[15,38,2],[51,46,0],[31,58,1],[0,3,3],[16,8,4],[25,12,5],[47,0,3],[58,16,5],[7,18,4],[22,23,3],[36,29,5],[47,30,4],[0,32,3],[24,43,4],[61,36,3],[6,50,5],[24,53,3],[42,53,4],[54,59,5],[15,58,3],[50,40,4]];
function cluster(data,family,x,y,rows,roles) {
  for(let py=0;py<rows.length;py++)for(let px=0;px<rows[py].length;px++) {
    const symbol=rows[py][px];if(symbol!==' ')paint(data,(wrap(y+py)*size+wrap(x+px))*4,family,roles[symbol]);
  }
}
function groundPlane(data,family,x,y,rows,tone) {
  for(let row=0;row<rows.length;row++)for(let col=0;col<rows[row][1];col++)paint(data,(wrap(y+row)*size+wrap(x+rows[row][0]+col))*4,family,tone);
}
function curatedSurface(family,seed,weathered=false) {
  const data=new Uint8Array(size*size*4),ox=Math.floor(hash(1,1,seed)*size),oy=Math.floor(hash(2,1,seed)*size);
  for(let at=0;at<data.length;at+=4)paint(data,at,family,{grass:3,dirt:5,gravel:2}[family]);
  if(family==='grass') {
    // Broken root shadows run through colonies instead of outlining oval rims.
    const planes=[[[0,4],[2,9],[5,11],[3,7],[4,3]],[[0,4],[0,5],[3,7],[6,7],[6,4]],[[1,3],[0,5],[2,4],[2,6],[1,4]]];
    for(const [i,[x,y]] of [[4,12],[40,28],[18,53]].entries())groundPlane(data,family,x+ox,y+oy,planes[i],2);
    groundPlane(data,family,12+ox,14+oy,[[0,3],[1,5]],3);
    groundPlane(data,family,45+ox,30+oy,[[0,3],[0,4]],3);
    if(weathered)for(const [x,y] of [[15,18],[44,43],[57,12]])groundPlane(data,'dirt',x+ox,y+oy,[[2,3],[0,6],[0,7],[1,6],[2,3]],5);
    for(const [i,[x,y,shape]] of GRASS_LAYOUT.entries())if(!weathered||![1,5,9].includes(i))cluster(data,family,x+ox,y+oy,TUFTS[shape],{s:2,b:4,l:3,h:!weathered&&[2,5,10].includes(i)?5:4});
  } else if(family==='dirt') {
    const low=[[0,7],[0,14],[3,14],[4,8]];
    groundPlane(data,family,7+ox,12+oy,low,4);
    groundPlane(data,family,38+ox,42+oy,[[0,4],[2,8],[6,7],[8,5]],4);
    groundPlane(data,family,16+ox,15+oy,[[0,4],[2,7]],5);
    groundPlane(data,family,43+ox,44+oy,[[0,4],[2,4]],5);
    groundPlane(data,family,48+ox,47+oy,[[0,2]],6);
    if(weathered)for(const [x,y] of [[4,29],[31,13],[52,51]])groundPlane(data,family,x+ox,y+oy,[[3,5],[1,8],[0,10],[0,11],[2,8],[4,4]],4);
    for(const [i,[x,y,shape]] of SOIL_LAYOUT.entries())if(!weathered||i%4!==1)cluster(data,family,x+ox,y+oy,SOIL_MARKS[shape],{s:!weathered&&i===6?3:4,b:4,h:5});
  } else {
    const planes=[[2,8],[0,12],[0,14],[1,12],[2,10],[4,7]];
    for(const [x,y] of [[4,11],[29,29],[46,51]])groundPlane(data,family,x+ox,y+oy,planes,3);
    if(weathered)for(const [x,y] of [[11,18],[38,34],[49,4]])groundPlane(data,'dirt',x+ox,y+oy,[[2,4],[0,8],[0,9],[2,6],[4,3]],4);
    for(const [i,[x,y,shape]] of GRAVEL_LAYOUT.entries()){
      if(weathered&&[5,12,23].includes(i))continue;
      const tone=weathered?3:4;
      cluster(data,family,x+ox,y+oy,GRAVEL_CLUSTERS[shape],{s:2,b:tone,f:tone+1,h:tone+2,q:Math.max(2,tone-1)});
    }
  }
  return {width:size,height:size,data};
}
function curatedBase(seed) {
  const tiles=['dirt','grass','gravel'].map(family=>({id:family,role:'surface',family,...curatedSurface(family,seed)}));
  for(let cornerMask=0;cornerMask<16;cornerMask++) {
    const terrainMask=retroTransitionMask(cornerMask,seed),data=new Uint8Array(size*size*4);
    for(let at=0;at<terrainMask.length;at++)data.set(tiles[terrainMask[at]].data.subarray(at*4,at*4+4),at*4);
    tiles.push({id:'grass-dirt-'+cornerMask,role:'transition',family:'grass-dirt',cornerMask,terrainMask,width:size,height:size,data});
  }
  return {recipe:{id:'retro-terrain',seed},tiles};
}
function weatheredSurface(tile,kit) {
  const {data}=curatedSurface(tile.family,kit.recipe.seed,true);
  return {...tile,id:'weathered-'+tile.id,variant:'weathered',sourceTile:tile.id,data};
}
function segmentDistance(x,y,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1],denominator=dx*dx+dy*dy;
  const t=denominator?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/denominator)):0;
  return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
}
function shoulderLobe(x,y) {
  // Authored asymmetric cuts and bulges inside the tile; mouths stay fixed.
  let result=0;
  for(const [cx,cy,rx,ry,amount] of [[23,13,7,9,-3],[40,25,8,7,2],[25,43,6,9,-2.5],[47,48,9,6,2]]) {
    result+=Math.max(0,1-Math.max(Math.abs(x-cx)/rx,Math.abs(y-cy)/ry))*amount;
  }
  return result;
}
function centerline(mask) {
  const c=(size-1)/2,r=14,segments=[],ports=[[c,0],[size-1,c],[c,size-1],[0,c]];
  const corner={3:[c+r,c-r,Math.PI,Math.PI/2],6:[c+r,c+r,-Math.PI/2,-Math.PI],12:[c-r,c+r,0,-Math.PI/2],9:[c-r,c-r,Math.PI/2,0]}[mask];
  if(corner) {
    const [cx,cy,start,end]=corner;
    const points=Array.from({length:17},(_,i)=>{const angle=start+(end-start)*i/16;return [cx+Math.cos(angle)*r,cy+Math.sin(angle)*r];});
    const active=ports.filter((_port,i)=>mask&(1<<i));
    for(const port of active) {
      const nearest=[points[0],points.at(-1)].sort((a,b)=>Math.hypot(a[0]-port[0],a[1]-port[1])-Math.hypot(b[0]-port[0],b[1]-port[1]))[0];
      segments.push([port,nearest]);
    }
    for(let i=1;i<points.length;i++)segments.push([points[i-1],points[i]]);
  } else for(let i=0;i<ports.length;i++)if(mask&(1<<i))segments.push([ports[i],[c,c]]);
  return segments;
}
export function gravelPathMask(mask,seed=1204) {
  if(!Number.isInteger(mask)||mask<0||mask>15)throw Error('Invalid gravel path mask');
  validateRetroRecipe({seed});
  const segments=centerline(mask),data=new Uint8Array(size*size),distances=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const at=y*size+x;
    const distance=Math.min(...segments.map(([a,b])=>segmentDistance(x,y,a,b)));
    const taper=Math.sin(x/(size-1)*Math.PI)*Math.sin(y/(size-1)*Math.PI);
    const shoulder=(hash(Math.floor(x/2),Math.floor(y/2),seed+503)-.5)*2.4*taper;
    distances[at]=distance;data[at]=distance<=10-2.25*taper+shoulder+shoulderLobe(x,y)*taper?1:0;
  }
  // Rough shoulders can leave tiny detached pixels. Retain the port-connected drawing.
  if(mask) {
    const starts=[31,31*size+63,63*size+31,31*size];
    const first=[1,2,4,8].findIndex(bit=>mask&bit),seen=new Uint8Array(data.length),pending=[starts[first]];
    while(pending.length) {
      const at=pending.pop();if(seen[at]||!data[at])continue;seen[at]=1;
      const x=at%size,y=Math.floor(at/size);
      if(x>0)pending.push(at-1);if(x<size-1)pending.push(at+1);
      if(y>0)pending.push(at-size);if(y<size-1)pending.push(at+size);
    }
    data.set(seen);
  }
  return {data,distances};
}
function pathTile(mask,kit,weathered=false) {
  const profile=gravelPathMask(mask,kit.recipe.seed),data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const pixel=y*size+x,at=pixel*4;if(!profile.data[pixel])continue;
    const compressedEdge=profile.distances[pixel]>4.5&&Math.abs(shoulderLobe(x,y))>.7;
    paint(data,at,'dirt',(weathered?4:5)-(compressedEdge?1:0));
  }
  const candidates=PATH_GRAVEL_LAYOUT.map(([x,y,shape])=>[x,y,GRAVEL_CLUSTERS[shape]]);
  const painted=new Uint8Array(size*size);
  for(const [i,[x,y,rows]] of candidates.entries()) {
    if(weathered&&i%4===2)continue;
    const pixels=[];
    for(let py=0;py<rows.length;py++)for(let px=0;px<rows[py].length;px++)if(rows[py][px]!==' ')pixels.push([wrap(x+px),wrap(y+py),rows[py][px]]);
    // Fit complete stone drawings within the shoulder; do not chop them into noise.
    if(pixels.some(([px,py])=>!profile.data[py*size+px]||profile.distances[py*size+px]>8.5||painted[py*size+px]))continue;
    const tone=weathered?3:4,roles={s:2,b:tone,f:tone+1,h:tone+2,q:Math.max(2,tone-1)};
    for(const [px,py,symbol] of pixels){paint(data,(py*size+px)*4,'gravel',roles[symbol]);painted[py*size+px]=1;}
  }
  return {id:(weathered?'weathered-':'')+'gravel-path-'+mask,role:'path-overlay',family:'gravel-path',pathMask:mask,variant:weathered?'weathered':'base',width:size,height:size,data,terrainMask:profile.data};
}
function atlasFor(id,tiles) {
  const data=new Uint8Array(size*size*16*4),width=size*4;
  for(let i=0;i<16;i++)for(let row=0;row<size;row++)data.set(tiles[i].data.subarray(row*size*4,(row+1)*size*4),((Math.floor(i/4)*size+row)*width+i%4*size)*4);
  return {id,width,height:width,data};
}
export function validateRetroGrowthRecipe(input={}) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['id','seed','palette'].includes(key)))throw Error('Expected a retro terrain growth recipe with id, seed and palette');
  if(input.id!==undefined&&input.id!=='retro-terrain-growth')throw Error('Unknown retro terrain growth recipe');
  const palette=input.palette??'original';
  if(typeof palette!=='string'||!Object.hasOwn(GROWTH_PALETTES,palette))throw Error('Unknown retro terrain palette');
  return {id:'retro-terrain-growth',seed:validateRetroRecipe({seed:input.seed??1204}).seed,palette};
}
function recolor(tiles,palette) {
  if(palette==='original')return tiles;
  const mapping=new Map();
  for(const family of ['grass','dirt','gravel'])for(let i=0;i<RETRO_PALETTES[family].length;i++){
    mapping.set(parseInt(RETRO_PALETTES[family][i].slice(1),16),[1,3,5].map(at=>parseInt(GROWTH_PALETTES[palette][family][i].slice(at,at+2),16)));
  }
  return tiles.map(tile=>{
    const data=tile.data.slice();
    for(let at=0;at<data.length;at+=4)if(data[at+3])data.set(mapping.get(data[at]*65536+data[at+1]*256+data[at+2]),at);
    return {...tile,data};
  });
}
export function generateRetroGrowth(input={}) {
  const recipe=validateRetroGrowthRecipe(input),base=curatedBase(recipe.seed);
  const worn=base.tiles.slice(0,3).map(tile=>weatheredSurface(tile,base));
  for(const tile of base.tiles.slice(3)) {
    const data=new Uint8Array(tile.data.length);
    for(let at=0;at<tile.terrainMask.length;at++)data.set(worn[tile.terrainMask[at]].data.subarray(at*4,at*4+4),at*4);
    worn.push({...tile,id:'weathered-'+tile.id,variant:'weathered',sourceTile:tile.id,data});
  }
  const paths=Array.from({length:16},(_,mask)=>pathTile(mask,base));
  const wornPaths=Array.from({length:16},(_,mask)=>pathTile(mask,base,true));
  const tiles=recolor([...base.tiles,...worn,...paths,...wornPaths],recipe.palette);
  const atlases=[atlasFor('grass-dirt-atlas',tiles.slice(3,19)),atlasFor('weathered-grass-dirt-atlas',tiles.slice(22,38)),atlasFor('gravel-path-atlas',tiles.slice(38,54)),atlasFor('weathered-gravel-path-atlas',tiles.slice(54,70))];
  return {recipe,tiles,atlas:atlases[0],atlases};
}
export function describeRetroGrowth(kit) {
  const classic=describeRetroTerrain(kit),atlases=kit.atlases.map(({id,width,height})=>({path:id+'.png',width,height,columns:4,rows:4}));
  return {...classic,generator:RETRO_GROWTH_VERSION,baseGenerator:'retro-terrain/1',recipe:kit.recipe,palettes:GROWTH_PALETTES[kit.recipe.palette],paletteName:kit.recipe.palette,pathBits:PATH_BITS,pathPortWidth:20,pathLayer:'Hard-alpha cutout; composite over any compatible base terrain',
    tiles:kit.tiles.map((tile,index)=>{
      const original=classic.tiles[index];
      if(index<19)return original;
      const isPath=tile.role==='path-overlay',atlas=isPath?(tile.variant==='weathered'?atlases[3]:atlases[2]):tile.cornerMask===undefined?null:atlases[1];
      const mask=isPath?tile.pathMask:tile.cornerMask;
      return {...original,variant:tile.variant,...(tile.sourceTile?{sourceTile:tile.sourceTile}:{}),alpha:isPath?'cutout':'opaque',wrap:isPath?'matching-ports':original.wrap,
        ...(isPath?{pathMask:tile.pathMask}:{}),...(atlas?{atlas:{path:atlas.path,x:mask%4*size,y:Math.floor(mask/4)*size}}:{})};
    }),atlases,drawing:'Editable native symbol maps, stepped ground planes and curated cluster layouts; original recipe preserved separately',weathering:'Whole tufts and stones removed, compacted soil planes and dirt-filled gaps; independently authored palettes',
    variation:{method:'Phase-offset diagnostic from one curated board; not independent authored layout variants',seeds:variationSeeds(kit.recipe.seed),boundary:'Corner states and path mouths remain compatible across seeds; choose the matching topology per cell'}};
}
export const variationSeeds = seed => [seed,(seed+11)>>>0,(seed+29)>>>0,(seed+47)>>>0];
function variantsFor(kit) {return variationSeeds(kit.recipe.seed).map((seed,index)=>index?generateRetroGrowth({...kit.recipe,seed}):kit);}
const variantAt=(kit,x,y)=>Math.floor(hash(x,y,kit.recipe.seed+601)*4);
export function composeRetroSurfaceVariants(kit,family,{weathered=false}={}) {
  const index=['dirt','grass','gravel'].indexOf(family);if(index<0)throw Error('Unknown terrain surface family');
  const variants=variantsFor(kit),width=size*4,data=new Uint8Array(width*width*4);
  for(let y=0;y<4;y++)for(let x=0;x<4;x++) {
    const tile=variants[variantAt(kit,x,y)].tiles[(weathered?19:0)+index];
    for(let row=0;row<size;row++)data.set(tile.data.subarray(row*size*4,(row+1)*size*4),((y*size+row)*width+x*size)*4);
  }
  return {width,height:width,data};
}
export function composeRetroGrowth(kit,corners,paths,{weathered=false,variation=false}={}) {
  if(!Array.isArray(corners)||corners.length<2||corners.length>17||!Array.isArray(corners[0])||corners[0].length<2||corners[0].length>17||corners.some(row=>!Array.isArray(row)||row.length!==corners[0].length||row.some(value=>value!==0&&value!==1)))throw Error('Expected a rectangular 0/1 corner grid, 2–17 corners per side');
  const rows=corners.length-1,columns=corners[0].length-1;
  if(!Array.isArray(paths)||paths.length!==rows||paths.some(row=>!Array.isArray(row)||row.length!==columns||row.some(mask=>!Number.isInteger(mask)||mask<0||mask>15)))throw Error('Path grid must match terrain tile dimensions with masks 0–15');
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++) {
    if(x+1<columns&&!!(paths[y][x]&2)!==!!(paths[y][x+1]&8))throw Error('Mismatched east/west path ports');
    if(y+1<rows&&!!(paths[y][x]&4)!==!!(paths[y+1][x]&1))throw Error('Mismatched north/south path ports');
  }
  const width=columns*size,height=rows*size,data=new Uint8Array(width*height*4);
  const variants=variation?variantsFor(kit):[kit];
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++) {
    const mask=corners[y][x]+corners[y][x+1]*2+corners[y+1][x+1]*4+corners[y+1][x]*8;
    const selected=variants[variation?variantAt(kit,x,y):0];
    const terrain=selected.tiles[(weathered?19:0)+3+mask],path=selected.tiles[(weathered?54:38)+paths[y][x]];
    for(let py=0;py<size;py++)for(let px=0;px<size;px++) {
      const at=(py*size+px)*4,source=path.data[at+3]?path.data:terrain.data;
      data.set(source.subarray(at,at+4),((y*size+py)*width+x*size+px)*4);
    }
  }
  return {width,height,data};
}
export function validateTerrainKitRecipe(input={}) {return input?.id==='retro-terrain'?validateRetroRecipe(input):validateRetroGrowthRecipe(input);}
export function generateTerrainKit(input={}) {return input?.id==='retro-terrain'?generateRetroTerrain(input):generateRetroGrowth(input);}
export function describeTerrainKit(kit) {return kit.recipe.id==='retro-terrain'?describeRetroTerrain(kit):describeRetroGrowth(kit);}
