import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createServer,preview} from 'vite';
import {generateMaterial,VOXEL_SURFACE_FAMILIES} from '../src/shader/material.mjs';
import {bakeMaterial} from './bake-material.mjs';

const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const seen=new Set();for(let i=0;i<args.length;i++){
  const name=args[i];if(!['--dev','--mode','--proof-out','--quick','--print-selection'].includes(name)||seen.has(name))throw Error('Unknown or duplicate browser option: '+name);
  seen.add(name);if(['--mode','--proof-out'].includes(name)){if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing browser option value: '+name);i++;}
}
const dev=args.includes('--dev'),mode=option('--mode')??'root',out=option('--proof-out');
if(!['root','pages'].includes(mode)||(dev&&seen.has('--mode')))throw Error('Use --dev or --mode root|pages');
const root=path.resolve(import.meta.dirname,'..'),proof=path.resolve(out??'.'),quick=args.includes('--quick'),lane=(dev?'dev':mode)+(quick?'-quick':'');
const selection={families:quick?['grass']:[...VOXEL_SURFACE_FAMILIES],seeds:quick?[1204]:[1204,1215,1233],sizes:quick?[32]:[32,512],qualification:!quick};
if(args.includes('--print-selection')){console.log(JSON.stringify(selection));process.exit(0);}
if(!out)throw Error('Use [--dev | --mode root|pages] --proof-out <directory>');
const channels=['albedo','height','normal','roughness'],hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt={lane,quick,started:new Date().toISOString(),checks:[],errors:[],expectedErrors:[],sources:[],canvasMatches:0,pngMatches:0};
let server,browser,page,injecting=false;
await fs.mkdir(proof,{recursive:true});const scratch=await fs.mkdtemp(path.join(path.dirname(proof),'voxel-browser-scratch-'));
function unzip(bytes){
  const files=new Map();
  for(let at=0;at+30<=bytes.length&&bytes.readUInt32LE(at)===0x04034b50;){
    assert.equal(bytes.readUInt16LE(at+8),0);const size=bytes.readUInt32LE(at+18),n=bytes.readUInt16LE(at+26),extra=bytes.readUInt16LE(at+28),start=at+30+n+extra;
    assert.ok(start+size<=bytes.length);const name=bytes.toString('utf8',at+30,at+30+n);assert.ok(!files.has(name));files.set(name,bytes.subarray(start,start+size));at=start+size;
  }
  return files;
}
async function canvasPixels(label){
  return page.getByLabel(label,{exact:true}).evaluate(async canvas=>{
    const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    return {width:canvas.width,height:canvas.height,hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('')};
  });
}
async function matches(recipe,channel){
  const expected=generateMaterial(recipe).channels[channel],wanted=hash(expected.data);
  await page.waitForFunction(async({wanted,size})=>{const c=document.querySelector('[aria-label="Material channel preview"]');if(!c||c.width!==size)return false;const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');return h===wanted;},{wanted,size:expected.width});
  assert.deepEqual(await canvasPixels('Material channel preview'),{width:expected.width,height:expected.height,hash:wanted});receipt.canvasMatches++;
}
async function decoded(bytes){
  return page.evaluate(async encoded=>{
    const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:'image/png'}));
    try{const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);return {width:c.width,height:c.height,hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,c.width,c.height).data))].map(n=>n.toString(16).padStart(2,'0')).join('')};}finally{bitmap.close();}
  },bytes.toString('base64'));
}
async function exportAndCheck(){
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Save material channels',exact:true}).click();const download=await pending;
  let files;try{files=unzip(await fs.readFile(await download.path()));}finally{await download.delete();}
  const recipe=JSON.parse(files.get('recipe.json')),manifest=JSON.parse(files.get('material.json'));
  assert.equal(recipe.id,'voxel-surface');assert.equal(manifest.generator,'voxel-surface/1');assert.equal(manifest.visualReview,'unapproved');assert.deepEqual(manifest.recipe,recipe);
  assert.ok(manifest.sources.some(s=>s.path.includes('material-voxel')));assert.deepEqual(manifest.provenance,{author:'original procedural work for our projects',restrictedInputs:[],training:false});
  const cli=await bakeMaterial({recipe,output:scratch,variantSet:'single'}),expected=generateMaterial(recipe);
  for(const channel of channels){
    const entry=manifest.files.find(f=>f.channel===channel),bytes=files.get(entry.path),wanted={width:recipe.size,height:recipe.size,hash:hash(expected.channels[channel].data)};
    assert.equal(entry.sha256,hash(bytes));assert.equal(entry.filter,'nearest');assert.equal(entry.wrap,'repeat');assert.deepEqual(await decoded(bytes),wanted);
    assert.deepEqual(await decoded(await fs.readFile(path.join(cli.directory,entry.path))),wanted);receipt.pngMatches++;
  }
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('cliff-material-v1'))),recipe);return recipe;
}
async function openRecovered(){
  await page.getByLabel('Material recipe',{exact:true}).waitFor({state:'attached'});
  const adjust=page.getByRole('button',{name:'Adjust',exact:true});if(await adjust.getAttribute('aria-expanded')!=='true')await adjust.click();
  if(!await page.locator('.material-panel').evaluate(el=>el.open))await page.locator('.material-panel summary').click();
  await page.getByLabel('Block material',{exact:true}).waitFor();await page.getByLabel('Material repeat',{exact:true}).selectOption('1');
}
try{
  for(const relative of ['src/shader/material.mjs','src/shader/material-voxel.mjs','src/shader/material.d.mts','src/shader/material-browser.mjs','src/components/material-panel.tsx','src/components/mill-app.tsx','src/styles.css','scripts/bake-material.mjs','scripts/test-material-voxel-browser.mjs','vite.config.ts','package-lock.json'])receipt.sources.push({path:relative,sha256:hash(await fs.readFile(path.join(root,relative)))});
  if(dev){server=await createServer({root,mode:'development',server:{host:'127.0.0.1',port:0,open:false}});await server.listen();}
  else server=await preview({root,mode:mode==='pages'?'pages':'production',preview:{host:'127.0.0.1',port:0,open:false}});
  receipt.url=`http://127.0.0.1:${server.httpServer.address().port}/${!dev&&mode==='pages'?'mountain-cabin-bloom-honey/':''}`;
  browser=await chromium.launch({channel:'chrome',headless:true});receipt.browser=browser.version();page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,acceptDownloads:true});
  page.on('pageerror',e=>receipt.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')(injecting?receipt.expectedErrors:receipt.errors).push(m.text());});
  await page.addInitScript(()=>localStorage.setItem('grout-shader-v1',JSON.stringify({animate:false})));await page.goto(receipt.url);
  await page.getByLabel('Material recipe',{exact:true}).waitFor({state:'attached'});await page.getByRole('button',{name:/Minecraft-style · 16 px/}).click();
  await page.getByLabel('Block material',{exact:true}).waitFor();assert.equal(await page.getByLabel('Material size',{exact:true}).inputValue(),'16');
  await page.getByLabel('Material repeat',{exact:true}).selectOption('1');
  for(const family of selection.families){
    await page.getByLabel('Block material',{exact:true}).selectOption(family);
    for(const seed of selection.seeds){await page.getByLabel('Material seed',{exact:true}).fill(String(seed));for(const channel of channels){await page.getByLabel('Material channel',{exact:true}).selectOption(channel);await matches({id:'voxel-surface',family,seed},channel);}}
    await page.getByLabel('Material seed',{exact:true}).fill('1204');await exportAndCheck();
  }
  receipt.checks.push(`direct catalog entry opens native16; ${selection.families.length} families × ${selection.seeds.length} seeds × four channel canvases; each native family ZIP matches Node and CLI PNG pixels`);
  await page.getByLabel('Block material',{exact:true}).selectOption('grass');await page.getByLabel('Material channel',{exact:true}).selectOption('albedo');
  for(const size of selection.sizes){await page.getByLabel('Material size',{exact:true}).selectOption(String(size));await matches({id:'voxel-surface',size},'albedo');await exportAndCheck();}
  await page.getByLabel('Material size',{exact:true}).selectOption('16');
  const scale=page.getByLabel('Material cluster scale',{exact:true});await scale.focus();await scale.press('ArrowRight');await matches({id:'voxel-surface',strataScale:5},'albedo');await scale.press('ArrowLeft');
  await page.getByLabel('Material repeat',{exact:true}).selectOption('4');
  const main=page.getByLabel('Active material preview',{exact:true});await main.waitFor();
  const geometry=await main.evaluate(c=>({width:c.width,cssWidth:c.getBoundingClientRect().width,dpr:devicePixelRatio}));assert.equal(geometry.width,64);assert.ok(Math.abs(geometry.cssWidth*geometry.dpr/geometry.width-Math.round(geometry.cssWidth*geometry.dpr/geometry.width))<.001);
  receipt.checks.push('32/512 exports retain exact native enlargement; keyboard cluster scale and integer device-pixel repeat preview');
  await page.reload();await openRecovered();await matches({id:'voxel-surface'},'albedo');
  const fault=route=>/material[^/]*\.mjs$/.test(new URL(route.request().url()).pathname)?route.fulfill({status:503,contentType:'text/plain',body:'Injected voxel source failure'}):route.continue();
  injecting=true;await page.route('**/*',fault);await page.getByRole('button',{name:'Save material channels',exact:true}).click();await page.locator('.material-panel [role="status"]').filter({hasText:'source identity unavailable'}).waitFor();await page.unroute('**/*',fault);injecting=false;await exportAndCheck();
  receipt.checks.push('saved native recipe recovers on reload; source identity failure preserves the draft and exports successfully after retry');
  await page.locator('.material-panel').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(proof,`${lane}-desktop.png`)});
  await page.setViewportSize({width:390,height:844});await page.getByLabel('Block material',{exact:true}).selectOption('brick');await matches({id:'voxel-surface',family:'brick'},'albedo');await exportAndCheck();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.getByLabel('Block material',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(proof,`${lane}-mobile.png`)});
  await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});await page.getByLabel('Block material',{exact:true}).focus();await page.getByLabel('Block material',{exact:true}).press('Home');await matches({id:'voxel-surface'},'albedo');await page.emulateMedia({reducedMotion:'no-preference',forcedColors:'none'});
  // The narrow Adjust drawer covers the catalog until its owner closes it.
  const adjust=page.getByRole('button',{name:'Adjust',exact:true});if(await adjust.getAttribute('aria-expanded')==='true')await adjust.click();
  await page.getByRole('button',{name:/Photorealistic materials/}).click();await page.getByLabel('Realistic material family',{exact:true}).waitFor();assert.equal(await page.getByLabel('Material size',{exact:true}).inputValue(),'512');
  await page.getByLabel('Material recipe',{exact:true}).selectOption('style-surface');assert.equal(await page.getByLabel('Material size',{exact:true}).inputValue(),'128');assert.equal(await page.getByLabel('Material size',{exact:true}).locator('option[value="16"]').count(),0);
  receipt.checks.push('real narrow download and keyboard/forced-color/reduced-motion access; existing realistic and style recipe defaults and valid sizes remain');
  assert.ok(receipt.expectedErrors.some(e=>e.includes('503')));assert.deepEqual(receipt.errors,[]);receipt.status='passed';
}catch(error){receipt.status='failed';receipt.error=error.stack;process.exitCode=1;console.error(error);await page?.screenshot({path:path.join(proof,`${lane}-failed.png`)}).catch(()=>{});}
finally{
  try{await browser?.close();}finally{if(server){if(dev)await server.close();else await new Promise((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));}}
  await fs.rm(scratch,{recursive:true,force:true});receipt.finished=new Date().toISOString();await fs.writeFile(path.join(proof,`${lane}-receipt.json`),JSON.stringify(receipt,null,2)+'\n');
}
console.log(JSON.stringify({lane,status:receipt.status,checks:receipt.checks.length,canvasMatches:receipt.canvasMatches,pngMatches:receipt.pngMatches,errors:receipt.errors}));
