import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createTravelerRecipe, createSpriteVariationProfile, generateSpriteVariations, parseRecipe, renderFrame } from "../packages/grout-art/index.mjs";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
export async function verifyArtVariations({ page, url, proof, mode, unzip, pngHash, bakeArt, scratch, faultUrls }) {
  const checks = [];
  const draft = async () => page.evaluate(() => JSON.parse(localStorage.getItem("grout-art-studio/1")));
  const saved = async expected => page.waitForFunction(expected => JSON.stringify(JSON.parse(localStorage.getItem("grout-art-studio/1"))) === expected, JSON.stringify(expected));
  const canvas = async expected => page.waitForFunction(async expected => {
    const c = document.querySelector(".art-main-canvas");
    const bytes = c.getContext("2d").getImageData(0,0,c.width,c.height).data;
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(value=>value.toString(16).padStart(2,"0")).join("") === expected;
  }, expected);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url + "studio");
  await page.evaluate(() => { localStorage.removeItem("grout-art-studio/1"); localStorage.removeItem("grout-art-studio/1:source"); });
  await page.reload();
  await page.locator('.art-studio[aria-busy="false"]').waitFor();
  await canvas(sha(renderFrame(createTravelerRecipe()).data));
  await page.screenshot({path: path.join(proof, `${mode}-variation-closed-desktop.png`)});
  await page.getByText("Sprite variations", { exact: true }).click();
  await page.getByLabel("Sprite variation seed", {exact: true}).fill("1215");
  await page.getByRole("button", { name: "Generate 4 candidates", exact: true }).click();
  assert.equal(await page.locator(".art-variation-candidates button").count(), 4);
  await page.screenshot({path: path.join(proof, `${mode}-variation-candidates-desktop.png`)});
  const base = createTravelerRecipe(), family = createSpriteVariationProfile(base);
  const expected = generateSpriteVariations(base, family, { seeds: [1215,1216,1217,1218] })[1];
  await page.getByRole("button", { name: "Choose candidate 2", exact: true }).click();
  await saved(expected); await canvas(sha(renderFrame(expected).data));
  await page.getByLabel("Lock variation Hat", {exact: true}).check();
  const locked = await draft();
  assert.ok(locked.spriteVariation.locks.hat);
  await page.getByLabel("Sprite variation seed", {exact: true}).fill("1233");
  await page.getByRole("button", { name: "Generate 4 candidates", exact: true }).click();
  await page.getByRole("button", { name: "Choose candidate 1", exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("grout-art-studio/1")).spriteVariation.seed === 1233);
  const chosen = await draft();
  assert.equal(chosen.spriteVariation.selections.hat, locked.spriteVariation.selections.hat);
  await page.getByRole("button", { name: "Undo (Ctrl or Command plus Z)", exact: true }).click();
  await saved(locked);
  await page.reload();
  await page.locator('.art-studio[aria-busy="false"]').waitFor();
  await page.getByText("Sprite variations", {exact:true}).click();
  assert.equal(await page.getByLabel("Lock variation Hat", {exact:true}).isChecked(), true);
  assert.equal(await page.getByLabel("Variation Hat", {exact:true}).isDisabled(), true);
  const priorHat = (await draft()).spriteVariation.selections.clothing;
  await page.getByRole("button", { name: "Reroll clothing", exact:true }).click();
  await page.waitForFunction(prior => JSON.parse(localStorage.getItem("grout-art-studio/1")).spriteVariation.selections.clothing !== prior, priorHat);
  checks.push("candidate preview/choose; locks; single-group reroll; undo; persisted family/selections/locks");

  await page.getByText("Edit variation family", {exact:true}).click();
  const source = page.getByLabel("Sprite variation family JSON", {exact:true});
  const valid = await source.inputValue();
  await source.fill("{broken-family");
  await page.getByRole("button", {name:"Apply variation family",exact:true}).click();
  await page.locator('.art-sprite-variations [role="alert"]').waitFor();
  await page.reload();
  await page.locator('.art-studio[aria-busy="false"]').waitFor();
  await page.getByText("Sprite variations",{exact:true}).click();
  await page.getByText("Edit variation family",{exact:true}).click();
  assert.equal(await source.inputValue(), "{broken-family");
  assert.equal(await page.getByRole("button", {name:"Generate 4 candidates",exact:true}).isDisabled(), true);
  await source.fill(valid);
  await page.getByRole("button", {name:"Apply variation family",exact:true}).click();
  assert.equal(await page.locator('.art-sprite-variations [role="alert"]').count(), 0);
  await page.getByText("Edit variation family",{exact:true}).click();
  const restored = await draft();
  await canvas(sha(renderFrame(restored).data));
  checks.push("invalid family text survives reload with last valid preview; explicit correction retains source pixels");

  await page.getByText("Lossless recipe optimization", {exact:true}).click();
  const optimize = page.getByRole("button", {name:"Check lossless optimization",exact:true});
  await optimize.click();
  await page.getByText("12 frames verified; exact authoring data restored.",{exact:true}).waitFor();
  await page.screenshot({path:path.join(proof,`${mode}-variation-desktop.png`)});
  const beforeOptimization = await draft();
  assert.deepEqual(beforeOptimization, restored);
  await optimize.click();
  await page.getByRole("button", {name:"Cancel optimization",exact:true}).click();
  await optimize.waitFor({state:"visible"});
  assert.equal(await optimize.isEnabled(),true);
  checks.push("lossless check proves every frame; displays independent gzip and full shared runtime costs; cancel leaves draft unchanged");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button",{name:"Export atlas kit",exact:true}).click();
  const download = await downloadPromise, files = unzip(await fs.readFile(await download.path()));
  const exported = JSON.parse(files.get("recipe.json")), optimizedDocument = JSON.parse(files.get("recipe.optimized.json"));
  const report = JSON.parse(files.get("optimization.json"));
  assert.deepEqual(parseRecipe(optimizedDocument), exported);
  assert.equal(report.verifiedFrames,12);
  const cli = await bakeArt({recipe:optimizedDocument,output:scratch});
  for (const [name, bytes] of files) if (name.endsWith(".png")) assert.deepEqual(await pngHash(page,bytes),await pngHash(page,await fs.readFile(path.join(cli.directory,name))));
  assert.deepEqual(JSON.parse(files.get("optimization.json")),JSON.parse(await fs.readFile(path.join(cli.directory,"optimization.json"),"utf8")));
  checks.push("actual variant ZIP includes editable family and verified lossless transport; optimized CLI input reproduces every browser PNG");

  const gpu = await page.evaluate(async () => {
    const s = await import("/__art-sdk/index.mjs"), base = s.createTravelerRecipe(), family = s.createSpriteVariationProfile(base);
    const variants = s.generateSpriteVariations(base,family);
    variants.push(s.compileCharacter(s.createCharacterDocument()),s.createExampleRecipe("custom-technique"));
    let comparisons=0;
    for (const backend of ["webgl2","webgpu"]) {
      const renderer=await s.createRenderer({backend});
      if(renderer.backend!==backend) throw Error("GPU qualification fell back: "+backend);
      try { for (const source of variants) {
        const {document}=await s.optimizeRecipe(source), restored=s.parseRecipe(document);
        for(let frame=0;frame<restored.frames.length;frame++) {
          const cpu=s.renderFrame(source,frame), actual=await renderer.render(restored,frame);
          if(cpu.data.some((value,index)=>value!==actual.data[index])) throw Error("Optimized GPU frame differs");
          comparisons++;
        }
      } } finally { renderer.dispose(); }
    }
    return { comparisons, differentBytes:0 };
  });

  // Actual measurement source failure and retry; preserve the existing source identity guard.
  await page.route("**/*",async route=>{
    if(route.request().resourceType()==="fetch" && /\.(mjs|js)(\?|$)/.test(route.request().url())) {
      faultUrls.add(route.request().url()); await route.fulfill({status:503,body:"Test-owned metric source failure"});
    } else await route.continue();
  });
  await optimize.click();
  await page.locator('.art-recipe-optimization [role="alert"]').waitFor();
  assert.deepEqual(await draft(),restored);
  await page.unroute("**/*");
  await optimize.click();
  await page.getByText("12 frames verified; exact authoring data restored.",{exact:true}).waitFor();
  checks.push("source-metric failure/retry preserves editable recipe; exact CPU/WebGL2/WebGPU restored frames");

  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
  await page.getByLabel("Lock variation Hat",{exact:true}).check();
  await page.getByLabel("Sprite variation seed",{exact:true}).fill("1204");
  await page.getByRole("button",{name:"Generate 4 candidates",exact:true}).click();
  await page.getByRole("button",{name:"Choose candidate 3",exact:true}).click();
  await page.screenshot({path:path.join(proof,`${mode}-variation-mobile.png`),fullPage:true});
  await page.locator('.art-sprite-variations > summary').click();
  await page.locator('.art-recipe-optimization > summary').click();
  await page.locator('.art-main-canvas').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(proof,`${mode}-variation-closed-mobile.png`)});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
  checks.push("narrow-screen candidate selection, locks, optimization controls and horizontal fit");
  await page.goto(url+"studio?workspace=character");
  await page.locator('.art-studio[aria-busy="false"]').waitFor();
  assert.equal(await page.locator('.art-sprite-variations').count(),0);
  await page.getByText("Lossless recipe optimization",{exact:true}).click();
  await optimize.click();
  await page.getByText("12 frames verified; exact authoring data restored.",{exact:true}).waitFor();
  checks.push("character workspace keeps its own creator randomizer and supports lossless source-preserving optimization");
  return {status:"passed",checks,gpu,report};
}
