import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { createServer, preview } from "vite";
const args = process.argv.slice(2), option = name => { const at=args.indexOf(name); return at < 0 ? null : args[at+1]; };
const mode=option("--mode") ?? "root", dev=option("--dev-url");
const ownDev=args.includes("--dev");
if(ownDev && dev) throw Error("Choose --dev or --dev-url");
if (!["root","pages"].includes(mode)) throw Error("Expected --mode root|pages");
if (dev && !/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(dev)) throw Error("Expected a local dev URL");
const proof=path.resolve(option("--proof-out") ?? ".artifacts/proof/standalone"), lane=dev||ownDev?"dev":mode;
const receipt={lane,started:new Date().toISOString(),checks:[],errors:[],retiredRequests:[]};
let server,browser,page;
try {
 await fs.mkdir(proof,{recursive:true});
 let url=dev;
 if(!url) {
  const root=path.resolve(import.meta.dirname,"..");
  if(ownDev) {
   server=await createServer({root,mode:"development",server:{host:"127.0.0.1",port:0,open:false}});
   await server.listen();
  } else server=await preview({root,mode:mode==="pages"?"pages":"production",preview:{host:"127.0.0.1",port:0,open:false}});
  const port=server.httpServer.address().port;
  url=`http://127.0.0.1:${port}/${!ownDev&&mode==="pages"?"mountain-cabin-bloom-honey/":""}`;
 }
 receipt.url=url;
 browser=await chromium.launch({channel:"chrome",headless:true});receipt.browser=browser.version();
 page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.addInitScript(()=>localStorage.setItem("grout-shader-v1",JSON.stringify({styleId:"brick",seed:1204,animate:false})));
 page.on("pageerror",error=>receipt.errors.push(error.message));
 page.on("console",message=>{if(message.type()==="error")receipt.errors.push(message.text());});
 page.on("request",request=>{if(/__grok|grok\.com|vercel\.(app|com)/i.test(request.url()))receipt.retiredRequests.push(request.url());});
 for(const route of ["","gallery","studio","examples"]) {
  const response=await page.goto(url+route);assert.equal(response.status(),200,route);
  await page.locator("main").waitFor();
  if(route==="") {
   await page.locator('.tile[aria-pressed="true"] img').waitFor();
   const canvas=page.locator('.stage > canvas').first(), before=await canvas.screenshot();
   receipt.contextRecovery=[];
   for(const selector of ['.stage > canvas','.util-canvas']) {
    const recovery=await page.evaluate(async selector=>{
     const canvas=document.querySelector(selector),gl=canvas.getContext("webgl"),extension=gl.getExtension("WEBGL_lose_context");
     if(!extension)throw Error("WEBGL_lose_context unavailable");
     const event=name=>new Promise((resolve,reject)=>{
      const done=()=>{clearTimeout(timer);resolve();};
      const timer=setTimeout(()=>{canvas.removeEventListener(name,done);reject(Error(`${name} timed out`));},10000);
      canvas.addEventListener(name,done,{once:true});
     });
     const lost=event("webglcontextlost");extension.loseContext();await lost;
     await new Promise(resolve=>setTimeout(resolve,50));
     const restored=event("webglcontextrestored");extension.restoreContext();await restored;
     return {selector,error:gl.getError(),lost:gl.isContextLost()};
    },selector);
    assert.equal(recovery.lost,false);assert.equal(recovery.error,0);
    assert.deepEqual(await canvas.screenshot(),before,"static mill redraws identical pixels after restoration");
    receipt.contextRecovery.push(recovery);
   }
   receipt.contextRecoveryPixels=createHash("sha256").update(before).digest("hex");
   await canvas.screenshot({path:path.join(proof,`${lane}-mill-restored.png`)});
   receipt.checks.push("display and utility WebGL loss recover identical static preview pixels without interaction");
  }
  if(route==="studio") {
   await page.locator('.art-studio[aria-busy="false"]').waitFor();
   await page.locator('.art-status-backend').filter({hasText:/Preview: (cpu|webgl2|webgpu)/}).waitFor();
   assert.equal(await page.locator('.art-main-canvas').getAttribute("width"),"16");
  }
  const head=await page.locator("head").innerHTML();
  assert.doesNotMatch(head,/__grok|grok-app-builder|grok:app_id|virtual:grok|vercel/i);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  receipt.checks.push(`/${route}: standalone shell, route, assets and desktop fit`);
 }
 await page.goto(url+"studio");await page.locator('.art-studio[aria-busy="false"]').waitFor();
 await page.screenshot({path:path.join(proof,`${lane}-desktop.png`)});
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByText("Sprite variations",{exact:true}).click();
 await page.getByRole("button",{name:"Generate 4 candidates",exact:true}).click();
 assert.equal(await page.locator('.art-variation-candidates button').count(),4);
 await page.getByRole("button",{name:"Choose candidate 1",exact:true}).click();
 await page.screenshot({path:path.join(proof,`${lane}-mobile.png`)});
 assert.deepEqual(receipt.retiredRequests,[]);assert.deepEqual(receipt.errors,[]);
 receipt.checks.push("narrow-screen Studio candidates select without retired host requests or browser errors");
 receipt.status="passed";
} catch(error) {receipt.status="failed";receipt.error=error.stack;process.exitCode=1;console.error(error);}
finally {
 await browser?.close();
 if(server) {
  if(ownDev)await server.close();
  else await new Promise((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));
 }
 receipt.finished=new Date().toISOString();await fs.mkdir(proof,{recursive:true});await fs.writeFile(path.join(proof,`${lane}-receipt.json`),JSON.stringify(receipt,null,2)+"\n");
}
console.log(JSON.stringify({lane,status:receipt.status,checks:receipt.checks.length,errors:receipt.errors}));
