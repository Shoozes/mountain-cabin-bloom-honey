import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {generateMaterial, materialContactSheet} from '../src/shader/material.mjs';
import {encodeMaterialPng} from './material-png.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),channels=['albedo','height','normal','roughness'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const repeat=pixels=>{
  const {width,height,data}=pixels,out={width:width*2,height:height*2,data:new Uint8Array(width*height*16)};
  for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){
    const source=((y%height)*width+x%width)*4,destination=(y*out.width+x)*4;
    out.data.set(data.subarray(source,source+4),destination);
    assert.deepEqual(out.data.subarray(destination,destination+4),data.subarray(source,source+4));
  }
  return out;
};
const rowCoherence=material=>{
  const n=material.recipe.size,h=material.heights;let total=0,coherent=0;
  for(let y=0;y<n;y++){
    let sum=0;
    for(let x=0;x<n;x++){const d=h[((y+1)%n)*n+x]-h[((y+n-1)%n)*n+x];sum+=d;total+=d*d;}
    coherent+=sum*sum/n;
  }
  return total?coherent/total:0;
};

export async function studyDirt(output){
  const files=[],cases=[],sources=[];
  await fs.mkdir(output,{recursive:true});
  for(const p of ['src/shader/material.mjs','scripts/study-material-dirt.mjs','scripts/material-png.mjs'])sources.push({path:p,sha256:hash(await fs.readFile(path.join(root,p)))});
  const save=async(name,pixels)=>{
    const bytes=encodeMaterialPng(pixels);await fs.writeFile(path.join(output,name),bytes);
    files.push({path:name,width:pixels.width,height:pixels.height,bytes:bytes.length,sha256:hash(bytes)});
  };
  const comparison=[];
  for(const structure of [undefined,'clumps'])for(const seed of [1204,1215,1233]){
    const material=generateMaterial({id:'style-surface',family:'dirt',style:'hd2d',size:128,seed,...(structure?{structure}:{})});
    cases.push({recipe:material.recipe,rowGradientCoherence:rowCoherence(material),channels:Object.fromEntries(channels.map(key=>[key,hash(material.channels[key].data)]))});
    if(seed===1204){
      const name=structure??'legacy';comparison.push(material);
      for(const key of channels){await save(`${name}-${key}.png`,material.channels[key]);await save(`${name}-${key}-2x2.png`,repeat(material.channels[key]));}
    }
  }
  await save('native-comparison.png',materialContactSheet(comparison));
  const rows=comparison.map(material=>({recipe:{...material.recipe,size:256},channels:Object.fromEntries(channels.map(key=>[key,repeat(material.channels[key])]))}));
  await save('repeat-comparison.png',materialContactSheet(rows));
  const study={format:'material-dirt-study/1',visualReview:'unapproved',layout:'Legacy top / clumps bottom; albedo, height, +Y normal, roughness left to right',producer:'scripts/study-material-dirt.mjs',retention:'Original-only compact evidence; retain while referenced; no automatic retirement',sources,cases,files};
  await fs.writeFile(path.join(output,'study.json'),JSON.stringify(study,null,2)+'\n');
  return {output,files:files.length,cases:cases.length,visualReview:study.visualReview,coherence:cases.map(c=>({seed:c.recipe.seed,structure:c.recipe.structure??'legacy',ratio:c.rowGradientCoherence}))};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--out')throw Error('Use --out <explicit study directory>');
  console.log(JSON.stringify(await studyDirt(path.resolve(args[1]))));
}
