import { lowerFrame, renderRows, parseRecipe } from "./core.mjs";
import { compileShader } from "./compiler.mjs";
const abort = (signal) => signal?.throwIfAborted();
const techniqueLabel = (r) =>
  r.techniques?.length
    ? " [modules: " + r.techniques.map((t) => t.id).join(", ") + "]"
    : " [native graph]";
function cpu(diagnostics = []) {
  let disposed = false;
  return {
    backend: "cpu",
    diagnostics,
    async render(recipe, index = 0, { signal } = {}) {
      abort(signal);
      if (disposed) throw Error("Renderer disposed");
      const r = parseRecipe(recipe),
        scene = lowerFrame(r, index),
        data = new Uint8Array(r.width * r.height * 4);
      for (let y = 0; y < r.height; y += 4) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        abort(signal);
        if (disposed) throw Error("Renderer disposed");
        renderRows(scene, data, y, Math.min(y + 4, r.height));
      }
      return { width: r.width, height: r.height, data, backend: "cpu" };
    },
    dispose() {
      disposed = true;
    },
  };
}
function webgl() {
  const canvas = document.createElement("canvas"),
    gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
  if (!gl) throw Error("WebGL2 unavailable");
  gl.disable(gl.DITHER);
  gl.disable(gl.BLEND);
  const programs = new Map();
  let disposed = false,
    lost = false;
  canvas.addEventListener("webglcontextlost", () => {
    lost = true;
  });
  const shader = (kind, source) => {
    const s = gl.createShader(kind);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw Error("GLSL technique compile: " + message);
    }
    return s;
  };
  const vertex = `#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0,1);}`;
  return {
    backend: "webgl2",
    diagnostics: [],
    async render(input, index = 0, { signal } = {}) {
      abort(signal);
      if (disposed) throw Error("Renderer disposed");
      if (lost) throw Error("WebGL context lost; switch to CPU or recreate renderer");
      const r = parseRecipe(input),
        source = compileShader(r, index, "webgl2");
      let program = programs.get(source);
      if (!program) {
        let vs, fs;
        program = gl.createProgram();
        try {
          vs = shader(gl.VERTEX_SHADER, vertex);
          fs = shader(gl.FRAGMENT_SHADER, source);
          gl.attachShader(program, vs);
          gl.attachShader(program, fs);
          gl.linkProgram(program);
          if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            throw Error("GLSL technique link: " + gl.getProgramInfoLog(program));
          programs.set(source, program);
          if (programs.size > 32) {
            const first = programs.keys().next().value;
            gl.deleteProgram(programs.get(first));
            programs.delete(first);
          }
        } catch (error) {
          gl.deleteProgram(program);
          throw Error(error.message + techniqueLabel(r));
        } finally {
          if (vs) gl.deleteShader(vs);
          if (fs) gl.deleteShader(fs);
        }
      }
      canvas.width = r.width;
      canvas.height = r.height;
      const texture = gl.createTexture(),
        target = gl.createFramebuffer();
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, r.width, r.height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
          throw Error("WebGL integer target unavailable");
        gl.viewport(0, 0, r.width, r.height);
        gl.useProgram(program);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const rows = new Uint8Array(r.width * r.height * 4);
        gl.readPixels(0, 0, r.width, r.height, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, rows);
        if (gl.getError() !== gl.NO_ERROR) throw Error("WebGL render/readback failed");
        abort(signal);
        const data = new Uint8Array(rows.length);
        for (let y = 0; y < r.height; y++)
          data.set(
            rows.subarray(y * r.width * 4, (y + 1) * r.width * 4),
            (r.height - y - 1) * r.width * 4,
          );
        return { width: r.width, height: r.height, data, backend: "webgl2" };
      } finally {
        gl.deleteTexture(texture);
        gl.deleteFramebuffer(target);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const p of programs.values()) gl.deleteProgram(p);
      programs.clear();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
async function webgpu() {
  if (typeof navigator === "undefined" || !navigator.gpu) throw Error("WebGPU unavailable");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw Error("WebGPU adapter unavailable");
  const device = await adapter.requestDevice(),
    pipelines = new Map();
  let disposed = false,
    lost = null;
  device.lost.then((info) => {
    lost = info.message || "device lost";
  });
  return {
    backend: "webgpu",
    diagnostics: [],
    async render(input, index = 0, { signal } = {}) {
      abort(signal);
      if (disposed) throw Error("Renderer disposed");
      if (lost) throw Error("WebGPU device lost: " + lost);
      const r = parseRecipe(input),
        source = compileShader(r, index, "webgpu");
      let pipeline = pipelines.get(source);
      if (!pipeline) {
        device.pushErrorScope("validation");
        let failure;
        try {
          const module = device.createShaderModule({
            code: source,
            label: "Grout Art" + techniqueLabel(r),
          });
          const info = await module.getCompilationInfo();
          const errors = info.messages.filter((m) => m.type === "error");
          if (errors.length)
            throw Error(errors.map((m) => `line ${m.lineNum}: ${m.message}`).join("\n"));
          pipeline = await device.createComputePipelineAsync({
            layout: "auto",
            compute: { module, entryPoint: "main" },
          });
        } catch (error) {
          failure = error;
        }
        const validation = await device.popErrorScope();
        if (failure || validation)
          throw Error(
            "WGSL technique compile" +
              techniqueLabel(r) +
              ": " +
              (failure?.message ?? validation.message),
          );
        abort(signal);
        if (disposed || lost) throw Error("WebGPU renderer disposed or device lost");
        pipelines.set(source, pipeline);
        if (pipelines.size > 32) pipelines.delete(pipelines.keys().next().value);
      }
      abort(signal);
      if (disposed || lost) throw Error("WebGPU renderer disposed or device lost");
      const size = r.width * r.height * 4,
        output = device.createBuffer({ size, usage: 128 | 4 }),
        read = device.createBuffer({ size, usage: 8 | 1 });
      try {
        const group = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: output } }],
          }),
          encoder = device.createCommandEncoder(),
          pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(Math.ceil(r.width / 8), Math.ceil(r.height / 8));
        pass.end();
        encoder.copyBufferToBuffer(output, 0, read, 0, size);
        device.queue.submit([encoder.finish()]);
        await read.mapAsync(1);
        const data = new Uint8Array(read.getMappedRange()).slice();
        read.unmap();
        abort(signal);
        return { width: r.width, height: r.height, data, backend: "webgpu" };
      } finally {
        output.destroy();
        read.destroy();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pipelines.clear();
      device.destroy();
    },
  };
}
export async function createRenderer({ backend = "auto" } = {}) {
  if (!["auto", "cpu", "webgl2", "webgpu"].includes(backend))
    throw Error("Unknown renderer backend");
  if (backend === "cpu" || typeof document === "undefined")
    return cpu(backend === "cpu" ? [] : ["GPU unavailable in headless host"]);
  const diagnostics = [];
  for (const kind of backend === "auto" ? ["webgpu", "webgl2"] : [backend])
    try {
      const result = kind === "webgpu" ? await webgpu() : webgl();
      result.diagnostics.push(...diagnostics);
      return result;
    } catch (error) {
      diagnostics.push(error instanceof Error ? error.message : String(error));
    }
  return cpu(diagnostics);
}
