import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {generateMaterial, materialContactSheet} from '../src/shader/material.mjs';
import {encodeMaterialPng} from './material-png.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),channels=['albedo','height','normal','roughness'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function mapPixels(pixels,width,height,sourceAt){
  const out={width,height,data:new Uint8Array(width*height*4)};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const source=sourceAt(x,y)*4,destination=(y*width+x)*4;
    out.data.set(pixels.data.subarray(source,source+4),destination);
    assert.deepEqual(out.data.subarray(destination,destination+4),pixels.data.subarray(source,source+4));
  }
  return out;
}
const repeat=p=>mapPixels(p,p.width*2,p.height*2,(x,y)=>(y%p.height)*p.width+x%p.width);
const zoom=p=>mapPixels(p,p.width*4,p.height*4,(x,y)=>Math.floor(y/4)*p.width+Math.floor(x/4));

export async function studyGrass(output){
  const files=[],cases=[],sources=[],comparison=[];
  await fs.mkdir(output,{recursive:true});
  for(const p of ['src/shader/material.mjs','scripts/study-material-grass.mjs','scripts/material-png.mjs'])sources.push({path:p,sha256:hash(await fs.readFile(path.join(root,p)))});
  const save=async(name,pixels)=>{
    const bytes=encodeMaterialPng(pixels);await fs.writeFile(path.join(output,name),bytes);
    files.push({path:name,width:pixels.width,height:pixels.height,bytes:bytes.length,sha256:hash(bytes)});
  };
  for(const structure of [undefined,'tufts'])for(const seed of [1204,1215,1233]){
    const material=generateMaterial({id:'style-surface',family:'grass',style:'hd2d',size:128,seed,...(structure?{structure}:{})});
    cases.push({recipe:material.recipe,channels:Object.fromEntries(channels.map(key=>[key,hash(material.channels[key].data)]))});
    const name=structure??'legacy';
    if(seed===1204){
      comparison.push(material);
      for(const key of channels){await save(`${name}-${key}.png`,material.channels[key]);await save(`${name}-${key}-2x2.png`,repeat(material.channels[key]));}
    }
    if(structure)await save(`tufts-s${seed}-channels.png`,materialContactSheet([material]));
  }
  await save('native-comparison.png',materialContactSheet(comparison));
  const rows=comparison.map(m=>({recipe:{...m.recipe,size:256},channels:Object.fromEntries(channels.map(k=>[k,repeat(m.channels[k])]))}));
  await save('repeat-comparison.png',materialContactSheet(rows));
  const albedo={width:256,height:128,data:new Uint8Array(256*128*4)};
  for(let y=0;y<128;y++)for(let i=0;i<2;i++)albedo.data.set(comparison[i].channels.albedo.data.subarray(y*512,(y+1)*512),(y*256+i*128)*4);
  await save('albedo-4x-comparison.png',zoom(albedo));
  const study={format:'material-grass-study/1',visualReview:'unapproved',layout:'Legacy top / tufts bottom; albedo, height, +Y normal, roughness left to right. 4x albedo: legacy left / tufts right, nearest-neighbor.',producer:'scripts/study-material-grass.mjs',retention:'Original-only compact evidence; retain while referenced; no automatic retirement',sources,cases,files};
  await fs.writeFile(path.join(output,'study.json'),JSON.stringify(study,null,2)+'\n');
  return {output,files:files.length,cases:cases.length,visualReview:study.visualReview};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--out')throw Error('Use --out <explicit study directory>');
  console.log(JSON.stringify(await studyGrass(path.resolve(args[1]))));
}
