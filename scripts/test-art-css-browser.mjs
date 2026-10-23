import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createServer,preview} from 'vite';
import {createTravelerRecipe,buildArtExport,buildArtCss,renderFrame} from '../packages/grout-art/index.mjs';
import {bakeArt,ART_SOURCE_PATHS} from './bake-art.mjs';
import {encodeMaterialPng} from './material-png.mjs';

const args=process.argv.slice(2),option=name=>{const at=args.indexOf(name);return at<0?null:args[at+1];};
const dev=args.includes('--dev'),mode=option('--mode')??'root',out=option('--proof-out');
if(!out||!['root','pages'].includes(mode))throw Error('Use [--dev | --mode root|pages] --proof-out <directory>');
const root=path.resolve(import.meta.dirname,'..'),proof=path.resolve(out),lane=dev?'dev':mode;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt={lane,started:new Date().toISOString(),checks:[],errors:[],expectedErrors:[],sources:[],pixelComparisons:0};
let server,browser,page,injecting=false;
const scratch=await fs.mkdtemp(path.join(proof+path.sep+'..','css-browser-scratch-'));
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
async function decoded(bytes){
  return page.evaluate(async encoded=>{
    const image=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:'image/png'}));
    try{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return {width:c.width,height:c.height,hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,c.width,c.height).data))].map(n=>n.toString(16).padStart(2,'0')).join('')};}
    finally{image.close();}
  },bytes.toString('base64'));
}
async function download(){
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export atlas kit',exact:true}).click();
  const file=await pending;try{return unzip(await fs.readFile(await file.path()));}finally{await file.delete();}
}
async function cssPixels(kit,css,tag){
  const assets=new Map([['atlas.css',{body:css.css,contentType:'text/css'}]]);
  for(const p of kit.atlas.pages)assets.set(`atlas-${p.index}.png`,{body:encodeMaterialPng({width:p.width,height:p.height,data:new Uint8Array(p.rgba)}),contentType:'image/png'});
  assets.set('view.html',{body:'<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="atlas.css"><style>html,body{margin:0;background:transparent}#sprite{display:block}</style><span id="sprite"></span>',contentType:'text/html'});
  const directory=new URL(`__css-proof__/${tag}/`,receipt.url).href;
  const serve=route=>{const file=assets.get(new URL(route.request().url()).pathname.split('/').at(-1));return route.fulfill(file?{status:200,...file}:{status:404,contentType:'text/plain',body:'Missing proof asset'});};
  await page.route(directory+'**',serve);
  try{
    await page.goto(directory+'view.html');
    await page.evaluate(async names=>{await Promise.all(names.map(name=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src=name;})));},[...assets.keys()].filter(n=>n.endsWith('.png')));
    const sprite=page.locator('#sprite');
    async function compare(name){
      const expected=renderFrame(kit.recipe,kit.recipe.frames.findIndex(f=>f.name===name));
      const actual=await decoded(await sprite.screenshot({omitBackground:true,animations:'allow'}));
      assert.deepEqual(actual,{width:expected.width,height:expected.height,hash:hash(expected.data)},`${tag}/${name}`);receipt.pixelComparisons++;
    }
    for(const frame of css.metadata.frames){await sprite.evaluate((el,selector)=>{el.className=selector.slice(1);},frame.selector);await compare(frame.name);}
    for(const clip of css.metadata.clips){
      await sprite.evaluate((el,selector)=>{el.className=selector.slice(1);},clip.selector);
      const duration=clip.durationSeconds*1000;
      for(let tick=0;tick<clip.frames.length;tick++){
        await sprite.evaluate((el,time)=>{const a=el.getAnimations({subtree:true})[0];if(!a)throw Error('Missing CSS animation');a.pause();a.currentTime=time;},(tick+.5)*duration/clip.frames.length);
        await compare(clip.frames[tick]);
      }
      await sprite.evaluate((el,time)=>{el.getAnimations({subtree:true})[0].currentTime=time;},duration+.001);
      await compare(clip.frames[0]);
      const timing=await sprite.evaluate(el=>el.getAnimations({subtree:true})[0].effect.getTiming());
      assert.ok(Math.abs(timing.duration-duration)<.001);assert.equal(timing.iterations,Infinity);
    }
  }finally{await page.unroute(directory+'**',serve);}
}
try{
  await fs.mkdir(proof,{recursive:true});
  for(const name of [...ART_SOURCE_PATHS,'src/art/art-export.ts','src/components/art-studio.tsx','src/art/studio.css','scripts/bake-art.mjs','scripts/test-art-css-browser.mjs','package-lock.json','vite.config.ts'])receipt.sources.push({path:name,sha256:hash(await fs.readFile(path.join(root,name)))});
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
  const choice=page.getByRole('checkbox',{name:'Include CSS sprites',exact:true});assert.equal(await choice.isChecked(),false);
  const original=await download();assert.equal(original.has('atlas.css'),false);assert.equal(JSON.parse(original.get('atlas.json')).stylesheet,undefined);
  await choice.check();
  const fault=async route=>{
    if(route.request().resourceType()==='fetch'&&/\.(mjs|js)(\?|$)/.test(route.request().url()))await route.fulfill({status:503,contentType:'text/plain',body:'Injected CSS export source failure'});
    else await route.continue();
  };
  injecting=true;await page.route('**/*',fault);await page.getByRole('button',{name:'Export atlas kit',exact:true}).click();await page.getByRole('alert').filter({hasText:'source identity unavailable'}).waitFor();await page.unroute('**/*',fault);injecting=false;
  let release,blocked;
  const arrived=new Promise(resolve=>{blocked=resolve;});const gate=new Promise(resolve=>{release=resolve;});
  const delay=async route=>{if(route.request().resourceType()==='fetch'&&/\.(mjs|js)(\?|$)/.test(route.request().url())){blocked();await gate;await route.abort().catch(()=>{});}else await route.continue();};
  await page.route('**/*',delay);await page.getByRole('button',{name:'Export atlas kit',exact:true}).click();await arrived;
  await page.getByRole('button',{name:'Cancel export',exact:true}).click();release();await page.unroute('**/*',delay);await page.getByRole('status').filter({hasText:'Export cancelled'}).waitFor();
  const files=await download(),manifest=JSON.parse(files.get('atlas.json')),exported=JSON.parse(files.get('recipe.json'));
  assert.deepEqual(exported,recipe);assert.equal(manifest.visualReview,'unapproved');assert.equal(manifest.stylesheet.format,'grout-art-css/1');
  const cli=await bakeArt({recipe:exported,output:scratch,includeCss:true});
  assert.equal(files.get('atlas.css').toString(),await fs.readFile(path.join(cli.directory,'atlas.css'),'utf8'));assert.deepEqual(manifest.stylesheet,cli.manifest.stylesheet);
  for(const [name,bytes]of files){
    if(name.endsWith('.png'))assert.deepEqual(await decoded(bytes),await decoded(await fs.readFile(path.join(cli.directory,name))));
    if(name!=='atlas.json'){const entry=manifest.files.find(f=>f.path===name);assert.equal(entry.sha256,hash(bytes));}
  }
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('grout-art-studio/1'))),recipe);
  receipt.checks.push('default export stays CSS-free; opt-in source failure/cancel/retry, manifest digests, PNG/recipe and CSS CLI parity');
  await page.screenshot({path:path.join(proof,`${lane}-desktop.png`)});
  await page.setViewportSize({width:390,height:844});await choice.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await choice.focus();await choice.press('Space');assert.equal(await choice.isChecked(),false);await choice.press('Space');assert.equal(await choice.isChecked(),true);
  const mobileFiles=await download();assert.deepEqual(mobileFiles.get('atlas.css'),files.get('atlas.css'));
  assert.ok(await page.locator('.art-studio-head').evaluate(el=>el.scrollWidth<=el.clientWidth));
  const exportBox=await page.getByRole('button',{name:'Export atlas kit',exact:true}).boundingBox();assert.ok(exportBox.x>=0&&exportBox.x+exportBox.width<=390);
  await choice.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(proof,`${lane}-mobile.png`)});
  await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});await choice.focus();await choice.press('Space');await choice.press('Space');assert.equal(await choice.isChecked(),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.emulateMedia({reducedMotion:'no-preference',forcedColors:'none'});
  await page.getByText('Export options',{exact:true}).click();await page.locator('.art-main-canvas').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(proof,`${lane}-closed-mobile.png`)});
  receipt.checks.push('desktop/narrow pointer and keyboard access, reduced motion and forced colors preserve the editable draft');
  await page.setViewportSize({width:1440,height:1000});
  const kit=buildArtExport(recipe);await cssPixels(kit,buildArtCss(kit),'traveler');
  const edge=createTravelerRecipe();edge.frames.push({name:'empty',anchor:[-3,21],layers:Object.fromEntries(edge.layers.map(l=>[l.id,{visible:false}]))});
  edge.clips={held:{frames:[edge.frames[0].name,'empty',edge.frames[1].name,edge.frames[1].name,edge.frames[0].name],fps:7}};
  const edgeKit=buildArtExport(edge,{atlas:{maxWidth:24,maxHeight:24}});assert.ok(edgeKit.atlas.pages.length>1);
  const edgeCss=buildArtCss(edgeKit,{classPrefix:'edge'});assert.deepEqual(edgeCss.metadata.frames.find(f=>f.name==='empty').anchor,[-3,21]);
  await cssPixels(edgeKit,edgeCss,'multipage');
  receipt.checks.push('actual CSS screenshots match every native frame, discrete clip tick/hold and loop; transparent frames, trim, multipage and custom anchors');
  assert.ok(receipt.expectedErrors.some(e=>e.includes('503')));assert.deepEqual(receipt.errors,[]);receipt.status='passed';
}catch(error){receipt.status='failed';receipt.error=error.stack;process.exitCode=1;console.error(error);await page?.screenshot({path:path.join(proof,`${lane}-failed.png`)}).catch(()=>{});}
finally{
  try{await browser?.close();}finally{if(server){if(dev)await server.close();else await new Promise((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));}}
  await fs.rm(scratch,{recursive:true,force:true});
  receipt.finished=new Date().toISOString();await fs.mkdir(proof,{recursive:true});await fs.writeFile(path.join(proof,`${lane}-receipt.json`),JSON.stringify(receipt,null,2)+'\n');
}
console.log(JSON.stringify({lane,status:receipt.status,checks:receipt.checks.length,pixelComparisons:receipt.pixelComparisons,errors:receipt.errors}));
