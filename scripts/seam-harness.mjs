/**
 * Score synthetic wrap fixtures with the same seamError the Reference Judge uses.
 * No GPU. Catalog style renders stay on the Judge button.
 *
 *   npm run seam
 *   node --experimental-strip-types scripts/seam-harness.mjs
 *
 * Exits 0 when every fixture hits its expected pass/fail under SEAM_MAX.
 * Prints the legacy edge average beside the new score so a threshold change
 * would show up here. SEAM_MAX is still 0.16.
 */
import { MATCH_MIN, SEAM_MAX, matchScore, readFeatures } from "../src/shader/judge.ts";
import { fillTile, scoreFixture, seamFixtures } from "../src/shader/seam-fixtures.ts";

const rows = seamFixtures().map((fixture) => scoreFixture(fixture, SEAM_MAX));
const nameWidth = Math.max(...rows.map((row) => row.name.length));

console.log(`seam harness   SEAM_MAX=${SEAM_MAX.toFixed(2)}   band=3px`);
console.log(`${"fixture".padEnd(nameWidth)}   edge   band corner   seam  gate`);
for (const row of rows) {
  const mark = row.gateOk && row.edgeOk && row.monotoneOk ? "ok" : "FAIL";
  console.log(
    `${row.name.padEnd(nameWidth)}  ${row.edge.toFixed(3)}  ${row.band.toFixed(3)}  ${row.corner.toFixed(3)}  ${row.seam.toFixed(3)}  ${row.gate.padEnd(4)}  ${mark}`,
  );
}

const gray = fillTile(16, 16, () => 140);
const other = fillTile(16, 16, (x, y) => (x + y * 3) % 255);
const same = matchScore(readFeatures(gray, 16, 16), readFeatures(gray, 16, 16));
const far = matchScore(readFeatures(gray, 16, 16), readFeatures(other, 16, 16));
console.log(
  `match identical ${same.toFixed(3)}  shifted ${far.toFixed(3)}  MATCH_MIN=${MATCH_MIN.toFixed(2)}`,
);

const failed = rows.filter((row) => !row.gateOk || !row.edgeOk || !row.monotoneOk);
if (failed.length || !(same >= MATCH_MIN) || !(far < same)) {
  process.exitCode = 1;
}
