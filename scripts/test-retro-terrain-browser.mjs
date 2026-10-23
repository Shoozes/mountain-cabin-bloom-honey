import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {preview} from 'vite';
import {generateRetroTerrain} from '../src/shader/retro-terrain.mjs';
import {generateRetroGrowth, generateTerrainKit} from '../src/shader/retro-terrain-growth.mjs';

const root = path.resolve(import.meta.dirname, '..');
const proofRoot = path.join(root, '.artifacts/proof/retro-terrain-browser');
const playwrightFlag = process.argv.indexOf('--playwright-root');
if (playwrightFlag < 0 || !process.argv[playwrightFlag + 1]) throw Error('Supply --playwright-root <installed package>');
const {chromium} = createRequire(path.join(path.resolve(process.argv[playwrightFlag + 1]), 'package.json'))('playwright-core');
const devFlag = process.argv.indexOf('--dev-url'), devUrl = devFlag < 0 ? null : process.argv[devFlag + 1];
if (devFlag >= 0 && (!devUrl || !/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(devUrl))) throw Error('Supply a loopback --dev-url http://127.0.0.1:<port>/');
const kitFlag = process.argv.indexOf('--kit'), kitMode = kitFlag < 0 ? 'classic' : process.argv[kitFlag + 1];
if (kitFlag >= 0 && (!kitMode || !['classic', 'growth'].includes(kitMode) || process.argv.indexOf('--kit', kitFlag + 1) >= 0)) throw Error('Use --kit classic or --kit growth');
await fs.mkdir(proofRoot, {recursive: true});
const out = path.join(proofRoot, `${Date.now()}-${process.pid}`);
await fs.mkdir(out, {recursive: true});
let server, browser, page, dpr2Page, failure;
const errors = [], expectedConsoleErrors = [], routeReleases = [], proof = {out, network: [], expectedFailures: []};

function parseStoredZip(bytes) {
  const files = new Map();
  for (let offset = 0; offset + 30 <= bytes.length;) {
    const signature = bytes.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;
    const method = bytes.readUInt16LE(offset + 8), compressedSize = bytes.readUInt32LE(offset + 18), size = bytes.readUInt32LE(offset + 22);
    const nameLength = bytes.readUInt16LE(offset + 26), extraLength = bytes.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength, name = bytes.toString('utf8', offset + 30, offset + 30 + nameLength);
    assert.equal(method, 0, `ZIP member ${name} must be stored without compression`);
    assert.equal(compressedSize, size, `ZIP member ${name} size must match`);
    assert.ok(start + size <= bytes.length, `ZIP member ${name} is truncated`);
    files.set(name, bytes.subarray(start, start + size));
    offset = start + size;
  }
  return files;
}

function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
async function snapshotPng(page, bytes) {
  return page.evaluate(async source => {
    const blob = new Blob([new Uint8Array(source)]), bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d', {willReadFrequently: true}); context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(value => value.toString(16).padStart(2, '0')).join('');
    bitmap.close(); return {width: canvas.width, height: canvas.height, digest};
  }, [...bytes]);
}
async function withTimeout(promise, milliseconds, message) {
  let timer;
  try { return await Promise.race([promise, new Promise((_resolve, reject) => {timer = setTimeout(() => reject(Error(message)), milliseconds);})]); }
  finally { clearTimeout(timer); }
}
async function adjustDiagnostics(page) {
  const roleCount = await page.getByRole('button', {name: 'Adjust', exact: true}).count().catch(() => null);
  const dom = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll('button')].filter(button => button.textContent.trim() === 'Adjust');
    return {
      visibilityState: document.visibilityState,
      readyState: document.readyState,
      detailsOpen: document.querySelector('.details')?.getAttribute('data-open') ?? null,
      buttons: candidates.map(button => {
        const rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const hiddenAncestor = button.closest('[aria-hidden="true"], [inert]');
        const style = getComputedStyle(button);
        return {text: button.textContent.trim(), ariaExpanded: button.getAttribute('aria-expanded'), disabled: button.disabled,
          rect: {left: rect.left, top: rect.top, width: rect.width, height: rect.height},
          hitTarget: hit?.textContent?.trim().slice(0, 80) ?? hit?.tagName ?? null,
          hiddenAncestor: hiddenAncestor ? {tag: hiddenAncestor.tagName, className: hiddenAncestor.className,
            ariaHidden: hiddenAncestor.getAttribute('aria-hidden'), inert: hiddenAncestor.hasAttribute('inert')} : null,
          style: {display: style.display, visibility: style.visibility, pointerEvents: style.pointerEvents}};
      }),
      hydrationEvidence: [...document.querySelectorAll('#root, #app, [data-reactroot]')].slice(0, 4).map(element =>
        ({selector: element.id ? `#${element.id}` : '[data-reactroot]', children: element.childElementCount, textLength: element.textContent.length})),
    };
  }).catch(error => ({captureError: error.message}));
  return {roleLocatorCount: roleCount, ...dom};
}
async function ensureAdjustOpen(page) {
  const button = page.getByRole('button', {name: 'Adjust', exact: true});
  const isOpen = () => page.evaluate(() => document.querySelector('.details')?.getAttribute('data-open') === 'true'
    && [...document.querySelectorAll('button')].some(value => value.textContent.trim() === 'Adjust' && value.getAttribute('aria-expanded') === 'true'));
  let lastClickError, lastStateError;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await isOpen()) return;
    try {
      await button.waitFor({state: 'visible', timeout: 1200});
      if (await button.getAttribute('aria-expanded') === 'true') return;
      await button.click({timeout: 1200});
    } catch (error) { lastClickError = error; /* bounded retry below keeps the interaction on Playwright's pointer path */ }
    try {
      await page.waitForFunction(() => document.querySelector('.details')?.getAttribute('data-open') === 'true', undefined, {timeout: 1200});
      return;
    } catch (error) {
      lastStateError = error;
      // A click may have completed while a render-frame-based locator wait lagged.
      // Read the actual two-sided state before retrying or reporting a failure.
      if (await isOpen()) return;
    }
  }
  const error = lastClickError ?? lastStateError ?? Error('Could not open the adjustment panel');
  error.adjustDiagnostics = await adjustDiagnostics(page);
  throw error;
}
async function measureIntegerStage(page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.stage canvas[aria-label="Active material preview"]');
    return canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.height > 0;
  });
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector('.stage canvas[aria-label="Active material preview"]');
    if (!(canvas instanceof HTMLCanvasElement)) throw Error('Active retro material preview canvas is missing');
    const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    return {dpr, source: {width: canvas.width, height: canvas.height}, rect: {width: rect.width, height: rect.height},
      deviceScale: {x: rect.width * dpr / canvas.width, y: rect.height * dpr / canvas.height}};
  });
  for (const axis of ['x', 'y']) assert.ok(Math.abs(metrics.deviceScale[axis] - Math.round(metrics.deviceScale[axis])) < 1e-8,
    `${axis} device-pixel magnification must be an integer: ${JSON.stringify(metrics)}`);
  assert.ok(metrics.deviceScale.x > 0, `stage device-pixel magnification must be positive: ${JSON.stringify(metrics)}`);
  assert.ok(Math.abs(metrics.deviceScale.x - metrics.deviceScale.y) < 1e-8,
    `stage device-pixel magnification must match on both axes: ${JSON.stringify(metrics)}`);
  return metrics;
}

try {
  if (!devUrl) server = await preview({root, mode: 'pages', preview: {host: '127.0.0.1', port: 0, open: false}});
  const address = server?.httpServer.address();
  proof.mode = devUrl ? 'dev' : 'pages'; proof.kit = kitMode; proof.url = devUrl ?? `http://127.0.0.1:${address.port}/mountain-cabin-bloom-honey/`;
  browser = await chromium.launch({channel: 'chrome', headless: true});
  page = await browser.newPage({viewport: {width: 1440, height: 1080}, deviceScaleFactor: 1});
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  let injectingFault = false;
  page.on('console', message => { if (message.type() === 'error') (injectingFault ? expectedConsoleErrors : errors).push(message.text()); });
  page.on('request', request => proof.network.push({type: request.resourceType(), url: request.url()}));
  await page.goto(proof.url);
  const cacheSession = await page.context().newCDPSession(page);
  await cacheSession.send('Network.setCacheDisabled', {cacheDisabled: true}); proof.sourceFetchCacheDisabled = true;
  await ensureAdjustOpen(page);
  proof.adjustExpanded = await page.getByRole('button', {name: 'Adjust', exact: true}).getAttribute('aria-expanded');
  const retro = page.locator('.retro-terrain-panel'), material = page.locator('.material-panel:not(.retro-terrain-panel)');
  await page.locator('.details[data-open="true"]').waitFor();
  await page.locator('.details').evaluate(element => {element.scrollTop = 0;});
  await retro.locator('summary').click();
  const canvas = page.getByLabel('Retro terrain preview', {exact: true}); await canvas.waitFor({state: 'visible'});
  const kitSelect = page.getByLabel('Terrain kit', {exact: true});
  await kitSelect.selectOption(kitMode === 'growth' ? 'retro-terrain-growth' : 'retro-terrain');
  if (kitMode === 'growth') await page.getByLabel('Terrain palette', {exact: true}).selectOption('heath');
  const seedInput = page.getByLabel('Terrain seed', {exact: true});
  await seedInput.fill('1204');
  await page.waitForFunction(() => document.querySelector('.top h1')?.textContent?.startsWith('Retro terrain · dirt'), undefined, {timeout: 10000});
  assert.equal(await page.locator('.top h1').textContent(), 'Retro terrain · dirt · color');
  assert.equal(await material.locator('summary').evaluate(el => el.parentElement.open), false);

  const signature = () => canvas.evaluate(element => {
    const data = element.getContext('2d').getImageData(0, 0, element.width, element.height).data;
    let hash = 0; for (const value of data) hash = (Math.imul(hash, 31) + value) >>> 0; return hash;
  });
  const initialSignature = await signature();
  await page.getByLabel('Terrain seed', {exact: true}).fill('1205');
  assert.notEqual(await signature(), initialSignature, 'seed edits change rendered pixels');
  const tileSelect = page.getByLabel('Terrain tile', {exact: true});
  const tileValues = kitMode === 'growth'
    ? ['dirt', 'grass', 'gravel', 'weathered-dirt', 'weathered-grass', 'weathered-gravel', 'atlas', 'patch', 'weathered-patch', 'path-patch', 'varied-path-patch', 'varied-weathered-patch', 'varied-dirt', 'varied-grass', 'varied-gravel', 'weathered-grass-dirt-atlas', 'gravel-path-atlas', 'weathered-gravel-path-atlas', ...Array.from({length: 16}, (_, i) => `grass-dirt-${i}`), ...Array.from({length: 16}, (_, i) => `gravel-path-${i}`), ...Array.from({length: 16}, (_, i) => `weathered-gravel-path-${i}`)]
    : ['dirt', 'grass', 'gravel', 'atlas', 'patch', ...Array.from({length: 16}, (_, i) => `grass-dirt-${i}`)];
  const tileSignatures = new Map();
  for (const value of tileValues) { await tileSelect.selectOption(value); tileSignatures.set(value, await signature()); }
  assert.ok(tileSignatures.get('dirt') !== tileSignatures.get('grass'));
  assert.ok(tileSignatures.get('atlas') !== tileSignatures.get('patch'));
  if (kitMode === 'growth') {
    assert.notEqual(tileSignatures.get('path-patch'), tileSignatures.get('weathered-patch'), 'weathering changes the connected path preview');
    assert.notEqual(tileSignatures.get('path-patch'), tileSignatures.get('varied-path-patch'), 'seed variation changes the connected path preview');
    assert.notEqual(tileSignatures.get('varied-path-patch'), tileSignatures.get('varied-weathered-patch'), 'varied weathered path preview remains distinct');
    assert.notEqual(tileSignatures.get('gravel-path-15'), tileSignatures.get('weathered-gravel-path-15'), 'weathering changes path overlay pixels');
    const paletteSelect = page.getByLabel('Terrain palette', {exact: true}), heathPreview = tileSignatures.get('weathered-gravel-path-15');
    await paletteSelect.selectOption('riverbed');
    const riverbedPreview = await signature();
    assert.notEqual(riverbedPreview, heathPreview, 'palette changes recolor the weathered path preview');
    await paletteSelect.selectOption('heath');
    assert.equal(await signature(), heathPreview, 'returning to heath restores its preview pixels');
    proof.growthPreviews = {path: true, weatheredPatch: true, weatheredOverlay: true};
    proof.paletteSwitch = {riverbedChangesPreview: true, heathRestoresPreview: true};
  }
  await tileSelect.selectOption('dirt');
  const repeat = page.getByLabel('Terrain repeat', {exact: true});
  await repeat.selectOption('4'); assert.equal(await repeat.inputValue(), '4');
  await tileSelect.selectOption('grass-dirt-0'); assert.equal(await repeat.isDisabled(), true);
  await tileSelect.selectOption('grass'); assert.equal(await repeat.isDisabled(), false);
  assert.equal(await repeat.inputValue(), '4');
  proof.integerStageScaling = {desktop: await measureIntegerStage(page)};
  await page.screenshot({path: path.join(out, 'retro-terrain-desktop.png')});

  // Switching to material and back confirms the mutually exclusive preview owner.
  await material.locator('summary').click();
  await page.waitForFunction(() => document.querySelector('.material-panel:not(.retro-terrain-panel)')?.open === true && document.querySelector('.retro-terrain-panel')?.open === false);
  assert.equal(await material.evaluate(el => el.open), true); assert.equal(await retro.evaluate(el => el.open), false);
  assert.equal(await page.getByLabel('Material channel preview', {exact: true}).isVisible(), true);
  await page.locator('.details').evaluate(element => {element.scrollTop = 0;});
  await retro.locator('summary').click();
  await page.waitForFunction(() => document.querySelector('.retro-terrain-panel')?.open === true && document.querySelector('.material-panel:not(.retro-terrain-panel)')?.open === false);
  assert.equal(await retro.evaluate(el => el.open), true); assert.equal(await material.evaluate(el => el.open), false);
  assert.equal(await page.locator('.top h1').textContent(), 'Retro terrain · grass · color');
  proof.exclusivePanels = true;

  // Export and check the archive's complete asset set and decoded pixels against the CPU generator.
  await tileSelect.selectOption('grass-dirt-0');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Save terrain kit', exact: true}).click();
  const download = await downloadPromise, zipPath = path.join(out, 'retro-terrain.zip'); await download.saveAs(zipPath);
  const entries = parseStoredZip(await fs.readFile(zipPath));
  const expectedPngCount = kitMode === 'growth' ? 74 : 20;
  assert.equal(entries.size, expectedPngCount + 2);
  assert.ok(entries.has('recipe.json')); assert.ok(entries.has('terrain.json'));
  const recipe = JSON.parse(entries.get('recipe.json').toString('utf8'));
  assert.deepEqual(recipe, kitMode === 'growth'
    ? {id: 'retro-terrain-growth', seed: 1205, palette: 'heath'}
    : {id: 'retro-terrain', seed: 1205});
  const manifest = JSON.parse(entries.get('terrain.json').toString('utf8'));
  assert.equal(manifest.format, 'retro-terrain-pack/1'); assert.equal(manifest.visualReview, 'unapproved');
  assert.equal(manifest.provenance.author, 'original procedural work for our projects');
  assert.deepEqual(manifest.provenance.restrictedInputs, []);
  assert.equal(manifest.tiles.length, kitMode === 'growth' ? 70 : 19); assert.equal(manifest.files.length, expectedPngCount);
  for (let mask = 0; mask < 16; mask++) {
    const tile = manifest.tiles.find(item => item.id === `grass-dirt-${mask}`);
    assert.equal(tile.cornerMask, mask);
    assert.deepEqual(tile.atlas, {x: mask % 4 * 64, y: Math.floor(mask / 4) * 64});
    if (kitMode === 'growth') {
      const weathered = manifest.tiles.find(item => item.id === `weathered-grass-dirt-${mask}`);
      assert.deepEqual(weathered.atlas, {path: 'weathered-grass-dirt-atlas.png', x: mask % 4 * 64, y: Math.floor(mask / 4) * 64});
    }
  }
  let expectedPixels;
  if (kitMode === 'growth') {
    const kit = generateTerrainKit(recipe), direct = generateRetroGrowth(recipe);
    assert.equal(kit.tiles.length, 70); assert.equal(kit.atlases.length, 4);
    assert.deepEqual(kit.tiles.map(tile => tile.id), direct.tiles.map(tile => tile.id));
    for (let index = 0; index < kit.tiles.length; index++) assert.deepEqual(kit.tiles[index].data, direct.tiles[index].data, `dispatcher pixels match growth generator for ${kit.tiles[index].id}`);
    expectedPixels = new Map([...kit.tiles.map(tile => [`${tile.id}.png`, tile]), ...kit.atlases.map(atlas => [`${atlas.id}.png`, atlas])]);
    assert.deepEqual(manifest.atlases.map(atlas => atlas.path), kit.atlases.map(atlas => `${atlas.id}.png`));
    proof.exportContents = {entries: entries.size, pngs: manifest.files.length, tiles: kit.tiles.length, atlases: kit.atlases.length, decodedPixelMatches: manifest.files.length};
  } else {
    const kit = generateRetroTerrain(recipe);
    expectedPixels = new Map([...kit.tiles.map(tile => [`${tile.id}.png`, tile]), ['grass-dirt-atlas.png', kit.atlas]]);
    proof.exportContents = {entries: entries.size, pngs: manifest.files.length, decodedPixelMatches: manifest.files.length};
  }
  for (const descriptor of manifest.files) {
    const png = entries.get(descriptor.path); assert.ok(png, `archive contains ${descriptor.path}`);
    assert.equal(png.length, descriptor.bytes); assert.equal(digest(png), descriptor.sha256);
    const decoded = await snapshotPng(page, png), expected = expectedPixels.get(descriptor.path);
    assert.ok(expected, `known CPU pixels for ${descriptor.path}`);
    assert.equal(decoded.width, expected.width); assert.equal(decoded.height, expected.height);
    assert.equal(decoded.digest, digest(expected.data), `decoded browser pixels match generator for ${descriptor.path}`);
  }

  // Missing generator source produces retryable status; retry succeeds when source fetch is restored.
  const sourceRoute = route => {
    const request = route.request();
    return request.resourceType() === 'fetch' && /retro-terrain(?:-browser)?(?:-[^/]+)?\.mjs$/.test(new URL(request.url()).pathname);
  };
  let held = false;
  const failSource = async route => {
    if (!held && sourceRoute(route)) { held = true; proof.expectedFailures.push({url: route.request().url(), status: 404}); await route.fulfill({status: 404, contentType: 'text/plain', body: 'test source unavailable'}); }
    else await route.continue();
  };
  injectingFault = true;
  await page.route('**/*', failSource);
  await page.getByRole('button', {name: 'Save terrain kit', exact: true}).click();
  const status = page.locator('.retro-terrain-panel [role=status], .retro-terrain-panel [role=alert]');
  await page.waitForFunction(() => /source identity unavailable/.test(document.querySelector('.retro-terrain-panel .drawer-status')?.textContent ?? ''), undefined, {timeout: 10000});
  assert.match(await status.textContent(), /source identity unavailable.*retry/i);
  await page.unroute('**/*', failSource); injectingFault = false; assert.ok(held); proof.missingSourceRetry = true;
  const retryDownload = page.waitForEvent('download'); await page.getByRole('button', {name: 'Save terrain kit', exact: true}).click();
  await retryDownload; proof.retrySucceeded = true;

  // Hold the export's source read, edit the seed, then release it to verify snapshot semantics.
  let releaseHeld, notifyHeld; const sourceHeld = new Promise(resolve => { notifyHeld = resolve; }); let didHold = false;
  const holdSource = async route => {
    if (!didHold && sourceRoute(route)) { didHold = true; releaseHeld = () => route.continue(); routeReleases.push(releaseHeld); notifyHeld(); }
    else await route.continue();
  };
  await page.route('**/*', holdSource);
  const staleDownload = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Save terrain kit', exact: true}).click();
  await withTimeout(sourceHeld, 10000, 'Export source route was not held');
  await page.getByLabel('Terrain seed', {exact: true}).fill('1206');
  assert.match(await page.locator('.retro-terrain-panel [role=status]').textContent(), /Unsaved retro terrain changes/);
  releaseHeld(); await page.unroute('**/*', holdSource);
  const staleItem = await staleDownload, stalePath = path.join(out, 'stale-seed.zip'); await staleItem.saveAs(stalePath);
  const staleZip = parseStoredZip(await fs.readFile(stalePath));
  assert.equal(JSON.parse(staleZip.get('recipe.json').toString('utf8')).seed, 1205);
  proof.seedInputBeforeReload = await page.getByLabel('Terrain seed', {exact: true}).inputValue();
  proof.seedStorageBeforeReload = await page.evaluate(() => localStorage.getItem('retro-terrain-v1'));
  if (kitMode === 'growth') assert.equal(JSON.parse(proof.seedStorageBeforeReload).palette, 'heath');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('retro-terrain-v1') ?? '{}').seed === 1206);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[aria-label="Terrain seed"]')?.value === '1206');
  if (kitMode === 'growth') await page.waitForFunction(() => document.querySelector('[aria-label="Terrain palette"]')?.value === 'heath');
  await ensureAdjustOpen(page);
  await page.locator('.details[data-open="true"]').waitFor();
  proof.seedStorageAfterReload = await page.evaluate(() => localStorage.getItem('retro-terrain-v1'));
  proof.seedInputAfterReload = await page.getByLabel('Terrain seed', {exact: true}).inputValue();
  assert.equal(await page.getByLabel('Terrain seed', {exact: true}).inputValue(), '1206');
  if (kitMode === 'growth') {
    assert.equal(await page.getByLabel('Terrain palette', {exact: true}).inputValue(), 'heath');
    proof.palettePersistence = true;
  }
  await page.locator('.details').evaluate(element => {element.scrollTop = 0;});
  const reloadedSummary = page.locator('.retro-terrain-panel summary');
  await reloadedSummary.scrollIntoViewIfNeeded(); await reloadedSummary.click({force: true});
  await page.waitForFunction(() => document.querySelector('.retro-terrain-panel')?.open === true);
  await page.getByLabel('Terrain tile', {exact: true}).selectOption('dirt');
  await page.setViewportSize({width: 390, height: 844});
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  proof.integerStageScaling.mobile = await measureIntegerStage(page);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const locator of [page.locator('.retro-terrain-panel summary'), page.getByLabel('Terrain seed', {exact:true}), page.getByLabel('Terrain tile', {exact:true}), page.getByRole('button', {name:'Save terrain kit',exact:true})]) {
    const bounds = await locator.boundingBox(); assert.ok(bounds && bounds.height >= 44, 'Terrain controls need touch-sized targets');
  }
  proof.touchTargets = true;
  await page.screenshot({path: path.join(out, 'retro-terrain-mobile.png')});
  proof.seedPersistence = true; proof.mobileFits = true;

  dpr2Page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});
  dpr2Page.setDefaultTimeout(10000);
  dpr2Page.on('pageerror', error => errors.push(error.message));
  dpr2Page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await dpr2Page.goto(proof.url, {waitUntil: 'domcontentloaded'});
  await dpr2Page.getByRole('button', {name: 'Adjust', exact: true}).waitFor({state: 'visible'});
  await ensureAdjustOpen(dpr2Page);
  await dpr2Page.locator('.details').evaluate(element => {element.scrollTop = 0;});
  const dpr2Summary = dpr2Page.locator('.retro-terrain-panel summary');
  await dpr2Summary.evaluate(element => element.scrollIntoView({block: 'center', inline: 'nearest'}));
  await dpr2Page.waitForFunction(() => {
    const rect = document.querySelector('.retro-terrain-panel summary')?.getBoundingClientRect();
    return document.querySelector('.details')?.getAttribute('data-open') === 'true' && rect && rect.top >= 0 && rect.bottom <= innerHeight;
  });
  await dpr2Summary.click();
  await dpr2Page.getByLabel('Retro terrain preview', {exact: true}).waitFor({state: 'visible'});
  await dpr2Page.getByLabel('Terrain kit', {exact: true}).selectOption(kitMode === 'growth' ? 'retro-terrain-growth' : 'retro-terrain');
  if (kitMode === 'growth') await dpr2Page.getByLabel('Terrain palette', {exact: true}).selectOption('heath');
  await dpr2Page.getByLabel('Terrain tile', {exact: true}).selectOption('grass');
  await dpr2Page.getByLabel('Terrain repeat', {exact: true}).selectOption('4');
  await dpr2Page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const dpr2Metrics = await measureIntegerStage(dpr2Page);
  await dpr2Page.close(); dpr2Page = null;
  proof.integerStageScaling.dpr2Mobile = {target: proof.url, sourceSelector: '.stage canvas[aria-label="Active material preview"]', ...dpr2Metrics, closed: true};
  proof.integerStageScaling.sourceSelector = '.stage canvas[aria-label="Active material preview"]';

  // Closing the drawer cancels a held source read; reopening allows a clean retry.
  await page.bringToFront();
  await page.getByRole('button', {name: 'Adjust', exact: true}).waitFor({state: 'visible'});
  let notifyCancel; const cancelHeld = new Promise(resolve => { notifyCancel = resolve; }); let releaseCancel;
  const stallSource = async route => {
    if (!releaseCancel && sourceRoute(route)) { notifyCancel(); await new Promise(resolve => { releaseCancel = resolve; routeReleases.push(() => resolve()); }); await route.continue().catch(() => {}); }
    else await route.continue();
  };
  await page.route('**/*', stallSource);
  await page.getByRole('button', {name: 'Save terrain kit', exact: true}).click();
  try { await withTimeout(cancelHeld, 30000, 'Cancellation source route was not held'); }
  catch (error) {
    proof.cancelDebug = {status: await page.locator('.retro-terrain-panel .drawer-status').textContent().catch(() => null),
      buttonDisabled: await page.getByRole('button', {name: 'Save terrain kit', exact: true}).isDisabled().catch(() => null),
      requests: proof.network.slice(-30)};
    throw error;
  }
  await page.getByRole('button', {name: 'Done', exact: true}).click();
  await page.locator('.details[data-open="false"]').waitFor();
  releaseCancel(); await page.unroute('**/*', stallSource);
  assert.match(await page.locator('.retro-terrain-panel [role=status]').textContent(), /Export cancelled; reopen to retry/);
  await page.waitForTimeout(250);
  await ensureAdjustOpen(page);
  await page.locator('.details[data-open="true"]').waitFor();
  await page.locator('.details').evaluate(element => {element.scrollTop = 0;});
  const retriedSummary = page.locator('.retro-terrain-panel summary');
  await retriedSummary.evaluate(element => element.scrollIntoView({block: 'center', inline: 'nearest'}));
  await page.waitForFunction(() => {
    const rect = document.querySelector('.retro-terrain-panel summary')?.getBoundingClientRect();
    return rect && rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
  await retriedSummary.click({force: true});
  await page.waitForFunction(() => document.querySelector('.retro-terrain-panel')?.open === true);
  const retryButton = page.getByRole('button', {name: 'Save terrain kit', exact: true});
  await retryButton.waitFor({state: 'visible'});
  proof.retryButton = await retryButton.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {disabled: element.disabled, rect: {left: rect.left, top: rect.top, width: rect.width, height: rect.height},
      viewport: {width: innerWidth, height: innerHeight}, hitTarget: hit?.textContent?.trim().slice(0, 80) ?? hit?.tagName ?? null};
  });
  const afterCancel = page.waitForEvent('download', {timeout: 60000});
  void afterCancel.catch(() => {});
  let retryClickError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await retryButton.click({timeout: 2000}); retryClickError = null; break; }
    catch (error) {
      retryClickError = error;
      if (attempt < 2) {
        await retryButton.evaluate(element => element.scrollIntoView({block: 'center', inline: 'nearest'}));
        await page.waitForTimeout(180);
      }
    }
  }
  if (retryClickError) throw retryClickError;
  await afterCancel;
  proof.cancelAndRetry = true;
  proof.authRequests = proof.network.filter(request => /^\/(?:api\/auth|auth\/popup)(?:\/|\?|$)/.test(new URL(request.url).pathname)).length;
  assert.equal(proof.authRequests, 0, 'Standalone texture authoring must not request sign-in');
  assert.deepEqual(errors, []);
} catch (error) {
  failure = error;
  if (error.adjustDiagnostics) proof.adjustFailureDiagnostics = error.adjustDiagnostics;
  proof.uiState = await page?.evaluate(() => ({details: document.querySelector('.details')?.outerHTML.slice(0, 500), adjust: [...document.querySelectorAll('button')].map(button => [button.textContent.trim(), button.getAttribute('aria-expanded')]).filter(([name]) => name === 'Adjust'), terrainStorage: localStorage.getItem('retro-terrain-v1'), terrainInput: document.querySelector('[aria-label="Terrain seed"]')?.value})).catch(() => null);
  await page?.screenshot({path: path.join(out, 'failure.png')}).catch(() => {});
  proof.failure = error.message;
} finally {
  for (const release of routeReleases) { try { await release(); } catch { proof.staleRouteReleases = (proof.staleRouteReleases ?? 0) + 1; } }
  await dpr2Page?.close();
  await browser?.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
  await fs.writeFile(path.join(out, 'receipt.json'), JSON.stringify({...proof, expectedConsoleErrors, status: failure || errors.length ? 'failed' : 'passed', errors}, null, 2));
}
if (failure) throw failure;
if (errors.length) throw Error(`Browser console errors: ${errors.join('; ')}`);
console.log(JSON.stringify({status: 'passed', out}));
