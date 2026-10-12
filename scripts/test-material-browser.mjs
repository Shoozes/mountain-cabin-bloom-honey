import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {preview} from 'vite';
import {mergeAppEnv,readAppEnv} from './with-app-env.mjs';
const root=path.resolve(import.meta.dirname,'..'),flag=process.argv.indexOf('--playwright-root');if(flag<0)throw Error('Supply an explicit --playwright-root <installed package>');
const {chromium}=createRequire(path.join(path.resolve(process.argv[flag+1]),'package.json'))('playwright-core');
const devFlag=process.argv.indexOf('--dev-url'),devUrl=devFlag<0?null:process.argv[devFlag+1];
const exportOnly=process.argv.includes('--export-only');
if(devFlag>=0&&(!devUrl||!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(devUrl)))throw Error('Supply a loopback --dev-url http://127.0.0.1:<port>/');
const out=path.join(root,'.artifacts/proof/material-browser',Date.now()+'-'+process.pid);await fs.mkdir(out,{recursive:true});
async function withTimeout(promise,ms,message){let timer;try{return await Promise.race([promise,new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}finally{clearTimeout(timer);}}
Object.assign(process.env,mergeAppEnv(readAppEnv(root),process.env));let server,browser,page;const errors=[],proof={out,network:[],exportOnly};let failure;
try{
 if(!devUrl)server=await preview({root,mode:'pages',preview:{host:'127.0.0.1',port:0,open:false}});const address=server?.httpServer.address();proof.mode=devUrl?'dev':'pages';proof.url=devUrl??'http://127.0.0.1:'+address.port+'/mountain-cabin-bloom-honey/';browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});let injectingFault=false;proof.expectedConsoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')(injectingFault?proof.expectedConsoleErrors:errors).push(message.text());});page.on('request',request=>proof.network.push({type:request.resourceType(),url:request.url()}));
 await page.goto(proof.url);assert.match(await page.locator('meta[name="description"]').getAttribute('content'),/Artwork remains unapproved/);proof.approvalMetadata=true;await page.getByRole('button',{name:'Adjust',exact:true}).click();await page.locator('.material-panel summary').click();const canvas=page.getByLabel('Material channel preview',{exact:true});await canvas.waitFor({state:'visible'});
 const signature=()=>canvas.evaluate(c=>{let h=0;for(const b of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=(Math.imul(h,31)+b)>>>0;return h;});
 const original=await signature();await page.getByLabel('Material recipe',{exact:true}).selectOption('hd2d-cliff-strata');assert.notEqual(await signature(),original);await page.getByLabel('Material palette',{exact:true}).selectOption('slate');await page.waitForTimeout(80);assert.notEqual(await signature(),original);await page.getByLabel('Material relief',{exact:true}).focus();await page.getByLabel('Material relief',{exact:true}).press('Home');await page.getByLabel('Material relief',{exact:true}).press('ArrowRight');await page.getByLabel('Material channel',{exact:true}).selectOption('normal');await page.screenshot({path:path.join(out,'mill-material-desktop.png')});
  const exportButton=page.getByRole('button',{name:'Save material channels',exact:true}),download=page.waitForEvent('download');await exportButton.click();const saved=await download;await saved.saveAs(path.join(out,'browser-material.zip'));assert.ok((await fs.stat(path.join(out,'browser-material.zip'))).size>1000);
  // The download event can fire before the export handler reaches finally/setBusy(false).
  await page.waitForFunction(()=>{const button=document.querySelector('.material-panel button');return button&&!button.disabled;},undefined,{timeout:10000});proof.firstExportReady=true;
 // Hold only the export's source read, then edit while the snapshot is baking.
  let releaseSource,sourceRequested,heldSource=false;const requested=new Promise(resolve=>{sourceRequested=resolve;});const sourceMatches=request=>request.resourceType()==='fetch'&&/\.(mjs|js)$/.test(new URL(request.url()).pathname);
  proof.network.length=0;proof.exportRequests=[];const intercept=async route=>{const request=route.request(),url=new URL(request.url()),type=request.resourceType(),isSource=sourceMatches(request);proof.exportRequests.push({type,url:url.href,path:url.pathname,isSource,held:isSource&&!heldSource});if(isSource&&!heldSource){heldSource=true;releaseSource=()=>route.continue();proof.heldSourceUrl=url.href;proof.heldSourceElapsedMs=Date.now()-clickStarted;sourceRequested();}else await route.continue();};
  // The hashed authoring module is immutable and was already fetched by the first export.
  // Disable Chromium's HTTP cache so this export's source read traverses the held route.
  const cacheSession=await page.context().newCDPSession(page);await cacheSession.send('Network.setCacheDisabled',{cacheDisabled:true});proof.sourceReadCacheDisabled=true;
  await page.route('**/*',intercept);const secondDownload=page.waitForEvent('download');void secondDownload.catch(()=>{});
  const clickStarted=Date.now();let clickError;
  const clickDone=exportButton.click({noWaitAfter:true}).then(()=>{proof.secondExportClickElapsedMs=Date.now()-clickStarted;},error=>{clickError=error;proof.secondExportClickElapsedMs=Date.now()-clickStarted;});
  try {
    await withTimeout(requested,15000,'Export source route was not held');proof.sourceRequestObserved=true;await withTimeout(clickDone,3000,'Export click did not settle after source request');if(clickError)throw clickError;
    if(!releaseSource){proof.secondExportRequests=[...proof.network];throw Error('Export source route was not held');}
    await page.getByLabel('Material palette',{exact:true}).selectOption('ochre');proof.concurrentEditDispatched=true;
  } catch(error) {
    proof.statusOnSourceTimeout=await page.locator('.material-panel [role=status], .material-panel [role=alert]').textContent().catch(()=>null);
    proof.exportButtonDisabled=await page.locator('.material-panel button').isDisabled().catch(()=>null);proof.secondExportRequests=[...proof.network];throw error;
  } finally {
    if(releaseSource){const release=releaseSource;releaseSource=undefined;await release().catch(()=>{});}
  }
  await secondDownload;await page.unroute('**/*',intercept);
 await page.waitForFunction(()=>!document.querySelector('.material-panel button').disabled);assert.match(await page.locator('.material-panel [role=status]').textContent(),/Unsaved material changes/);proof.concurrentEditPreserved=true;
 if(!exportOnly){
 await page.reload();await page.waitForFunction(()=>document.querySelector('[aria-label="Material recipe"]')?.value==='hd2d-cliff-strata');await page.getByRole('button',{name:'Adjust',exact:true}).click();await page.locator('.material-panel summary').click();assert.equal(await page.getByLabel('Material recipe',{exact:true}).inputValue(),'hd2d-cliff-strata');assert.equal(await page.getByLabel('Material palette',{exact:true}).inputValue(),'ochre');assert.match(await page.locator('.material-panel [role=status]').textContent(),/Unsaved material changes/);await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mill-material-mobile.png')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));proof.persisted=true;proof.unsavedPersisted=true;proof.download=true;assert.deepEqual(errors,[]);
 await page.setViewportSize({width:1440,height:1080});await page.getByLabel('Material recipe',{exact:true}).selectOption('style-surface');
 const pausedThumbs=await page.locator('.tile-grid img').count();
 proof.styleMaterials=[];
 for(const [style,size]of [['hd2d',128],['cel-ink',256],['soft-cartoon',256],['pbr',512]]) {
  await page.getByLabel('Material style',{exact:true}).selectOption(style);assert.equal(Number(await page.getByLabel('Material size',{exact:true}).inputValue()),size);
  const signatures=[];
  for(const family of ['grass','dirt','moss','cliff','stone','cobble','bark','timber','plaster','roof']) {
   await page.getByLabel('Material family',{exact:true}).selectOption(family);signatures.push(await signature());assert.equal(await page.locator('.top h1').textContent(),`${style} ${family} · albedo`);
  }
  assert.equal(new Set(signatures).size,10,'Families need distinct original channels');proof.styleMaterials.push({style,size,families:signatures.length});
 }
 assert.equal(await page.locator('.tile-grid img').count(),pausedThumbs);proof.catalogPausedDuringMaterial=true;
 await page.getByLabel('Material family',{exact:true}).selectOption('cliff');await page.getByLabel('Material size',{exact:true}).selectOption('256');
 await page.getByLabel('Material seed',{exact:true}).fill('-1');await page.locator('.material-panel [role=alert]').waitFor({state:'visible'});
 await page.getByLabel('Material seed',{exact:true}).fill('1204');await page.locator('.material-panel [role=alert]').waitFor({state:'hidden'});
 await page.getByLabel('Material channel',{exact:true}).selectOption('albedo');await page.screenshot({path:path.join(out,'style-material-panel.png')});
 const materialDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Save material channels',exact:true}).click();const materialZip=await materialDownload;
 await materialZip.saveAs(path.join(out,'style-material.zip'));assert.ok((await fs.stat(path.join(out,'style-material.zip'))).size>1000);
 await page.reload();await page.waitForFunction(()=>document.querySelector('[aria-label="Material recipe"]')?.value==='style-surface');await page.getByRole('button',{name:'Adjust',exact:true}).click();await page.locator('.material-panel summary').click();
 assert.equal(await page.getByLabel('Material recipe',{exact:true}).inputValue(),'style-surface');assert.equal(await page.getByLabel('Material family',{exact:true}).inputValue(),'cliff');
 assert.equal(await page.getByLabel('Material style',{exact:true}).inputValue(),'pbr');assert.equal(await page.getByLabel('Material size',{exact:true}).inputValue(),'256');
 proof.styleDraft=true;proof.styleExport=true;proof.styleErrorRecovery=true;assert.deepEqual(errors,[]);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'style-material-mobile.png')});await page.setViewportSize({width:1440,height:1080});
 proof.materialLabels=true;
 // A missing judge image must expose a retryable error rather than strand busy state.
 const resumeFrom=await page.locator('.tile-grid img').count();await page.getByRole('button',{name:'Done',exact:true}).click();
 await page.waitForFunction(count=>count===75||document.querySelectorAll('.tile-grid img').length>count,resumeFrom,{timeout:15000});proof.catalogResumed=true;
 const missingReference=route=>route.fulfill({status:404,contentType:'text/plain',body:'Missing test reference'});
 injectingFault=true;await page.route('**/judge/brick.jpg',missingReference);
 await page.getByRole('button',{name:'Judge',exact:true}).click();
 await page.locator('.judge [role=alert]').waitFor({state:'visible',timeout:10000});
 assert.match(await page.locator('.judge [role=alert]').textContent(),/brick\.jpg.*404.*retry/);
 await page.unroute('**/judge/brick.jpg',missingReference);injectingFault=false;proof.judgeMissingReference=true;
 await page.getByRole('button',{name:'Close',exact:true}).click();
 // Cancel a stalled reference fetch, then immediately start a healthy run.
 let referenceHeld;const held=new Promise(resolve=>{referenceHeld=resolve;});
 const stallReference=async route=>{referenceHeld();await new Promise(resolve=>{proof.releaseReference=resolve;});await route.continue().catch(()=>{});};
 await page.route('**/judge/brick.jpg',stallReference);
 await page.getByRole('button',{name:'Judge',exact:true}).click();await held;
 await page.getByRole('button',{name:'Close',exact:true}).click();
 proof.releaseReference();delete proof.releaseReference;await page.unroute('**/judge/brick.jpg',stallReference);
 await page.getByRole('button',{name:'Judge',exact:true}).click();
 await page.waitForFunction(()=>{const summary=document.querySelector('[data-judge-sum]');return summary&&summary.getAttribute('role')!=='alert'&&!summary.textContent.endsWith('…')&&document.querySelectorAll('[data-judge-row]').length===75;},undefined,{timeout:60000});
 assert.equal(await page.locator('[data-judge-row]').count(),75);proof.judgeCancellation=true;proof.judgeRetry=true;
 await page.screenshot({path:path.join(out,'judge-recovered.png')});await page.getByRole('button',{name:'Close',exact:true}).click();assert.deepEqual(errors,[]);
 // Browser storage can be unavailable or full; the mill must still render/export.
 const storagePage=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 storagePage.on('pageerror',error=>errors.push(error.message));storagePage.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await storagePage.addInitScript(()=>{const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='grout-shader-v1')throw new DOMException('Test storage quota','QuotaExceededError');return setItem.call(this,key,value);};});
 await storagePage.goto(proof.url);await storagePage.locator('.stage [role=alert]').waitFor({state:'visible'});
 assert.match(await storagePage.locator('.stage [role=alert]').textContent(),/could not be saved locally/);
 await storagePage.getByRole('button',{name:'Adjust',exact:true}).click();assert.ok(await storagePage.getByRole('button',{name:'Copy recipe',exact:true}).isVisible());
 const fallbackDownload=storagePage.waitForEvent('download');await storagePage.getByRole('button',{name:'Save',exact:true}).click();await (await fallbackDownload).saveAs(path.join(out,'storage-fallback.png'));
 assert.ok((await fs.stat(path.join(out,'storage-fallback.png'))).size>100);proof.storageFailureRecovery=true;
 await storagePage.screenshot({path:path.join(out,'storage-failure-mobile.png')});await storagePage.close();assert.deepEqual(errors,[]);
 }
}catch(e){failure=e;proof.failureState=await page?.evaluate(()=>({button:document.querySelector('.material-panel button')?.outerHTML,status:document.querySelector('.material-panel .drawer-status')?.textContent,heading:document.querySelector('.top h1')?.textContent,drawerOpen:document.querySelector('.details')?.dataset.open,recipe:document.querySelector('[aria-label="Material recipe"]')?.value,judge:document.querySelector('[data-judge-sum]')?.textContent})).catch(()=>null);await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}finally{await browser?.close();await new Promise(resolve=>server?server.httpServer.close(resolve):resolve());await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify({...proof,status:failure||errors.length?'failed':'passed',error:failure?.message,errors},null,2));}
console.log(JSON.stringify({status:'passed',out}));
