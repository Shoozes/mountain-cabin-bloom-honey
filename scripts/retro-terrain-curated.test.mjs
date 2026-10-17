import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {generateRetroTerrain} from '../src/shader/retro-terrain.mjs';
import {generateRetroGrowth} from '../src/shader/retro-terrain-growth.mjs';
import {BLOB_MASK_GRID, blobAtlasPosition, blobMaskAt} from '../src/shader/retro-autotile.mjs';
import {
  CURATED_FAMILIES, CURATED_COMPOSITIONS, CURATED_RELATIONSHIPS,
  CURATED_SCENE,
  curatedArtSource,
  curatedPathMask, composeCuratedSurface, composeCuratedTerrain,
  describeCuratedTerrain, generateCuratedTerrain,
} from '../src/shader/retro-terrain-curated.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
const pixel = (data, size, x, y) => [...data.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)];
const alphaAt = (data, size, x, y) => data[(y * size + x) * 4 + 3];
const colors = data => new Set(Array.from({length: data.length / 4}, (_, i) => [...data.subarray(i * 4, i * 4 + 3)].join(',')));
const tile = (kit, id) => {
  const found = kit.tiles.find(item => item.id === id);
  assert.ok(found, `missing tile ${id}`);
  return found;
};
function edge(mask, side, size) {
  return Array.from({length: size}, (_, i) => mask[side === 'left' ? i * size : side === 'right' ? i * size + size - 1 : side === 'top' ? i : (size - 1) * size + i]);
}
function connected(mask, size) {
  const first = mask.findIndex(Boolean);
  if (first < 0) return false;
  const seen = new Set([first]), pending = [first];
  while (pending.length) {
    const at = pending.pop(), x = at % size, y = Math.floor(at / size);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const next = ny * size + nx;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size && mask[next] && !seen.has(next)) { seen.add(next); pending.push(next); }
    }
  }
  return seen.size === mask.reduce((sum, value) => sum + value, 0);
}
function componentCount(mask, size) {
  const seen = new Set(); let count = 0;
  for (let start = 0; start < mask.length; start++) if (mask[start] && !seen.has(start)) {
    count++; const pending = [start]; seen.add(start);
    while (pending.length) {
      const at = pending.pop(), x = at % size, y = Math.floor(at / size);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        const next = ny * size + nx;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size && mask[next] && !seen.has(next)) { seen.add(next); pending.push(next); }
      }
    }
  }
  return count;
}
function sideForMask(mask, side) {
  return side === 'top' ? Boolean(mask & 1) : side === 'right' ? Boolean(mask & 2) : side === 'bottom' ? Boolean(mask & 4) : Boolean(mask & 8);
}
function band(data, size, side, depth) {
  const result = [];
  for (let i = 0; i < size; i++) for (let d = 0; d < depth; d++) {
    const x = side === 'left' ? d : side === 'right' ? size - depth + d : i;
    const y = side === 'top' ? d : side === 'bottom' ? size - depth + d : i;
    result.push(pixel(data, size, x, y));
  }
  return result;
}
function featureGroups(material, size, ground, excludedBand = 0) {
  const marked = i => material.data.subarray(i * 4, i * 4 + 3).some((value, channel) => value !== (material.primary ? material.primary[i * 4 + channel] : ground[channel]));
  const seen = new Set(), groups = [];
  for (let start = 0; start < size * size; start++) if (!seen.has(start) && marked(start)) {
    const group = [], pending = [start]; seen.add(start);
    while (pending.length) {
      const at = pending.pop(), x = at % size, y = Math.floor(at / size); group.push(at);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, next = ny * size + nx;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size && !seen.has(next) && marked(next)) { seen.add(next); pending.push(next); }
      }
    }
    if (excludedBand && group.some(at => at % size < excludedBand || at % size >= size - excludedBand || Math.floor(at / size) < excludedBand || Math.floor(at / size) >= size - excludedBand)) continue;
    groups.push(group);
  }
  return groups;
}
function assertWholeFeatureGroups(output, source, underlay, groups, label, familyGround = source.ground) {
  const samePixel = (a, b, at) => a[at * 4] === b[at * 4] && a[at * 4 + 1] === b[at * 4 + 1] && a[at * 4 + 2] === b[at * 4 + 2] && a[at * 4 + 3] === b[at * 4 + 3];
  const isFamilyGround = at => output.data[at * 4] === familyGround[0] && output.data[at * 4 + 1] === familyGround[1] && output.data[at * 4 + 2] === familyGround[2] && output.data[at * 4 + 3] === 255;
  for (const [groupIndex, group] of groups.entries()) {
    const retained = group.every(at => samePixel(output.data, source.data, at));
    const omitted = group.every(at => samePixel(output.data, underlay.data, at) || isFamilyGround(at) || source.primary && samePixel(output.data, source.primary, at));
    assert.ok(retained || omitted, `${label}: feature group ${groupIndex} was clipped or changed`);
  }
}

test('the preserved fixture still matches all twelve classic and growth recipe outputs', async () => {
  const fixture = JSON.parse(await fs.readFile(new URL('./fixtures/retro-terrain-preserved-20261011.json', import.meta.url), 'utf8'));
  assert.equal(fixture.cases.length, 12);
  for (const entry of fixture.cases) {
    const kit = entry.recipe.id === 'retro-terrain' ? generateRetroTerrain(entry.recipe) : generateRetroGrowth(entry.recipe);
    assert.deepEqual(kit.tiles.map(item => ({id: item.id, rgba: hash(item.data)})), entry.tiles, JSON.stringify(entry.recipe));
    const atlases = kit.atlases ?? [kit.atlas];
    assert.deepEqual(atlases.map(item => hash(item.data)), entry.atlases, JSON.stringify(entry.recipe));
  }
});

test('historical curated fixture remains recorded and original terrain palette roles are preserved', async () => {
  const fixture = JSON.parse(await fs.readFile(new URL('./fixtures/retro-terrain-unaffected-20261012.json', import.meta.url), 'utf8'));
  assert.equal(fixture.cases.length, 72);
  const legacyFamilies = ['grass', 'dirt', 'gravel'];
  for (const [palette, original] of Object.entries(fixture.palettes)) {
    const current = curatedArtSource(generateCuratedTerrain({tileSize: 16, palette, seed: 1204})).palettes;
    for (const family of legacyFamilies) assert.deepEqual(current[family], original[family], `${palette} ${family} ramp`);
  }
});

test('expanded candidate matches deliberately updated active decoded-pixel expectations', async () => {
  const fixture = JSON.parse(await fs.readFile(new URL('./fixtures/retro-terrain-curated-v2.json', import.meta.url), 'utf8'));
  assert.equal(fixture.generator, 'retro-terrain-curated/2');
  assert.equal(fixture.visualReview, 'unapproved');
  assert.equal(fixture.startingArtSha256, 'fc21f554ed799a1924425c58ad7a955ffaae7888b83b5c77c5ecac24dd3641c5');
  assert.deepEqual(fixture.cases.map(item => item.recipe.tileSize), [16, 64]);
  for (const entry of fixture.cases) {
    const kit = generateCuratedTerrain(entry.recipe);
    assert.deepEqual([...kit.tiles, ...kit.atlases, ...kit.templates, ...kit.previews].map(({id, width, height, data}) => ({id, width, height, rgbaSha256: hash(data)})), entry.images);
  }
});

for (const tileSize of [16, 64]) {
  test(`${tileSize}px natural materials use quiet shared seam bands across compositions and weathering`, () => {
    const kit = generateCuratedTerrain({tileSize, seed: 1204, palette: 'woodland'}), depth = tileSize === 16 ? 2 : 4;
    for (const family of ['grass', 'dirt', 'gravel', 'moss', 'rock']) for (const weathered of [false, true]) for (const composition of CURATED_COMPOSITIONS) {
      const source = tile(kit, `${weathered ? 'weathered-' : ''}${family}-${composition}`);
      for (const side of ['top', 'right', 'bottom', 'left']) {
        for (const value of band(source.data, tileSize, side, depth)) assert.deepEqual(value, [...source.ground, 255], `${source.id} ${side}`);
      }
      if (family === 'gravel') {
        const groups = featureGroups(source, tileSize, source.ground);
        assert.ok(groups.length >= 2, `${source.id}: retain distinct stone aggregates`);
        assert.ok(groups.every(group => group.length >= 2), `${source.id}: stones remain connected clusters`);
      }
    }
  });
}

test('connected terrain relationships keep exact adjoining boundaries in normal and weathered scenes', () => {
  for (const tileSize of [16, 64]) for (const seed of [1204, 1215, 1233]) for (const palette of ['woodland', 'dry-trail', 'cool-moor']) {
    const kit = generateCuratedTerrain({tileSize, seed, palette}), relationships = tileSize === 16 ? CURATED_RELATIONSHIPS : CURATED_RELATIONSHIPS.filter(value => value !== 'gravel-dirt');
    const n = tileSize, sceneSize = tileSize === 16 ? CURATED_SCENE.length : 7;
    for (const relationship of relationships) for (const weathered of [false, true]) for (const composition of ['mixed', ...CURATED_COMPOSITIONS]) {
      const image = composeCuratedTerrain(kit, {relationship, weathered, composition});
      for (let y = 0; y < sceneSize; y++) for (let x = 0; x < sceneSize; x++) {
        if (x + 1 < sceneSize) for (let i = 0; i < n; i++) assert.deepEqual(
          pixel(image.data, image.width, x * n + n - 1, y * n + i), pixel(image.data, image.width, (x + 1) * n, y * n + i),
          `${relationship} ${palette} seed ${seed} weathered ${weathered} composition ${composition}: horizontal ${x},${y},${i}`,
        );
        if (y + 1 < sceneSize) for (let i = 0; i < n; i++) assert.deepEqual(
          pixel(image.data, image.width, x * n + i, y * n + n - 1), pixel(image.data, image.width, x * n + i, (y + 1) * n),
          `${relationship} ${palette} seed ${seed} weathered ${weathered} composition ${composition}: vertical ${x},${y},${i}`,
        );
      }
    }
  }
});

for (const seed of [1204, 1215, 1233]) for (const tileSize of [16, 64]) for (const palette of ['woodland', 'dry-trail', 'cool-moor']) {
  test(`curated ${tileSize}px ${palette} seed ${seed} is deterministic and manifest/source describe generated pixels`, () => {
    const recipe = {id: 'retro-terrain-curated', tileSize, seed, palette};
    const first = generateCuratedTerrain(recipe), second = generateCuratedTerrain(recipe);
    assert.deepEqual(first.recipe, recipe);
    assert.deepEqual(first.tiles.map(({id, width, height, data}) => [id, width, height, hash(data)]), second.tiles.map(({id, width, height, data}) => [id, width, height, hash(data)]));
    assert.deepEqual(first.atlases.map(({id, width, height, data}) => [id, width, height, hash(data)]), second.atlases.map(({id, width, height, data}) => [id, width, height, hash(data)]));
    assert.deepEqual(first.templates.map(({id, width, height, data}) => [id, width, height, hash(data)]), second.templates.map(({id, width, height, data}) => [id, width, height, hash(data)]));
    assert.deepEqual(first.previews.map(({id, width, height, data}) => [id, width, height, hash(data)]), second.previews.map(({id, width, height, data}) => [id, width, height, hash(data)]));
    assert.deepEqual(describeCuratedTerrain(first), describeCuratedTerrain(second));
    assert.deepEqual(curatedArtSource(first), curatedArtSource(second));
    const manifest = describeCuratedTerrain(first), art = curatedArtSource(first);
    assert.equal(manifest.format, 'retro-terrain-pack/2');
    assert.equal(manifest.generator, 'retro-terrain-curated/2');
    assert.equal(manifest.visualReview, 'unapproved');
    assert.deepEqual(manifest.recipe, recipe);
    assert.equal(art.format, 'retro-terrain-art/1');
    assert.equal(art.renderedDrawings.length, 56);
    assert.deepEqual([...new Set(art.renderedDrawings.map(drawing => drawing.family))], CURATED_FAMILIES);
    for (const family of CURATED_FAMILIES) for (const weathered of [false, true]) {
      assert.deepEqual(art.renderedDrawings.filter(drawing => drawing.family === family && drawing.weathered === weathered).map(drawing => drawing.composition), CURATED_COMPOSITIONS, `${family} weathered ${weathered} authored source rows`);
    }
    assert.deepEqual(manifest.families.map(family => family.id), CURATED_FAMILIES);
    assert.ok(manifest.families.every(family => family.compositions === 4 && family.weathering));
    assert.equal(manifest.tiles.length, first.tiles.length);
    assert.equal(manifest.atlases.length, first.atlases.length);
    for (const image of [...first.tiles, ...first.atlases, ...first.templates, ...first.previews]) {
      assert.equal(image.data.length, image.width * image.height * 4, image.id);
      const counterpart = [...second.tiles, ...second.atlases, ...second.templates, ...second.previews].find(item => item.id === image.id);
      assert.ok(counterpart, image.id);
      assert.deepEqual(image.data, counterpart.data, image.id);
    }
    for (const drawing of art.renderedDrawings) {
      const prefix = drawing.weathered ? 'weathered-' : '';
      const surface = tile(first, `${prefix}${drawing.family}-${drawing.composition}`), ramp = art.palettes[drawing.family];
      for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) {
        const color = [1, 3, 5].map(at => parseInt(ramp[Number(drawing.rows[y][x])].slice(at, at + 2), 16));
        assert.deepEqual(pixel(surface.data, tileSize, x, y), [...color, 255], `${surface.id} authored source (${x},${y})`);
      }
    }
  });
}

for (const seed of [1204, 1215, 1233]) for (const tileSize of [16, 64]) for (const palette of ['woodland', 'dry-trail', 'cool-moor']) {
  test(`${tileSize}px ${palette} seed ${seed}: material roles are opaque, path cutouts are binary with zero RGB, and palettes stay finite`, () => {
    const kit = generateCuratedTerrain({tileSize, seed, palette}), manifest = describeCuratedTerrain(kit), ramps = manifest.palettes;
    assert.deepEqual(manifest.paletteBudgets, tileSize === 16
      ? {grass: 3, dirt: 3, gravel: 4, moss: 3, rock: 4, masonry: 4, timber: 4}
      : {grass: 8, dirt: 12, gravel: 12, moss: 3, rock: 4, masonry: 4, timber: 4});
    for (const item of kit.tiles) {
      const used = colors(item.data);
      if (item.role === 'surface') {
        const ramp = new Set(ramps[item.family].map(value => [1, 3, 5].map(at => parseInt(value.slice(at, at + 2), 16)).join(',')));
        assert.ok(used.size <= manifest.paletteBudgets[item.family], item.id);
        for (const color of used) assert.ok(ramp.has(color), `${item.id}: ${color}`);
      }
      if (item.role === 'transition') {
        const foreground = item.family.split('-')[0];
        assert.ok(used.size <= manifest.paletteBudgets[foreground] + manifest.paletteBudgets.dirt, item.id);
        const ramp = new Set([...ramps[foreground], ...ramps.dirt].map(value => [1, 3, 5].map(at => parseInt(value.slice(at, at + 2), 16)).join(',')));
        for (const color of used) assert.ok(ramp.has(color), `${item.id}: ${color}`);
      }
      if (item.role === 'path-overlay') {
        for (let at = 0; at < item.data.length; at += 4) {
          assert.ok(item.data[at + 3] === 0 || item.data[at + 3] === 255, item.id);
          if (item.data[at + 3] === 0) assert.deepEqual([...item.data.subarray(at, at + 3)], [0, 0, 0], item.id);
        }
      } else {
        for (let at = 3; at < item.data.length; at += 4) assert.equal(item.data[at], 255, item.id);
      }
    }
    for (const weathered of [false, true]) {
      const prefix = weathered ? 'weathered-' : '';
      for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
        const first = tile(kit, `${prefix}gravel-path-${a}`), second = tile(kit, `${prefix}gravel-path-${b}`);
        if (Boolean(a & 2) === Boolean(b & 8)) assert.deepEqual(band(first.data, tileSize, 'right', 1), band(second.data, tileSize, 'left', 1), `path east/west ${a}/${b}`);
        if (Boolean(a & 4) === Boolean(b & 1)) assert.deepEqual(band(first.data, tileSize, 'bottom', 1), band(second.data, tileSize, 'top', 1), `path south/north ${a}/${b}`);
      }
    }
  });
}

for (const tileSize of [16, 64]) {
  test(`${tileSize}px: four unique compositions per family/weathering and compatible shared bands`, () => {
    const kit = generateCuratedTerrain({tileSize, seed: 1233, palette: 'woodland'}), depth = tileSize === 16 ? 2 : 4;
    const natural = new Set(['dirt', 'grass', 'gravel', 'moss', 'rock']);
    for (const family of CURATED_FAMILIES) for (const weathered of [false, true]) {
      const prefix = weathered ? 'weathered-' : '';
      const compositions = CURATED_COMPOSITIONS.map(index => tile(kit, `${prefix}${family}-${index}`));
      assert.equal(new Set(compositions.map(item => hash(item.data))).size, 4, `${prefix}${family}`);
      for (const side of ['top', 'right', 'bottom', 'left']) {
        const expected = band(compositions[0].data, tileSize, side, depth);
        for (const variant of compositions.slice(1)) assert.deepEqual(band(variant.data, tileSize, side, depth), expected, `${prefix}${family} ${side}`);
        if (natural.has(family)) for (const value of expected) assert.deepEqual(value, [...compositions[0].ground, 255], `${prefix}${family} ${side} natural quiet band`);
      }
      const composed = CURATED_COMPOSITIONS.map(composition => composeCuratedSurface(kit, family, {weathered, composition}));
      assert.equal(new Set(composed.map(item => hash(item.data))).size, 4, `${prefix}${family} composed variants`);
      if (!natural.has(family)) for (const side of ['top', 'right', 'bottom', 'left']) {
        const normal = band(tile(kit, `${family}-0`).data, tileSize, side, depth);
        assert.deepEqual(band(tile(kit, `weathered-${family}-0`).data, tileSize, side, depth), normal, `${family} ${side} weathering retains structural boundary`);
      }
    }
  });
}

test('16px blob atlases preserve all 47 mapping pixels, canonical aliases, and individual tile identity', () => {
  const kit = generateCuratedTerrain({tileSize: 16, seed: 1204, palette: 'woodland'}), manifest = describeCuratedTerrain(kit);
  assert.equal(manifest.topology.kind, 'blob-47');
  for (const weathered of [false, true]) for (const family of ['grass', 'gravel', 'moss', 'rock']) {
    const prefix = weathered ? 'weathered-' : '', atlas = kit.atlases.find(item => item.id === `${prefix}${family}-dirt-atlas`);
    assert.ok(atlas); assert.deepEqual([atlas.width, atlas.height], [192, 64]);
    const mapping = manifest.topology.mapping;
    assert.equal(mapping.length, 48);
    assert.equal(mapping.filter(item => item.alias).length, 1);
    assert.deepEqual(mapping.find(item => item.mask === 0 && !item.alias), {mask: 0, x: 160, y: 16});
    for (const [ty, row] of BLOB_MASK_GRID.entries()) for (const [tx, mask] of row.entries()) {
      const source = tile(kit, `${prefix}${family}-dirt-blob-${mask}`), position = blobAtlasPosition(mask);
      for (let y = 0; y < 16; y++) assert.deepEqual(
        atlas.data.subarray(((ty * 16 + y) * 192 + tx * 16) * 4, ((ty * 16 + y) * 192 + (tx + 1) * 16) * 4),
        source.data.subarray(y * 64, (y + 1) * 64),
      );
      if (mask === 0) assert.deepEqual(position, {x: 10, y: 1});
    }
  }
});

test('native blob transitions preserve neighboring material-class profiles for every local binary neighborhood', () => {
  for (const family of ['grass', 'gravel', 'moss', 'rock']) {
    const kit = generateCuratedTerrain({tileSize: 16, seed: 1215, palette: 'woodland'}), manifest = describeCuratedTerrain(kit);
    const foregroundColors = new Set(manifest.palettes[family].map(hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16)).join(',')));
    const materialEdge = (grid, x, y, side) => {
      if (!grid[y][x]) return Array(16).fill(false);
      const mask = blobMaskAt(grid, x, y);
      if (mask === 255) return Array(16).fill(true);
      const image = tile(kit, `${family}-dirt-blob-${mask}`);
      return Array.from({length: 16}, (_, i) => {
        const at = side === 'left' ? i * 16 : side === 'right' ? i * 16 + 15 : side === 'top' ? i : 15 * 16 + i;
        const color = image.data.subarray(at * 4, at * 4 + 3).join(',');
        return foregroundColors.has(color);
      });
    };
    // Enumerate every 4×3 binary neighborhood around horizontally adjacent cells.
    for (let bits = 0; bits < 2 ** 12; bits++) {
      const grid = Array.from({length: 3}, (_, y) => Array.from({length: 4}, (_, x) => (bits >> (y * 4 + x)) & 1));
      assert.deepEqual(materialEdge(grid, 1, 1, 'right'), materialEdge(grid, 2, 1, 'left'), `${family} horizontal neighborhood ${bits}`);
    }
    // Enumerate every 3×4 neighborhood around vertically adjacent cells.
    for (let bits = 0; bits < 2 ** 12; bits++) {
      const grid = Array.from({length: 4}, (_, y) => Array.from({length: 3}, (_, x) => (bits >> (y * 3 + x)) & 1));
      assert.deepEqual(materialEdge(grid, 1, 1, 'bottom'), materialEdge(grid, 1, 2, 'top'), `${family} vertical neighborhood ${bits}`);
    }
  }
});

test('native moss and rock blob cardinal corners retain their central connection', () => {
  const kit = generateCuratedTerrain({tileSize: 16, seed: 1215, palette: 'woodland'});
  for (const family of ['moss', 'rock']) for (const weathered of [false, true]) for (const mask of [5, 20, 80, 65]) {
    const image = tile(kit, `${weathered ? 'weathered-' : ''}${family}-dirt-blob-${mask}`);
    const familyColors = new Set(describeCuratedTerrain(kit).palettes[family].map(hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16)).join(',')));
    const foreground = Uint8Array.from({length: 256}, (_, i) => Number(familyColors.has(image.data.subarray(i * 4, i * 4 + 3).join(','))));
    assert.equal(componentCount(foreground, 16), 1, `${family} weathered ${weathered} cardinal corner mask ${mask}`);
  }
});

test('64px moss and rock diagonal corner masks retain two disconnected foreground lobes', () => {
  const kit = generateCuratedTerrain({tileSize: 64, seed: 1215, palette: 'woodland'});
  for (const family of ['grass', 'moss', 'rock']) for (const weathered of [false, true]) for (const mask of [5, 10]) {
    const image = tile(kit, `${weathered ? 'weathered-' : ''}${family}-dirt-${mask}`);
    assert.equal(componentCount(image.terrainMask, 64), 2, `${family} weathered ${weathered} diagonal corner mask ${mask}`);
  }
});

test('masonry and timber weathering keeps every authored primary structural pixel', () => {
  for (const tileSize of [16, 64]) {
    const art = curatedArtSource(generateCuratedTerrain({tileSize, seed: 1204, palette: 'woodland'}));
    for (const family of ['masonry', 'timber']) for (const composition of CURATED_COMPOSITIONS) {
      const shapeSet = art.drawings[family][composition];
      const normal = art.renderedDrawings.find(item => item.family === family && item.composition === composition && !item.weathered);
      const weathered = art.renderedDrawings.find(item => item.family === family && item.composition === composition && item.weathered);
      const structures = shapeSet.filter(shape => shape[3] === 'structure');
      assert.ok(structures.length > 0, `${tileSize}px ${family}-${composition} has primary structure roles`);
      const secondary = new Set();
      for (const [x, y, rows, role = 'detail'] of shapeSet) if (role === 'detail') for (let dy = 0; dy < rows.length; dy++) for (let dx = 0; dx < rows[dy].length; dx++) if (rows[dy][dx] !== '.') secondary.add(((y + dy + tileSize) % tileSize) * tileSize + (x + dx + tileSize) % tileSize);
      // Later structural strokes can replace earlier faces with mortar or joints.
      // Compare the rendered primary form outside authored secondary details.
      for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) if (!secondary.has(y * tileSize + x)) assert.equal(weathered.rows[y][x], normal.rows[y][x], `${tileSize}px ${family}-${composition} primary form ${x},${y}`);
    }
  }
});

test('16px blob silhouettes retain or omit complete interior decorative feature groups', () => {
  for (const family of ['grass', 'gravel', 'moss', 'rock']) for (const weathered of [false, true]) {
    const kit = generateCuratedTerrain({tileSize: 16, seed: 1215, palette: 'woodland'}), prefix = weathered ? 'weathered-' : '';
    const source = tile(kit, `${prefix}${family}-0`), dirt = tile(kit, `${prefix}dirt-0`);
    const groups = featureGroups(source, 16, source.ground, 2);
    assert.ok(groups.length > 0, `${prefix}${family} source features exist`);
    for (const mask of new Set(BLOB_MASK_GRID.flat())) {
      const output = tile(kit, `${prefix}${family}-dirt-blob-${mask}`);
      assertWholeFeatureGroups(output, source, dirt, groups, `${output.id}`, source.ground);
    }
  }
});

test('64px natural corner transitions preserve complete decorative features for every family and mask', () => {
  for (const family of ['grass', 'moss', 'rock']) for (const seed of [1204, 1215, 1233]) for (const weathered of [false, true]) {
    const kit = generateCuratedTerrain({tileSize: 64, seed, palette: 'woodland'}), prefix = weathered ? 'weathered-' : '';
    const material = tile(kit, `${prefix}${family}-0`), rampGround = describeCuratedTerrain(kit).palettes[family][0];
    const groundRGB = [1, 3, 5].map(at => parseInt(rampGround.slice(at, at + 2), 16));
    const dirt = tile(kit, `${prefix}dirt-0`), groups = featureGroups(material, 64, material.ground);
    if (family !== 'rock' || !weathered) assert.ok(groups.length > 0, `${prefix}${family} source features exist`);
    else assert.ok(colors(material.data).size > 1, 'weathered rock retains its primary face planes');
    for (let mask = 0; mask < 16; mask++) assertWholeFeatureGroups(tile(kit, `${prefix}${family}-dirt-${mask}`), material, dirt, groups, `${prefix}${family}-dirt-${mask}`, groundRGB);
  }
});

test('64px path stones are admitted only as complete fitting source groups; 16px masks 5 and 10 stay quiet', () => {
  for (const weathered of [false, true]) {
    const kit = generateCuratedTerrain({tileSize: 64, seed: 1215, palette: 'woodland'}), prefix = weathered ? 'weathered-' : '';
    const stones = tile(kit, `${prefix}gravel-0`), dirt = tile(kit, `${prefix}dirt-0`), groups = featureGroups(stones, 64, stones.data.subarray(0, 3));
    for (let mask = 0; mask < 16; mask++) {
      const coverage = curatedPathMask(mask, 64, 1215), expected = new Uint8Array(64 * 64 * 4);
      for (let i = 0; i < coverage.length; i++) if (coverage[i]) expected.set(dirt.data.subarray(i * 4, i * 4 + 4), i * 4);
      for (const group of groups) {
        const fits = group.every(at => coverage[at] && at % 64 >= 4 && at % 64 < 60 && Math.floor(at / 64) >= 4 && Math.floor(at / 64) < 60);
        if (fits) for (const at of group) expected.set(stones.data.subarray(at * 4, at * 4 + 4), at * 4);
      }
      assert.deepEqual(tile(kit, `${prefix}gravel-path-${mask}`).data, expected, `${prefix}path ${mask}`);
    }

    const small = generateCuratedTerrain({tileSize: 16, seed: 1215, palette: 'woodland'}), smallPrefix = weathered ? 'weathered-' : '';
    const smallGround = tile(small, `${smallPrefix}dirt-0`);
    for (const mask of [5, 10]) {
      const coverage = curatedPathMask(mask, 16, 1215), expected = new Uint8Array(16 * 16 * 4);
      for (let i = 0; i < coverage.length; i++) if (coverage[i]) expected.set(smallGround.data.subarray(i * 4, i * 4 + 4), i * 4);
      assert.deepEqual(tile(small, `${smallPrefix}gravel-path-${mask}`).data, expected, `${smallPrefix}straight quiet path ${mask}`);
    }
  }
});

for (const seed of [1204, 1215, 1233]) for (const tileSize of [16, 64]) {
  test(`${tileSize}px seed ${seed}: path masks are connected and expose fixed-width ports`, () => {
    const portWidth = tileSize === 16 ? 6 : 20;
    for (let mask = 0; mask < 16; mask++) {
      const coverage = curatedPathMask(mask, tileSize, seed);
      assert.equal(coverage.length, tileSize * tileSize);
      if (mask === 0) { assert.equal(coverage.some(Boolean), false); continue; }
      assert.equal(connected(coverage, tileSize), true, `mask ${mask}`);
      for (const side of ['top', 'right', 'bottom', 'left']) {
        const count = edge(coverage, side, tileSize).reduce((sum, value) => sum + value, 0);
        assert.equal(count, sideForMask(mask, side) ? portWidth : 0, `mask ${mask} ${side}`);
      }
    }
    const kit = generateCuratedTerrain({tileSize, seed, palette: 'woodland'});
    for (let mask = 0; mask < 16; mask++) {
      const path = tile(kit, `gravel-path-${mask}`);
      assert.deepEqual(Uint8Array.from({length: tileSize * tileSize}, (_, i) => alphaAt(path.data, tileSize, i % tileSize, Math.floor(i / tileSize)) === 255 ? 1 : 0), curatedPathMask(mask, tileSize, seed));
    }
  });
}

for (const tileSize of [16, 64]) {
  test(`${tileSize}px connected terrain is deterministic, seed-sensitive, weathered, and rejects invalid topology`, () => {
    const kit = generateCuratedTerrain({tileSize, seed: 1215, palette: 'cool-moor'}), again = generateCuratedTerrain({tileSize, seed: 1215, palette: 'cool-moor'}), other = generateCuratedTerrain({tileSize, seed: 1233, palette: 'cool-moor'});
    const plain = composeCuratedTerrain(kit), repeat = composeCuratedTerrain(again), changedSeed = composeCuratedTerrain(other), weathered = composeCuratedTerrain(kit, {weathered: true});
    assert.deepEqual(plain, repeat);
    assert.notDeepEqual(plain.data, changedSeed.data);
    assert.notDeepEqual(plain.data, weathered.data);
    assert.ok(plain.data.some((value, index) => index % 4 === 3 && value === 255));
    for (const image of [plain, repeat, changedSeed, weathered]) for (let at = 3; at < image.data.length; at += 4) assert.equal(image.data[at], 255);
    for (const scene of [[], [[1]], [[0, 1], [1]], [[0, 2], [1, 0]], Array.from({length: 18}, () => Array(2).fill(0))]) assert.throws(() => composeCuratedTerrain(kit, {scene}));
    assert.throws(() => composeCuratedTerrain(kit, {composition: 7}));
    assert.throws(() => composeCuratedTerrain(kit, {relationship: 'stone-grass'}));
    const scene = tileSize === 16 ? [[1, 1], [1, 1]] : [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
    const paths = tileSize === 16 ? [[0, 0], [0, 0]] : [[0, 0], [0, 0]];
    const mismatch = paths.map(row => row.slice()); mismatch[0][0] = 2;
    assert.throws(() => composeCuratedTerrain(kit, {scene, paths: mismatch}), /Mismatched east\/west path ports|Mismatched north\/south path ports/);
  });
}

test('all 64px natural corner transitions preserve shared boundary material profiles', () => {
  for (const seed of [1204, 1215, 1233]) {
    const kit = generateCuratedTerrain({tileSize: 64, seed, palette: 'woodland'});
    for (const family of ['grass', 'moss', 'rock']) for (const weathered of [false, true]) {
      const prefix = weathered ? 'weathered-' : '', masks = Array.from({length: 16}, (_, mask) => tile(kit, `${prefix}${family}-dirt-${mask}`).terrainMask);
      let horizontal = 0, vertical = 0;
      for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
        if (Boolean(a & 2) === Boolean(b & 1) && Boolean(a & 4) === Boolean(b & 8)) { assert.deepEqual(edge(masks[a], 'right', 64), edge(masks[b], 'left', 64), `${family} right/left ${a}/${b}`); horizontal++; }
        if (Boolean(a & 8) === Boolean(b & 1) && Boolean(a & 4) === Boolean(b & 2)) { assert.deepEqual(edge(masks[a], 'bottom', 64), edge(masks[b], 'top', 64), `${family} bottom/top ${a}/${b}`); vertical++; }
      }
      assert.equal(horizontal, 64); assert.equal(vertical, 64);
    }
  }
});

test('64px rock primary faces remain visible in connected normal and weathered terrain', () => {
  for (const seed of [1204, 1215, 1233]) for (const palette of ['woodland', 'dry-trail', 'cool-moor']) {
    const kit = generateCuratedTerrain({tileSize: 64, seed, palette});
    const faceColors = new Set(describeCuratedTerrain(kit).palettes.rock.slice(1).map(hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16)).join(',')));
    for (const weathered of [false, true]) {
      const image = composeCuratedTerrain(kit, {relationship: 'rock-dirt', weathered});
      assert.ok(Array.from({length: image.width * image.height}, (_, i) => image.data.subarray(i * 4, i * 4 + 3).join(',')).some(color => faceColors.has(color)), `${palette} ${seed} weathered=${weathered}: primary faces were erased`);
    }
  }
});

for (const tileSize of [16, 64]) {
  test(`${tileSize}px boundary soil follows its own selected composition`, () => {
    for (const seed of [1204, 1215, 1233]) {
      const kit = generateCuratedTerrain({tileSize, seed}), cells = tileSize === 16 ? 8 : 7;
      const paths = Array.from({length: cells}, () => Array(cells).fill(0));
      const grassColors = new Set(describeCuratedTerrain(kit).palettes.grass.map(hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16)).join(',')));
      for (const weathered of [false, true]) {
        const connected = composeCuratedTerrain(kit, {paths, weathered});
        const selectedSoil = composeCuratedSurface(kit, 'dirt', {weathered});
        for (let y = 0; y < selectedSoil.height; y++) for (let x = 0; x < selectedSoil.width; x++) {
          const actual = pixel(connected.data, connected.width, x, y);
          if (!grassColors.has(actual.slice(0, 3).join(','))) assert.deepEqual(actual, pixel(selectedSoil.data, selectedSoil.width, x, y), `seed ${seed} weathered ${weathered} soil (${x},${y})`);
        }
      }
    }
  });

  test(`${tileSize}px path overlays retain or omit complete visible grass clusters`, () => {
    for (const seed of [1204, 1215, 1233]) {
      const kit = generateCuratedTerrain({tileSize, seed}), cells = tileSize === 16 ? 8 : 7;
      const paths = Array.from({length: cells}, () => Array(cells).fill(0));
      const grass = tile(kit, 'grass-0'), detailColors = colors(grass.data);
      detailColors.delete(grass.ground.join(','));
      for (const weathered of [false, true]) {
        const before = composeCuratedTerrain(kit, {paths, weathered}), after = composeCuratedTerrain(kit, {weathered});
        const isolated = before.data.slice();
        for (let at = 0; at < isolated.length; at += 4) if (!detailColors.has(isolated.subarray(at, at + 3).join(','))) isolated.set([...grass.ground, 255], at);
        const groups = featureGroups({data: isolated}, before.width, grass.ground);
        assert.ok(groups.length > 0);
        for (const group of groups) {
          const remaining = group.filter(at => detailColors.has(after.data.subarray(at * 4, at * 4 + 3).join(','))).length;
          assert.ok(remaining === 0 || remaining === group.length, `seed ${seed} weathered ${weathered}: path left ${remaining}/${group.length} pixels at ${group[0] % before.width},${Math.floor(group[0] / before.width)}`);
        }
      }
    }
  });
}
