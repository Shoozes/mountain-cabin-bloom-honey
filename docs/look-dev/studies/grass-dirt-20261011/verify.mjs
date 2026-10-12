// Read-only verification of the retained, unapproved study against its source snapshot.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {generateMaterial} from '../../../../src/shader/material.mjs';
import {encodeMaterialPng} from '../../../../scripts/material-png.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const study = JSON.parse(await fs.readFile(path.join(here, 'study.json'), 'utf8'));
let references = 0;
async function verifyFile(reference) {
  const file = path.resolve(here, reference.path);
  assert.ok(file.startsWith(here + path.sep), 'Study reference leaves its retained directory');
  const raw = await fs.readFile(file);
  const bytes = /\.(json|mjs)$/.test(file)
    ? Buffer.from(raw.toString('utf8').replaceAll('\r\n', '\n')) : raw;
  assert.equal(bytes.length, reference.bytes, reference.path + ' length');
  assert.equal(hash(bytes), reference.sha256, reference.path + ' hash');
  references++;
  return bytes;
}
assert.equal(study.visualReview, 'unapproved');
for (const source of study.sources) {
  // Git text checkouts may use CRLF; the snapshot's source hashes use LF.
  const text = (await fs.readFile(path.join(root, source.path), 'utf8')).replaceAll('\r\n', '\n');
  assert.equal(hash(text), source.sha256, 'Source snapshot changed: ' + source.path);
}
for (const candidate of study.cases) {
  const manifest = JSON.parse(await verifyFile(candidate.manifest));
  const recipe = study.recipes.find(value => value.family === candidate.family);
  assert.deepEqual(manifest.recipe, recipe);
  assert.equal(manifest.identity, candidate.identity);
  assert.equal(manifest.visualReview, 'unapproved');
  assert.deepEqual(manifest.provenance.restrictedInputs, []);
  assert.equal(manifest.provenance.training, false);
  assert.deepEqual(manifest.sources, study.sources);
  const material = generateMaterial(recipe);
  for (const native of candidate.native) {
    const pixels = material.channels[native.channel];
    assert.deepEqual(await verifyFile(native), encodeMaterialPng(pixels), 'Native channel differs');
    const repeat = candidate.repeat.find(value => value.channel === native.channel);
    const width = pixels.width * 2, height = pixels.height * 2;
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const offset = ((y % pixels.height) * pixels.width + x % pixels.width) * 4;
      data.set(pixels.data.subarray(offset, offset + 4), (y * width + x) * 4);
    }
    assert.deepEqual(await verifyFile(repeat), encodeMaterialPng({width, height, data}), 'Repeat differs');
  }
  await verifyFile(candidate.contactSheet);
}
await verifyFile(study.verifierSource);
console.log(JSON.stringify({status: 'passed', references, nativeMaps: 8, repeatedMaps: 8, artwork: 'unapproved'}));
