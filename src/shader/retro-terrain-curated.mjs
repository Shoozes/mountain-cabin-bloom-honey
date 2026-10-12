import {artRows, CURATED_DRAWINGS, CURATED_PALETTES} from './retro-terrain-art.mjs';
import {BLOB_BITS, BLOB_MASK_GRID, blobMaskAt, blobAtlasPosition, buildBlob47} from './retro-autotile.mjs';
import {gravelPathMask} from './retro-terrain-growth.mjs';

export const CURATED_VERSION = 'retro-terrain-curated/1';
export const CURATED_PATH_BITS = {N:1,E:2,S:4,W:8};
export const CURATED_SCENE = [
  [0,0,0,0,0,0,0,0], [0,1,1,1,0,1,0,0], [0,1,0,1,1,1,0,0],
  [0,1,1,1,0,1,1,0], [0,0,0,1,0,1,0,0], [0,1,1,1,1,1,0,0],
  [0,1,0,0,0,0,1,0], [0,0,0,0,0,0,0,0],
];
export const CURATED_PATH_SCENE = [
  [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,2,10,10,12,0,0,0],
  [0,0,0,0,5,0,0,0], [0,0,2,10,15,10,12,0], [0,0,0,0,5,0,1,0],
  [0,0,0,0,1,0,0,0], [0,0,0,0,0,0,0,0],
];
const families=['dirt','grass','gravel'];
export function validateCuratedRecipe(input={}) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['id','tileSize','seed','palette'].includes(k)))throw Error('Expected a curated terrain recipe');
  const recipe={id:'retro-terrain-curated',tileSize:16,seed:1204,palette:'woodland',...input};
  if(recipe.id!=='retro-terrain-curated'||![16,64].includes(recipe.tileSize)||!Number.isInteger(recipe.seed)||recipe.seed<0||recipe.seed>0xffffffff||typeof recipe.palette!=='string'||!Object.hasOwn(CURATED_PALETTES,recipe.palette))throw Error('Invalid curated terrain size, seed or palette');
  return recipe;
}
const pixel=(size,data=new Uint8Array(size*size*4))=>({width:size,height:size,data});
const rgb=hex=>[1,3,5].map(at=>parseInt(hex.slice(at,at+2),16));
const colorsFor=recipe=>Object.fromEntries(families.map(f=>[f,CURATED_PALETTES[recipe.palette][f].map(rgb)]));
function surface(recipe,family,composition,weathered) {
  const n=recipe.tileSize,rows=artRows(n,family,composition,weathered),colors=colorsFor(recipe)[family],out=pixel(n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)out.data.set([...colors[Number(rows[y][x])],255],(y*n+x)*4);
  return {...out,ground:colors[0]};
}
function stamp(dest,source,x,y) {
  for(let row=0;row<source.height;row++)dest.data.set(source.data.subarray(row*source.width*4,(row+1)*source.width*4),((y+row)*dest.width+x)*4);
}
function atlas(id,tiles,columns,rows) {
  const n=tiles[0].width,out={id,width:columns*n,height:rows*n,data:new Uint8Array(columns*rows*n*n*4)};
  tiles.forEach((tile,i)=>stamp(out,tile,i%columns*n,Math.floor(i/columns)*n));return out;
}
// Five native quadrant silhouettes, authored as integer pixel runs. Inward
// distances 0..7 are measured from the cell corner, never scaled raster data.
function quadrantInside(state,u,v) {
  if(state==='full')return true;
  if(state==='horizontal')return v>=4;
  if(state==='vertical')return u>=4;
  if(state==='outer')return u>=4&&v>=4&&u+v>=9;
  return u>=4||v>=4||u+v>=6;
}
function footprint(states) {
  const mask=new Uint8Array(256);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++) {
    const qx=x>=8?1:0,qy=y>=8?1:0,u=qx?15-x:x,v=qy?15-y:y;
    mask[y*16+x]=Number(quadrantInside(states[qy*2+qx],u,v));
  }
  return mask;
}
// Authored 64px corner runs: one broad turn, with quiet straight shoulders.
// The half-edge ports match across tiles without borrowing classic noise.
const cornerRuns = [32,32,32,32,31,31,31,30,30,29,29,28,28,27,26,25,24,23,22,21,20,19,18,17,16,14,13,11,9,7,4,1];
function cornerFootprint(mask) {
  const data=new Uint8Array(64*64),bits=[1,2,4,8],count=bits.filter(bit=>mask&bit).length;
  const corner=(bit,x,y)=>{const u=bit===2||bit===4?63-x:x,v=bit===4||bit===8?63-y:y;return v<32&&u<cornerRuns[v];};
  for(let y=0;y<64;y++)for(let x=0;x<64;x++) {
    let inside;
    if(mask===0||mask===15)inside=mask===15;
    else if(mask===3||mask===12)inside=mask===3?y<32:y>=32;
    else if(mask===9||mask===6)inside=mask===9?x<32:x>=32;
    else if(count===3)inside=!corner(bits.find(bit=>!(mask&bit)),x,y);
    else inside=bits.some(bit=>(mask&bit)&&corner(bit,x,y));
    data[y*64+x]=Number(inside);
  }
  return data;
}
function decorativeClusters(material) {
  const n=material.width,ground=material.ground,seen=new Set(),clusters=[];
  const marked=i=>material.data.subarray(i*4,i*4+3).some((v,c)=>v!==ground[c]);
  for(let start=0;start<n*n;start++)if(!seen.has(start)&&marked(start)) {
    const pending=[start],group=[];seen.add(start);
    while(pending.length){const i=pending.pop(),x=i%n,y=Math.floor(i/n);group.push(i);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy,j=ny*n+nx;if(nx>=0&&nx<n&&ny>=0&&ny<n&&!seen.has(j)&&marked(j)){seen.add(j);pending.push(j);}}}
    clusters.push(group);
  }
  return {ground,clusters};
}
function maskedMaterial(material,mask) {
  const data=new Uint8Array(material.data.length);
  const {ground,clusters}=decorativeClusters(material);
  for(let i=0;i<mask.length;i++)if(mask[i])data.set([...ground,255],i*4);
  // Keep a complete leaf/soil/stone group, or omit it. A silhouette never
  // slices a decorative face into stray tips or half stones.
  for(const group of clusters)if(group.every(i=>mask[i]))for(const i of group)data.set(material.data.subarray(i*4,i*4+4),i*4);
  return {...material,data};
}
function sourceSheet(recipe,family,weathered) {
  const ground=surface(recipe,'dirt',0,weathered),material=surface(recipe,family,0,weathered),sheet={id:(weathered?'weathered-':'')+family+'-grout-source',width:96,height:96,data:new Uint8Array(96*96*4)};
  for(let y=0;y<3;y++)for(let x=0;x<3;x++) {
    stamp(sheet,ground,x*16,y*16);
    const states=[];
    for(let qy=0;qy<2;qy++)for(let qx=0;qx<2;qx++) {
      const absentX=qx===0?x===0:x===2,absentY=qy===0?y===0:y===2;
      states.push(absentX&&absentY?'outer':absentX?'vertical':absentY?'horizontal':'full');
    }
    stamp(sheet,maskedMaterial(material,footprint(states)),x*16,48+y*16);
  }
  for(let cy=0;cy<2;cy++)for(let cx=0;cx<2;cx++) {
    const inner=['full','full','full','full'];inner[cy*2+cx]='inner';
    stamp(sheet,maskedMaterial(material,footprint(inner)),48+cx*16,cy*16);
    // Whole convex tile with the two outward edges absent.
    const states=[];for(let qy=0;qy<2;qy++)for(let qx=0;qx<2;qx++)states.push(qx===cx&&qy===cy?'outer':qx===cx?'vertical':qy===cy?'horizontal':'full');
    stamp(sheet,maskedMaterial(material,footprint(states)),48+cx*16,32+cy*16);
  }
  return sheet;
}
export function curatedPathMask(mask,size,seed=1204) {
  if(!Number.isInteger(mask)||mask<0||mask>15||![16,64].includes(size))throw Error('Invalid curated path mask or size');
  if(size===64)return gravelPathMask(mask,seed).data;
  const data=new Uint8Array(256);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++) {
    data[y*16+x]=Number(Boolean(mask)&&((x>=5&&x<=10&&y>=5&&y<=10)||Boolean(mask&1)&&x>=5&&x<=10&&y<5||Boolean(mask&2)&&y>=5&&y<=10&&x>10||Boolean(mask&4)&&x>=5&&x<=10&&y>10||Boolean(mask&8)&&y>=5&&y<=10&&x<5));
  }
  return data;
}
function pathTile(recipe,mask,weathered) {
  const n=recipe.tileSize,coverage=curatedPathMask(mask,n,recipe.seed),ground=surface(recipe,'dirt',0,weathered),stones=surface(recipe,'gravel',0,weathered),data=new Uint8Array(n*n*4);
  const gravel=colorsFor(recipe).gravel,{clusters}=decorativeClusters(stones);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(coverage[y*n+x]) {
    const at=(y*n+x)*4;data.set(ground.data.subarray(at,at+4),at);
  }
  if(n===64)for(const group of clusters)if(group.every(i=>coverage[i]&&i%n>=4&&i%n<n-4&&Math.floor(i/n)>=4&&Math.floor(i/n)<n-4))for(const i of group)data.set(stones.data.subarray(i*4,i*4+4),i*4);
  // Straight 16px walking strips stay quiet. Other pieces can contain one
  // whole off-center chip, rather than a marker stamped at every cell center.
  if(n===16&&mask&&mask!==5&&mask!==10&&((recipe.seed^mask)&1)===0&&!weathered) {
    const x=mask&2?8:6,y=mask&4?8:6;
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)data.set([...gravel[dy?1:2],255],((y+dy)*16+x+dx)*4);
  }
  return {id:(weathered?'weathered-':'')+'gravel-path-'+mask,role:'path-overlay',family:'gravel-dirt',weathered,pathMask:mask,terrainMask:coverage,...pixel(n,data)};
}
export function generateCuratedTerrain(input={}) {
  const recipe=validateCuratedRecipe(input),n=recipe.tileSize,tiles=[],atlases=[],templates=[];
  for(const weathered of [false,true]) {
    const prefix=weathered?'weathered-':'';
    for(const family of families)for(let composition=0;composition<3;composition++)tiles.push({id:prefix+family+'-'+composition,role:'surface',family,composition,weathered,...surface(recipe,family,composition,weathered)});
    if(n===16)for(const family of ['grass','gravel']) {
      const sheet=sourceSheet(recipe,family,weathered),blob=buildBlob47(sheet.data),id=prefix+family+'-dirt-atlas';templates.push(sheet);
      tiles.push(...blob.tiles.map(t=>({id:prefix+family+'-dirt-blob-'+t.blobMask,role:'transition',family:family+'-dirt',weathered,...t})));
      atlases.push({id,...blob.atlas});
    }
    else {
      const grass=surface(recipe,'grass',0,weathered),dirt=surface(recipe,'dirt',0,weathered),transitions=[];
      for(let cornerMask=0;cornerMask<16;cornerMask++) {
        const coverage=cornerFootprint(cornerMask),data=new Uint8Array(n*n*4);
        const foreground=maskedMaterial(grass,coverage);
        for(let i=0;i<coverage.length;i++)data.set((coverage[i]?foreground:dirt).data.subarray(i*4,i*4+4),i*4);
        transitions.push({id:prefix+'grass-dirt-'+cornerMask,role:'transition',family:'grass-dirt',cornerMask,weathered,terrainMask:coverage,...pixel(n,data)});
      }
      tiles.push(...transitions);atlases.push(atlas(prefix+'grass-dirt-atlas',transitions,4,4));
    }
    const paths=Array.from({length:16},(_,m)=>pathTile(recipe,m,weathered));tiles.push(...paths);atlases.push(atlas(prefix+'gravel-path-atlas',paths,4,4));
  }
  const kit={recipe,tiles,atlases,templates,previews:[]};
  for(const weathered of [false,true])kit.previews.push({id:weathered?'weathered-connected-terrain':'connected-terrain',...composeCuratedTerrain(kit,{weathered})});
  return kit;
}
function variant(seed,x,y,family) {
  let h=Math.imul(x+1,0x9e3779b1)^Math.imul(y+1,0x85ebca77)^seed^Math.imul(family+1,0x7feb352d);
  h=Math.imul(h^(h>>>16),0x846ca68b);return ((h^(h>>>16))>>>0)%3;
}
export function composeCuratedSurface(kit,family,{weathered=false,composition='mixed'}={}) {
  if(!families.includes(family)||!['mixed',0,1,2].includes(composition))throw Error('Unknown curated surface composition');
  const n=kit.recipe.tileSize,out={width:n*4,height:n*4,data:new Uint8Array(n*n*16*4)},prefix=weathered?'weathered-':'';
  for(let y=0;y<4;y++)for(let x=0;x<4;x++) {
    const c=composition==='mixed'?variant(kit.recipe.seed,x,y,families.indexOf(family)):composition;
    stamp(out,kit.tiles.find(t=>t.id===prefix+family+'-'+c),x*n,y*n);
  }
  return out;
}
export function composeCuratedTerrain(kit,{weathered=false,scene=CURATED_SCENE,paths=CURATED_PATH_SCENE,composition='mixed',relationship='grass-dirt'}={}) {
  if(!['mixed',0,1,2].includes(composition)||!['grass-dirt','gravel-dirt'].includes(relationship))throw Error('Invalid connected terrain selection');
  if(!Array.isArray(scene)||scene.length<2||scene.length>17||!Array.isArray(scene[0])||scene[0].length<2||scene[0].length>17||scene.some(row=>!Array.isArray(row)||row.length!==scene[0].length||row.some(v=>v!==0&&v!==1)))throw Error('Expected bounded rectangular binary terrain');
  const n=kit.recipe.tileSize,rows=n===16?scene.length:scene.length-1,cols=n===16?scene[0].length:scene[0].length-1;
  // The built-in corner-grid scene has one fewer cell than its blob-grid counterpart.
  if(paths===CURATED_PATH_SCENE&&n===64)paths=paths.slice(0,rows).map(row=>row.slice(0,cols));
  if(!Array.isArray(paths)||paths.length!==rows||paths.some(row=>!Array.isArray(row)||row.length!==cols||row.some(m=>!Number.isInteger(m)||m<0||m>15)))throw Error('Path grid must match terrain cells');
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++) {
    if(x+1<cols&&Boolean(paths[y][x]&2)!==Boolean(paths[y][x+1]&8))throw Error('Mismatched east/west path ports');
    if(y+1<rows&&Boolean(paths[y][x]&4)!==Boolean(paths[y+1][x]&1))throw Error('Mismatched north/south path ports');
  }
  const out={width:cols*n,height:rows*n,data:new Uint8Array(cols*rows*n*n*4)},prefix=weathered?'weathered-':'',foreground=relationship.split('-')[0];
  const foregroundColors=new Set(colorsFor(kit.recipe)[foreground].map(c=>c.join(',')));
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++) {
    let tile;const pick=family=>kit.tiles.find(t=>t.id===prefix+family+'-'+(composition==='mixed'?variant(kit.recipe.seed,x,y,families.indexOf(family)):composition));
    if(n===16) {
      const mask=blobMaskAt(scene,x,y);
      tile=!scene[y][x]?pick('dirt'):mask===255?pick(foreground):kit.tiles.find(t=>t.id===prefix+relationship+'-blob-'+mask);
    } else {
      if(relationship!=='grass-dirt')throw Error('64px terrain uses grass/dirt corner masks');
      const mask=scene[y][x]+2*scene[y][x+1]+4*scene[y+1][x+1]+8*scene[y+1][x];
      tile=mask===0?pick('dirt'):mask===15?pick('grass'):kit.tiles.find(t=>t.id===prefix+'grass-dirt-'+mask);
    }
    let terrain=tile;
    // Boundary cells can use the authored alternatives too. Reuse the exact
    // topology silhouette, then place whole native clusters inside it; the
    // canonical exported sheet remains composition zero.
    if(tile.role==='transition') {
      const material=pick(foreground);
      const coverage=tile.terrainMask??Uint8Array.from({length:n*n},(_,i)=>Number(foregroundColors.has(tile.data.subarray(i*4,i*4+3).join(','))));
      const fg=maskedMaterial(material,coverage),background=pick('dirt'),pixels=background.data.slice();
      for(let i=0;i<coverage.length;i++)if(coverage[i])pixels.set(fg.data.subarray(i*4,i*4+4),i*4);
      terrain={...tile,data:pixels};
    }
    const path=kit.tiles.find(t=>t.id===prefix+'gravel-path-'+paths[y][x]),data=terrain.data.slice();
    if(paths[y][x]&&tile.family!=='dirt') {
      // A path is another cutout boundary: omit the entire affected feature,
      // leaving ground where its uncovered tips would otherwise survive.
      const visible=Uint8Array.from({length:n*n},(_,i)=>Number(!path.data[i*4+3]&&foregroundColors.has(data.subarray(i*4,i*4+3).join(','))));
      const fg=maskedMaterial(pick(foreground),visible);
      for(let i=0;i<visible.length;i++)if(visible[i])data.set(fg.data.subarray(i*4,i*4+4),i*4);
    }
    for(let at=0;at<data.length;at+=4)if(path.data[at+3])data.set(path.data.subarray(at,at+4),at);
    stamp(out,pixel(n,data),x*n,y*n);
  }
  return out;
}
export function curatedArtSource(kit) {
  return {format:'retro-terrain-art/1',recipe:kit.recipe,symbols:{0:'quiet ground',1:'shadow or depression',2:'light face',3:'stone highlight'},palettes:CURATED_PALETTES[kit.recipe.palette],drawings:CURATED_DRAWINGS[kit.recipe.tileSize],
    renderedDrawings:families.flatMap(family=>[false,true].flatMap(weathered=>[0,1,2].map(composition=>({family,composition,weathered,rows:artRows(kit.recipe.tileSize,family,composition,weathered)}))))};
}
export function describeCuratedTerrain(kit) {
  const n=kit.recipe.tileSize;
  return {format:'retro-terrain-pack/2',generator:CURATED_VERSION,recipe:kit.recipe,tileSize:n,visualReview:'unapproved',sampling:{filter:'nearest',colorSpace:'srgb'},palettes:CURATED_PALETTES[kit.recipe.palette],paletteBudgets:n===16?{grass:3,dirt:3,gravel:4}:{grass:8,dirt:12,gravel:12},
    provenance:{author:'Original native drawings for our projects',restrictedInputs:[],training:false,autotileSource:{repository:'Grout-Library',commit:'34016ee18a7e9b072495d728a0be1e02caf232a6',license:'MIT',notice:'LICENSE-Grout.txt'}},
    topology:n===16?{kind:'blob-47',bits:BLOB_BITS,columns:12,rows:4,mapping:BLOB_MASK_GRID.flatMap((row,y)=>row.map((mask,x)=>({mask,x:x*16,y:y*16,...(blobAtlasPosition(mask).x!==x||blobAtlasPosition(mask).y!==y?{alias:true}:{})}))),diagonals:'Only when both adjoining cardinal neighbors exist'}:{kind:'corner-16',bits:{NW:1,NE:2,SE:4,SW:8},diagonals:'Disconnected grass corners'},
    pathBits:CURATED_PATH_BITS,pathPortWidth:n===16?6:20,compositions:{count:3,method:'Independent authored cluster counts, footprints and negative space; spatial seed selection in full and boundary cells',boundaryStrip:n===16?2:4,topologySheets:'Composition zero; alternatives compose from exported surfaces inside the same silhouette'},
    tiles:kit.tiles.map(({id,role,family,width,height,composition,weathered,blobMask,cornerMask,pathMask})=>{
      const mask=blobMask??cornerMask??pathMask,prefix=weathered?'weathered-':'';
      const atlasId=role==='path-overlay'?prefix+'gravel-path-atlas':prefix+family+'-atlas';
      const pos=blobMask===undefined?{x:(mask%4)*n,y:Math.floor(mask/4)*n}:blobAtlasPosition(blobMask);
      return {id,path:id+'.png',role,family,width,height,weathered,alpha:role==='path-overlay'?'cutout':'opaque',...(composition===undefined?{}:{composition}),...(blobMask===undefined?{}:{blobMask}),...(cornerMask===undefined?{}:{cornerMask}),...(pathMask===undefined?{}:{pathMask}),...(role==='surface'?{wrap:'repeat'}:{atlas:{path:atlasId+'.png',x:blobMask===undefined?pos.x:pos.x*16,y:blobMask===undefined?pos.y:pos.y*16}})};
    }),atlases:kit.atlases.map(({id,width,height})=>({path:id+'.png',width,height})),templates:kit.templates.map(({id,width,height})=>({path:id+'.png',width,height,layout:'Grout native16 base/overlay3x3 plus inner/outer2x2'})),previews:kit.previews.map(({id,width,height})=>({path:id+'.png',width,height})),editableSource:'art-source.json'};
}
