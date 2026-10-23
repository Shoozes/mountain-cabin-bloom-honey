import {generateMaterial,MATERIAL_CHANNELS,materialVersion} from './material.mjs';
export function paintMaterialCanvas(canvas,pixels,repeat=1){
  const tile=document.createElement('canvas');tile.width=pixels.width;tile.height=pixels.height;
  tile.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height),0,0);
  canvas.width=pixels.width*repeat;canvas.height=pixels.height*repeat;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  for(let y=0;y<repeat;y++)for(let x=0;x<repeat;x++)ctx.drawImage(tile,x*pixels.width,y*pixels.height);
}
const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
export async function materialBrowserFiles(recipe){
  const material=generateMaterial(recipe),generator=materialVersion(material.recipe.id),files=[],metadata=[];
  for(const [channel,pixels]of Object.entries(material.channels)){
    const canvas=document.createElement('canvas');paintMaterialCanvas(canvas,pixels);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG export failed')),'image/png'));
    const data=new Uint8Array(await blob.arrayBuffer()),name='s'+material.recipe.seed+'-'+channel+'.png';files.push({name,data});
    metadata.push({path:name,channel,seed:material.recipe.seed,width:pixels.width,height:pixels.height,bytes:data.length,sha256:await digest(data),...MATERIAL_CHANNELS[channel],filter:material.recipe.id==='realistic-surface'?'linear':'nearest',wrap:'repeat'});
  }
  const urls=[new URL('./material.mjs',import.meta.url),new URL(import.meta.url)];if(material.recipe.id==='realistic-surface')urls.push(new URL('./material-realistic.mjs',import.meta.url));
  if(material.recipe.id==='voxel-surface')urls.push(new URL('./material-voxel.mjs',import.meta.url));
  const sources=[];for(const url of urls){const response=await fetch(url);if(!response.ok)throw Error('Authoring source identity unavailable');const source=new Uint8Array(await response.arrayBuffer());sources.push({path:url.pathname,sha256:await digest(source)});}
  const identity=await digest(new TextEncoder().encode(JSON.stringify({recipe:material.recipe,generator,sources})));
  const manifest={format:'texture-material/1',identity,generator,sourceTip:null,sources,recipe:material.recipe,visualReview:'unapproved',provenance:{author:'original procedural work for our projects',restrictedInputs:[],training:false},files:metadata};
  files.push({name:'material.json',data:new TextEncoder().encode(JSON.stringify(manifest,null,2)+'\n')},{name:'recipe.json',data:new TextEncoder().encode(JSON.stringify(material.recipe,null,2)+'\n')});return files;
}
