import fs from "node:fs/promises";
import path from "node:path";
import { createCharacterDocument, compileCharacter, renderFrame } from "../packages/grout-art/index.mjs";
import { encodeMaterialPng } from "./material-png.mjs";
export async function studyCharacters(output) {
  await fs.mkdir(output,{recursive:true});
  const base=createCharacterDocument(), all=[], labels=[];
  for(const build of base.creator.builds) for(const style of base.creator.styles) {
    const d=structuredClone(base);d.build=build.id;d.style=style.id;
    const r=compileCharacter(d);
    all.push(r.frames.map((_,i)=>renderFrame(r,i)));
    labels.push(`${build.name} / ${style.name}`);
  }
  const width=12*26,height=9*28,data=new Uint8Array(width*height*4);
  for(let i=0;i<data.length;i+=4)data.set([78,75,68,255],i);
  for(let row=0;row<9;row++)for(let f=0;f<12;f++) {
    const p=all[row][f];
    for(let y=0;y<24;y++)for(let x=0;x<24;x++) {
      const at=(x+y*24)*4;if(p.data[at+3])data.set(p.data.slice(at,at+4),((row*28+y)*width+f*26+x)*4);
    }
  }
  const native={width,height,data};
  await fs.writeFile(path.join(output,"native.png"),encodeMaterialPng(native));
  const zoom=4,large={width:width*zoom,height:height*zoom,data:new Uint8Array(data.length*zoom*zoom)};
  for(let y=0;y<large.height;y++)for(let x=0;x<large.width;x++) {
    const at=(Math.floor(x/zoom)+Math.floor(y/zoom)*width)*4;
    large.data.set(data.subarray(at,at+4),(x+y*large.width)*4);
  }
  await fs.writeFile(path.join(output,"integer-4x.png"),encodeMaterialPng(large));
  await fs.writeFile(path.join(output,"study.json"),JSON.stringify({labels,columns:["south-0","south-1","south-2","west-0","west-1","west-2","east-0","east-1","east-2","north-0","north-1","north-2"],visualReview:"unapproved"},null,2));
  return {count:all.length,output};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)) {
  const out=process.argv[process.argv.indexOf("--out")+1];
  if(!process.argv.includes("--out")||!out)throw Error("Explicit --out is required");
  console.log(await studyCharacters(out));
}
