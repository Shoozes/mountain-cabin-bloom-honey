import type { StyleDef } from "@/shader/catalog";
import { VERTEX, liveFragment } from "@/shader/glsl";

export type Rgb = [number, number, number];

export type DrawParams = {
  seed: number;
  scale: number;
  pixels: number;
  wear: number;
  repeat: number;
  time: number;
  look: number;
  colors: [Rgb, Rgb, Rgb, Rgb];
};

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [
    Number.parseInt(h.slice(0, 2), 16) / 255,
    Number.parseInt(h.slice(2, 4), 16) / 255,
    Number.parseInt(h.slice(4, 6), 16) / 255,
  ];
}

type GL = WebGLRenderingContext;

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

function contextFor(canvas: HTMLCanvasElement, preserve: boolean): GL {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: preserve,
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error("WebGL is not available in this browser.");
  gl.disable(gl.DITHER);
  return gl;
}

class Target {
  readonly gl: GL;
  readonly programs = new Map<string, WebGLProgram>();
  readonly errors = new Map<string, string>();
  private readonly buffer: WebGLBuffer;

  constructor(canvas: HTMLCanvasElement, preserve: boolean) {
    this.gl = contextFor(canvas, preserve);
    const buffer = this.gl.createBuffer();
    if (!buffer) throw new Error("Could not allocate a shader buffer.");
    this.buffer = buffer;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, QUAD, this.gl.STATIC_DRAW);
  }

  program(style: StyleDef): WebGLProgram | null {
    const cached = this.programs.get(style.id);
    if (cached) return cached;
    if (this.errors.has(style.id)) return null;
    try {
      const program = linkProgram(this.gl, liveFragment(style.glsl));
      this.programs.set(style.id, program);
      return program;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Shader failed to compile.";
      this.errors.set(style.id, message);
      return null;
    }
  }

  draw(style: StyleDef, params: DrawParams, width: number, height: number): boolean {
    const program = this.program(style);
    const gl = this.gl;
    if (!program) return false;
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const set1 = (name: string, value: number) => {
      const loc = gl.getUniformLocation(program, name);
      if (loc) gl.uniform1f(loc, value);
    };
    const set3 = (name: string, color: Rgb) => {
      const loc = gl.getUniformLocation(program, name);
      if (loc) gl.uniform3f(loc, color[0], color[1], color[2]);
    };
    set3("uC0", params.colors[0]);
    set3("uC1", params.colors[1]);
    set3("uC2", params.colors[2]);
    set3("uC3", params.colors[3]);
    set1("uTime", params.time);
    set1("uSeed", params.seed);
    set1("uScale", params.scale);
    set1("uPixels", params.pixels);
    set1("uWear", params.wear);
    set1("uRepeat", params.repeat);
    set1("uLook", params.look);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return true;
  }

  dropPrograms() {
    for (const program of this.programs.values()) this.gl.deleteProgram(program);
    this.programs.clear();
  }
}

function compile(gl: GL, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create a shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || "compile failed";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function linkProgram(gl: GL, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create a program.");
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || "link failed";
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

export class ShaderMill {
  private readonly display: Target;
  private readonly util: Target;
  private readonly thumbs = new Map<string, string>();

  constructor(
    displayCanvas: HTMLCanvasElement,
    utilCanvas: HTMLCanvasElement,
  ) {
    this.display = new Target(displayCanvas, false);
    this.util = new Target(utilCanvas, true);
    const restore = (target: Target) => {
      target.gl.canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
      });
      target.gl.canvas.addEventListener("webglcontextrestored", () => {
        target.dropPrograms();
        target.errors.clear();
      });
    };
    restore(this.display);
    restore(this.util);
  }

  error(id: string): string | undefined {
    return this.display.errors.get(id) ?? this.util.errors.get(id);
  }

  drawDisplay(
    canvas: HTMLCanvasElement,
    style: StyleDef,
    params: DrawParams,
  ): boolean {
    return this.display.draw(style, params, canvas.width, canvas.height);
  }

  drawUtil(canvas: HTMLCanvasElement, style: StyleDef, params: DrawParams): boolean {
    return this.util.draw(style, params, canvas.width, canvas.height);
  }

  thumbnail(canvas: HTMLCanvasElement, style: StyleDef, params: DrawParams, key: string): string | null {
    const cached = this.thumbs.get(key);
    if (cached) return cached;
    canvas.width = 96;
    canvas.height = 96;
    const ok = this.util.draw(style, params, 96, 96);
    if (!ok) return null;
    const url = canvas.toDataURL("image/jpeg", 0.72);
    this.thumbs.set(key, url);
    return url;
  }

  clearThumbs() {
    this.thumbs.clear();
  }

  dispose() {
    this.display.dropPrograms();
    this.util.dropPrograms();
  }
}
