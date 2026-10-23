import assert from "node:assert/strict";
import test from "node:test";
import { ShaderMill, type DrawParams } from "./engine.ts";
import type { StyleDef } from "./catalog.ts";

const style = { id: "lifecycle-fixture", glsl: "void main() { gl_FragColor = vec4(1.); }" } as StyleDef;
const params: DrawParams = {
  seed: 1, scale: 1, pixels: 16, wear: 0, repeat: 1, time: 0, look: 0,
  colors: [[0, 0, 0], [.2, .2, .2], [.5, .5, .5], [1, 1, 1]],
};

function target({ missingContext = false, failBuffer = false, failUpload = false } = {}) {
  let generation = 0;
  let bound: { generation: number } | null = null;
  const counts = { buffers: 0, deletedBuffers: 0, uploads: 0, draws: 0, programs: 0, deletedPrograms: 0, thumbnails: 0, listeners: 0 };
  class Canvas extends EventTarget {
    width = 16;
    height = 16;
    override addEventListener(...args: Parameters<EventTarget["addEventListener"]>) {
      counts.listeners++;
      super.addEventListener(...args);
    }
    override removeEventListener(...args: Parameters<EventTarget["removeEventListener"]>) {
      counts.listeners--;
      super.removeEventListener(...args);
    }
    getContext() { return missingContext ? null : gl; }
    toDataURL() { return `thumbnail-${++counts.thumbnails}`; }
  }
  const canvas = new Canvas();
  const gl = {
    canvas,
    createBuffer() { if (failBuffer) return null; counts.buffers++; return { generation }; },
    deleteBuffer() { counts.deletedBuffers++; },
    bindBuffer(_type: number, buffer: { generation: number }) {
      assert.equal(buffer.generation, generation, "a restored context must use a fresh buffer");
      bound = buffer;
    },
    bufferData() { if (failUpload) throw Error("upload failed"); counts.uploads++; },
    createProgram() { counts.programs++; return {}; },
    deleteProgram() { counts.deletedPrograms++; },
    createShader() { return {}; },
    getShaderParameter() { return true; },
    getProgramParameter() { return true; },
    getUniformLocation() { return null; },
    drawArrays() { assert.equal(bound?.generation, generation); counts.draws++; },
    disable() {}, shaderSource() {}, compileShader() {}, attachShader() {}, bindAttribLocation() {},
    linkProgram() {}, deleteShader() {}, viewport() {}, useProgram() {}, enableVertexAttribArray() {}, vertexAttribPointer() {},
  };
  return {
    canvas: canvas as unknown as HTMLCanvasElement,
    counts,
    lose() {
      generation++;
      bound = null;
      const event = new Event("webglcontextlost", { cancelable: true });
      canvas.dispatchEvent(event);
      return event.defaultPrevented;
    },
    restore() { canvas.dispatchEvent(new Event("webglcontextrestored")); },
    failNextBuffer() { failBuffer = true; },
  };
}

test("restored display and utility contexts recreate geometry, programs and thumbnails", () => {
  const display = target(), util = target();
  let restored = 0;
  const mill = new ShaderMill(display.canvas, util.canvas, () => restored++);
  try {
    assert.equal(mill.drawDisplay(display.canvas, style, params), true);
    assert.equal(mill.thumbnail(util.canvas, style, params, "same"), "thumbnail-1");
    for (const owner of [display, util]) {
      assert.equal(owner.lose(), true);
      assert.equal(owner === display ? mill.drawDisplay(display.canvas, style, params) : mill.drawUtil(util.canvas, style, params), false);
      owner.restore();
      assert.equal(owner.counts.uploads, 2);
    }
    assert.equal(restored, 2);
    assert.equal(mill.drawDisplay(display.canvas, style, params), true);
    assert.equal(mill.thumbnail(util.canvas, style, params, "same"), "thumbnail-2");
    assert.equal(display.counts.programs, 2);
    assert.equal(util.counts.programs, 2);
  } finally { mill.dispose(); }
});

test("dispose releases both targets once and removes restoration listeners", () => {
  const display = target(), util = target();
  let restored = 0;
  const mill = new ShaderMill(display.canvas, util.canvas, () => restored++);
  mill.drawDisplay(display.canvas, style, params);
  mill.drawUtil(util.canvas, style, params);
  mill.dispose();
  mill.dispose();
  for (const owner of [display, util]) {
    assert.equal(owner.counts.deletedBuffers, 1);
    assert.equal(owner.counts.deletedPrograms, 1);
    assert.equal(owner.counts.listeners, 0);
    owner.restore();
    assert.equal(owner.counts.buffers, 1);
  }
  assert.equal(restored, 0);
  assert.equal(mill.drawDisplay(display.canvas, style, params), false);
});

test("partial startup releases display resources and any failed utility allocation", () => {
  for (const failure of [{ missingContext: true }, { failBuffer: true }, { failUpload: true }]) {
    const display = target(), util = target(failure);
    assert.throws(() => new ShaderMill(display.canvas, util.canvas));
    assert.equal(display.counts.deletedBuffers, 1);
    assert.equal(display.counts.listeners, 0);
    assert.equal(util.counts.deletedBuffers, failure.failUpload ? 1 : 0);
    assert.equal(util.counts.listeners, 0);
  }
});

test("failed restoration reports the allocation error without drawing stale geometry", () => {
  const display = target(), util = target();
  const mill = new ShaderMill(display.canvas, util.canvas);
  try {
    display.lose();
    display.failNextBuffer();
    display.restore();
    assert.match(mill.error(style.id) ?? "", /allocate a shader buffer/);
    assert.equal(mill.drawDisplay(display.canvas, style, params), false);
    assert.equal(display.counts.draws, 0);
  } finally { mill.dispose(); }
});
