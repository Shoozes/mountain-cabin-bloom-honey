import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createServer,preview} from 'vite';
import {generateMaterial} from '../src/shader/material.mjs';

const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const dev=args.includes('--dev'),mode=option('--mode')??'root',out=option('--proof-out');
if(!out||!['root','pages'].includes(mode))throw Error('Use [--dev | --mode root|pages] --proof-out <directory>');
const root=path.resolve(import.meta.dirname,'..'),proof=path.resolve(out),lane=dev?'dev':mode;
const channels=['albedo','height','normal','roughness'],hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const base={id:'style-surface',family:'grass',style:'hd2d',seed:1204,size:128};
const receipt={lane,started:new Date().toISOString(),checks:[],errors:[],expectedErrors:[],sources:[]};
let server,browser,page,injecting=false;
function unzip(bytes){
  const files=new Map();
  for(let at=0;at+30<=bytes.length&&bytes.readUInt32LE(at)===0x04034b50;){
    assert.equal(bytes.readUInt16LE(at+8),0);
    const size=bytes.readUInt32LE(at+18),n=bytes.readUInt16LE(at+26),extra=bytes.readUInt16LE(at+28),start=at+30+n+extra;
    assert.ok(start+size<=bytes.length);const name=bytes.toString('utf8',at+30,at+30+n);assert.ok(!files.has(name));
    files.set(name,bytes.subarray(start,start+size));at=start+size;
  }
  assert.ok(files.size);return files;
}
async function panelPixels(){
  return page.getByLabel('Material channel preview',{exact:true}).evaluate(async canvas=>{
    const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');
    return {width:canvas.width,height:canvas.height,hash:digest};
  });
}
async function matches(recipe,channel){
  const expected=generateMaterial(recipe).channels[channel],wanted=hash(expected.data),until=Date.now()+10000;
  do{
    const actual=await panelPixels();
    if(actual.hash===wanted){assert.deepEqual([actual.width,actual.height],[expected.width,expected.height]);return actual;}
    await page.waitForTimeout(30);
  }while(Date.now()<until);
  assert.fail(`${channel} did not match the independent Node generator`);
}
async function openMaterial(url){
  await page.goto(url);
  await page.waitForFunction(()=>document.querySelector('[aria-label="Material family"]')?.value==='grass');
  const adjust=page.getByRole('button',{name:'Adjust',exact:true});
  if(await adjust.getAttribute('aria-expanded')!=='true')await adjust.click();
  await page.waitForFunction(()=>document.querySelector('.details')?.dataset.open==='true');
  await page.locator('.material-panel summary').click();
  await page.getByLabel('Material channel preview',{exact:true}).waitFor();
  await page.getByLabel('Material repeat',{exact:true}).selectOption('1');
}
try{
  await fs.mkdir(proof,{recursive:true});
  for(const relative of ['src/shader/material.mjs','src/shader/material.d.mts','src/shader/material-browser.mjs','src/components/material-panel.tsx','scripts/test-material-grass-browser.mjs','vite.config.ts','package-lock.json'])receipt.sources.push({path:relative,sha256:hash(await fs.readFile(path.join(root,relative)))});
  if(dev){server=await createServer({root,mode:'development',server:{host:'127.0.0.1',port:0,open:false}});await server.listen();}
  else server=await preview({root,mode:mode==='pages'?'pages':'production',preview:{host:'127.0.0.1',port:0,open:false}});
  receipt.url=`http://127.0.0.1:${server.httpServer.address().port}/${!dev&&mode==='pages'?'mountain-cabin-bloom-honey/':''}`;
  browser=await chromium.launch({channel:'chrome',headless:true});receipt.browser=browser.version();
  page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  page.on('pageerror',error=>receipt.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')(injecting?receipt.expectedErrors:receipt.errors).push(message.text());});
  await page.addInitScript(recipe=>{
    if(!localStorage.getItem('cliff-material-v1'))localStorage.setItem('cliff-material-v1',JSON.stringify(recipe));
    localStorage.setItem('grout-shader-v1',JSON.stringify({animate:false}));
  },base);
  await openMaterial(receipt.url);
  let structure=page.getByLabel('Grass structure',{exact:true});
  assert.equal(await structure.inputValue(),'legacy');await matches(base,'albedo');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cliff-material-v1')).structure),undefined);
  receipt.checks.push('legacy grass draft hydrates without a structure field and preserves its original pixels');
  await structure.selectOption('tufts');
  await page.getByLabel('Material tuft scale',{exact:true}).waitFor();
  for(const seed of [1204,1215,1233]){
    await page.getByLabel('Material seed',{exact:true}).fill(String(seed));
    for(const channel of channels){
      await page.getByLabel('Material channel',{exact:true}).selectOption(channel);
      await matches({...base,seed,structure:'tufts'},channel);
    }
  }
  receipt.checks.push('three seeds and all four browser channels exactly match Node pixels');
  await page.getByLabel('Material seed',{exact:true}).fill('1204');
  await page.getByLabel('Material channel',{exact:true}).selectOption('albedo');
  await structure.focus();await structure.press('Home');assert.equal(await structure.inputValue(),'legacy');await matches(base,'albedo');
  await structure.press('End');assert.equal(await structure.inputValue(),'tufts');await matches({...base,structure:'tufts'},'albedo');
  const tuftScale=page.getByLabel('Material tuft scale',{exact:true});await tuftScale.focus();await tuftScale.press('ArrowRight');await tuftScale.press('ArrowRight');
  assert.equal(await tuftScale.inputValue(),'6');await matches({...base,structure:'tufts',strataScale:6},'albedo');
  await tuftScale.press('ArrowLeft');await tuftScale.press('ArrowLeft');assert.equal(await tuftScale.inputValue(),'4');await matches({...base,structure:'tufts'},'albedo');
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Material family"]')?.value==='grass');
  const adjust=page.getByRole('button',{name:'Adjust',exact:true});if(await adjust.getAttribute('aria-expanded')!=='true')await adjust.click();
  await page.waitForFunction(()=>document.querySelector('.details')?.dataset.open==='true');await page.locator('.material-panel summary').click();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Grass structure"]')?.value==='tufts');
  await page.getByLabel('Material repeat',{exact:true}).selectOption('1');
  await matches({...base,structure:'tufts'},'albedo');
  receipt.checks.push('reload restores the opt-in tuft recipe and pixels');
  await page.getByLabel('Material style',{exact:true}).selectOption('cel-ink');
  assert.equal(await page.getByLabel('Grass structure',{exact:true}).count(),0);
  await page.getByLabel('Material style',{exact:true}).selectOption('hd2d');
  structure=page.getByLabel('Grass structure',{exact:true});assert.equal(await structure.inputValue(),'legacy');
  receipt.checks.push('leaving HD-2D clears the unsupported tuft option');
  await structure.selectOption('tufts');
  await page.getByLabel('Material family',{exact:true}).selectOption('dirt');
  let dirtStructure=page.getByLabel('Dirt structure',{exact:true});assert.equal(await dirtStructure.inputValue(),'legacy');
  await dirtStructure.selectOption('clumps');await matches({id:'style-surface',family:'dirt',style:'hd2d',structure:'clumps',seed:1204,size:128},'albedo');
  await page.getByLabel('Material family',{exact:true}).selectOption('grass');
  structure=page.getByLabel('Grass structure',{exact:true});assert.equal(await structure.inputValue(),'legacy');
  await structure.selectOption('tufts');await matches({...base,structure:'tufts'},'albedo');
  receipt.checks.push('grass/dirt family switches clear incompatible tuft and clump options');
  const rejectSource=route=>{
    const pathname=new URL(route.request().url()).pathname;
    return /material[^/]*\.mjs$/.test(pathname)?route.fulfill({status:503,contentType:'text/plain',body:'Injected source failure'}):route.continue();
  };
  injecting=true;await page.route('**/*',rejectSource);
  await page.getByRole('button',{name:'Save material channels',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.material-panel [role="status"]')?.textContent.includes('source identity unavailable'));
  await page.unroute('**/*',rejectSource);injecting=false;
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Save material channels',exact:true}).click();
  const download=await pending,files=unzip(await fs.readFile(await download.path()));await download.delete();
  const recipe=JSON.parse(files.get('recipe.json').toString()),manifest=JSON.parse(files.get('material.json').toString());
  assert.equal(recipe.structure,'tufts');assert.equal(manifest.visualReview,'unapproved');assert.deepEqual(manifest.recipe,recipe);
  assert.deepEqual(manifest.provenance,{author:'original procedural work for our projects',restrictedInputs:[],training:false});
  for(const channel of channels){
    const bytes=files.get(`s1204-${channel}.png`),entry=manifest.files.find(file=>file.channel===channel);assert.equal(entry.sha256,hash(bytes));
    const decoded=await page.evaluate(async encoded=>{
      const image=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:'image/png'}));
      try{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,c.width,c.height).data))].map(n=>n.toString(16).padStart(2,'0')).join('');}finally{image.close();}
    },bytes.toString('base64'));
    assert.equal(decoded,hash(generateMaterial(recipe).channels[channel].data));
  }
  receipt.checks.push('source failure retries and exported PNGs, recipe and provenance retain all tuft pixels');
  await page.getByLabel('Material channel',{exact:true}).selectOption('albedo');
  await page.locator('.material-panel').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(proof,`${lane}-desktop.png`)});
  await page.setViewportSize({width:390,height:844});await structure.scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await structure.selectOption('legacy');await structure.selectOption('tufts');
  await page.getByLabel('Material channel',{exact:true}).selectOption('normal');
  await matches({...base,structure:'tufts'},'normal');
  await page.getByLabel('Material channel',{exact:true}).selectOption('albedo');
  await page.screenshot({path:path.join(proof,`${lane}-mobile.png`)});
  receipt.checks.push('desktop and narrow views keep controls reachable and preserve exact previews');
  assert.ok(receipt.expectedErrors.some(text=>text.includes('503')),'injected source failure is captured as expected');
  assert.deepEqual(receipt.errors,[]);receipt.status='passed';
}catch(error){receipt.status='failed';receipt.error=error.stack;process.exitCode=1;console.error(error);await page?.screenshot({path:path.join(proof,`${lane}-failed.png`)}).catch(()=>{});}
finally{
  try{await browser?.close();}finally{if(server){if(dev)await server.close();else await new Promise((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));}}
  receipt.finished=new Date().toISOString();await fs.mkdir(proof,{recursive:true});await fs.writeFile(path.join(proof,`${lane}-receipt.json`),JSON.stringify(receipt,null,2)+'\n');
}
console.log(JSON.stringify({lane,status:receipt.status,checks:receipt.checks.length,errors:receipt.errors}));
