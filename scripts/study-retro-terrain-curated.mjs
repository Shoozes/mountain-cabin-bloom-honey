import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {generateCuratedTerrain,composeCuratedSurface} from '../src/shader/retro-terrain-curated.mjs';
import {encodeMaterialPng} from './material-png.mjs';
const root=path.resolve(import.meta.dirname,'..'),args=process.argv.slice(2),at=args.indexOf('--out');
if(at<0||!args[at+1]||args.some((v,i)=>i!==at&&i!==at+1&&v!=='--verify'))throw Error('Use --out <original-only study directory> [--verify]');
const out=path.resolve(args[at+1]),verify=args.includes('--verify'),hash=b=>createHash('sha256').update(b).digest('hex');
const sources=[];for(const file of ['src/shader/retro-terrain-art.mjs','src/shader/retro-autotile.mjs','src/shader/retro-terrain-curated.mjs','src/shader/retro-terrain.mjs','src/shader/retro-terrain-growth.mjs','scripts/material-png.mjs','scripts/study-retro-terrain-curated.mjs'])sources.push({file,sha256:hash(await fs.readFile(path.join(root,file)))});
function board(images,columns){const w=images[0].width,h=images[0].height,width=w*columns,height=h*Math.ceil(images.length/columns),data=new Uint8Array(width*height*4);images.forEach((image,i)=>{for(let y=0;y<h;y++)data.set(image.data.subarray(y*w*4,(y+1)*w*4),((Math.floor(i/columns)*h+y)*width+i%columns*w)*4);});return {width,height,data};}
const images=[];for(const tileSize of [16,64]){
  const kit=generateCuratedTerrain({tileSize,palette:'woodland',seed:1204});
  images.push({name:`surfaces-${tileSize}.png`,...board([false,true].flatMap(weathered=>[0,1,2].flatMap(c=>['grass','dirt','gravel'].map(f=>kit.tiles.find(t=>t.id===(weathered?'weathered-':'')+f+'-'+c)))),3)});
  images.push({name:`repeats-${tileSize}.png`,...board(['grass','dirt','gravel'].map(f=>composeCuratedSurface(kit,f)),3)});
  for(const p of kit.previews)images.push({name:`${p.id}-${tileSize}.png`,...p});
  if(tileSize===16){images.push({name:'blob-cases.png',...board(kit.atlases.filter(a=>a.id==='grass-dirt-atlas'||a.id==='gravel-dirt-atlas'),1)});images.push({name:'palettes-16.png',...board(['woodland','dry-trail','cool-moor'].map(palette=>generateCuratedTerrain({tileSize,seed:1204,palette}).previews[0]),3)});}
}
const files=images.map(({name,width,height,data})=>{const png=encodeMaterialPng({width,height,data});return {path:name,width,height,bytes:png.length,sha256:hash(png),rgbaSha256:hash(data),data:png};});
const study={format:'retro-terrain-curated-study/1',visualReview:'unapproved',seeds:[1204,1215,1233],palettes:['woodland','dry-trail','cool-moor'],sources,files:files.map(({data:_,...entry})=>entry)};
const encoded=Buffer.from(JSON.stringify(study,null,2)+'\n');
if(verify){if(!(await fs.readFile(path.join(out,'study.json'))).equals(encoded))throw Error('Study source identity or descriptor changed');for(const file of files)if(!(await fs.readFile(path.join(out,file.path))).equals(file.data))throw Error('Study pixels changed: '+file.path);}
else{await fs.mkdir(out,{recursive:true});for(const file of [...files,{path:'study.json',data:encoded}]){try{const old=await fs.readFile(path.join(out,file.path));if(!old.equals(file.data))throw Error('Preserve historical study; choose a fresh output directory');}catch(e){if(e.code!=='ENOENT')throw e;await fs.writeFile(path.join(out,file.path),file.data);}}}
console.log(JSON.stringify({status:'passed',mode:verify?'verify':'write',out,images:files.length,bytes:files.reduce((s,f)=>s+f.bytes,0),sourceIdentity:hash(JSON.stringify(sources)),visualReview:'unapproved'}));
