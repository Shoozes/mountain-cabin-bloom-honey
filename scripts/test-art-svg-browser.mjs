import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {createServer,preview} from 'vite';
import {buildArtExport,buildArtSvgs,createTravelerRecipe,createExampleRecipe,importSpritePixels} from '../packages/grout-art/index.mjs';
import {bakeArt,ART_SOURCE_PATHS} from './bake-art.mjs';

const args=process.argv.slice(2),seen=new Set(),options={};
for(let i=0;i<args.length;i++){
  const name=args[i];if(!['--dev','--mode','--proof-out','--diagnostic-blobs','--print-selection'].includes(name)||seen.has(name))throw Error('Unknown or duplicate option: '+name);
  seen.add(name);if(['--dev','--diagnostic-blobs','--print-selection'].includes(name))options[name]=true;else{if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing option value: '+name);options[name]=args[++i];}
}
const dev=!!options['--dev'],mode=options['--mode']??'root',out=options['--proof-out'],diagnostic=!!options['--diagnostic-blobs'];
if(!['root','pages'].includes(mode)||(dev&&seen.has('--mode')))throw Error('Use --dev or --mode root|pages');
const selection={lane:(dev?'dev':mode)+(diagnostic?'-diagnostic':''),qualification:!diagnostic,downloadMethod:diagnostic?'diagnostic-blob-capture':'completed-browser-download'};
if(options['--print-selection']){console.log(JSON.stringify(selection));process.exit(0);}
if(!out)throw Error('Use --proof-out <directory>');
const root=path.resolve(import.meta.dirname,'..'),proof=path.resolve(out),lane=selection.lane,hash=b=>createHash('sha256').update(b).digest('hex');
const receipt={...selection,started:new Date().toISOString(),checks:[],errors:[],expectedErrors:[],sources:[],svgFrames:0,pixelComparisons:0};
const runtimeFile=path.join(root,'.runtime',`svg-browser-${lane}.json`);
await fs.mkdir(proof,{recursive:true});await fs.mkdir(path.dirname(runtimeFile),{recursive:true});
let owner={pid:process.pid,executable:process.execPath};
if(process.platform==='win32')owner=JSON.parse(execFileSync('pwsh',['-NoProfile','-Command',`$owned=Get-CimInstance Win32_Process -Filter 'ProcessId=${process.pid}'; [pscustomobject]@{pid=$owned.ProcessId;created=$owned.CreationDate.ToUniversalTime().ToString('o');executable=$owned.ExecutablePath} | ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true}));
const lease={owner:'svg-export-20261023',lane,...owner,status:'starting',output:proof,lifetime:'one browser qualification invocation',shutdown:'finally: close browser, close Vite server, remove exact mkdtemp scratch; verify endpoint release'};
const saveLease=()=>fs.writeFile(runtimeFile,JSON.stringify(lease,null,2)+'\n');
await saveLease();
const scratch=await fs.mkdtemp(path.join(path.dirname(proof),'svg-browser-scratch-'));lease.scratch=scratch;
let server,browser,page,injecting=false,port;
function unzip(bytes){
  const files=new Map();
  for(let at=0;at+30<=bytes.length&&bytes.readUInt32LE(at)===0x04034b50;){
    assert.equal(bytes.readUInt16LE(at+8),0);const size=bytes.readUInt32LE(at+18),n=bytes.readUInt16LE(at+26),extra=bytes.readUInt16LE(at+28),start=at+30+n+extra;
    assert.ok(start+size<=bytes.length);const name=bytes.toString('utf8',at+30,at+30+n);assert.ok(!files.has(name));files.set(name,bytes.subarray(start,start+size));at=start+size;
  }return files;
}
async function download(){
  receipt.step='download';console.log('SVG browser: download');
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export atlas kit',exact:true}).click();const file=await pending;
  let timer;
  try{
    if(diagnostic){
      // Inspect the exact UI-generated ZIP without treating an unfinished native
      // download as successful. Cancel it; this mode cannot qualify release.
      const bytes=await page.evaluate(async url=>{
        const blob=window.__svgProofBlobs.get(url);if(!blob)throw Error('Missing diagnostic export blob');
        window.__svgProofBlobs.delete(url);return Array.from(new Uint8Array(await blob.arrayBuffer()));
      },file.url());
      await file.cancel();return unzip(Buffer.from(bytes));
    }
    const saved=await Promise.race([file.path(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Browser download did not finish within 15 seconds')),15000);})]);
    return unzip(await fs.readFile(saved));
  }finally{clearTimeout(timer);await file.cancel().catch(()=>{});}
}
function scaledHash(frame,scale){
  const rows=[];
  for(let y=0;y<frame.height;y++){
    const row=Buffer.concat(Array.from({length:frame.width},(_,x)=>Buffer.concat(Array.from({length:scale},()=>frame.data.subarray((y*frame.width+x)*4,(y*frame.width+x+1)*4)))));
    for(let i=0;i<scale;i++)rows.push(row);
  }return hash(Buffer.concat(rows));
}
async function raster(bytes,scale,type){
  return page.evaluate(async({encoded,scale,type})=>{
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    if(type==='image/svg+xml'){
      const doc=new DOMParser().parseFromString(new TextDecoder().decode(bytes),type);if(doc.querySelector('parsererror'))throw Error('Invalid SVG XML');
      for(const el of doc.querySelectorAll('*')){
        if(!['svg','path'].includes(el.localName))throw Error('Unexpected SVG element');
        const allowed=el.localName==='svg'?['xmlns','width','height','viewBox','shape-rendering']:['fill','d'];
        for(const a of el.attributes)if(!allowed.includes(a.name))throw Error('Unexpected SVG attribute');
      }
    }
    const url=URL.createObjectURL(new Blob([bytes],{type})),image=new Image();
    try{
      image.src=url;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth*scale;c.height=image.naturalHeight*scale;
      const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0,c.width,c.height);
      return {width:c.width,height:c.height,hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,c.width,c.height).data))].map(n=>n.toString(16).padStart(2,'0')).join('')};
    }finally{URL.revokeObjectURL(url);}
  },{encoded:Buffer.from(bytes).toString('base64'),scale,type});
}
async function verifySvg(recipe,files,metadata,tag){
  const kit=buildArtExport(recipe);assert.equal(metadata.format,'grout-art-svg/1');assert.equal(metadata.frames.length,recipe.frames.length);
  for(const [i,entry]of metadata.frames.entries()){
    assert.deepEqual(entry,{name:recipe.frames[i].name,path:`frame-${recipe.frames[i].name}.svg`,width:recipe.width,height:recipe.height,anchor:recipe.frames[i].anchor});
    for(const scale of [1,3])assert.deepEqual(await raster(files.get(entry.path),scale,'image/svg+xml'),{width:recipe.width*scale,height:recipe.height*scale,hash:scaledHash(kit.frames[i],scale)},`${tag}/${entry.name}/${scale}x`);
    receipt.svgFrames++;receipt.pixelComparisons+=2;
  }
}
async function generated(recipe,tag){const vectors=await buildArtSvgs(buildArtExport(recipe));await verifySvg(recipe,new Map(vectors.files.map(f=>[f.name,f.data])),vectors.metadata,tag);}
try{
  for(const name of [...ART_SOURCE_PATHS,'packages/grout-art/index.d.mts','src/art/art-export.ts','src/components/art-studio.tsx','src/art/studio.css','scripts/bake-art.mjs','scripts/test-art-svg-browser.mjs','package-lock.json','vite.config.ts'])receipt.sources.push({path:name,sha256:hash(await fs.readFile(path.join(root,name)))});
  if(dev){server=await createServer({root,mode:'development',server:{host:'127.0.0.1',port:0,open:false}});await server.listen();}
  else server=await preview({root,mode:mode==='pages'?'pages':'production',preview:{host:'127.0.0.1',port:0,open:false}});
  port=server.httpServer.address().port;receipt.url=`http://127.0.0.1:${port}/${!dev&&mode==='pages'?'mountain-cabin-bloom-honey/':''}`;
  Object.assign(lease,{status:'running',endpoint:receipt.url,port});await saveLease();
  browser=await chromium.launch({channel:'chrome',headless:true});receipt.browser=browser.version();page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,acceptDownloads:true});
  page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(15000);
  if(diagnostic)await page.addInitScript(()=>{
    window.__svgProofBlobs=new Map();const original=URL.createObjectURL.bind(URL);
    URL.createObjectURL=blob=>{const url=original(blob);if(blob instanceof Blob&&blob.type==='application/zip')window.__svgProofBlobs.set(url,blob);return url;};
  });
  page.on('pageerror',e=>receipt.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')(injecting?receipt.expectedErrors:receipt.errors).push(m.text());});
  await page.goto(receipt.url+'studio',{waitUntil:'domcontentloaded'});await page.locator('.art-studio[aria-busy="false"]').waitFor();await page.getByRole('combobox',{name:/Renderer/}).selectOption('cpu');
  const recipe=await page.evaluate(()=>JSON.parse(localStorage.getItem('grout-art-studio/1')));
  await page.getByText('Export options',{exact:true}).click();const svg=page.getByRole('checkbox',{name:'Include SVG frames',exact:true}),css=page.getByRole('checkbox',{name:'Include CSS sprites',exact:true}),gif=page.getByRole('checkbox',{name:'Include animated GIFs',exact:true});
  assert.equal(await svg.isChecked(),false);const plain=await download();assert.equal(JSON.parse(plain.get('atlas.json')).vectors,undefined);assert.ok(![...plain.keys()].some(n=>n.endsWith('.svg')));
  await svg.check();await css.check();await gif.check();receipt.step='source failure';console.log('SVG browser: source failure');
  const fault=route=>route.request().resourceType()==='fetch'&&/\.(mjs|js)(\?|$)/.test(route.request().url())?route.fulfill({status:503,contentType:'text/plain',body:'Injected source failure'}):route.continue();
  injecting=true;await page.route('**/*',fault);await page.getByRole('button',{name:'Export atlas kit',exact:true}).click();await page.getByRole('alert').filter({hasText:'source identity unavailable'}).waitFor();await page.unroute('**/*',fault);injecting=false;
  receipt.step='cancellation';console.log('SVG browser: cancellation');
  let release,arrive;const arrived=new Promise(resolve=>{arrive=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  const delay=async route=>{if(route.request().resourceType()==='fetch'&&/\.(mjs|js)(\?|$)/.test(route.request().url())){arrive();await gate;await route.abort().catch(()=>{});}else await route.continue();};
  await page.route('**/*',delay);await page.getByRole('button',{name:'Export atlas kit',exact:true}).click();
  let arrivalTimer;try{await Promise.race([arrived,new Promise((_,reject)=>{arrivalTimer=setTimeout(()=>reject(Error('Source interception did not arrive')),15000);})]);}finally{clearTimeout(arrivalTimer);}
  assert.equal(await svg.isDisabled(),true);
  await page.getByRole('button',{name:'Cancel export',exact:true}).click();release();await page.unroute('**/*',delay);await page.getByRole('status').filter({hasText:'Export cancelled'}).waitFor();
  const files=await download(),manifest=JSON.parse(files.get('atlas.json'));assert.deepEqual(JSON.parse(files.get('recipe.json')),recipe);assert.equal(manifest.visualReview,'unapproved');assert.ok(manifest.sources.some(s=>s.path.includes('svg')));
  receipt.step='CLI parity';console.log('SVG browser: CLI parity');
  const cli=await bakeArt({recipe,output:scratch,includeSvg:true,includeCss:true,includeGif:true});assert.deepEqual(manifest.vectors,cli.manifest.vectors);assert.deepEqual(manifest.stylesheet,cli.manifest.stylesheet);assert.deepEqual(manifest.animations,cli.manifest.animations);
  for(const [name,bytes]of files){
    if(name.endsWith('.png')){assert.deepEqual(bytes,plain.get(name));assert.deepEqual(await raster(bytes,1,'image/png'),await raster(await fs.readFile(path.join(cli.directory,name)),1,'image/png'));}
    if(name.endsWith('.svg')||name.endsWith('.gif')||name==='atlas.css')assert.deepEqual(bytes,await fs.readFile(path.join(cli.directory,name)),name);
    if(name!=='atlas.json'){const entry=manifest.files.find(f=>f.path===name);assert.equal(entry.sha256,hash(bytes));assert.equal(entry.bytes,bytes.length);}
  }
  await verifySvg(recipe,files,manifest.vectors,'download');await css.uncheck();await gif.uncheck();const onlySvg=await download();assert.deepEqual(JSON.parse(onlySvg.get('atlas.json')).vectors,manifest.vectors);
  for(const frame of manifest.vectors.frames)assert.deepEqual(onlySvg.get(frame.path),files.get(frame.path));
  receipt.checks.push('default-off, SVG-only and combined SVG/CSS/GIF downloads; source failure/cancel/retry, exact manifest/digests/CLI bytes and unchanged PNG/recipe');
  await svg.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(proof,`${lane}-desktop.png`)});
  await page.setViewportSize({width:390,height:844});await svg.scrollIntoViewIfNeeded();await svg.focus();await svg.press('Space');assert.equal(await svg.isChecked(),false);await svg.press('Space');
  const mobile=await download();for(const f of manifest.vectors.frames)assert.deepEqual(mobile.get(f.path),files.get(f.path));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const box=await page.getByRole('button',{name:'Export atlas kit',exact:true}).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
  await svg.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(proof,`${lane}-mobile.png`)});
  await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});await svg.focus();await svg.press('Space');await svg.press('Space');assert.equal(await svg.isChecked(),true);await page.emulateMedia({reducedMotion:'no-preference',forcedColors:'none'});
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('grout-art-studio/1'))),recipe);
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.art-studio[aria-busy="false"]').waitFor();await page.getByText('Export options',{exact:true}).click();assert.equal(await svg.isChecked(),false);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('grout-art-studio/1'))),recipe);
  receipt.checks.push('real narrow download, keyboard/reduced-motion/forced-color access, unchanged recovery and transient option reset');
  for(const corners of ['stepped','square'])for(const width of [1,2,3]){const r=createTravelerRecipe();r.outline={enabled:true,color:'#26323f',width,corners};await generated(r,`outline-${corners}-${width}`);}
  const data=new Uint8Array(7*5*4);for(let p=0;p<35;p++)if(p%3)data.set(p%2?[5,17,129,255]:[230,39,51,255],p*4);
  const imported=await importSpritePixels({width:7,height:5,data});imported.palette.duplicate=Object.values(imported.palette)[0];imported.frames.push({name:'blank',anchor:[-3,8],layers:Object.fromEntries(imported.layers.map(l=>[l.id,{visible:false}]))});imported.clips={};await generated(imported,'non-square-holes-blank');
  const palette=new Uint8Array(257*4);for(let i=0;i<256;i++)palette.set([i,i^0xaa,i^0x55,255],i*4);await generated(await importSpritePixels({width:257,height:1,data:palette}),'256-colors-cutout');
  await generated(createExampleRecipe('custom-technique'),'custom-technique');
  const maximum=createExampleRecipe('geometry');maximum.width=512;maximum.height=1;maximum.parts.study=[{op:'rect',x:0,y:0,w:512,h:1,role:'cloth'}];await generated(maximum,'512-wide');
  receipt.checks.push('independent native/3x SVG rasterization: outlines 1/2/3 with both corner modes, holes, blank frames, duplicate colors, negative anchors, 256-color cutout, portable technique and 512px width');
  assert.ok(receipt.expectedErrors.some(e=>e.includes('503')));assert.deepEqual(receipt.errors,[]);receipt.status='passed';
}catch(error){receipt.status='failed';receipt.error=error.stack;process.exitCode=1;console.error(error);await page?.screenshot({path:path.join(proof,`${lane}-failed.png`)}).catch(()=>{});}
finally{
  const failures=[];
  try{await browser?.close();}catch(error){failures.push('browser: '+error.message);}
  try{if(server){if(dev)await server.close();else await new Promise((resolve,reject)=>server.httpServer.close(e=>e?reject(e):resolve()));}}catch(error){failures.push('server: '+error.message);}
  try{assert.equal(path.dirname(scratch),path.dirname(proof));assert.ok(path.basename(scratch).startsWith('svg-browser-scratch-'));await fs.rm(scratch,{recursive:true,force:true});}catch(error){failures.push('scratch: '+error.message);}
  if(port){const probe=net.createServer();try{await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(port,'127.0.0.1',resolve);});await new Promise(resolve=>probe.close(resolve));lease.endpointReleased=true;}catch(error){failures.push('endpoint: '+error.message);}}
  if(failures.length){receipt.status='failed';receipt.cleanupErrors=failures;process.exitCode=1;}
  receipt.finished=new Date().toISOString();Object.assign(lease,{status:failures.length?'cleanup failed':'closed',closed:receipt.finished,scratchReleased:!failures.some(f=>f.startsWith('scratch:')),cleanupErrors:failures});await saveLease();
  receipt.resources={ownerReceipt:runtimeFile,endpointReleased:lease.endpointReleased,scratchReleased:lease.scratchReleased,cleanupErrors:failures};
  await fs.writeFile(path.join(proof,`${lane}-receipt.json`),JSON.stringify(receipt,null,2)+'\n');
}
console.log(JSON.stringify({lane,status:receipt.status,checks:receipt.checks.length,svgFrames:receipt.svgFrames,pixelComparisons:receipt.pixelComparisons,errors:receipt.errors,resources:receipt.resources}));
