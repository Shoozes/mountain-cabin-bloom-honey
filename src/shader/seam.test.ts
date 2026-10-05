import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MATCH_MIN,
  SEAM_MAX,
  matchScore,
  readFeatures,
  seamError as judgeSeam,
  verdict,
} from "./judge.ts";
import { seamError, seamParts } from "./seam.ts";
import { fillTile, scoreFixture, seamFixtures } from "./seam-fixtures.ts";

describe("seam fixtures", () => {
  for (const fixture of seamFixtures()) {
    it(`${fixture.name} matches its gate`, () => {
      const scored = scoreFixture(fixture, SEAM_MAX);
      assert.equal(scored.gateOk, true, `${fixture.name} seam=${scored.seam} edge=${scored.edge}`);
      assert.equal(scored.edgeOk, true, `${fixture.name} should track the legacy edge`);
      assert.equal(scored.monotoneOk, true);
      assert.ok(scored.seam <= 1);
      assert.ok(scored.seam >= 0);
    });
  }

  it("keeps a full-length one-axis step at the step amplitude, not the halved edge", () => {
    const scored = scoreFixture(
      seamFixtures().find((item) => item.name === "one-axis-step")!,
      SEAM_MAX,
    );
    assert.ok(Math.abs(scored.edge - 51 / 510) < 1e-9);
    assert.ok(Math.abs(scored.band - 51 / 255) < 1e-9);
    assert.ok(scored.corner <= 1e-9);
    assert.ok(scored.edge <= SEAM_MAX);
    assert.ok(scored.seam > SEAM_MAX);
  });

  it("flags a 3px wrap break the edge average dilutes away", () => {
    const scored = scoreFixture(
      seamFixtures().find((item) => item.name === "band-break")!,
      SEAM_MAX,
    );
    assert.ok(Math.abs(scored.edge - 5 / 255) < 1e-9);
    assert.ok(Math.abs(scored.band - 80 / 255) < 1e-9);
    assert.ok(scored.edge <= SEAM_MAX);
    assert.ok(scored.seam > SEAM_MAX);
  });

  it("flags four corners that meet worse than any interior 2×2", () => {
    const scored = scoreFixture(
      seamFixtures().find((item) => item.name === "corner-meet")!,
      SEAM_MAX,
    );
    assert.ok(scored.band <= 1e-9);
    assert.ok(scored.corner > SEAM_MAX);
    assert.ok(scored.edge <= SEAM_MAX);
    assert.ok(scored.seam > SEAM_MAX);
  });

  it("stays at least the legacy edge on noise", () => {
    let seed = 0x5eed;
    const next = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed & 255;
    };
    const data = fillTile(48, 48, () => next());
    const parts = seamParts(data, 48, 48);
    assert.ok(parts.seam + 1e-9 >= parts.edge);
    assert.equal(seamError(data, 48, 48), parts.seam);
  });

  it("rejects a buffer that cannot tile", () => {
    const data = fillTile(1, 4, () => 10);
    assert.equal(seamError(data, 1, 4), 1);
  });

  it("scores a 96px tile quickly enough for the judge matrix", () => {
    const data = fillTile(96, 96, (x, y) => (x + y) % 64);
    const start = Date.now();
    for (let i = 0; i < 12; i++) seamError(data, 96, 96);
    assert.ok(Date.now() - start < 500);
  });
});

describe("judge gates", () => {
  it("keeps the seam and match thresholds", () => {
    assert.equal(SEAM_MAX, 0.16);
    assert.equal(MATCH_MIN, 0.58);
    assert.equal(judgeSeam, seamError);
  });

  it("still fails seam before match, and leaves flat / compile alone", () => {
    assert.deepEqual(verdict(0.16, 0.58, false, true), { pass: true, reason: "matches" });
    assert.deepEqual(verdict(0.1601, 0.9, false, true), { pass: false, reason: "seam" });
    assert.deepEqual(verdict(0, 0.579, false, true), { pass: false, reason: "unlike reference" });
    assert.deepEqual(verdict(0, 0.9, true, true), { pass: false, reason: "too flat" });
    assert.deepEqual(verdict(0, 0.9, false, false), { pass: false, reason: "shader failed" });
    assert.deepEqual(verdict(0, null, false, true), { pass: false, reason: "no reference" });
  });

  it("matches identical buffers more tightly than a shifted one", () => {
    const gray = fillTile(16, 16, () => 140);
    const other = fillTile(16, 16, (x, y) => (x + y * 3) % 255);
    const same = matchScore(readFeatures(gray, 16, 16), readFeatures(gray, 16, 16));
    const far = matchScore(readFeatures(gray, 16, 16), readFeatures(other, 16, 16));
    assert.ok(same >= MATCH_MIN);
    assert.ok(far < same);
  });
});
