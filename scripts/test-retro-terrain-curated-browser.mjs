import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {chromium} from 'playwright';
import {preview} from 'vite';
import {generateCuratedTerrain,composeCuratedTerrain,composeCuratedSurface,curatedArtSource,CURATED_FAMILIES,CURATED_RELATIONSHIPS} from '../src/shader/retro-terrain-curated.mjs';
import {bakeRetroTerrainCurated} from './bake-retro-terrain-curated.mjs';

const root=path.resolve(import.meta.dirname,'..'),devIndex=process.argv.indexOf('--dev-url'),dev=devIndex<0?null:process.argv[devIndex+1];
const caseAt=process.argv.indexOf('--case'),selectedCase=caseAt<0?null:process.argv[caseAt+1];
if(caseAt>=0&&!/^(16|64):(woodland|dry-trail|cool-moor):(1204|1215|1233)$/.test(selectedCase??''))throw Error('Use --case <size>:<palette>:<verification seed>');
if(dev&&!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(dev))throw Error('Use a loopback --dev-url');
const out=path.join(root,'.artifacts/proof/retro-terrain-curated-browser',`${Date.now()}-${process.pid}`);await fs.mkdir(out,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function unzip(bytes){const files=new Map();for(let at=0;at+30<bytes.length&&bytes.readUInt32LE(at)===0x04034b50;){assert.equal(bytes.readUInt16LE(at+8),0);const size=bytes.readUInt32LE(at+18),n=bytes.readUInt16LE(at+26),extra=bytes.readUInt16LE(at+28),start=at+30+n+extra;files.set(bytes.toString('utf8',at+30,at+30+n),bytes.subarray(start,start+size));at=start+size;}return files;}
function cliPixels(bytes){let width,height,parts=[];for(let at=8;at<bytes.length;){const size=bytes.readUInt32BE(at),type=bytes.toString('ascii',at+4,at+8),data=bytes.subarray(at+8,at+8+size);if(type==='IHDR'){width=data.readUInt32BE();height=data.readUInt32BE(4);}if(type==='IDAT')parts.push(data);at+=size+12;}const raw=inflateSync(Buffer.concat(parts)),data=Buffer.alloc(width*height*4);for(let y=0;y<height;y++){assert.equal(raw[y*(width*4+1)],0);raw.copy(data,y*width*4,y*(width*4+1)+1,(y+1)*(width*4+1));}return {width,height,hash:hash(data)};}
async function readUntil(page,fn){for(let i=0;i<60;i++){if(await page.evaluate(fn))return;await page.waitForTimeout(50);}throw Error('Browser state did not settle');}
async function pointerAt(page,selector,text){let previous;for(let attempt=0;attempt<60;attempt++){const rect=await page.evaluate(({selector,text})=>{const element=[...document.querySelectorAll(selector)].find(e=>!text||e.textContent.trim()===text),r=element?.getBoundingClientRect();if(!r)return null;const x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,ready:x>=0&&x<innerWidth&&y>=0&&y<innerHeight&&Boolean(hit&&(hit===element||element.contains(hit)))};},{selector,text});if(rect?.ready&&previous&&Math.abs(rect.x-previous.x)<.1&&Math.abs(rect.y-previous.y)<.1){await page.mouse.click(rect.x,rect.y);return;}previous=rect;await page.waitForTimeout(50);}throw Error('Pointer target did not settle: '+selector);}
async function openAdjust(page){await readUntil(page,()=>Boolean(document.querySelector('.details')));let last;for(let attempt=0;attempt<3;attempt++){if(await page.evaluate(()=>document.querySelector('.details')?.getAttribute('data-open')==='true'))return;await pointerAt(page,'.top-actions button','Adjust');try{await readUntil(page,()=>document.querySelector('.details')?.getAttribute('data-open')==='true');return;}catch(error){last=error;}}throw last;}
async function openRetro(page){await openAdjust(page);for(let attempt=0;attempt<3;attempt++){if(await page.evaluate(()=>document.querySelector('.retro-terrain-panel')?.open))break;await page.locator('.details').evaluate(e=>{e.scrollTop=0;});await pointerAt(page,'.retro-terrain-panel summary');try{await readUntil(page,()=>document.querySelector('.retro-terrain-panel')?.open===true);break;}catch(error){if(attempt===2)throw error;}}await page.getByLabel('Retro terrain preview',{exact:true}).waitFor({state:'visible'});}
async function canvasHash(page){return page.getByLabel('Retro terrain preview',{exact:true}).evaluate(async c=>{const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))].map(v=>v.toString(16).padStart(2,'0')).join('');});}
async function stageScale(page){const m=await page.locator('.stage canvas[aria-label="Active material preview"]').evaluate(c=>{const r=c.getBoundingClientRect();return {x:r.width*devicePixelRatio/c.width,y:r.height*devicePixelRatio/c.height,width:r.width,height:r.height};});for(const v of [m.x,m.y])assert.ok(v>=1&&Math.abs(v-Math.round(v))<1e-8,JSON.stringify(m));assert.equal(m.x,m.y);return m;}
async function sideScale(page,expectedWidth){
  await page.waitForFunction(expected=>{const c=document.querySelector('.retro-preview'),r=c?.getBoundingClientRect(),scale=r?.width*devicePixelRatio/c?.width;return (!expected||c?.width===expected)&&scale>=1&&Math.abs(scale-Math.round(scale))<1e-8;},expectedWidth);
  const m=await page.locator('.retro-preview').evaluate(c=>{const r=c.getBoundingClientRect(),v=c.parentElement;return {sourceWidth:c.width,x:r.width*devicePixelRatio/c.width,y:r.height*devicePixelRatio/c.height,viewportWidth:v.clientWidth,scrollWidth:v.scrollWidth};});
  assert.equal(m.x,m.y);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));return m;
}
async function shaderFailureCleanup(page){
  const result=await page.evaluate(async()=>{
    const {ShaderMill}=await import('/src/shader/engine.ts'),{STYLES}=await import('/src/shader/catalog.ts');
    const d=document.createElement('canvas'),u=document.createElement('canvas'),counts={createProgram:0,deleteProgram:0,createShader:0,deleteShader:0},proto=WebGLRenderingContext.prototype,originals={};
    for(const key of Object.keys(counts)){originals[key]=proto[key];proto[key]=function(...args){if(this.canvas===d||this.canvas===u)counts[key]++;return originals[key].apply(this,args);};}
    let mill;
    try {
      mill=new ShaderMill(d,u);const params={seed:1,scale:1,pixels:16,wear:0,repeat:1,time:0,look:0,colors:[[0,0,0],[.2,.2,.2],[.5,.5,.5],[1,1,1]]},invalid={id:'review-invalid-shader',glsl:'intentional invalid %% shader'};
      const failed=mill.drawDisplay(d,invalid,params),cachedFailure=mill.drawDisplay(d,invalid,params),message=mill.error(invalid.id),afterFailure={...counts};
      const valid=mill.drawUtil(u,STYLES[0],params);mill.dispose();mill=undefined;
      return {failed,cachedFailure,message,afterFailure,valid,afterDispose:counts};
    } finally {mill?.dispose();for(const key of Object.keys(counts))proto[key]=originals[key];}
  });
  assert.equal(result.failed,false);assert.equal(result.cachedFailure,false);assert.ok(result.message);assert.equal(result.valid,true);
  assert.deepEqual(result.afterFailure,{createProgram:1,deleteProgram:1,createShader:2,deleteShader:2});
  assert.deepEqual(result.afterDispose,{createProgram:2,deleteProgram:2,createShader:4,deleteShader:4});return result;
}
async function downloadFiles(page){await page.getByRole('button',{name:'Save terrain kit',exact:true}).scrollIntoViewIfNeeded();const pending=page.waitForEvent('download',{timeout:60000});await pointerAt(page,'.retro-terrain-panel button.primary','Save terrain kit');const dl=await pending;const files=unzip(await fs.readFile(await dl.path()));await dl.delete();return files;}
let server,browser,page,failure,injecting=false;const errors=[],proof={mode:dev?'dev':'pages',cases:[],screenshots:[],expectedFaults:[],selectedCase,navigationEvents:[]},cleanup=[];
proof.sources=await Promise.all(['src/components/retro-terrain-panel.tsx','src/components/mill-app.tsx','src/styles.css','src/shader/engine.ts','src/shader/retro-terrain-art.mjs','src/shader/retro-autotile.mjs','src/shader/retro-terrain-curated.mjs','src/shader/retro-terrain-browser.mjs','scripts/test-retro-terrain-curated-browser.mjs','scripts/bake-retro-terrain-curated.mjs'].map(async file=>({file,sha256:hash(await fs.readFile(path.join(root,file)))})));
try {
  if(!dev)server=await preview({root,mode:'pages',preview:{host:'127.0.0.1',port:0,open:false}});
  proof.url=dev??`http://127.0.0.1:${server.httpServer.address().port}/mountain-cabin-bloom-honey/`;
  proof.owner={pid:process.pid,startedAt:new Date().toISOString(),executable:process.execPath,endpoint:proof.url,lifetime:'This browser verification only',shutdown:'finally closes browser and owned preview server'};
  browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1440,height:1080}});page.setDefaultTimeout(12000);
  await page.addInitScript(()=>{window.terrainClicks=[];document.addEventListener('click',event=>{const button=event.target.closest?.('button');if(button){window.terrainClicks.push(button.textContent.trim());if(window.terrainClicks.length>24)window.terrainClicks.shift();}},true);});
  page.on('framenavigated',frame=>{if(frame===page.mainFrame()&&proof.navigationEvents.length<32)proof.navigationEvents.push({url:frame.url(),at:new Date().toISOString()});});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!injecting)errors.push(m.text());});
  await page.goto(proof.url);const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await openRetro(page);
  if(dev)proof.shaderFailureCleanup=await shaderFailureCleanup(page);
  await page.getByLabel('Terrain kit',{exact:true}).selectOption('retro-terrain-curated');
  proof.matrixSkipped=process.argv.includes('--flows-only');
  for(const tileSize of (proof.matrixSkipped?[]:[16,64]))for(const palette of ['woodland','dry-trail','cool-moor'])for(const seed of [1204,1215,1233]) {
    if(selectedCase&&selectedCase!==`${tileSize}:${palette}:${seed}`)continue;
    await page.getByLabel('Terrain size',{exact:true}).selectOption(String(tileSize));await page.getByLabel('Terrain palette',{exact:true}).selectOption(palette);await page.getByLabel('Terrain seed',{exact:true}).fill(String(seed));await page.getByLabel('Terrain tile',{exact:true}).selectOption('patch');
    const recipe={id:'retro-terrain-curated',tileSize,seed,palette},kit=generateCuratedTerrain(recipe);assert.equal(await canvasHash(page),hash(composeCuratedTerrain(kit).data));
    for(const relationship of CURATED_RELATIONSHIPS.filter(r=>tileSize===16||r!=='gravel-dirt'))for(const weathered of [false,true]) {
      const view=relationship==='grass-dirt'?'patch':relationship.split('-')[0]+'-patch';
      await page.getByLabel('Terrain tile',{exact:true}).selectOption((weathered?'weathered-':'')+view);
      assert.equal(await canvasHash(page),hash(composeCuratedTerrain(kit,{relationship,weathered}).data));
    }
    const files=await downloadFiles(page),manifest=JSON.parse(files.get('terrain.json'));assert.deepEqual(JSON.parse(files.get('recipe.json')),recipe);assert.equal(manifest.visualReview,'unapproved');assert.equal(manifest.format,'retro-terrain-pack/2');assert.deepEqual(JSON.parse(files.get('art-source.json')),curatedArtSource(kit));assert.ok(files.get('LICENSE-Grout.txt'));
    const images=[...kit.tiles,...kit.atlases,...kit.templates,...kit.previews];assert.equal([...files.keys()].filter(n=>n.endsWith('.png')).length,images.length);
    const decoded=await page.evaluate(async values=>{const result=[];for(const [name,source]of values){const bitmap=await createImageBitmap(new Blob([new Uint8Array(source)])),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;result.push({name,width:canvas.width,height:canvas.height,hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',rgba))].map(v=>v.toString(16).padStart(2,'0')).join('')});bitmap.close();}return result;},images.map(i=>[i.id+'.png',[...files.get(i.id+'.png')]]));
    const cache=await fs.mkdtemp(path.join(out,'cli-case-'));cleanup.push(cache);const baked=await bakeRetroTerrainCurated({recipe,output:cache});
    for(const [i,image]of images.entries()){const expected={width:image.width,height:image.height,hash:hash(image.data)};assert.deepEqual({...decoded[i],name:undefined},{...expected,name:undefined});assert.deepEqual(cliPixels(await fs.readFile(path.join(baked.directory,image.id+'.png'))),expected);const descriptor=manifest.files.find(f=>f.path===image.id+'.png');assert.equal(descriptor.rgbaSha256,expected.hash);}
    assert.equal(manifest.files.length,baked.manifest.files.length);
    assert.ok(cache.startsWith(out+path.sep));await fs.rm(cache,{recursive:true,force:true});cleanup.splice(cleanup.indexOf(cache),1);
    proof.cases.push({recipe,decodedPngs:images.length,browserIdentity:manifest.identity,cliIdentity:baked.manifest.identity});console.log(`${proof.mode}: ${tileSize}px ${palette} s${seed}: ${images.length} PNG pairs match`);
  }
  await page.getByLabel('Terrain size',{exact:true}).selectOption('16');await page.getByLabel('Terrain palette',{exact:true}).selectOption('woodland');await page.getByLabel('Terrain seed',{exact:true}).fill('1204');
  for(const view of ['patch','weathered-patch',...['gravel','moss','rock'].flatMap(f=>[f+'-patch','weathered-'+f+'-patch',f+'-dirt-atlas',f+'-grout-source']),...CURATED_FAMILIES.flatMap(f=>['mixed-'+f,'weathered-mixed-'+f,f+'-3','weathered-'+f+'-3']),'grass-dirt-atlas','grass-grout-source',...Array.from({length:16},(_,m)=>'gravel-path-'+m)]){await page.getByLabel('Terrain tile',{exact:true}).selectOption(view);await stageScale(page);await sideScale(page);}
  await page.getByLabel('Terrain tile',{exact:true}).selectOption('grass-grout-source');proof.previewScales=[{device:'desktop',dpr:1,view:'grass-grout-source',...await sideScale(page,96)}];
  await page.getByLabel('Terrain size',{exact:true}).selectOption('64');await page.getByLabel('Terrain tile',{exact:true}).selectOption('patch');proof.previewScales.push({device:'desktop',dpr:1,view:'64px-patch',...await sideScale(page,448)});
  await page.getByLabel('Terrain size',{exact:true}).selectOption('16');
  await page.getByLabel('Terrain tile',{exact:true}).selectOption('mixed-grass');const mixed=await canvasHash(page);await page.getByLabel('Terrain composition',{exact:true}).selectOption('3');assert.notEqual(await canvasHash(page),mixed);await page.getByLabel('Terrain composition',{exact:true}).selectOption('mixed');
  // Existing recipes remain selectable and old drafts recover without migration.
  for(const id of ['retro-terrain','retro-terrain-growth']){await page.getByLabel('Terrain kit',{exact:true}).selectOption(id);assert.equal(await page.getByLabel('Terrain tile',{exact:true}).inputValue(),'dirt');}
  await page.reload();await openRetro(page);assert.equal(await page.getByLabel('Terrain kit',{exact:true}).inputValue(),'retro-terrain-growth');
  await page.evaluate(()=>localStorage.setItem('retro-terrain-v1',JSON.stringify({id:'retro-terrain-curated',tileSize:64,seed:1233,palette:'cool-moor'})));
  await page.reload();await openRetro(page);assert.equal(await page.getByLabel('Terrain size',{exact:true}).inputValue(),'64');assert.equal(await page.getByLabel('Terrain seed',{exact:true}).inputValue(),'1233');assert.equal(await page.getByLabel('Terrain palette',{exact:true}).inputValue(),'cool-moor');proof.oldCuratedDraft=true;
  await page.getByLabel('Terrain kit',{exact:true}).selectOption('retro-terrain-curated');await page.getByLabel('Terrain tile',{exact:true}).selectOption('patch');
  await page.getByLabel('Terrain size',{exact:true}).selectOption('16');await page.getByLabel('Terrain palette',{exact:true}).selectOption('woodland');await page.getByLabel('Terrain seed',{exact:true}).fill('1204');
  await page.locator('.material-panel:not(.retro-terrain-panel) summary').click();await page.waitForFunction(()=>document.querySelector('.retro-terrain-panel')?.open===false);await openRetro(page);await page.waitForFunction(()=>document.querySelector('.material-panel:not(.retro-terrain-panel)')?.open===false);proof.exclusivePreview=true;
  injecting=true;await page.route('**/*retro-terrain-art*.mjs*',route=>route.fulfill({status:404,body:'Injected source identity failure'}));await page.getByRole('button',{name:'Save terrain kit',exact:true}).click();await page.getByText('Retro terrain authoring source identity unavailable; retry export',{exact:true}).waitFor();await page.unroute('**/*retro-terrain-art*.mjs*');injecting=false;await downloadFiles(page);proof.expectedFaults.push('source404 then successful retry');
  let release;const holdSource=async()=>{release=null;await page.route('**/*retro-terrain-art*.mjs*',async route=>{await new Promise(resolve=>{release=resolve;});await route.continue().catch(()=>{});});};
  await holdSource();const capturedDownload=page.waitForEvent('download',{timeout:60000});await page.getByRole('button',{name:'Save terrain kit',exact:true}).click();for(let i=0;!release&&i<60;i++)await page.waitForTimeout(50);assert.ok(release);await page.getByLabel('Terrain seed',{exact:true}).fill('1215');release();const captured=await capturedDownload,previous=unzip(await fs.readFile(await captured.path()));assert.equal(JSON.parse(previous.get('recipe.json')).seed,1204);await captured.delete();await page.getByText('Unsaved changes — the previous terrain seed was exported',{exact:true}).waitFor();await page.unroute('**/*retro-terrain-art*.mjs*');proof.capturedRevision=true;
  await page.getByLabel('Terrain seed',{exact:true}).fill('1204');await holdSource();await page.getByRole('button',{name:'Save terrain kit',exact:true}).click();for(let i=0;!release&&i<60;i++)await page.waitForTimeout(50);assert.ok(release);await page.locator('.retro-terrain-panel summary').click();release();await page.unroute('**/*retro-terrain-art*.mjs*');await openRetro(page);await downloadFiles(page);proof.cancelRetry=true;
  await page.getByLabel('Terrain tile',{exact:true}).selectOption('patch');await page.screenshot({path:path.join(out,'desktop.png')});proof.screenshots.push('desktop.png');
  for(const {device,dpr,viewport}of [{device:'desktop',dpr:2,viewport:{width:1440,height:1080}},... [1,2].map(dpr=>({device:'mobile',dpr,viewport:{width:390,height:844}}))]){
    const phone=await browser.newPage({viewport,deviceScaleFactor:dpr});phone.on('pageerror',e=>errors.push(e.message));await phone.goto(proof.url);await openRetro(phone);await phone.getByLabel('Terrain kit',{exact:true}).selectOption('retro-terrain-curated');
    await phone.getByLabel('Terrain tile',{exact:true}).selectOption('grass-grout-source');proof.previewScales.push({device,dpr,view:'grass-grout-source',...await sideScale(phone,96)});
    await phone.getByLabel('Terrain size',{exact:true}).selectOption('64');await phone.getByLabel('Terrain tile',{exact:true}).selectOption('patch');proof.previewScales.push({device,dpr,view:'64px-patch',...await sideScale(phone,448)});await stageScale(phone);
    await phone.getByLabel('Terrain tile',{exact:true}).selectOption('weathered-patch');await sideScale(phone,448);
    for(const tileSize of [64,16]) {
      await phone.getByLabel('Terrain size',{exact:true}).selectOption(String(tileSize));await phone.getByLabel('Terrain composition',{exact:true}).selectOption('3');
      const kit=generateCuratedTerrain({tileSize});
      for(const family of CURATED_FAMILIES)for(const weathered of [false,true]) {
        await phone.getByLabel('Terrain tile',{exact:true}).selectOption((weathered?'weathered-':'')+'mixed-'+family);
        assert.equal(await canvasHash(phone),hash(composeCuratedSurface(kit,family,{weathered,composition:3}).data));await sideScale(phone,tileSize*4);
      }
      for(const relationship of ['moss-dirt','rock-dirt'])for(const weathered of [false,true]) {
        await phone.getByLabel('Terrain tile',{exact:true}).selectOption((weathered?'weathered-':'')+relationship.replace('-dirt','-patch'));
        assert.equal(await canvasHash(phone),hash(composeCuratedTerrain(kit,{relationship,weathered,composition:3}).data));
      }
      await phone.getByLabel('Terrain composition',{exact:true}).selectOption('mixed');
    }
    await phone.getByLabel('Terrain size',{exact:true}).selectOption('16');await phone.getByLabel('Terrain tile',{exact:true}).selectOption('patch');proof[device+'Scale'+dpr]=await stageScale(phone);
    for(const label of ['Terrain size','Terrain palette','Terrain composition','Terrain seed','Terrain tile'])assert.ok(await phone.getByLabel(label,{exact:true}).evaluate(e=>e.getBoundingClientRect().height)>=44);
    const capture=`${device}-dpr${dpr}.png`;await phone.screenshot({path:path.join(out,capture)});proof.screenshots.push(capture);await phone.close();
  }
  assert.deepEqual(errors,[]);
} catch(error){failure=error;proof.failure=error.message;proof.failureState=await page?.evaluate(()=>({clicks:window.terrainClicks,adjustOpen:document.querySelector('.details')?.getAttribute('data-open'),retroOpen:document.querySelector('.retro-terrain-panel')?.open,status:document.querySelector('.retro-terrain-panel .drawer-status')?.textContent})).catch(()=>null);await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
finally{await page?.unrouteAll({behavior:'ignoreErrors'}).catch(()=>{});await browser?.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));for(const cache of cleanup)if(cache.startsWith(out+path.sep))await fs.rm(cache,{recursive:true,force:true});proof.resourcesReleased=true;await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify({...proof,errors,status:failure?'failed':'passed'},null,2)+'\n');}
if(failure)throw failure;console.log(JSON.stringify({status:'passed',out,cases:proof.cases.length}));
