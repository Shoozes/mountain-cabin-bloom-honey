import { seamParts, type SeamParts } from "./seam.ts";

export type SeamFixture = {
  name: string;
  w: number;
  h: number;
  data: Uint8ClampedArray;
  /** Expected gate under SEAM_MAX. */
  gate: "pass" | "fail";
  /** New score should match the legacy edge average. */
  tracksEdge: boolean;
};

export type SeamFixtureResult = SeamFixture &
  SeamParts & {
    pass: boolean;
    gateOk: boolean;
    edgeOk: boolean;
    monotoneOk: boolean;
  };

export function fillTile(
  w: number,
  h: number,
  paint: (x: number, y: number) => number,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = paint(x, y);
      const i = (y * w + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
}

export function seamFixtures(): SeamFixture[] {
  const solid = fillTile(16, 16, () => 128);
  const stripes = fillTile(8, 8, (x) => (x % 2 === 0 ? 0 : 255));
  const oneAxis = fillTile(16, 16, (x) => (x === 0 ? 40 : 91));
  const bandBreak = fillTile(32, 32, (x, y) => (y < 3 && x === 0 ? 180 : 100));
  const cornerMeet = fillTile(16, 16, (x, y) => {
    if (x === 0 && y === 0) return 0;
    if (x === 15 && y === 0) return 100;
    if (x === 0 && y === 15) return 100;
    if (x === 15 && y === 15) return 200;
    if (x === 8 || y === 8) return 0;
    return 100;
  });
  const sine = fillTile(32, 32, (x, y) =>
    Math.round(128 + 36 * Math.sin((2 * Math.PI * x) / 32) + 18 * Math.sin((2 * Math.PI * y) / 32)),
  );
  return [
    { name: "solid", w: 16, h: 16, data: solid, gate: "pass", tracksEdge: true },
    { name: "stripes", w: 8, h: 8, data: stripes, gate: "fail", tracksEdge: true },
    { name: "one-axis-step", w: 16, h: 16, data: oneAxis, gate: "fail", tracksEdge: false },
    { name: "band-break", w: 32, h: 32, data: bandBreak, gate: "fail", tracksEdge: false },
    { name: "corner-meet", w: 16, h: 16, data: cornerMeet, gate: "fail", tracksEdge: false },
    { name: "periodic-sine", w: 32, h: 32, data: sine, gate: "pass", tracksEdge: true },
  ];
}

export function scoreFixture(fixture: SeamFixture, seamMax: number): SeamFixtureResult {
  const parts = seamParts(fixture.data, fixture.w, fixture.h);
  const pass = parts.seam <= seamMax;
  const gateOk = pass === (fixture.gate === "pass");
  const edgeOk = !fixture.tracksEdge || Math.abs(parts.seam - parts.edge) <= 1e-9;
  const monotoneOk = parts.seam + 1e-9 >= parts.edge;
  return { ...fixture, ...parts, pass, gateOk, edgeOk, monotoneOk };
}
