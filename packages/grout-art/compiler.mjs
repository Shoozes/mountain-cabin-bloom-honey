import { parseRecipe, lowerFrame } from "./core.mjs";
export function compileShader(input, index = 0, backend = "webgl2") {
  const r = parseRecipe(input),
    scene = lowerFrame(r, index),
    wg = backend === "webgpu";
  if (!wg && backend !== "webgl2") throw Error("Unknown shader backend");
  const v = (x, y) => (wg ? `vec2<i32>(${x},${y})` : `ivec2(${x},${y})`),
    functions = [],
    custom = new Map();
  let serial = 0;
  const functionFor = (ops) => {
    const id = "part" + serial++,
      lines = [wg ? "var color:i32=-1;" : "int color=-1;"];
    for (const o of ops) {
      const q = `(p-${v(o.x, o.y)})`,
        box = `p.x>=${o.x} && p.y>=${o.y} && p.x<${o.x + o.w} && p.y<${o.y + o.h}`;
      switch (o.kind) {
        case "rect":
          lines.push(`if(${box}){color=${o.role};}`);
          break;
        case "circle":
          lines.push(`if((${q}.x*${q}.x+${q}.y*${q}.y)<=${o.r * o.r}){color=${o.role};}`);
          break;
        case "hatch":
          lines.push(`if(${box}){if((p.x-${o.x}+p.y-${o.y})%${o.period}==0){color=${o.role};}}`);
          break;
        case "clusters":
          lines.push(
            `if(${box}){if(hashPixel(${v(`(p.x-${o.x})/${o.cell}`, `(p.y-${o.y})/${o.cell}`)},seed+${o.salt >>> 0}u)%100u<${o.density}u){color=${o.role};}}`,
          );
          break;
        case "clip": {
          const fn = functionFor(o.ops);
          lines.push(`if(${box}){${wg ? "let" : "int"} c=${fn}(p,seed);if(c>=0){color=c;}}`);
          break;
        }
        case "use": {
          if (o.scale < 1 || o.scale > 16) throw Error("Part scale must be 1..16");
          const fn = functionFor(o.ops),
            px = `floorDivide(p.x-${o.x},${o.scale})`,
            py = `floorDivide(p.y-${o.y},${o.scale})`;
          lines.push(
            `{${wg ? "let" : "int"} c=${fn}(${v(o.flipX ? `${o.width - 1}-(${px})` : px, o.flipY ? `${o.height - 1}-(${py})` : py)},seed);if(c>=0){color=c;}}`,
          );
          break;
        }
        case "outline": {
          const fn = functionFor(o.ops);
          lines.push(
            `if(${fn}(${q},seed)<0){if(${[
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]
              .map(([dx, dy]) => `${fn}(${q}+${v(dx, dy)},seed)>=0`)
              .join(" || ")}){color=${o.role};}}`,
          );
          break;
        }
        case "technique": {
          const key = JSON.stringify(o.module),
            id = custom.get(key) ?? "technique" + custom.size;
          if (!custom.has(key)) {
            custom.set(key, id);
            const params = Object.keys(o.module.parameters).map((k) =>
              wg ? `${k}:i32` : `int ${k}`,
            );
            functions.push(
              wg
                ? `fn ${id}(p:vec2<i32>,seed:u32${params.length ? "," + params.join(",") : ""})->i32{${o.module.wgsl}}`
                : `int ${id}(ivec2 p,uint seed${params.length ? "," + params.join(",") : ""}){${o.module.glsl}}`,
            );
          }
          lines.push(
            `{${wg ? "let" : "int"} c=${id}(${q},seed${o.args.length ? "," + o.args.join(",") : ""});if(c>=0){color=c;}}`,
          );
          break;
        }
      }
    }
    lines.push("return color;");
    functions.push(
      wg
        ? `fn ${id}(p:vec2<i32>,seed:u32)->i32{${lines.join("\n")}}`
        : `int ${id}(ivec2 p,uint seed){${lines.join("\n")}}`,
    );
    return id;
  };
  const layers = scene.layers.map((layer) => ({
      fn: functionFor(layer.ops),
      offset: layer.offset,
    })),
    colorCases = scene.colors
      .map((c, i) =>
        wg
          ? `if(color==${i}){return vec4<u32>(${c.join(",")},255);}`
          : `if(color==${i}){return uvec4(${c.map((c) => c + "u").join(",")},255u);}`,
      )
      .join("\n");
  const body = layers
    .map(
      ({ fn, offset }) =>
        `{${wg ? "let" : "int"} c=${fn}(p-${v(...offset)},seed);if(c>=0){color=c;}}`,
    )
    .join("\n");
  // Evaluate the completed visible layer stack before adding a border. The source
  // function is shared by all neighboring samples; no CPU raster is uploaded.
  const sample = wg
    ? `fn sampleScene(p:vec2<i32>,seed:u32)->i32{if(p.x<0||p.y<0||p.x>=${r.width}||p.y>=${r.height}){return -1;}var color:i32=-1;${body}return color;}`
    : `int sampleScene(ivec2 p,uint seed){if(p.x<0||p.y<0||p.x>=${r.width}||p.y>=${r.height}){return -1;}int color=-1;${body}return color;}`;
  const border = scene.outline
    ? `if(${scene.outline.offsets.map(([x, y]) => `sampleScene(p+${v(x, y)},seed)>=0`).join(" || ")}){${wg ? `return vec4<u32>(${scene.outline.color.join(",")},255);` : `outColor=uvec4(${scene.outline.color.map((c) => c + "u").join(",")},255u);return;`}}`
    : "";
  if (wg)
    return `// Grout Art: direct native-grid evaluation, no completed CPU frame upload.
fn hashPixel(p:vec2<i32>,s:u32)->u32{var h=(bitcast<u32>(p.x)*0x9e3779b1u)^(bitcast<u32>(p.y)*0x85ebca77u)^s;h=(h^(h>>16u))*0x7feb352du;h=(h^(h>>15u))*0x846ca68bu;return h^(h>>16u);}
fn floorDivide(a:i32,b:i32)->i32{return select(a/b,(a-b+1)/b,a<0);}
${functions.join("\n")}
${sample}
fn paint(p:vec2<i32>)->vec4<u32>{let seed=${scene.seed}u;let color=sampleScene(p,seed);${colorCases}\n${border}\nreturn vec4<u32>(0);}
@group(0) @binding(0) var<storage,read_write> output:array<u32>;
@compute @workgroup_size(8,8) fn main(@builtin(global_invocation_id) id:vec3<u32>){if(id.x>=${r.width}u||id.y>=${r.height}u){return;}let c=paint(vec2<i32>(id.xy));output[id.x+id.y*${r.width}u]=c.r|(c.g<<8u)|(c.b<<16u)|(c.a<<24u);}`;
  return `#version 300 es
precision highp float;precision highp int;layout(location=0) out uvec4 outColor;
uint hashPixel(ivec2 p,uint s){uint h=uint(p.x)*0x9e3779b1u^uint(p.y)*0x85ebca77u^s;h=(h^(h>>16u))*0x7feb352du;h=(h^(h>>15u))*0x846ca68bu;return h^(h>>16u);}
int floorDivide(int a,int b){return a<0?(a-b+1)/b:a/b;}
${functions.join("\n")}
${sample}
void main(){ivec2 p=ivec2(int(gl_FragCoord.x),${r.height - 1}-int(gl_FragCoord.y));uint seed=${scene.seed}u;int color=sampleScene(p,seed);${colorCases.replaceAll("return uvec4", "outColor=uvec4").replaceAll(");}", ");return;}")}\n${border}\noutColor=uvec4(0u);}`;
}
