import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createServer,preview} from 'vite';
import {createTravelerRecipe,buildArtExport,buildArtGifs,renderFrame,importSpritePixels} from '../packages/grout-art/index.mjs';
import {bakeArt,ART_SOURCE_PATHS} from './bake-art.mjs';

const args=process.argv.slice(2),option=name=>{const at=args.indexOf(name);return at<0?null:args[at+1];};
const dev=args.includes('--dev'),mode=option('--mode')??'root',out=option('--proof-out');
if(!out||!['root','pages'].includes(mode))throw Error('Use [--dev | --mode root|pages] --proof-out <directory>');
const root=path.resolve(import.meta.dirname,'..'),proof=path.resolve(out),lane=dev?'dev':mode;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt={lane,started:new Date().toISOString(),checks:[],errors:[],expectedErrors:[],sources:[],pixelComparisons:0};
const corpus={files:[]};
let server,browser,page,injecting=false;
await fs.mkdir(proof,{recursive:true});
const scratch=await fs.mkdtemp(path.join(path.dirname(proof),'gif-browser-scratch-'));
function unzip(bytes){
  const files=new Map();
  for(let at=0;at+30<=bytes.length&&bytes.readUInt32LE(at)===0x04034b50;){
    assert.equal(bytes.readUInt16LE(at+8),0);
    const size=bytes.readUInt32LE(at+18),n=bytes.readUInt16LE(at+26),extra=bytes.readUInt16LE(at+28),start=at+30+n+extra;
    assert.ok(start+size<=bytes.length);const name=bytes.toString('utf8',at+30,at+30+n);assert.ok(!files.has(name));
    files.set(name,bytes.subarray(start,start+size));at=start+size;
  }
  return files;
}
async function download(){
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export atlas kit',exact:true}).click();
  const file=await pending;try{return unzip(await fs.readFile(await file.path()));}finally{await file.delete();}
}
async function pngHash(bytes){
  return page.evaluate(async encoded=>{
    const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:'image/png'}));
    try{const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,c.width,c.height).data))].map(n=>n.toString(16).padStart(2,'0')).join('');}
    finally{bitmap.close();}
  },bytes.toString('base64'));
}
async function verifyGifs(recipe,files,metadata,tag){
  assert.equal(metadata.format,'grout-art-gif/1');
  for(const clip of metadata.clips){
    const bytes=Buffer.from(files.get(clip.path)),expected=clip.frames.map(name=>({name,sha256:hash(renderFrame(recipe,recipe.frames.findIndex(f=>f.name===name)).data)}));
    const actual=await page.evaluate(async encoded=>{
      const decoder=new ImageDecoder({data:Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),type:'image/gif',preferAnimation:true,colorSpaceConversion:'none'});
      try{
        await decoder.completed;await decoder.tracks.ready;
        const track=decoder.tracks.selectedTrack,result=[];
        for(let i=0;i<track.frameCount;i++){
          const {image}=await decoder.decode({frameIndex:i,completeFramesOnly:true});
          try{
            const c=document.createElement('canvas');c.width=image.displayWidth;c.height=image.displayHeight;
            const ctx=c.getContext('2d');ctx.drawImage(image,0,0);
            const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,c.width,c.height).data))].map(n=>n.toString(16).padStart(2,'0')).join('');
            result.push({width:c.width,height:c.height,sha256,durationMs:image.duration/1000});
          }finally{image.close();}
        }
        return {frames:result,repetitionCount:track.repetitionCount};
      }finally{decoder.close();}
    },bytes.toString('base64'));
    assert.equal(actual.frames.length,expected.length,tag+'/'+clip.name);assert.equal(actual.repetitionCount,Infinity);
    let elapsed=0;
    actual.frames.forEach((frame,i)=>{
      assert.deepEqual(frame,{width:recipe.width,height:recipe.height,sha256:expected[i].sha256,durationMs:clip.delaysCs[i]*10},`${tag}/${clip.name}/${i}`);
      elapsed+=frame.durationMs;assert.ok(Math.abs(elapsed-(i+1)*1000/clip.fps)<=5.000001);receipt.pixelComparisons++;
    });
    const name=`${lane}-gifs/${tag}-${clip.path}`;await fs.mkdir(path.join(proof,`${lane}-gifs`),{recursive:true});await fs.writeFile(path.join(proof,name),bytes);
    corpus.files.push({path:name,width:recipe.width,height:recipe.height,fps:clip.fps,frames:expected,delaysCs:clip.delaysCs});
  }
}
async function generatedCase(recipe,tag){
  const result=await buildArtGifs(buildArtExport(recipe));
  await verifyGifs(recipe,new Map(result.files.map(f=>[f.name,f.data])),result.metadata,tag);
}
async function paletteRecipe({transparent=false}={}){
  // Keep each imported mask within its 4,096-run authoring budget while
  // exercising all palette entries and LZW width transitions with random ink.
  const width=128,height=64,data=new Uint8Array(width*height*4);let state=123456789;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    state^=state<<13;state^=state>>>17;state^=state<<5;state>>>=0;
    const index=state%(transparent?255:256),clear=transparent&&state%13===0;
    data.set(clear?[0,0,0,0]:[index,(index*31)&255,(index*71)&255,255],(y*width+x)*4);
  }
  const recipe=await importSpritePixels({width,height,data},{frameWidth:64,frameHeight:64,fps:25,name:transparent?'Transparent palette boundary':'Opaque palette boundary'});
  recipe.clips={held:{frames:[recipe.frames[0].name,recipe.frames[1].name,recipe.frames[1].name],fps:25}};
  return recipe;
}
try{
  for(const name of [...ART_SOURCE_PATHS,'src/art/art-export.ts','src/components/art-studio.tsx','src/art/studio.css','scripts/bake-art.mjs','scripts/test-art-gif-browser.mjs','scripts/verify-art-gif-pillow.py','package-lock.json','vite.config.ts'])receipt.sources.push({path:name,sha256:hash(await fs.readFile(path.join(root,name)))});
  if(dev){server=await createServer({root,mode:'development',server:{host:'127.0.0.1',port:0,open:false}});await server.listen();}
  else server=await preview({root,mode:mode==='pages'?'pages':'production',preview:{host:'127.0.0.1',port:0,open:false}});
  receipt.url=`http://127.0.0.1:${server.httpServer.address().port}/${!dev&&mode==='pages'?'mountain-cabin-bloom-honey/':''}`;
  browser=await chromium.launch({channel:'chrome',headless:true});receipt.browser=browser.version();
  page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,acceptDownloads:true});
  page.on('pageerror',error=>receipt.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')(injecting?receipt.expectedErrors:receipt.errors).push(message.text());});
  await page.goto(receipt.url+'studio');await page.locator('.art-studio[aria-busy="false"]').waitFor();
  await page.getByRole('combobox',{name:/Renderer/}).selectOption('cpu');
  const recipe=await page.evaluate(()=>JSON.parse(localStorage.getItem('grout-art-studio/1')));
  await page.screenshot({path:path.join(proof,`${lane}-closed-desktop.png`)});
  await page.getByText('Export options',{exact:true}).click();
  const gif=page.getByRole('checkbox',{name:'Include animated GIFs',exact:true}),css=page.getByRole('checkbox',{name:'Include CSS sprites',exact:true});
  assert.equal(await gif.isChecked(),false);assert.equal(await css.isChecked(),false);
  const plain=await download(),plainManifest=JSON.parse(plain.get('atlas.json'));
  assert.equal(plainManifest.animations,undefined);assert.equal(plainManifest.stylesheet,undefined);assert.ok(![...plain.keys()].some(n=>n.endsWith('.gif')));
  await gif.check();await css.check();
  const fault=async route=>{if(route.request().resourceType()==='fetch'&&/\.(mjs|js)(\?|$)/.test(route.request().url()))await route.fulfill({status:503,contentType:'text/plain',body:'Injected GIF export source failure'});else await route.continue();};
  injecting=true;await page.route('**/*',fault);await page.getByRole('button',{name:'Export atlas kit',exact:true}).click();await page.getByRole('alert').filter({hasText:'source identity unavailable'}).waitFor();await page.unroute('**/*',fault);injecting=false;
  let release,blocked;
  const arrived=new Promise(resolve=>{blocked=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  const delay=async route=>{if(route.request().resourceType()==='fetch'&&/\.(mjs|js)(\?|$)/.test(route.request().url())){blocked();await gate;await route.abort().catch(()=>{});}else await route.continue();};
  await page.route('**/*',delay);await page.getByRole('button',{name:'Export atlas kit',exact:true}).click();await arrived;
  await page.getByRole('button',{name:'Cancel export',exact:true}).click();release();await page.unroute('**/*',delay);await page.getByRole('status').filter({hasText:'Export cancelled'}).waitFor();
  const files=await download(),manifest=JSON.parse(files.get('atlas.json')),exported=JSON.parse(files.get('recipe.json'));
  assert.deepEqual(exported,recipe);assert.equal(manifest.visualReview,'unapproved');
  const cli=await bakeArt({recipe:exported,output:scratch,includeCss:true,includeGif:true});
  assert.deepEqual(manifest.animations,cli.manifest.animations);assert.deepEqual(manifest.stylesheet,cli.manifest.stylesheet);
  for(const [name,bytes]of files){
    if(name.endsWith('.png')){assert.equal(await pngHash(bytes),await pngHash(await fs.readFile(path.join(cli.directory,name))));assert.deepEqual(bytes,plain.get(name));}
    if(name.endsWith('.gif')||name==='atlas.css')assert.deepEqual(bytes,await fs.readFile(path.join(cli.directory,name)));
    if(name!=='atlas.json'){const entry=manifest.files.find(f=>f.path===name);assert.equal(entry.sha256,hash(bytes));}
  }
  await verifyGifs(recipe,files,manifest.animations,'download');
  receipt.checks.push('default GIF-free kit, combined CSS/GIF download, source failure/cancel/retry, digests, exact PNG/recipe preservation and CLI parity');
  await page.screenshot({path:path.join(proof,`${lane}-desktop.png`)});
  await page.setViewportSize({width:390,height:844});await gif.scrollIntoViewIfNeeded();
  await gif.focus();await gif.press('Space');assert.equal(await gif.isChecked(),false);await gif.press('Space');assert.equal(await gif.isChecked(),true);
  const mobile=await download();for(const clip of manifest.animations.clips)assert.deepEqual(mobile.get(clip.path),files.get(clip.path));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await page.locator('.art-studio-head').evaluate(el=>el.scrollWidth<=el.clientWidth));
  const box=await page.getByRole('button',{name:'Export atlas kit',exact:true}).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
  await gif.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(proof,`${lane}-mobile.png`)});
  await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});await gif.focus();await gif.press('Space');await gif.press('Space');assert.equal(await gif.isChecked(),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.emulateMedia({reducedMotion:'no-preference',forcedColors:'none'});
  await page.getByText('Export options',{exact:true}).click();await page.locator('.art-main-canvas').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(proof,`${lane}-closed-mobile.png`)});
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('grout-art-studio/1'))),recipe);
  await page.reload();await page.locator('.art-studio[aria-busy="false"]').waitFor();await page.getByText('Export options',{exact:true}).click();assert.equal(await gif.isChecked(),false);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('grout-art-studio/1'))),recipe);
  receipt.checks.push('desktop/narrow pointer and keyboard export, reduced motion/forced colors, unchanged draft recovery and transient options reset');
  await page.setViewportSize({width:1440,height:1000});
  // A valid PNG recipe can exceed GIF's palette when it also has transparency.
  const overflowData=new Uint8Array(257*4);for(let i=0;i<256;i++)overflowData.set([i,i^0xaa,i^0x55,255],i*4);
  const overflow=await importSpritePixels({width:257,height:1,data:overflowData},{name:'GIF color limit'});
  await page.getByText('Recipe source and technique modules',{exact:true}).click();
  const source=page.getByRole('textbox',{name:'Recipe JSON, including custom technique source',exact:true});
  await source.fill(JSON.stringify(overflow));await page.getByRole('button',{name:'Apply recipe',exact:true}).click();await page.locator('.art-studio[aria-busy="false"]').waitFor();
  await gif.check();await page.getByRole('button',{name:'Export atlas kit',exact:true}).click();await page.getByRole('alert').filter({hasText:'255 supported with transparency'}).waitFor();
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('grout-art-studio/1'))),overflow);
  await gif.uncheck();const fallback=await download();assert.ok(fallback.has('sheet.png'));assert.equal(JSON.parse(fallback.get('atlas.json')).animations,undefined);
  await source.fill(JSON.stringify(recipe));await page.getByRole('button',{name:'Apply recipe',exact:true}).click();await page.locator('.art-studio[aria-busy="false"]').waitFor();
  receipt.checks.push('visible exact-color limit error preserves the valid draft and permits immediate PNG-only export');
  const outlined=createTravelerRecipe();outlined.outline={enabled:true,color:'#26323f',width:2,corners:'stepped'};await generatedCase(outlined,'outlined');
  const transition=createTravelerRecipe();transition.frames.push({name:'empty',anchor:[8,15],layers:Object.fromEntries(transition.layers.map(l=>[l.id,{visible:false}]))});
  transition.clips={clear:{frames:[transition.frames[0].name,'empty',transition.frames[1].name,'empty'],fps:8}};await generatedCase(transition,'clear');
  for(const fps of [1,3,7,8,25,50,60]){const timed=createTravelerRecipe();timed.clips={timed:{frames:[timed.frames[0].name,timed.frames[1].name,timed.frames[1].name,timed.frames[2].name],fps}};await generatedCase(timed,`fps-${fps}`);}
  await generatedCase(await paletteRecipe(),'opaque-256');await generatedCase(await paletteRecipe({transparent:true}),'cutout-255');
  receipt.checks.push('Chrome independent GIF pixels, loop and cumulative delay boundaries: outlines, blank transitions, holds, 1/3/7/8/25/50/60 fps and 255/256-color high-entropy LZW fixtures');
  assert.ok(receipt.expectedErrors.some(e=>e.includes('503')));assert.deepEqual(receipt.errors,[]);receipt.status='passed';
}catch(error){receipt.status='failed';receipt.error=error.stack;process.exitCode=1;console.error(error);await page?.screenshot({path:path.join(proof,`${lane}-failed.png`)}).catch(()=>{});}
finally{
  try{await browser?.close();}finally{if(server){if(dev)await server.close();else await new Promise((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));}}
  await fs.rm(scratch,{recursive:true,force:true});
  receipt.finished=new Date().toISOString();await fs.writeFile(path.join(proof,`${lane}-index.json`),JSON.stringify(corpus,null,2)+'\n');await fs.writeFile(path.join(proof,`${lane}-receipt.json`),JSON.stringify(receipt,null,2)+'\n');
}
console.log(JSON.stringify({lane,status:receipt.status,checks:receipt.checks.length,gifs:corpus.files.length,pixelComparisons:receipt.pixelComparisons,errors:receipt.errors}));
