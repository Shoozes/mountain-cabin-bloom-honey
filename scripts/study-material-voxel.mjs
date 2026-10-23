import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {generateMaterial,VOXEL_SURFACE_FAMILIES} from '../src/shader/material.mjs';
import {encodeMaterialPng} from './material-png.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function compose(tiles,columns,scale=1,repeat=1){
  const cell=16*scale*repeat,width=columns*cell,height=Math.ceil(tiles.length/columns)*cell,data=new Uint8Array(width*height*4);
  for(let i=0;i<tiles.length;i++)for(let y=0;y<cell;y++)for(let x=0;x<cell;x++){
    const from=((Math.floor(y/scale)%16)*16+Math.floor(x/scale)%16)*4;
    data.set(tiles[i].data.subarray(from,from+4),((Math.floor(i/columns)*cell+y)*width+(i%columns)*cell+x)*4);
  }
  return {width,height,data};
}
export async function studyVoxel(output){
  await fs.mkdir(output,{recursive:true});const files=[],cases=[],sources=[];
  for(const name of ['src/shader/material.mjs','src/shader/material-voxel.mjs','scripts/study-material-voxel.mjs','scripts/material-png.mjs'])sources.push({path:name,sha256:hash(await fs.readFile(new URL('../'+name,import.meta.url)))});
  const save=async(name,pixels)=>{const bytes=encodeMaterialPng(pixels);await fs.writeFile(path.join(output,name),bytes);files.push({path:name,width:pixels.width,height:pixels.height,sha256:hash(bytes),bytes:bytes.length});};
  const families=[];
  for(const family of VOXEL_SURFACE_FAMILIES){
    const first=generateMaterial({id:'voxel-surface',family});families.push(first.channels.albedo);
    await save(`${family}-native.png`,first.channels.albedo);
    await save(`${family}-8x.png`,compose([first.channels.albedo],1,8));
    await save(`${family}-repeat.png`,compose([first.channels.albedo],1,4,3));
    for(const seed of [1204,1215,1233]){const m=generateMaterial({id:'voxel-surface',family,seed});cases.push({recipe:m.recipe,channels:Object.fromEntries(Object.entries(m.channels).map(([key,p])=>[key,hash(p.data)]))});}
  }
  await save('families-native.png',compose(families,4));
  await save('families-8x.png',compose(families,4,8));
  await save('families-repeat.png',compose(families,4,4,3));
  await save('channels-8x.png',compose(VOXEL_SURFACE_FAMILIES.flatMap(family=>Object.values(generateMaterial({id:'voxel-surface',family}).channels)),4,8));
  const manifest={format:'voxel-material-study/1',visualReview:'unapproved',nativeSize:16,layout:'Four columns: grass, dirt, stone, cobble / sand, planks, bark, brick. Channels: one family per row; albedo, height, normal, roughness.',provenance:'Original code-authored pixels and ramps. Official reference capture stays separate and is not a generator input.',sources,cases,files};
  await fs.writeFile(path.join(output,'study.json'),JSON.stringify(manifest,null,2)+'\n');
  return {status:'written',files:files.length,cases:cases.length,output};
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename){const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--out')throw Error('Use --out <explicit directory>');console.log(JSON.stringify(await studyVoxel(path.resolve(args[1]))));}
