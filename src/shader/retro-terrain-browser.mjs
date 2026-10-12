import {generateTerrainKit, describeTerrainKit} from './retro-terrain-growth.mjs';
import {paintMaterialCanvas} from './material-browser.mjs';
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
export async function retroTerrainBrowserFiles(recipe, {signal} = {}) {
  signal?.throwIfAborted();
  const kit = generateTerrainKit(recipe);
  // Queue the bounded kit together, avoiding serial idle-frame waits.
  const encoded = await Promise.all([...kit.tiles, ...(kit.atlases ?? [{id: 'grass-dirt-atlas', ...kit.atlas}])].map(async tile => {
    signal?.throwIfAborted();
    const canvas = document.createElement('canvas');
    paintMaterialCanvas(canvas, tile);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error('Retro terrain PNG export failed')), 'image/png'));
    signal?.throwIfAborted();
    const data = new Uint8Array(await blob.arrayBuffer()), name = tile.id + '.png';
    const [sha256, rgbaSha256] = await Promise.all([digest(data), digest(tile.data)]);
    return {name, data, metadata: {path: name, width: tile.width, height: tile.height, bytes: data.length, sha256, rgbaSha256}};
  }));
  const files = encoded.map(({name, data}) => ({name, data})), metadata = encoded.map(value => value.metadata);
  const sources = [];
  for (const url of [new URL('./retro-terrain.mjs', import.meta.url), new URL('./retro-terrain-growth.mjs', import.meta.url), new URL(import.meta.url)]) {
    const response = await fetch(url, {signal});
    if (!response.ok) throw Error('Retro terrain authoring source identity unavailable');
    sources.push({path: url.pathname, sha256: await digest(new Uint8Array(await response.arrayBuffer()))});
  }
  signal?.throwIfAborted();
  const descriptor = describeTerrainKit(kit);
  const identity = await digest(new TextEncoder().encode(JSON.stringify({recipe: kit.recipe, generator: descriptor.generator, sources})));
  const manifest = {...descriptor, identity, sourceTip: null, sources, files: metadata};
  for (const [name, content] of [['recipe.json', kit.recipe], ['terrain.json', manifest]]) files.push({name, data: new TextEncoder().encode(JSON.stringify(content, null, 2) + '\n')});
  return files;
}
