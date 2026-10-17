import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mergeAppEnv, readAppEnv } from './with-app-env.mjs';
import { generateMaterial, materialVersion, REALISTIC_SURFACE_PRESETS } from '../src/shader/material.mjs';
import { shadeRealisticPreview } from '../src/shader/material-realistic.mjs';
import { bakeMaterial } from './bake-material.mjs';

const root = path.resolve(import.meta.dirname, '..');
const proofRoot = path.join(root, '.artifacts', 'proof', 'realistic-material-browser');
const runDir = path.join(proofRoot, `${Date.now()}-${process.pid}`);
const channels = ['albedo', 'height', 'normal', 'roughness'];
const devFlag = process.argv.indexOf('--dev-url');
const devUrl = devFlag < 0 ? null : process.argv[devFlag + 1];
let ownedBakeDirectories = [];
if (devFlag >= 0 && (!devUrl || !/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(devUrl))) {
  throw new Error('Supply --dev-url http://127.0.0.1:<port>/');
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
function unzipStored(bytes) {
  const files = new Map();
  let offset = 0;
  while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const method = bytes.readUInt16LE(offset + 8);
    const size = bytes.readUInt32LE(offset + 18);
    const nameSize = bytes.readUInt16LE(offset + 26);
    const extraSize = bytes.readUInt16LE(offset + 28);
    assert.equal(method, 0, 'Browser material ZIP must use stored entries');
    const nameAt = offset + 30;
    const dataAt = nameAt + nameSize + extraSize;
    const name = bytes.subarray(nameAt, nameAt + nameSize).toString('utf8');
    assert.ok(!files.has(name), `Duplicate ZIP member ${name}`);
    assert.ok(dataAt + size <= bytes.length, `Truncated ZIP member ${name}`);
    files.set(name, bytes.subarray(dataAt, dataAt + size));
    offset = dataAt + size;
  }
  assert.ok(files.size > 0, 'Browser download did not contain stored ZIP entries');
  return files;
}

async function decodedBrowserHash(page, png, width, height) {
  const base64 = Buffer.from(png).toString('base64');
  return page.evaluate(async ({ base64: encoded, width: w, height: h }) => {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    try {
      if (bitmap.width !== w || bitmap.height !== h) return { width: bitmap.width, height: bitmap.height, hash: null };
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, w, h).data;
      const digest = await crypto.subtle.digest('SHA-256', pixels);
      const hash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
      return { width: bitmap.width, height: bitmap.height, hash };
    } finally {
      bitmap.close();
    }
  }, { base64, width, height });
}

async function canvasHash(page, selector) {
  return page.locator(selector).evaluate(async (canvas) => {
    const pixels = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
    const digest = await crypto.subtle.digest('SHA-256', pixels);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  });
}

async function waitForCanvasHash(page, selector, expected) {
  await page.waitForFunction(async ({ target, hash }) => {
    const canvas = document.querySelector(target);
    if (!canvas) return false;
    const pixels = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
    const digest = await crypto.subtle.digest('SHA-256', pixels);
    const actual = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    return actual === hash;
  }, { target: selector, hash: expected });
}

async function verifyExport(page, zipBytes, expectedFamily) {
  const files = unzipStored(zipBytes);
  const manifestBytes = files.get('material.json');
  assert.ok(manifestBytes, 'Material export is missing material.json');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  assert.equal(manifest.format, 'texture-material/1');
  assert.equal(manifest.generator, materialVersion('realistic-surface'));
  assert.equal(manifest.sources.length, 3, 'Realistic browser exports bind the generator, browser encoder, and realistic source');
  assert.ok(manifest.sources.some((source) => /\/material(?:-[A-Za-z0-9_-]+)?\.mjs$/.test(source.path)));
  assert.ok(manifest.sources.some((source) => /\/material-browser(?:-[A-Za-z0-9_-]+)?\.(?:mjs|js)$/.test(source.path) || /\/(?:index|routes?)(?:-[A-Za-z0-9_-]+)?\.js$/.test(source.path)), 'Browser encoder identity should bind the dev module or bundled app module');
  assert.ok(manifest.sources.some((source) => /\/material-realistic(?:-[A-Za-z0-9_-]+)?\.mjs$/.test(source.path)));
  assert.ok(manifest.sources.every((source) => /^[a-f0-9]{64}$/.test(source.sha256)));
  assert.equal(manifest.recipe.id, 'realistic-surface');
  assert.equal(manifest.recipe.family, expectedFamily);
  assert.equal(manifest.recipe.size, 512);
  assert.equal(manifest.visualReview, 'unapproved');
  assert.deepEqual(manifest.provenance.restrictedInputs, []);
  assert.equal(manifest.files.length, 4);
  assert.deepEqual(manifest.files.map((file) => file.channel).sort(), [...channels].sort());
  assert.ok(manifest.files.every((file) => file.filter === 'linear' && file.wrap === 'repeat'));

  const expected = generateMaterial(manifest.recipe).channels;
  const cliOutput = path.join(runDir, 'cli-bakes', expectedFamily);
  const baked = await bakeMaterial({ recipe: manifest.recipe, output: cliOutput, variantSet: 'single' });
  ownedBakeDirectories.push(baked.directory);
  assert.equal(baked.manifest.format, manifest.format);
  assert.equal(baked.manifest.generator, manifest.generator);
  const cliSourcePaths = ['src/shader/material.mjs', 'scripts/bake-material.mjs', 'scripts/material-png.mjs', 'src/shader/material-realistic.mjs'];
  assert.deepEqual(baked.manifest.sources.map((source) => source.path), cliSourcePaths);
  assert.deepEqual(baked.manifest.recipe, manifest.recipe);
  assert.equal(baked.manifest.variantSet, 'single');
  const cliManifest = JSON.parse(await fs.readFile(path.join(baked.directory, 'material.json'), 'utf8'));
  assert.deepEqual(cliManifest.sources, baked.manifest.sources);
  assert.ok(baked.manifest.sources.every((source) => /^[a-f0-9]{64}$/.test(source.sha256)));
  const bakedPixelChecks = [];
  const pixelChecks = [];
  for (const channel of channels) {
    const record = manifest.files.find((file) => file.channel === channel);
    assert.ok(record, `Missing ${channel} metadata`);
    const name = `s${manifest.recipe.seed}-${channel}.png`;
    const png = files.get(name);
    assert.ok(png, `Missing ${name}`);
    assert.equal(record.path, name);
    assert.equal(record.width, expected[channel].width);
    assert.equal(record.height, expected[channel].height);
    assert.equal(record.bytes, png.length);
    assert.equal(record.sha256, sha256(png));
    const actualPixels = await decodedBrowserHash(page, png, expected[channel].width, expected[channel].height);
    assert.equal(actualPixels.width, expected[channel].width);
    assert.equal(actualPixels.height, expected[channel].height);
    const expectedHash = sha256(expected[channel].data);
    assert.equal(actualPixels.hash, expectedHash, `${expectedFamily}/${channel} decoded PNG pixels differ from generateMaterial`);
    const cliRecord = baked.manifest.files.find((file) => file.channel === channel);
    assert.ok(cliRecord, `CLI bake is missing ${channel}`);
    assert.equal(cliRecord.filter, 'linear');
    const cliPng = await fs.readFile(path.join(baked.directory, cliRecord.path));
    const cliPixels = await decodedBrowserHash(page, cliPng, expected[channel].width, expected[channel].height);
    assert.equal(cliPixels.hash, expectedHash, `${expectedFamily}/${channel} decoded CLI PNG pixels differ from generateMaterial`);
    assert.equal(cliPixels.hash, actualPixels.hash, `${expectedFamily}/${channel} browser ZIP and CLI PNG differ`);
    bakedPixelChecks.push({ channel, sha256: cliPixels.hash });
    pixelChecks.push({ channel, pixels: expected[channel].width * expected[channel].height, sha256: expectedHash });
  }
  const resolvedRunDir = path.resolve(runDir);
  const resolvedBakeDir = path.resolve(baked.directory);
  assert.ok(resolvedBakeDir.startsWith(`${resolvedRunDir}${path.sep}`), 'CLI output must remain inside this harness run directory');
  await fs.rm(resolvedBakeDir, { recursive: true, force: true });
  ownedBakeDirectories = ownedBakeDirectories.filter((directory) => path.resolve(directory) !== resolvedBakeDir);
  assert.ok(files.has('recipe.json'));
  assert.deepEqual(JSON.parse(files.get('recipe.json').toString('utf8')), manifest.recipe);
  return { family: expectedFamily, generator: manifest.generator, filter: 'linear', sources: manifest.sources, pixelChecks, cliBake: { variantSet: baked.variantSet, reused: baked.reused, sources: baked.manifest.sources, pixelChecks: bakedPixelChecks, ownedOutputCleaned: true } };
}

async function main() {
  await fs.mkdir(runDir, { recursive: true });
  Object.assign(process.env, mergeAppEnv(readAppEnv(root), process.env));
  let server;
  let browser;
  let page;
  let activeFault = false;
  const errors = [];
  const expectedErrors = [];
  const navigationEvents = [];
  const hotUpdateRequests = [];
  let initialNavigationComplete = false;
  let injected404Response = null;
  const presetPanelStates = [];
  const proof = { mode: devUrl ? 'dev' : 'pages', output: runDir, errors, expectedErrors, navigationEvents, hotUpdateRequests, presetPanelStates, exports: [] };
  let failure;
  try {
    if (!devUrl) {
      server = await preview({ root, mode: 'pages', preview: { host: '127.0.0.1', port: 0, open: false } });
    }
    const address = server?.httpServer.address();
    const baseUrl = devUrl ?? `http://127.0.0.1:${address.port}/mountain-cabin-bloom-honey/`;
    proof.url = baseUrl;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(30000);
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigationEvents.push(frame.url()); });
    page.on('request', (request) => { if (initialNavigationComplete && /\/src\/components\/material-panel\.(?:tsx?|jsx?)(?:\?|$)/.test(request.url())) hotUpdateRequests.push(request.url()); });
    page.on('response', (response) => {
      if (activeFault && response.status() === 404 && /material-realistic[^/]*\.mjs/.test(response.url())) {
        injected404Response = { status: response.status(), url: response.url() };
        expectedErrors.push(`Injected source response ${response.status()}: ${response.url()}`);
      }
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const text = message.text();
        if (activeFault && injected404Response && /404/.test(text)) expectedErrors.push(text);
        else errors.push(text);
      }
    });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    initialNavigationComplete = true;
    await page.waitForFunction(() => document.querySelectorAll('.tile-grid > li').length === 75);
    proof.initialTileCount = await page.locator('.tile-grid > li').count();
    assert.equal(proof.initialTileCount, 75, 'Legacy shader tile catalog count changed');

    await page.getByRole('button', { name: /Photorealistic materials/ }).click();
    await page.waitForFunction(() => document.querySelector('.material-panel')?.open === true);
    const recipeSelect = page.getByLabel('Material recipe', { exact: true });
    await page.waitForFunction(() => document.querySelector('[aria-label="Material recipe"]')?.value === 'realistic-surface');
    assert.equal(await recipeSelect.inputValue(), 'realistic-surface');
    const familySelect = page.getByLabel('Realistic material family', { exact: true });
    const sizeSelect = page.getByLabel('Material size', { exact: true });
    assert.equal(await familySelect.inputValue(), 'soil');
    assert.equal(await sizeSelect.inputValue(), '512', 'Realistic default should be 512');
    await page.waitForFunction(() => document.querySelector('.top h1')?.textContent === 'soil surface · surface');
    const panelCanvas = page.locator('.material-panel canvas');
    const panelRendering = await panelCanvas.evaluate((canvas) => getComputedStyle(canvas).getPropertyValue('image-rendering'));
    assert.ok(!await panelCanvas.evaluate((canvas) => canvas.classList.contains('pixelated')));
    assert.notEqual(panelRendering, 'pixelated');
    const stageCanvas = page.getByLabel('Active material preview', { exact: true });
    const stageRendering = await stageCanvas.evaluate((canvas) => getComputedStyle(canvas).getPropertyValue('image-rendering'));
    assert.ok(!await stageCanvas.evaluate((canvas) => canvas.classList.contains('pixelated')));
    assert.notEqual(stageRendering, 'pixelated');
    proof.catalogEntry = { recipe: await recipeSelect.inputValue(), family: await familySelect.inputValue(), size: Number(await sizeSelect.inputValue()), panelImageRendering: panelRendering || 'initial(auto)', stageImageRendering: stageRendering || 'initial(auto)' };
    await page.screenshot({ path: path.join(runDir, 'realistic-desktop.png') });

    const repeatSelect = page.locator('.material-panel .fields label.field').filter({ hasText: /^Repeat/ }).locator('select');
    await repeatSelect.selectOption('1');
    const channelSelect = page.getByLabel('Material channel', { exact: true });
    const litSurfaceHash = await canvasHash(page, '.material-panel canvas');
    const flatRecipe = { id: 'realistic-surface', family: 'soil', seed: 1204, size: 512, palette: 'earth', strataScale: 4, fracture: 0.28, relief: 0, roughness: 1 };
    const flatChannels = generateMaterial(flatRecipe).channels;
    const expectedLit = shadeRealisticPreview(flatChannels);
    await channelSelect.selectOption('albedo');
    const expectedAlbedo = sha256(flatChannels.albedo.data);
    await page.waitForFunction(() => document.querySelector('.top h1')?.textContent === 'soil surface · albedo');
    await waitForCanvasHash(page, '.material-panel canvas', expectedAlbedo);
    assert.notEqual(litSurfaceHash, expectedAlbedo, 'Lit surface preview should differ from exported albedo');
    await channelSelect.selectOption('surface');
    await page.waitForFunction(() => document.querySelector('.top h1')?.textContent === 'soil surface · surface');
    await page.getByLabel('Material relief', { exact: true }).fill('0');
    await page.getByLabel('Material roughness', { exact: true }).fill('1');
    await waitForCanvasHash(page, '.material-panel canvas', sha256(expectedLit.data));
    assert.equal(await canvasHash(page, '.material-panel canvas'), sha256(expectedLit.data), 'Flat relief with maximum roughness should show uniformly lit pigment');
    assert.notEqual(expectedAlbedo, sha256(expectedLit.data));
    proof.surfacePreview = { distinctFromAlbedo: litSurfaceHash !== expectedAlbedo, flatReliefAndRoughness: 'matches neutral-lit generated albedo' };

    const presetButton = (label) => page.getByRole('button', { name: label, exact: true });
    const familiesSeen = [];
    for (const preset of REALISTIC_SURFACE_PRESETS) {
      await page.waitForFunction(() => !document.querySelector('.material-panel .primary')?.disabled);
      await presetButton(preset.label).click();
      assert.equal(await familySelect.inputValue(), preset.recipe.family, `${preset.label} selects its family`);
      assert.equal(await sizeSelect.inputValue(), '512', `${preset.label} retains 512px default`);
      const panelOpen = await page.locator('.material-panel').evaluate((element) => element.open);
      presetPanelStates.push({ label: preset.label, panelOpen, url: page.url(), navigationCount: navigationEvents.length, hotUpdateRequestCount: hotUpdateRequests.length });
      assert.ok(panelOpen, `${preset.label} should not close the material panel`);
      familiesSeen.push(await familySelect.inputValue());
    }
    assert.deepEqual(familiesSeen, ['soil', 'gravel', 'limestone', 'concrete', 'bark', 'timber']);
    assert.equal(new Set(familiesSeen).size, 6);
    proof.presets = familiesSeen.map((family, index) => ({ family, label: REALISTIC_SURFACE_PRESETS[index].label, size: 512 }));

    assert.ok(await page.locator('.material-panel').evaluate((element) => element.open), 'Material panel must remain open for channel/repeat controls');
    await channelSelect.selectOption('normal');
    await repeatSelect.selectOption('4');
    assert.equal(await page.locator('.material-panel canvas').evaluate((canvas) => canvas.width), 2048);
    await channelSelect.selectOption('roughness');
    await repeatSelect.selectOption('1');
    assert.equal(await page.locator('.material-panel canvas').evaluate((canvas) => canvas.width), 512);
    await channelSelect.selectOption('surface');
    proof.channelRepeat = { channels: channels.slice(), repeats: [1, 4] };

    await page.getByLabel('Material seed', { exact: true }).fill('321');
    await page.getByLabel('Material palette', { exact: true }).selectOption('slate');
    await sizeSelect.selectOption('128');
    assert.equal(await page.getByLabel('Material seed', { exact: true }).inputValue(), '321');
    assert.equal(await page.getByLabel('Material palette', { exact: true }).inputValue(), 'slate');
    assert.equal(await sizeSelect.inputValue(), '128');
    await page.getByLabel('Material seed', { exact: true }).fill('-1');
    await page.locator('.material-panel [role="alert"]').waitFor({ state: 'visible' });
    await page.getByLabel('Material seed', { exact: true }).fill('1204');
    await page.locator('.material-panel [role="alert"]').waitFor({ state: 'hidden' });
    proof.invalidSeedRecovery = true;

    await presetButton('Loamy soil').click();
    await page.getByLabel('Material seed', { exact: true }).fill('77');
    await page.getByLabel('Material palette', { exact: true }).selectOption('ochre');
    await sizeSelect.selectOption('128');
    await page.waitForFunction(() => {
      try { return JSON.parse(localStorage.getItem('cliff-material-v1')).id === 'realistic-surface'; } catch { return false; }
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('[aria-label="Material recipe"]')?.value === 'realistic-surface');
    assert.equal(await page.getByLabel('Realistic material family', { exact: true }).inputValue(), 'soil');
    assert.equal(await page.getByLabel('Material seed', { exact: true }).inputValue(), '77');
    assert.equal(await page.getByLabel('Material palette', { exact: true }).inputValue(), 'ochre');
    assert.equal(await page.getByLabel('Material size', { exact: true }).inputValue(), '128');
    proof.realisticDraftRecovery = true;

    await page.evaluate(() => localStorage.setItem('cliff-material-v1', JSON.stringify({ id: 'hd2d-cliff-strata', seed: 1215, size: 128, palette: 'slate', strataScale: 5, fracture: 0.31, relief: 0.6, roughness: 0.78 })));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('[aria-label="Material recipe"]')?.value === 'hd2d-cliff-strata');
    assert.equal(await page.getByLabel('Material seed', { exact: true }).inputValue(), '1215');
    assert.equal(await page.getByLabel('Material palette', { exact: true }).inputValue(), 'slate');
    proof.legacyDraftRecovery = true;

    await page.getByRole('button', { name: /Photorealistic materials/ }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Material recipe"]')?.value === 'realistic-surface');
    await page.locator('.retro-terrain-panel summary').click();
    await page.waitForFunction(() => document.querySelector('.top h1')?.textContent.startsWith('Retro terrain ·'));
    assert.equal(await page.getByLabel('Active material preview', { exact: true }).evaluate((canvas) => getComputedStyle(canvas).imageRendering), 'pixelated');
    await page.locator('.material-panel summary').click();
    await page.waitForFunction(() => document.querySelector('.top h1')?.textContent.startsWith('soil surface ·'));
    assert.equal(await page.getByLabel('Active material preview', { exact: true }).evaluate((canvas) => getComputedStyle(canvas).imageRendering), 'auto');
    proof.previewExclusivity = { retro: 'pixelated', realistic: 'smooth' };

    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile layout should not overflow horizontally');
    await page.screenshot({ path: path.join(runDir, 'realistic-mobile.png') });
    proof.mobileNoOverflow = true;

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByLabel('Material seed', { exact: true }).fill('1204');
    await page.getByLabel('Material palette', { exact: true }).selectOption('earth');
    await sizeSelect.selectOption('512');
    let capturedExport = null;
    for (const preset of REALISTIC_SURFACE_PRESETS) {
      await presetButton(preset.label).click();
      await page.getByLabel('Material seed', { exact: true }).fill('1204');
      await page.getByLabel('Material palette', { exact: true }).selectOption('earth');
      await sizeSelect.selectOption('512');
      await page.waitForFunction((expected) => {
        try {
          const draft = JSON.parse(localStorage.getItem('cliff-material-v1'));
          return Object.entries(expected).every(([key, value]) => draft[key] === value);
        } catch { return false; }
      }, preset.recipe);
      const exportButton = page.getByRole('button', { name: 'Save material channels', exact: true });
      const downloadReady = page.waitForEvent('download');
      if (preset.recipe.family === 'soil') {
        let releaseSource;
        let notifySource;
        const sourceHeld = new Promise((resolve) => { notifySource = resolve; });
        let held = false;
        const hold = async (route) => {
          if (!held) {
            held = true;
            releaseSource = () => route.continue();
            notifySource();
          } else await route.continue();
        };
        await page.route('**/*material-realistic*.mjs*', hold);
        await exportButton.click();
        await sourceHeld;
        assert.ok(held, 'Export should fetch realistic source identity');
        await page.getByLabel('Material palette', { exact: true }).selectOption('slate');
        releaseSource();
        await page.unroute('**/*material-realistic*.mjs*', hold);
        const download = await downloadReady;
        const zipBytes = await fs.readFile(await download.path());
        capturedExport = await verifyExport(page, zipBytes, 'soil');
        assert.equal(JSON.parse(unzipStored(zipBytes).get('material.json').toString('utf8')).recipe.palette, 'earth');
        await page.waitForFunction(() => !document.querySelector('.material-panel .primary')?.disabled);
        assert.match(await page.locator('.material-panel [role="status"]').textContent(), /Unsaved material changes/);
        proof.concurrentEditPreserved = true;
      } else {
        await exportButton.click();
        const download = await downloadReady;
        const zipBytes = await fs.readFile(await download.path());
        const verified = await verifyExport(page, zipBytes, preset.recipe.family);
        proof.exports.push(verified);
      }
    }
    assert.ok(capturedExport, 'Soil export was verified');
    proof.exports.unshift(capturedExport);
    assert.deepEqual(proof.exports.map((entry) => entry.family), ['soil', 'gravel', 'limestone', 'concrete', 'bark', 'timber']);

    await presetButton('Loamy soil').click();
    let injected = false;
    const failSource = (route) => {
      injected = true;
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Injected source identity failure' });
    };
    activeFault = true;
    await page.route('**/*material-realistic*.mjs*', failSource);
    await page.getByRole('button', { name: 'Save material channels', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.material-panel [role="status"]')?.textContent.includes('Authoring source identity unavailable'));
    assert.match(await page.locator('.material-panel [role="status"]').textContent(), /Authoring source identity unavailable/);
    assert.ok(injected && injected404Response, 'Injected realistic source identity request should receive the expected 404');
    await page.unroute('**/*material-realistic*.mjs*', failSource);
    activeFault = false;
    const retryReady = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save material channels', exact: true }).click();
    const retryDownload = await retryReady;
    const retryZip = await fs.readFile(await retryDownload.path());
    proof.exportFailureRetry = (await verifyExport(page, retryZip, 'soil')).family === 'soil';

    await page.waitForFunction(() => document.querySelectorAll('.tile-grid > li').length === 75);
    assert.equal(await page.locator('.tile-grid > li').count(), 75, 'Material flow must not change the legacy tile count');
    assert.deepEqual(errors, [], 'Unexpected browser console/page errors');
  } catch (error) {
    failure = error;
    proof.failure = { message: error instanceof Error ? error.message : String(error) };
    await page?.screenshot({ path: path.join(runDir, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    activeFault = false;
    const cleanupIssues = [];
    const resolvedRunDir = path.resolve(runDir);
    let cleanedBakeDirectories = 0;
    for (const directory of ownedBakeDirectories) {
      const resolvedDirectory = path.resolve(directory);
      if (!resolvedDirectory.startsWith(`${resolvedRunDir}${path.sep}`)) cleanupIssues.push(`Refused CLI cleanup outside harness run directory: ${resolvedDirectory}`);
      else {
        try { await fs.rm(resolvedDirectory, { recursive: true, force: true }); cleanedBakeDirectories++; }
        catch (error) { cleanupIssues.push(`CLI output cleanup failed: ${error instanceof Error ? error.message : String(error)}`); }
      }
    }
    const cliRoot = path.resolve(runDir, 'cli-bakes');
    let cliBakeScratchRemoved = false;
    if (cliRoot.startsWith(`${resolvedRunDir}${path.sep}`)) {
      try { await fs.rm(cliRoot, { recursive: true, force: true }); cliBakeScratchRemoved = true; }
      catch (error) { cleanupIssues.push(`CLI output scratch cleanup failed: ${error instanceof Error ? error.message : String(error)}`); }
    } else cleanupIssues.push('Refused CLI scratch cleanup outside harness run directory');
    let browserClosed = !browser;
    if (browser) {
      try { await browser.close(); browserClosed = true; }
      catch (error) { cleanupIssues.push(`Browser close failed: ${error instanceof Error ? error.message : String(error)}`); }
    }
    let previewServerStatus = server ? 'close-failed' : 'not-owned (existing dev server)';
    if (server) {
      try {
        await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
        previewServerStatus = 'closed';
      } catch (error) { cleanupIssues.push(`Owned preview server close failed: ${error instanceof Error ? error.message : String(error)}`); }
    }
    proof.resources = { browserClosed, previewServer: previewServerStatus };
    proof.resources.cliBakeDirectoriesCleaned = cleanedBakeDirectories;
    proof.resources.cliBakeScratchRemoved = cliBakeScratchRemoved;
    proof.resources.cleanupIssues = cleanupIssues;
    proof.materialPanelHotUpdatesAfterInitialLoad = hotUpdateRequests;
    proof.status = failure || errors.length || cleanupIssues.length ? 'failed' : 'passed';
    proof.errors = errors;
    proof.expectedErrors = expectedErrors;
    await fs.writeFile(path.join(runDir, 'receipt.json'), JSON.stringify(proof, null, 2) + '\n');
  }
  if (proof.status !== 'passed') throw new Error(proof.resources.cleanupIssues.join('; ') || 'Browser verification cleanup failed');
  console.log(JSON.stringify({ status: 'passed', output: runDir }));
}

await main();
