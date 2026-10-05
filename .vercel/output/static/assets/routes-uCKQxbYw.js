import{n as e,r as t,t as n}from"./index-BqOf85Rm.js";var r=t(e(),1),i=[`Reviewed`,`Bond`,`Ground`,`Built`,`Fiber`,`Metal`,`Nature`,`Signal`],a=[{id:`pixel`,label:`Pixel art`,value:0},{id:`painted`,label:`Painted`,value:1},{id:`real`,label:`Hyper real`,value:2},{id:`poster`,label:`Poster`,value:3}],o=[{value:16,label:`16×16`},{value:32,label:`32×32`},{value:64,label:`64×64`},{value:128,label:`128×128`},{value:0,label:`Smooth`}];function s(e){return a.find(t=>t.id===e)?.value??0}var c=[{id:`style`,name:`Style`},{id:`mortar`,name:`Mortar`,colors:[`#2a2724`,`#6d675f`,`#b7b0a4`,`#ece4d6`]},{id:`kiln`,name:`Kiln`,colors:[`#3a221c`,`#8a3e2d`,`#d4652f`,`#f0d2b4`]},{id:`moss`,name:`Moss`,colors:[`#1c2618`,`#3d5233`,`#7d9a62`,`#d5ddc4`]},{id:`sea`,name:`Sea`,colors:[`#102028`,`#1d4e66`,`#3e8ea8`,`#d5eef2`]},{id:`ember`,name:`Ember`,colors:[`#2a120c`,`#8a2e16`,`#e26a2c`,`#f6d36a`]},{id:`ink`,name:`Ink`,colors:[`#14120f`,`#3a342c`,`#a39886`,`#efe6d6`]},{id:`copper`,name:`Copper`,colors:[`#2c1a12`,`#6e3b28`,`#b8734a`,`#e6c2a2`]},{id:`bone`,name:`Bone`,colors:[`#4a3d32`,`#8a7564`,`#d9cbb8`,`#f4efe6`]}],l=e=>e;function u(e){return`float hash1(vec2 p) {
      p += uSeed;
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash1(i), hash1(i + vec2(1.0, 0.0)), u.x),
                 mix(hash1(i + vec2(0.0, 1.0)), hash1(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = r * p * 2.0;
        a *= 0.5;
      }
      return v;
    }
    float pnoise(vec2 p, float period) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      vec2 pp = vec2(period);
      float a = hash1(mod(i, pp));
      float b = hash1(mod(i + vec2(1.0, 0.0), pp));
      float c = hash1(mod(i + vec2(0.0, 1.0), pp));
      float d = hash1(mod(i + vec2(1.0, 1.0), pp));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }
    float sdBox(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
    }
    float rowCount(float col, float cols) {
      return 3.0 + floor(hash1(vec2(mod(col, cols), 5.2)) * 3.0);
    }
    float boardSDF(vec2 uv, vec2 id, float rows, float cols, out vec2 luv) {
      vec2 cell = vec2(1.0 / cols, 1.0 / rows);
      vec2 center = (id + 0.5) * cell;
      vec2 p = uv - center;
      luv = p / cell + 0.5;
      vec2 b = max(cell * 0.5 - vec2(${e.gap.toFixed(4)}), vec2(0.001));
      return sdBox(p, b, 0.0012);
    }
    vec3 boardColor(vec2 id, vec2 luv, out float surfH) {
      float pick = hash1(id + 4.0);
      vec3 base = mix(uC0, uC1, pick);
      base = mix(base, uC2, hash1(id + 8.0) * 0.55);
      float grain = fbm(vec2(luv.x * ${e.grainFx.toFixed(2)}, luv.y * ${e.grainFy.toFixed(2)}) + id * 3.1);
      base = mix(base, mix(uC0, uC2, grain), ${e.grainAmt.toFixed(3)});
      float knot = 0.0;
      if (hash1(id + 1.7) > ${e.knot.toFixed(3)}) {
        vec2 k = vec2(hash1(id + 2.2), hash1(id + 3.4));
        vec2 kp = (luv - vec2(0.32 + 0.36 * k.x, 0.38 + 0.24 * k.y)) * vec2(1.15, 1.7);
        float kd = length(kp);
        knot = 1.0 - smoothstep(0.05, 0.2, kd);
        float ring = abs(fract(kd * 7.0) - 0.5);
        base = mix(base, uC0, knot * 0.85);
        base = mix(base, uC1, knot * (1.0 - smoothstep(0.04, 0.18, ring)) * 0.7);
      }
      float crack = smoothstep(0.62, 0.84, fbm(vec2(luv.y * 7.0, luv.x * 1.4) + id));
      base = mix(base, uC3, clamp(crack * ${e.crack.toFixed(2)} * 0.34, 0.0, 1.0));
      surfH = (grain - 0.5) * 0.10 - knot * 0.25 - crack * 0.4;
      return base;
    }
    vec3 groutStyle(vec2 uv) {
      float sc = max(SC(), 1.0);
      float cols = ${e.cols.toFixed(1)} * sc;
      vec3 col = uC3 * (0.85 + 0.3 * pnoise(uv * 24.0, 24.0));
      float h = 0.0;
      float c = floor(uv.x * cols);
      float rows = rowCount(c, cols);
      float baseRow = floor(uv.y * rows);
      for (int dy = -1; dy <= 1; dy++) {
        float row = baseRow + float(dy);
        float sy = uv.y;
        if (row < 0.0) { row += rows; sy += 1.0; }
        else if (row >= rows) { row -= rows; sy -= 1.0; }
        vec2 id = vec2(mod(c, cols), row);
        vec2 luv;
        float d = boardSDF(vec2(uv.x, sy), id, rows, cols, luv);
        float face = smoothstep(0.0018, -0.0018, d);
        if (face > 0.001) {
          float surfH;
          vec3 bc = boardColor(id, luv, surfH);
          float bevel = smoothstep(0.0, ${e.bevel.toFixed(4)}, -d);
          bc *= mix(0.22, 1.0, bevel);
          col = mix(col, bc, face);
          h = mix(h, 0.5 + bevel * 0.5 + surfH, face);
        }
      }
      float diff = clamp(h, 0.0, 1.0);
      diff = floor(diff * ${e.steps.toFixed(1)} + 0.5) / ${e.steps.toFixed(1)};
      col *= mix(0.82, 1.16, diff);
      col *= 0.96 + 0.04 * cos(uv.x * 6.28318) * cos(uv.y * 6.28318);
      return clamp(col, 0.0, 1.0);
    }`}var d=[l({id:`brick`,name:`Running Bond`,category:`Reviewed`,preset:`brick`,blurb:`Cookbook brick. Offset courses and a pale mortar joint.`,palette:[`#4a241c`,`#8d3b2c`,`#c46a52`,`#cfc3b2`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 2.0 * sc;
      float rows = 4.0 * sc;
      vec2 b = brickUv(uv, cols, rows);
      float m = face(b, 0.07, 0.11, cols);
      float n = N(uv, 8.0 * sc);
      float speckle = N(uv, 16.0 * sc);
      vec3 body = pick4(0.08 + 0.72 * n + 0.12 * speckle);
      return mix(uC3, body, m);
    }`}),l({id:`stone`,name:`Rubble`,category:`Reviewed`,preset:`stone`,blurb:`Cookbook stone. Noisy faces broken by dark joints.`,palette:[`#6a6862`,`#7e7c76`,`#908e88`,`#b4b0a6`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float f = 9.0 * sc;
      vec2 w = worley(uv, f);
      float edge = 1.0 - smoothstep(0.015, 0.07, w.y - w.x);
      float n = FBM(uv, f);
      vec3 body = mix(uC1, uC2, n);
      body = mix(body, uC3, N(uv, 16.0 * sc) * 0.28);
      return mix(body, uC0, edge * 0.92);
    }`}),l({id:`metal`,name:`Rivet Panel`,category:`Reviewed`,preset:`metal`,blurb:`Cookbook metal. Vertical seams and paired rivets.`,palette:[`#2c3842`,`#5d6e7c`,`#8ea0ae`,`#d5e2ea`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 4.0 * sc;
      vec2 g = fract(vec2(uv.x * cols, uv.y * cols));
      float ax = cols / max(RES(), 1.0);
      float seam = 1.0 - smoothstep(0.0, max(ax, 0.001), g.x - 0.025) * smoothstep(0.0, max(ax, 0.001), 0.975 - g.x);
      float n = N(uv, 8.0 * sc);
      vec3 body = mix(uC1, uC2, n);
      float d = min(length(g - vec2(0.22, 0.22)), length(g - vec2(0.78, 0.78)));
      float rivet = 1.0 - smoothstep(0.04, 0.075, d);
      float hi = 1.0 - smoothstep(0.0, 0.028, d);
      vec3 c = mix(body, uC0, seam);
      c = mix(c, uC2, rivet);
      return mix(c, uC3, hi * rivet);
    }`}),l({id:`wood`,name:`Plank Grain`,category:`Reviewed`,preset:`wood`,blurb:`Cookbook wood. Horizontal grain, plank gaps, and knots.`,palette:[`#3a2418`,`#6b4228`,`#a56b3e`,`#e2c29a`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float rows = 4.0 * sc;
      float fy = fract(uv.y * rows);
      float gap = smoothstep(0.0, max(rows / RES(), 0.001) * 2.0, fy);
      float wob = N(uv, 2.0 * sc);
      float lines = abs(fract(uv.y * (16.0 * sc) + wob * 2.0) - 0.5);
      float dark = 1.0 - smoothstep(0.04, 0.2, lines);
      vec2 cell = wrap2(floor(uv * vec2(2.0 * sc)), 2.0 * sc);
      vec2 pf = fract(uv * vec2(2.0 * sc));
      vec2 ko = vec2(H(cell), H(cell + 5.0));
      float knot = 1.0 - smoothstep(0.05, 0.16, length(pf - (0.28 + 0.44 * ko)));
      vec3 c = mix(uC1, uC2, N(uv, 4.0 * sc));
      c = mix(c, uC0, dark * 0.7);
      c = mix(c, uC0, knot);
      c = mix(c, uC3, (1.0 - knot) * N(uv, 10.0 * sc) * 0.18);
      return mix(uC0, c, gap);
    }`}),l({id:`sawn-oak`,name:`Sawn Oak`,category:`Fiber`,blurb:`Shadertoy mdy3R1 board. Distorted fbm, musgrave grain, and the three wood colors.`,palette:[`#080300`,`#401c0a`,`#855230`,`#e7c39a`],glsl:`float sum2(vec2 v) { return dot(v, vec2(1.0)); }
    float h31(vec3 p3) {
      p3 = fract(p3 * 0.1031);
      p3 += dot(p3, p3.yzx + 333.3456);
      return fract(sum2(p3.xy) * p3.z);
    }
    float h21(vec2 p) { return h31(p.xyx); }
    float n31(vec3 p) {
      vec3 s = vec3(7.0, 157.0, 113.0);
      vec3 ip = floor(p);
      p = fract(p);
      p = p * p * (3.0 - 2.0 * p);
      vec4 h = vec4(0.0, s.yz, sum2(s.yz)) + dot(ip, s);
      h = mix(fract(sin(h) * 43758.545), fract(sin(h + s.x) * 43758.545), p.x);
      h.xy = mix(h.xz, h.yw, p.y);
      return mix(h.x, h.y, p.z);
    }
    float fbm8(vec3 p) {
      float sum = 0.0;
      float amp = 1.0;
      float tot = 0.0;
      for (int i = 0; i < 8; i++) {
        sum += amp * n31(p);
        tot += amp;
        amp *= 0.5;
        p *= 2.0;
      }
      return sum / tot;
    }
    float fbm3(vec3 p) {
      float sum = 0.0;
      float amp = 1.0;
      float tot = 0.0;
      for (int i = 0; i < 3; i++) {
        sum += amp * n31(p);
        tot += amp;
        p *= 2.0;
      }
      return sum / tot;
    }
    float musgrave8(vec3 p, float dimension, float lacunarity) {
      float sum = 0.0;
      float amp = 1.0;
      float m = pow(lacunarity, -dimension);
      for (int i = 0; i < 8; i++) {
        sum += (n31(p) * 2.0 - 1.0) * amp;
        amp *= m;
        p *= lacunarity;
      }
      return sum;
    }
    float musgrave2(vec3 p, float dimension, float lacunarity) {
      float sum = 0.0;
      float amp = 1.0;
      float m = pow(lacunarity, -dimension);
      for (int i = 0; i < 2; i++) {
        sum += (n31(p) * 2.0 - 1.0) * amp;
        amp *= m;
        p *= lacunarity;
      }
      return sum;
    }
    vec3 randomPos(float seed) {
      vec4 s = vec4(seed, 0.0, 1.0, 2.0);
      return vec3(h21(s.xy), h21(s.xz), h21(s.xw)) * 100.0 + 100.0;
    }
    float fbmDistorted(vec3 p) {
      p += (vec3(n31(p + randomPos(0.0)), n31(p + randomPos(1.0)), n31(p + randomPos(2.0))) * 2.0 - 1.0) * 1.12;
      return fbm8(p);
    }
    vec3 waveFbmX(vec3 p) {
      float n = p.x * 20.0;
      n += 0.4 * fbm3(p * 3.0);
      return vec3(sin(n) * 0.5 + 0.5, p.yz);
    }
    vec3 matWood(vec3 p) {
      float n1 = fbmDistorted(p * vec3(7.8, 1.17, 1.17));
      n1 = mix(n1, 1.0, 0.2);
      float n2 = mix(musgrave8(vec3(n1 * 4.6), 0.0, 2.5), n1, 0.85);
      float dirt = 1.0 - musgrave8(waveFbmX(p * vec3(0.01, 0.15, 0.15)), 0.26, 2.4) * 0.4;
      float grain = 1.0 - smoothstep(0.2, 1.0, musgrave2(p * vec3(500.0, 6.0, 1.0), 2.0, 2.5)) * 0.2;
      n2 *= dirt * grain;
      float a = clamp((n2 - 0.19) / 0.37, 0.0, 1.0);
      float b = clamp((n2 - 0.56) / 0.44, 0.0, 1.0);
      return pow(max(mix(mix(uC0, uC1, a), uC2, b), 0.0), vec3(0.4545));
    }
    vec3 groutStyle(vec2 uv) {
      float sc = max(SC(), 1.0);
      vec3 p = vec3((uv - 0.5) * vec2(1.78, 1.0) * sc, mod(uSeed, 8.0));
      return matWood(p);
    }`}),l({id:`toon-plank`,name:`Toon Plank`,category:`Fiber`,blurb:`Cartoon boards. Grain, knots, cracks, bevel, and 5-step cel light.`,palette:[`#48220b`,`#9b480d`,`#d97925`,`#090401`],glsl:u({cols:8,gap:.0043,grainFx:6,grainFy:4.4,grainAmt:.23,knot:.455,crack:2.55,bevel:.014,steps:5})}),l({id:`knot-comic`,name:`Knot Comic`,category:`Fiber`,blurb:`Same plank functions, mismatched: wide boards, a knot on almost every one, cracks off.`,palette:[`#5c2e10`,`#c46a22`,`#f0b15a`,`#1a0c06`],glsl:u({cols:4,gap:.006,grainFx:3.5,grainFy:2.2,grainAmt:.4,knot:.08,crack:0,bevel:.02,steps:3})}),l({id:`crack-comic`,name:`Crack Comic`,category:`Fiber`,blurb:`Same plank functions, mismatched: thin boards, heavy cracks, knots almost never.`,palette:[`#2a140c`,`#6a3818`,`#c48448`,`#0c0704`],glsl:u({cols:12,gap:.003,grainFx:9,grainFy:7,grainAmt:.08,knot:.92,crack:4.2,bevel:.008,steps:4})}),l({id:`dark-panels`,name:`Dark Panels`,category:`Fiber`,blurb:`Dark stained panels. Warped fbm in a 16×3 stagger with thin seams.`,palette:[`#0c0806`,`#3a2416`,`#5e3b22`,`#100c0a`],glsl:`float nrand(vec2 co) {
      co += uSeed;
      return fract(sin(dot(co, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(nrand(i + vec2(0.0, 0.0)), nrand(i + vec2(1.0, 0.0)), u.x),
                 mix(nrand(i + vec2(0.0, 1.0)), nrand(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 x, float H) {
      float G = exp2(-H);
      float f = 1.0;
      float a = 1.0;
      float t = 0.0;
      for (int i = 0; i < 8; i++) {
        t += a * noise(f * x);
        f *= 2.0;
        a *= G;
      }
      return t;
    }
    float fn(float x) { return nrand(vec2(x, 3.7)); }
    float edgeMask(vec2 uv, vec2 size) {
      float blur = 1.0 / max(RES(), 1.0);
      vec2 fuv = fract(uv);
      float d = min(min(fuv.x, 1.0 - fuv.x) / size.x, min(fuv.y, 1.0 - fuv.y) / size.y);
      return 1.0 - smoothstep(blur, blur + 0.002, d);
    }
    vec3 woodTexture(vec2 uv) {
      vec2 iuv = floor(uv);
      vec2 fuv = fract(uv);
      vec2 uv2 = fuv + 10.0 * noise(iuv);
      uv2 += 20.0 * fbm(uv2, 1.0);
      float n = clamp(fbm(uv2, 1.0), 0.0, 1.0);
      return mix(uC0, mix(uC1, uC2, n), n);
    }
    vec3 groutStyle(vec2 uv) {
      float sc = max(SC(), 1.0);
      vec2 size = vec2(16.0, 3.0) * sc;
      vec2 p = uv * size;
      p.y += 0.5 * fn(floor(p.x));
      vec3 color = uC3;
      color = mix(color, uC0, edgeMask(p, size));
      color = mix(color, woodTexture(p), 0.62);
      return pow(max(color, 0.0), vec3(0.8));
    }`}),l({id:`grass`,name:`Turf`,category:`Reviewed`,preset:`grass`,blurb:`Short even turf. Fine blades held in a tight olive range.`,palette:[`#4a611c`,`#536923`,`#5c7226`,`#6a8030`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 42.0 * sc;
      float rows = 26.0 * sc;
      float x = abs(fract(uv.x * cols) - 0.5);
      float blade = 1.0 - smoothstep(0.1, 0.46, x);
      float y = fract(uv.y * rows);
      float tip = smoothstep(0.08, 0.4, y);
      vec3 c = mix(uC0, uC1, N(uv, 4.0 * sc));
      c = mix(c, uC2, blade * 0.5);
      return mix(c, uC3, blade * tip * N(uv, 9.0 * sc) * 0.22);
    }`}),l({id:`checkerboard`,name:`Checker`,category:`Reviewed`,preset:`checkerboard`,blurb:`Cookbook checker. Even tiles, a little scuff.`,palette:[`#1a1816`,`#efe6d6`,`#8a8074`,`#d4652f`],glsl:`vec3 groutStyle(vec2 uv) {
      float n = 4.0 * SC();
      vec2 g = floor(uv * n);
      float c = mod(g.x + g.y, 2.0);
      float dirt = N(uv, n * 2.0);
      return mix(c < 0.5 ? uC0 : uC1, uC2, dirt * 0.12);
    }`}),l({id:`water`,name:`Shallow Water`,category:`Reviewed`,preset:`water`,blurb:`Shallow turquoise water. Small caustic ripples and pale crests.`,motion:!0,palette:[`#4ea8a6`,`#67b6b3`,`#8ecfc8`,`#e7f7f4`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 p = uv + vec2(uTime * 0.015, uTime * 0.01);
      float a = FBM(p, 5.0 * sc);
      float b = FBM(p + vec2(0.37, 0.13), 8.0 * sc);
      float crest = smoothstep(0.58, 0.86, b);
      vec3 c = mix(uC0, uC1, 0.35 + 0.65 * a);
      c = mix(c, uC2, b * 0.7);
      return mix(c, uC3, crest * 0.28);
    }`}),l({id:`lava`,name:`Magma`,category:`Reviewed`,preset:`lava`,blurb:`Cookbook lava. Hot flow cut by cooled cracks.`,motion:!0,palette:[`#2a0a06`,`#9a220c`,`#e25822`,`#ffd36a`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 p = uv + vec2(uTime * 0.04, uTime * 0.012);
      float n = FBM(p, 3.0 * sc);
      float hot = smoothstep(0.55, 0.92, n);
      vec2 w = worley(uv, 5.0 * sc);
      float crack = 1.0 - smoothstep(0.02, 0.07, w.y - w.x);
      vec3 c = mix4(n);
      c = mix(c, uC3, hot);
      return mix(c, uC0, crack * (1.0 - hot) * 0.85);
    }`}),l({id:`sand`,name:`Dry Sand`,category:`Reviewed`,preset:`sand`,blurb:`Cookbook sand. Fine grain and a few darker pebbles.`,palette:[`#7a6244`,`#c4a56e`,`#e6d2a4`,`#f6ecd0`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = N(uv, 12.0 * sc);
      float n2 = N(uv + vec2(0.17, 0.04), 20.0 * sc);
      vec3 c = pick4(0.22 + 0.55 * n);
      c = mix(c, uC3, smoothstep(0.72, 0.92, n2));
      float f = 5.0 * sc;
      vec2 w = worley(uv, f);
      float rare = step(0.78, H(wrap2(floor(uv * f), f)));
      float pebble = (1.0 - smoothstep(0.1, 0.2, w.x)) * rare;
      return mix(c, uC0, pebble);
    }`}),l({id:`buttered`,name:`Buttered Grout`,category:`Bond`,blurb:`Irregular tiles with a thick, pale joint. The mill's namesake.`,palette:[`#6a5346`,`#b08968`,`#d8c3a5`,`#efe4d4`],glsl:`vec3 groutStyle(vec2 uv) {
      float f = 4.0 * SC();
      vec2 w = worley(uv, f);
      float joint = 1.0 - smoothstep(0.045, 0.13, w.y - w.x);
      float n = N(uv, f * 2.0);
      vec3 tile = pick4(0.08 + 0.78 * n);
      vec3 mortar = mix(uC3, uC2, 0.35);
      return mix(tile, mortar, joint);
    }`}),l({id:`herringbone`,name:`Herringbone`,category:`Bond`,blurb:`Parquet planks that flip direction every cell.`,palette:[`#3e291c`,`#7a5132`,`#b58355`,`#e6d2b4`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = 4.0 * sc;
      vec2 p = uv * n;
      vec2 id = floor(p);
      vec2 f = fract(p);
      float flip = mod(id.x + id.y, 2.0);
      vec2 q = flip > 0.5 ? f.yx : f.xy;
      float m = face(q, 0.08, 0.12, n);
      float grain = N(flip > 0.5 ? uv.yx : uv, 8.0 * sc);
      vec3 c = mix(uC0, uC2, 0.3 + 0.6 * grain);
      return mix(uC3, c, m);
    }`}),l({id:`basket`,name:`Basket Weave`,category:`Bond`,blurb:`Over-under strips that swap axis each cell.`,palette:[`#4a3424`,`#8b6240`,`#c49562`,`#edd7b0`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = 4.0 * sc;
      vec2 id = floor(uv * n);
      vec2 f = fract(uv * n);
      float alt = mod(id.x + id.y, 2.0);
      float bands = alt < 0.5 ? step(0.5, fract(f.y * 3.0)) : step(0.5, fract(f.x * 3.0));
      vec3 c = mix(uC0, uC2, bands);
      float border = 1.0 - face(f, 0.05, 0.05, n);
      return mix(c, uC1, border * 0.85);
    }`}),l({id:`subway`,name:`Subway Tile`,category:`Bond`,blurb:`Long ceramic courses with a narrow grout line.`,palette:[`#8e8a84`,`#d9d4cc`,`#f4f1ea`,`#c45a3a`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 2.0 * sc;
      float rows = 6.0 * sc;
      vec2 b = brickUv(uv, cols, rows);
      float m = face(b, 0.045, 0.1, rows);
      float glaze = 0.45 + 0.4 * N(uv, 3.0 * sc);
      vec3 body = mix(uC1, uC2, glaze);
      body = mix(body, uC3, step(0.97, N(uv, 10.0 * sc)) * 0.35);
      return mix(uC0, body, m);
    }`}),l({id:`chevron`,name:`Chevron`,category:`Bond`,blurb:`Sawtooth bands that close on the tile edge.`,palette:[`#241c18`,`#6e4a34`,`#c9844a`,`#f0e2cc`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float y = fract(uv.y * (4.0 * sc));
      float x = fract(uv.x * (2.0 * sc));
      float v = abs(x - 0.5);
      float band = abs(fract(y + v) - 0.5);
      float on = 1.0 - smoothstep(0.12, 0.22, band);
      float n = N(uv, 6.0 * sc);
      return mix(uC0, mix(uC1, uC2, n), on);
    }`}),l({id:`diamond`,name:`Diamond Tile`,category:`Bond`,blurb:`A diamond set in each cell, joint at the corners.`,palette:[`#2c2824`,`#6a645c`,`#b7aea2`,`#f2ebe1`],glsl:`vec3 groutStyle(vec2 uv) {
      float n = 5.0 * SC();
      vec2 f = fract(uv * n);
      float d = abs(f.x - 0.5) + abs(f.y - 0.5);
      float m = 1.0 - smoothstep(0.4, 0.5, d);
      float shade = N(uv, n * 2.0);
      vec3 body = mix(uC1, uC2, shade);
      return mix(uC0, body, m);
    }`}),l({id:`mosaic`,name:`Tessera`,category:`Bond`,blurb:`Small chips, each its own palette index, bright grout.`,palette:[`#1e3a4c`,`#c4563a`,`#e0b15a`,`#f4efe6`],glsl:`vec3 groutStyle(vec2 uv) {
      float f = 8.0 * SC();
      vec2 w = worley(uv, f);
      float mortar = 1.0 - smoothstep(0.03, 0.08, w.y - w.x);
      float n = H(wrap2(floor(uv * f), f));
      vec3 chip = pick4(n);
      return mix(chip, uC3, mortar);
    }`}),l({id:`cobble`,name:`Cobble`,category:`Bond`,blurb:`Rounded fieldstones with deep joints.`,palette:[`#2a2926`,`#5e5a54`,`#8d877e`,`#cfc6b8`],glsl:`vec3 groutStyle(vec2 uv) {
      float f = 5.0 * SC();
      vec2 w = worley(uv, f);
      float mortar = 1.0 - smoothstep(0.05, 0.14, w.y - w.x);
      float n = N(uv, 10.0 * SC());
      vec3 c = pick4(0.25 + 0.5 * n);
      return mix(c, uC0, mortar);
    }`}),l({id:`hex-bond`,name:`Hex Bond`,category:`Bond`,blurb:`Offset diamonds that read as a hex pavement.`,palette:[`#3d342c`,`#7d6a58`,`#c2a88c`,`#efe4d6`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 b = brickUv(uv, 6.0 * sc, 4.0 * sc);
      float d = abs(b.x - 0.5) * 0.9 + abs(b.y - 0.5);
      float m = 1.0 - smoothstep(0.4, 0.5, d);
      float n = N(uv, 6.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      return mix(uC0, c, m);
    }`}),l({id:`honeycomb`,name:`Honeycomb`,category:`Bond`,blurb:`Tight offset cells with a dark shared wall.`,palette:[`#3a2a12`,`#a87420`,`#e2b04a`,`#f6e2a8`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 b = brickUv(uv, 8.0 * sc, 6.0 * sc);
      float d = abs(b.x - 0.5) * 0.85 + abs(b.y - 0.5);
      float wall = smoothstep(0.36, 0.46, d);
      float n = N(uv, 4.0 * sc);
      vec3 c = mix(uC1, uC2, 0.4 + 0.5 * n);
      return mix(c, uC0, wall);
    }`}),l({id:`dirt`,name:`Packed Dirt`,category:`Ground`,blurb:`Brown earth with the odd pale stone.`,palette:[`#3a2a1c`,`#6b4a30`,`#8d6844`,`#cbb48a`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 4.0 * sc);
      float p = N(uv, 14.0 * sc);
      vec3 c = pick4(n * 0.85);
      return mix(c, uC3, smoothstep(0.8, 0.94, p));
    }`}),l({id:`gravel`,name:`Gravel`,category:`Ground`,blurb:`Loose stones sitting in a darker bed.`,palette:[`#2a2824`,`#6a655c`,`#9a9388`,`#d9d2c6`],glsl:`vec3 groutStyle(vec2 uv) {
      float f = 9.0 * SC();
      vec2 w = worley(uv, f);
      float stone = 1.0 - smoothstep(0.12, 0.28, w.x);
      float n = H(wrap2(floor(uv * f), f));
      return mix(uC0, pick4(n), stone);
    }`}),l({id:`mud`,name:`Wet Mud`,category:`Ground`,blurb:`Dark soil with glossy low spots.`,palette:[`#1c140e`,`#4a3424`,`#6e5034`,`#c8b49a`],glsl:`vec3 groutStyle(vec2 uv) {
      float n = FBM(uv, 3.0 * SC());
      vec3 c = mix4(0.15 + 0.65 * n);
      float puddle = smoothstep(0.62, 0.82, n);
      return mix(c, uC3, puddle * 0.65);
    }`}),l({id:`snow`,name:`Snow Field`,category:`Ground`,blurb:`Soft drifts and a few cold sparks.`,palette:[`#8aa0b0`,`#c5d4de`,`#e7eef2`,`#f7fbfd`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 3.0 * sc);
      vec3 c = mix(uC0, uC3, 0.45 + 0.55 * n);
      float spark = step(0.93, N(uv, 18.0 * sc));
      return mix(c, uC3, spark);
    }`}),l({id:`ash`,name:`Ash`,category:`Ground`,blurb:`Cool cinders with a rare live ember.`,motion:!0,palette:[`#1a1918`,`#4a4744`,`#8a847c`,`#e25822`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 5.0 * sc);
      vec3 c = pick4(n * 0.8);
      float ember = step(0.975, N(uv + vec2(uTime * 0.02, 0.0), 12.0 * sc));
      return mix(c, uC3, ember);
    }`}),l({id:`clay`,name:`Raw Clay`,category:`Ground`,blurb:`Soft sedimentary bands in kiln clay.`,palette:[`#6a382c`,`#a85a42`,`#d48968`,`#f0c8b0`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = 0.65 * N(uv, 5.0 * sc) + 0.35 * N(uv, 2.0 * sc);
      float bands = 0.5 + 0.5 * sin(uv.y * 6.28318 * 3.0 * sc + n * 2.0);
      return pick4(0.15 + 0.55 * n + 0.12 * bands);
    }`}),l({id:`peat`,name:`Peat`,category:`Ground`,blurb:`Dark fibrous soil, almost black between strands.`,palette:[`#14110e`,`#2c2418`,`#4a3a24`,`#7a6840`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 4.0 * sc);
      float fib = 1.0 - smoothstep(0.02, 0.2, abs(fract(uv.y * 14.0 * sc + N(uv, 3.0 * sc)) - 0.5));
      vec3 c = pick4(n * 0.75);
      return mix(c, uC1, fib * 0.45);
    }`}),l({id:`moss`,name:`Moss Clumps`,category:`Ground`,blurb:`Rounded colonies on a bare patch of soil.`,palette:[`#1a1812`,`#2f4a28`,`#5e8a44`,`#c6d6a4`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 w = worley(uv, 5.0 * sc);
      float clump = 1.0 - smoothstep(0.12, 0.42, w.x);
      float n = FBM(uv, 6.0 * sc);
      vec3 leaf = pick4(0.35 + 0.55 * n);
      return mix(uC0, leaf, clump);
    }`}),l({id:`granite`,name:`Granite`,category:`Ground`,blurb:`Salt-and-pepper granite. Fine mineral specks, no open cracks.`,palette:[`#6e6e68`,`#84847e`,`#94948c`,`#d2cec4`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float base = N(uv, 7.0 * sc);
      float pepper = smoothstep(0.45, 0.82, N(uv, 52.0 * sc));
      float salt = smoothstep(0.72, 0.96, N(uv, 44.0 * sc + 1.7));
      float warm = smoothstep(0.8, 0.98, N(uv, 28.0 * sc + 4.0));
      vec3 c = mix(uC1, uC2, base);
      c = mix(c, uC0, pepper * 0.55);
      c = mix(c, uC3, salt * 0.75);
      return mix(c, vec3(uC2.r, uC1.g, uC0.b), warm * 0.35);
    }`}),l({id:`asphalt`,name:`Asphalt`,category:`Ground`,blurb:`Tar, pale aggregate, and a wandering crack.`,palette:[`#121212`,`#2a2a28`,`#8a8680`,`#d0ccc4`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 6.0 * sc);
      vec3 c = mix(uC0, uC1, n);
      vec2 w = worley(uv, 2.0 * sc);
      float crack = 1.0 - smoothstep(0.012, 0.05, w.y - w.x);
      float stones = step(0.86, N(uv, 18.0 * sc));
      c = mix(c, uC2, stones);
      return mix(c, uC0, crack * 0.92);
    }`}),l({id:`erosion`,name:`Strata`,category:`Ground`,blurb:`Stacked sediment with a dark bed line.`,palette:[`#2c241c`,`#6a5344`,`#a78462`,`#e2d0b4`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 2.0 * sc);
      float strata = fract(uv.y * 6.0 * sc + n * 1.4);
      float line = 1.0 - smoothstep(0.0, 0.08, strata);
      vec3 c = pick4(0.15 + 0.7 * n);
      return mix(c, uC0, line * 0.85);
    }`}),l({id:`concrete`,name:`Concrete`,category:`Built`,blurb:`Flat gray with a crack that skips some cells.`,palette:[`#3a3a38`,`#6e6e6a`,`#9a9a94`,`#d2d0c8`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 4.0 * sc);
      vec3 c = pick4(0.28 + 0.5 * n);
      vec2 w = worley(uv, 2.0 * sc);
      float crack = 1.0 - smoothstep(0.015, 0.05, w.y - w.x);
      float allow = step(0.55, H(wrap2(floor(uv * 2.0 * sc), 2.0 * sc)));
      return mix(c, uC0, crack * allow);
    }`}),l({id:`stucco`,name:`Stucco`,category:`Built`,blurb:`Fine sandy dash, almost a solid tone.`,palette:[`#c2a88c`,`#d8c4aa`,`#ead8c4`,`#f6eee4`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = N(uv, 18.0 * sc);
      float n2 = N(uv, 6.0 * sc);
      return pick4(0.25 + 0.45 * n2 + 0.22 * n);
    }`}),l({id:`cinder`,name:`Cinder Block`,category:`Built`,blurb:`A block face with three core holes.`,palette:[`#1c1c1a`,`#5c5c58`,`#8a8a84`,`#c8c6be`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 2.0 * sc;
      vec2 g = fract(uv * vec2(cols, sc));
      float n = N(uv, 8.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      float h1 = length(g - vec2(0.25, 0.5));
      float h2 = length(g - vec2(0.5, 0.5));
      float h3 = length(g - vec2(0.75, 0.5));
      float hole = 1.0 - smoothstep(0.07, 0.11, min(h1, min(h2, h3)));
      float seam = 1.0 - face(g, 0.03, 0.04, cols);
      c = mix(c, uC0, hole);
      return mix(c, uC0, seam * 0.8);
    }`}),l({id:`shingle`,name:`Shingles`,category:`Built`,blurb:`Offset courses with a shadow under each lip.`,palette:[`#2a2420`,`#5c4638`,`#8c6850`,`#c4a080`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 4.0 * sc;
      float rows = 6.0 * sc;
      float row = floor(uv.y * rows);
      float x = fract(uv.x * cols + mod(row, 2.0) * 0.5);
      float y = fract(uv.y * rows);
      float m = face(vec2(x, y), 0.04, 0.08, cols);
      float shade = 0.25 + 0.45 * N(uv, cols) + 0.15 * y;
      vec3 c = pick4(shade);
      c = mix(c, uC0, smoothstep(0.72, 0.98, y));
      return mix(uC0, c, m);
    }`}),l({id:`pantile`,name:`Pantile`,category:`Built`,blurb:`Overlapping barrel tiles, offset each course.`,palette:[`#6a2c24`,`#a84838`,`#d47858`,`#f0c8b0`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float rows = 4.0 * sc;
      float cols = 6.0 * sc;
      float row = floor(uv.y * rows);
      vec2 f = fract(vec2(uv.x * cols + mod(row, 2.0) * 0.5, uv.y * rows));
      float d = length((f - vec2(0.5, 0.22)) * vec2(0.85, 1.45));
      float cap = 1.0 - smoothstep(0.66, 0.78, d);
      float n = N(uv, 8.0 * sc);
      return mix(uC0, mix(uC1, uC2, n), cap);
    }`}),l({id:`plaster`,name:`Cracked Plaster`,category:`Built`,blurb:`Warm wall color with hairline cracks.`,palette:[`#6a5348`,`#cbb59a`,`#e4d4c0`,`#f6efe6`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 3.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      vec2 w = worley(uv, 3.0 * sc);
      float crack = 1.0 - smoothstep(0.01, 0.04, w.y - w.x);
      return mix(c, uC0, crack * 0.75);
    }`}),l({id:`terrazzo`,name:`Terrazzo`,category:`Built`,blurb:`Chips scattered in a honed binder.`,palette:[`#2c3a3a`,`#d8d2c8`,`#c45a3a`,`#e0b15a`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float f = 7.0 * sc;
      vec2 w = worley(uv, f);
      float chip = 1.0 - smoothstep(0.14, 0.24, w.x);
      float idn = H(wrap2(floor(uv * f), f));
      vec3 base = mix(uC0, uC1, 0.45 + 0.55 * N(uv, 3.0 * sc));
      vec3 fleck = pick4(idn);
      return mix(base, fleck, chip * step(0.42, idn));
    }`}),l({id:`slate`,name:`Slate`,category:`Built`,blurb:`Stacked cleft sheets. Blue-gray faces and thin staggered joints.`,palette:[`#3e464c`,`#5c656c`,`#737a82`,`#8d949b`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float rows = 7.0 * sc;
      float cols = 3.0 * sc;
      vec2 b = brickUv(uv, cols, rows);
      float seam = face(b, 0.045, 0.1, rows);
      float n = N(uv, 9.0 * sc);
      float cleft = 1.0 - smoothstep(0.04, 0.2, abs(fract(uv.x * cols * 2.0 + n) - 0.5));
      vec3 c = mix(uC1, uC2, n);
      c = mix(c, uC3, cleft * 0.22);
      return mix(uC0, c, seam);
    }`}),l({id:`rebar`,name:`Rebar Grid`,category:`Built`,blurb:`Concrete seen through a rust-dark bar grid.`,palette:[`#4a2c1c`,`#8a8a84`,`#b0aea6`,`#d8d4cc`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = N(uv, 8.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      float gx = 1.0 - smoothstep(0.035, 0.08, abs(fract(uv.x * 3.0 * sc) - 0.5));
      float gy = 1.0 - smoothstep(0.035, 0.08, abs(fract(uv.y * 3.0 * sc) - 0.5));
      return mix(c, uC0, clamp(gx + gy, 0.0, 1.0));
    }`}),l({id:`ceramic`,name:`Glazed Tile`,category:`Built`,blurb:`Square glaze pools inside a dark joint.`,palette:[`#1c2428`,`#1e6a78`,`#3aa8a0`,`#d8f2ee`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 4.0 * sc;
      vec2 g = fract(uv * cols);
      float m = face(g, 0.06, 0.06, cols);
      float glaze = FBM(uv, 2.0 * sc);
      vec3 c = mix4(0.35 + 0.5 * glaze);
      return mix(uC0, c, m);
    }`}),l({id:`canvas`,name:`Canvas`,category:`Fiber`,blurb:`Plain weave, one thread over the next.`,palette:[`#cbb892`,`#e4d2ae`,`#f3e6c8`,`#faf6ee`],glsl:`vec3 groutStyle(vec2 uv) {
      float n = 14.0 * SC();
      vec2 f = fract(uv * n);
      float alt = mod(floor(uv.x * n) + floor(uv.y * n), 2.0);
      float thread = alt < 0.5 ? f.y : f.x;
      float v = smoothstep(0.12, 0.5, thread) * (1.0 - smoothstep(0.5, 0.88, thread));
      return mix(uC0, uC2, v);
    }`}),l({id:`linen`,name:`Linen`,category:`Fiber`,blurb:`A loose grid of slubs, almost cloth.`,palette:[`#b7a48c`,`#d2c2aa`,`#e6d8c4`,`#f7f1e8`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float vx = 1.0 - smoothstep(0.32, 0.5, abs(fract(uv.x * 22.0 * sc) - 0.5));
      float hy = 1.0 - smoothstep(0.32, 0.5, abs(fract(uv.y * 22.0 * sc) - 0.5));
      float n = N(uv, 8.0 * sc);
      return mix(uC1, uC3, clamp(max(vx, hy) * 0.85 + n * 0.2, 0.0, 1.0));
    }`}),l({id:`knit`,name:`Knit`,category:`Fiber`,blurb:`Offset loops, like a ribbed sweater.`,palette:[`#3a2428`,`#8a4450`,`#c47078`,`#f0c8c4`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 b = brickUv(uv, 8.0 * sc, 6.0 * sc);
      float d = length((b - vec2(0.5, 0.58)) * vec2(1.15, 1.7));
      float loop = (1.0 - smoothstep(0.26, 0.42, d)) * smoothstep(0.1, 0.2, d);
      float n = N(uv, 4.0 * sc);
      vec3 yarn = mix(uC1, uC2, n);
      return mix(uC0, yarn, loop);
    }`}),l({id:`quilt`,name:`Quilt`,category:`Fiber`,blurb:`Stitched squares with alternating diagonals.`,palette:[`#2a2428`,`#8a3e48`,`#d4896a`,`#f2e2c8`],glsl:`vec3 groutStyle(vec2 uv) {
      float n = 4.0 * SC();
      vec2 g = floor(uv * n);
      vec2 f = fract(uv * n);
      float alt = mod(g.x + g.y, 2.0);
      float d = alt < 0.5 ? abs(f.x - f.y) : abs(f.x + f.y - 1.0);
      float stitch = 1.0 - smoothstep(0.02, 0.07, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
      vec3 c = mix(uC1, uC2, 1.0 - smoothstep(0.0, 0.25, d));
      return mix(c, uC0, stitch);
    }`}),l({id:`thatch`,name:`Thatch`,category:`Fiber`,blurb:`Bundled straw, offset, with a dark tie.`,palette:[`#4a3418`,`#8a6428`,`#c49648`,`#e8d09a`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float clumps = 5.0 * sc;
      float row = floor(uv.y * clumps);
      float x = fract(uv.x * clumps + mod(row, 2.0) * 0.5);
      float y = fract(uv.y * clumps);
      float strand = abs(fract((x + y) * 7.0) - 0.5);
      float s = 1.0 - smoothstep(0.06, 0.28, strand);
      vec3 c = mix(uC0, uC2, s);
      c = mix(c, uC1, 1.0 - smoothstep(0.0, 0.18, y));
      return c;
    }`}),l({id:`denim`,name:`Denim`,category:`Fiber`,blurb:`Twill diagonal with a little wash.`,palette:[`#14283c`,`#1e466e`,`#3d6ea0`,`#c5d4e4`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float d = fract((uv.x + uv.y * 0.5) * 24.0 * sc);
      float tw = smoothstep(0.0, 0.18, d) * (1.0 - smoothstep(0.28, 0.5, d));
      float n = N(uv, 10.0 * sc);
      return mix(uC0, uC2, tw * 0.9 + 0.12 * n);
    }`}),l({id:`corduroy`,name:`Corduroy`,category:`Fiber`,blurb:`Vertical wales with a soft valley between.`,palette:[`#3a241c`,`#7a4030`,`#b46848`,`#e8c4a8`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float y = abs(fract(uv.x * 16.0 * sc) - 0.5);
      float wale = 1.0 - smoothstep(0.08, 0.42, y);
      float n = N(uv, 6.0 * sc);
      return mix(uC0, uC2, wale * (0.7 + 0.3 * n));
    }`}),l({id:`burlap`,name:`Burlap`,category:`Fiber`,blurb:`Coarse open weave, gaps at the crossings.`,palette:[`#3a2c18`,`#8a6a3c`,`#c4a06a`,`#ead8b4`],glsl:`vec3 groutStyle(vec2 uv) {
      float n = 8.0 * SC();
      vec2 f = fract(uv * n);
      float gap = smoothstep(0.08, 0.2, f.x) * smoothstep(0.08, 0.2, f.y)
        * (1.0 - smoothstep(0.72, 0.9, f.x)) * (1.0 - smoothstep(0.72, 0.9, f.y));
      float alt = mod(floor(uv.x * n) + floor(uv.y * n), 2.0);
      vec3 thread = alt < 0.5 ? uC1 : uC2;
      return mix(uC0, thread, gap);
    }`}),l({id:`reed`,name:`Woven Reed`,category:`Fiber`,blurb:`Wide flat strands crossing on a square.`,palette:[`#3e3424`,`#8a7048`,`#c4a46c`,`#f0e0bc`],glsl:`vec3 groutStyle(vec2 uv) {
      float n = 6.0 * SC();
      vec2 f = fract(uv * n);
      float alt = mod(floor(uv.x * n) + floor(uv.y * n), 2.0);
      float wave = 0.5 + 0.5 * sin((alt < 0.5 ? f.x : f.y) * 6.28318);
      vec3 c = mix(uC1, uC2, wave);
      float edge = 1.0 - face(f, 0.07, 0.07, n);
      return mix(c, uC0, edge * 0.7);
    }`}),l({id:`paper`,name:`Laid Paper`,category:`Fiber`,blurb:`Warm sheet with fiber flecks.`,palette:[`#8a7a62`,`#d9cbb0`,`#f0e6d4`,`#faf6ee`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 4.0 * sc);
      float fleck = step(0.94, N(uv, 20.0 * sc));
      vec3 c = mix(uC2, uC3, n);
      return mix(c, uC0, fleck);
    }`}),l({id:`brushed`,name:`Brushed Steel`,category:`Metal`,blurb:`Long horizontal grain, cool and flat.`,palette:[`#2a3036`,`#66727c`,`#a8b4be`,`#e6eef2`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float streaks = abs(fract(uv.y * 40.0 * sc + (N(uv, 3.0 * sc) - 0.5) * 1.4) - 0.5);
      float b = 1.0 - smoothstep(0.02, 0.22, streaks);
      float n = N(uv, 8.0 * sc);
      return mix(uC0, uC3, 0.28 + 0.45 * b + 0.12 * n);
    }`}),l({id:`rust`,name:`Rust`,category:`Metal`,blurb:`Flaking oxide with dark pits.`,palette:[`#2a140c`,`#8a3418`,`#c46228`,`#e8a85a`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 3.0 * sc);
      float pits = worley(uv, 6.0 * sc).x;
      vec3 c = mix4(n);
      return mix(c, uC0, 1.0 - smoothstep(0.05, 0.16, pits));
    }`}),l({id:`tread`,name:`Diamond Plate`,category:`Metal`,blurb:`Raised treads staggered across a brushed bed.`,palette:[`#24282c`,`#5a646c`,`#8e9aa2`,`#d5dee4`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 4.0 * sc;
      float rows = 6.0 * sc;
      float row = floor(uv.y * rows);
      vec2 f = fract(vec2(uv.x * cols + mod(row, 2.0) * 0.5, uv.y * rows));
      float d = abs(f.x - 0.5) + abs(f.y - 0.42) * 1.25;
      float bump = 1.0 - smoothstep(0.18, 0.34, d);
      float n = N(uv, 10.0 * sc);
      vec3 base = mix(uC0, uC1, 0.35 + 0.4 * n);
      return mix(base, uC3, bump);
    }`}),l({id:`carbon`,name:`Carbon Twill`,category:`Metal`,blurb:`2×2 twill, dark, with a faint sheen.`,palette:[`#0e0e10`,`#2a2a30`,`#6a6a74`,`#c8c8d0`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 p = uv * (8.0 * sc);
      vec2 i = floor(p);
      vec2 f = fract(p);
      float d = mod(i.x + i.y, 2.0) < 0.5 ? abs(f.x - f.y) : abs(f.x + f.y - 1.0);
      float twill = 1.0 - smoothstep(0.12, 0.42, d);
      float n = N(uv, 16.0 * sc);
      return mix(uC0, uC2, twill * 0.85 + n * 0.12);
    }`}),l({id:`copper`,name:`Copper Sheet`,category:`Metal`,blurb:`Brushed copper with a dull stain.`,palette:[`#4a2414`,`#a85a32`,`#d48958`,`#f0d2b0`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float streaks = abs(fract(uv.y * 28.0 * sc) - 0.5);
      float b = 1.0 - smoothstep(0.04, 0.28, streaks);
      float stain = FBM(uv, 2.0 * sc);
      vec3 c = mix(uC0, uC2, 0.35 + 0.5 * b);
      return mix(c, uC3, smoothstep(0.62, 0.9, stain) * 0.55);
    }`}),l({id:`hazard`,name:`Hazard`,category:`Metal`,blurb:`Diagonal caution bands. Still seamless.`,palette:[`#1a140c`,`#c45512`,`#3a342c`,`#f0c030`],glsl:`vec3 groutStyle(vec2 uv) {
      float s = fract((uv.x + uv.y) * 4.0 * SC());
      float band = step(0.5, s);
      float n = N(uv, 8.0 * SC());
      vec3 c = mix(uC0, uC3, band);
      return mix(c, uC1, n * 0.18);
    }`}),l({id:`vent`,name:`Vent`,category:`Metal`,blurb:`Horizontal slots in a painted housing.`,palette:[`#14181c`,`#3a444c`,`#7a868e`,`#d0d8de`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float rows = 10.0 * sc;
      float y = fract(uv.y * rows);
      float slot = smoothstep(0.18, 0.28, y) * (1.0 - smoothstep(0.62, 0.74, y));
      float n = N(uv, 2.0 * sc);
      vec3 housing = mix(uC1, uC2, n);
      return mix(uC0, housing, 1.0 - slot);
    }`}),l({id:`gold`,name:`Gold Leaf`,category:`Metal`,blurb:`Uneven leaf with bright flakes.`,palette:[`#5a3a12`,`#a87820`,`#e2b04a`,`#fff0c0`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 3.0 * sc);
      float flake = N(uv, 12.0 * sc);
      vec3 c = mix4(0.3 + 0.55 * n);
      return mix(c, uC3, smoothstep(0.76, 0.95, flake));
    }`}),l({id:`anodized`,name:`Anodized`,category:`Metal`,blurb:`A dyed metal band that shifts across the tile.`,palette:[`#14202c`,`#1e5a7a`,`#c45a6a`,`#f0d2a0`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float v = 0.5 + 0.5 * sin(uv.y * 6.28318 * 2.0 * sc + FBM(uv, 2.0 * sc) * 3.0);
      return mix4(v);
    }`}),l({id:`chainmail`,name:`Chainmail`,category:`Metal`,blurb:`Interlocked rings on a dark backing.`,palette:[`#1a1c20`,`#6a7078`,`#a8b0b8`,`#e4eaee`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 b = brickUv(uv, 8.0 * sc, 8.0 * sc);
      float d = length(b - vec2(0.5, 0.5));
      float ring = smoothstep(0.16, 0.22, d) * (1.0 - smoothstep(0.32, 0.4, d));
      float n = N(uv, 4.0 * sc);
      vec3 steel = mix(uC1, uC2, n);
      return mix(uC0, steel, ring);
    }`}),l({id:`bark`,name:`Bark`,category:`Nature`,blurb:`Vertical ridges with a little wander.`,palette:[`#2a1c14`,`#5c3a28`,`#8a5c40`,`#c49a74`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float ridges = abs(fract(uv.x * 7.0 * sc + FBM(uv, 2.0 * sc) * 1.1) - 0.5);
      float r = 1.0 - smoothstep(0.02, 0.18, ridges);
      float n = N(uv, 6.0 * sc);
      vec3 c = pick4(0.18 + 0.6 * n);
      return mix(c, uC0, r * 0.85);
    }`}),l({id:`marble`,name:`Marble`,category:`Nature`,blurb:`Pale ground cut by a dark vein.`,palette:[`#2a2c30`,`#c8c6c2`,`#e6e4e0`,`#f7f6f4`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 2.0 * sc);
      float vein = abs(sin((uv.y * 3.0 * sc + n * 1.6) * 6.28318));
      float v = 1.0 - smoothstep(0.0, 0.16, vein);
      vec3 c = mix(uC2, uC3, n);
      return mix(c, uC0, v);
    }`}),l({id:`ice`,name:`Ice`,category:`Nature`,blurb:`Pale crystal with hairline fractures.`,palette:[`#1a3040`,`#8ec4d4`,`#d4eef4`,`#f7fcfe`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 3.0 * sc);
      vec2 w = worley(uv, 4.0 * sc);
      float crack = 1.0 - smoothstep(0.02, 0.07, w.y - w.x);
      vec3 c = mix(uC1, uC3, 0.35 + 0.65 * n);
      return mix(c, uC0, crack * 0.55);
    }`}),l({id:`leather`,name:`Leather`,category:`Nature`,blurb:`Hide grain and small pores.`,palette:[`#2a160e`,`#6a3420`,`#a85a38`,`#e0b090`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 5.0 * sc);
      float pores = worley(uv, 12.0 * sc).x;
      vec3 c = pick4(0.22 + 0.55 * n);
      return mix(c, uC0, (1.0 - smoothstep(0.04, 0.12, pores)) * 0.75);
    }`}),l({id:`cloud`,name:`Cloud Deck`,category:`Nature`,blurb:`A slow drift of cloud over a flat sky.`,motion:!0,palette:[`#8aa4b8`,`#c5d6e2`,`#e7eef4`,`#f8fbfd`],glsl:`vec3 groutStyle(vec2 uv) {
      vec2 p = uv + vec2(uTime * 0.03, 0.0);
      float n = FBM(p, 2.0 * SC());
      float m = smoothstep(0.38, 0.75, n);
      return mix(uC0, uC3, m);
    }`}),l({id:`coral`,name:`Coral`,category:`Nature`,blurb:`Branching ridges on a deep ground.`,palette:[`#3a1428`,`#a83858`,`#e47878`,`#f8d0c0`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 w = worley(uv, 6.0 * sc);
      float n = FBM(uv, 3.0 * sc);
      float branch = 1.0 - smoothstep(0.04, 0.16, abs(w.x - 0.16));
      vec3 c = mix(uC0, uC1, n);
      return mix(c, uC3, branch);
    }`}),l({id:`scales`,name:`Scales`,category:`Nature`,blurb:`Offset arcs, like fish or roof scales.`,palette:[`#14281c`,`#1e6848`,`#3aaa78`,`#d8f2e0`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 b = brickUv(uv, 8.0 * sc, 6.0 * sc);
      float d = length(b - vec2(0.5, 0.12));
      float s = 1.0 - smoothstep(0.46, 0.58, d);
      float n = N(uv, 4.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      c = mix(c, uC3, (1.0 - smoothstep(0.2, 0.5, d)) * s * 0.35);
      return mix(uC0, c, s);
    }`}),l({id:`cork`,name:`Cork`,category:`Nature`,blurb:`Warm granules punched with pores.`,palette:[`#4a3018`,`#8a5c34`,`#c49058`,`#edd2a4`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 5.0 * sc);
      float pore = worley(uv, 8.0 * sc).x;
      vec3 c = pick4(0.2 + 0.6 * n);
      return mix(c, uC0, (1.0 - smoothstep(0.03, 0.1, pore)) * 0.85);
    }`}),l({id:`bamboo`,name:`Bamboo`,category:`Nature`,blurb:`Culms side by side with a node ring.`,palette:[`#3a4a20`,`#6a8a38`,`#a8c868`,`#e4f0c0`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 6.0 * sc;
      float col = gid(uv, cols);
      float x = fract(uv.x * cols);
      float y = fract(uv.y * 3.0 * sc + H(vec2(col, 2.0)));
      float node = 1.0 - smoothstep(0.0, 0.09, y);
      float culm = face(vec2(x, 0.5), 0.06, 0.0, cols);
      float n = N(uv, 8.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      c = mix(c, uC0, node * 0.8);
      c = mix(c, uC3, (1.0 - node) * N(uv, 16.0 * sc) * 0.2);
      return mix(uC0, c, culm);
    }`}),l({id:`foam`,name:`Sea Foam`,category:`Nature`,blurb:`Packed bubbles with a thin dark rim.`,palette:[`#1a4048`,`#d5e8ea`,`#f4fbfb`,`#ffffff`],glsl:`vec3 groutStyle(vec2 uv) {
      float f = 7.0 * SC();
      vec2 w = worley(uv, f);
      float bubble = 1.0 - smoothstep(0.06, 0.2, w.x);
      float rim = smoothstep(0.12, 0.2, w.x) * (1.0 - smoothstep(0.2, 0.3, w.x));
      vec3 c = mix(uC0, uC2, bubble);
      return mix(c, uC1, rim);
    }`}),l({id:`obsidian`,name:`Obsidian`,category:`Nature`,blurb:`Near-black glass with a hard highlight.`,palette:[`#07080c`,`#1a2030`,`#3a4860`,`#d8e4f0`],glsl:`vec3 groutStyle(vec2 uv) {
      float n = FBM(uv, 2.0 * SC());
      float shine = smoothstep(0.72, 0.95, n);
      vec3 c = mix(uC0, uC1, n * 0.85);
      return mix(c, uC3, shine);
    }`}),l({id:`circuit`,name:`Circuit`,category:`Signal`,blurb:`Traces and a few square pads on a board.`,palette:[`#102018`,`#1e6a38`,`#c6a24a`,`#e8f6d8`],glsl:`vec3 groutStyle(vec2 uv) {
      float cols = 8.0 * SC();
      vec2 g = fract(uv * cols);
      vec2 id = wrap2(floor(uv * cols), cols);
      float trace = 0.0;
      if (H(id) > 0.42) trace = max(trace, 1.0 - smoothstep(0.45, 0.55, abs(g.x - 0.5) * 2.0));
      if (H(id + 3.0) > 0.55) trace = max(trace, 1.0 - smoothstep(0.45, 0.55, abs(g.y - 0.5) * 2.0));
      float pad = (1.0 - smoothstep(0.12, 0.2, length(g - vec2(0.5, 0.5)))) * step(0.82, H(id + 8.0));
      vec3 c = uC0;
      c = mix(c, uC2, clamp(trace, 0.0, 1.0));
      return mix(c, uC1, pad);
    }`}),l({id:`panel`,name:`Sci Panel`,category:`Signal`,blurb:`Inset plates. Some of them carry a lamp.`,palette:[`#14181c`,`#2a343c`,`#4a5a66`,`#e2b04a`],glsl:`vec3 groutStyle(vec2 uv) {
      float cols = 4.0 * SC();
      vec2 g = fract(uv * cols);
      float panel = face(g, 0.08, 0.08, cols);
      float n = N(uv, cols);
      vec3 c = mix(uC0, mix(uC1, uC2, n), panel);
      vec2 id = wrap2(floor(uv * cols), cols);
      float lamp = step(0.8, H(id));
      float ld = length(g - vec2(0.78, 0.22));
      float on = (1.0 - smoothstep(0.035, 0.07, ld)) * lamp * panel;
      return mix(c, uC3, on);
    }`}),l({id:`dither`,name:`Ordered Dither`,category:`Signal`,blurb:`A vertical ramp through a 4-step Bayer threshold.`,palette:[`#1a120e`,`#6a3a28`,`#d4652f`,`#f6e6d4`],glsl:`vec3 groutStyle(vec2 uv) {
      vec2 px = floor(uv * RES());
      float threshold = mod(mod(px.x, 2.0) + mod(px.y, 2.0) * 2.0, 4.0) / 4.0;
      float v = step(threshold, uv.y);
      return mix(uC0, uC3, v);
    }`}),l({id:`plasma`,name:`Plasma`,category:`Signal`,blurb:`Three sine fields, periodic, slowly turning.`,motion:!0,palette:[`#1a1030`,`#6a2878`,`#e25822`,`#f6d36a`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float v = 0.5 + 0.5 * sin(uv.x * 6.28318 * sc + uTime);
      v += 0.5 + 0.5 * sin(uv.y * 6.28318 * 2.0 * sc - uTime * 0.7);
      v += 0.5 + 0.5 * sin((uv.x + uv.y) * 6.28318 * sc + uTime * 0.4);
      return mix4(v / 3.0);
    }`}),l({id:`film`,name:`Film Grain`,category:`Signal`,blurb:`Frame-stepped grain that still tiles.`,motion:!0,palette:[`#12100e`,`#3a342c`,`#a39886`,`#efe6d6`],glsl:`vec3 groutStyle(vec2 uv) {
      vec2 px = wrap2(floor(uv * RES() + vec2(floor(uTime * 12.0), 0.0)), RES());
      float n = H(px);
      return mix(uC0, uC3, n);
    }`}),l({id:`hatch`,name:`Crosshatch`,category:`Signal`,blurb:`Ink lines on a paper ground.`,palette:[`#1a140e`,`#5c4636`,`#a89880`,`#f3eadc`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float a = 1.0 - smoothstep(0.0, 0.06, abs(fract(uv.x * 14.0 * sc) - 0.5));
      float b = 1.0 - smoothstep(0.0, 0.05, abs(fract((uv.x + uv.y) * 10.0 * sc) - 0.5));
      return mix(uC3, uC0, clamp(a + b, 0.0, 1.0));
    }`}),l({id:`oil`,name:`Oil Slick`,category:`Signal`,blurb:`A thin-film shift that keeps the tile period.`,motion:!0,palette:[`#101820`,`#1e6a5a`,`#c43a6a`,`#f0d36a`],glsl:`vec3 groutStyle(vec2 uv) {
      float n = FBM(uv + vec2(uTime * 0.02, 0.0), 2.0 * SC());
      float v = fract(n * 3.0 + uTime * 0.05);
      return mix4(v);
    }`}),l({id:`static`,name:`Static`,category:`Signal`,blurb:`One palette index per pixel. Seed changes the field.`,palette:[`#141210`,`#3a342c`,`#a39886`,`#efe6d6`],glsl:`vec3 groutStyle(vec2 uv) {
      float q = H(wrap2(floor(uv * RES()), RES()));
      return pick4(q);
    }`}),l({id:`phosphor`,name:`Phosphor`,category:`Signal`,blurb:`Scanlines over a dim green field.`,palette:[`#04140c`,`#0e3a22`,`#3dcc6e`,`#d8ffd8`],glsl:`vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = N(uv, 6.0 * sc);
      float line = 0.65 + 0.35 * (0.5 + 0.5 * sin(uv.y * 6.28318 * RES() * 0.5));
      vec3 c = mix(uC0, uC2, 0.35 + 0.5 * n);
      return c * line;
    }`})],f=new Map(d.map(e=>[e.id,e]));function p(e){return f.get(e)??d[0]}function m(e,t){return t===`style`?e.palette:c.find(e=>e.id===t)?.colors??e.palette}var h=d.length,g=`
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`,_=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`,v=`
vec2 wrap2(vec2 p, float f) {
  return mod(mod(p, vec2(f)) + vec2(f), vec2(f));
}

float H(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33 + uSeed);
  return fract((p3.x + p3.y) * p3.z);
}

float SC() {
  return max(1.0, floor(uScale + 0.5));
}

float RES() {
  return uPixels > 1.5 ? uPixels : 96.0;
}

float N(vec2 uv, float freq) {
  vec2 p = uv * freq;
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = H(wrap2(i, freq));
  float b = H(wrap2(i + vec2(1.0, 0.0), freq));
  float c = H(wrap2(i + vec2(0.0, 1.0), freq));
  float d = H(wrap2(i + vec2(1.0, 1.0), freq));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float FBM(vec2 uv, float freq) {
  float v = 0.0;
  float a = 0.5;
  float f = freq;
  for (int i = 0; i < 4; i++) {
    v += a * N(uv, f);
    f *= 2.0;
    a *= 0.5;
  }
  return v;
}

vec2 worley(vec2 uv, float freq) {
  vec2 p = uv * freq;
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 cell = wrap2(i + g, freq);
      vec2 o = vec2(H(cell + 0.37), H(cell + 8.91));
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return vec2(sqrt(d1), sqrt(d2));
}

vec3 pick4(float t) {
  t = clamp(t, 0.0, 0.999);
  float q = floor(t * 4.0);
  if (q < 1.0) return uC0;
  if (q < 2.0) return uC1;
  if (q < 3.0) return uC2;
  return uC3;
}

vec3 mix4(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.3333) return mix(uC0, uC1, t * 3.0);
  if (t < 0.6666) return mix(uC1, uC2, (t - 0.3333) * 3.0);
  return mix(uC2, uC3, (t - 0.6666) * 3.0);
}

vec2 brickUv(vec2 uv, float cols, float rows) {
  float row = floor(uv.y * rows);
  float x = fract(uv.x * cols + mod(row, 2.0) * 0.5);
  float y = fract(uv.y * rows);
  return vec2(x, y);
}

float face(vec2 b, float mx, float my, float freqHint) {
  float ax = freqHint / max(RES(), 1.0);
  ax = max(ax, 0.001);
  return smoothstep(0.0, ax, b.x - mx)
    * smoothstep(0.0, ax, (1.0 - mx) - b.x)
    * smoothstep(0.0, ax, b.y - my)
    * smoothstep(0.0, ax, (1.0 - my) - b.y);
}

float gid(vec2 uv, float f) {
  return wrap2(floor(uv * f), f).x;
}

vec3 finish(vec3 c, vec2 uv) {
  if (uLook < 0.5) {
    float luma = dot(c, vec3(0.25, 0.55, 0.2));
    c = pick4(clamp(luma * 1.05, 0.0, 0.999));
  } else if (uLook < 1.5) {
    float luma = dot(c, vec3(0.3, 0.5, 0.2));
    float bristle = N(vec2(uv.y * 14.0 * SC(), uv.x * 2.0 * SC()), 6.0);
    float dab = N(uv, 5.0 * SC());
    c = mix4(clamp(luma * 0.72 + dab * 0.25 + (bristle - 0.5) * 0.1, 0.0, 1.0));
    c *= vec3(1.05, 0.97, 0.88);
  } else if (uLook < 2.5) {
    float micro = FBM(uv, 40.0);
    float pore = N(uv, 28.0 * SC());
    float shade = FBM(uv, 6.0 * SC());
    c *= 0.76 + 0.4 * shade;
    c += (micro - 0.5) * 0.12 + (pore - 0.5) * 0.07;
    c += pow(clamp(pore, 0.0, 1.0), 8.0) * 0.16;
  } else {
    float luma = dot(c, vec3(0.3, 0.59, 0.11));
    c = mix4(clamp(floor(luma * 3.0) / 2.0, 0.0, 1.0));
  }
  float grain = N(uv, 16.0 * SC()) - 0.5;
  float wearAmt = uLook < 0.5 ? 0.06 : 0.22;
  c += grain * uWear * wearAmt;
  return clamp(c, 0.0, 1.0);
}
`,y=`
void main() {
  vec2 uv = fract(vUv * max(uRepeat, 1.0));
  float grid = uPixels;
  if (uLook < 0.5 && grid < 1.5) grid = 32.0;
  if (grid > 1.5) {
    uv = (floor(uv * grid) + 0.5) / grid;
  }
  gl_FragColor = vec4(finish(groutStyle(uv), uv), 1.0);
}
`,b=`
varying vec2 vUv;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform float uTime;
uniform float uSeed;
uniform float uScale;
uniform float uPixels;
uniform float uWear;
uniform float uRepeat;
uniform float uLook;
`;function x(e){return`${_}${b}${v}${e}\n${y}`}function S(e){return`vec3(${e[0].toFixed(4)}, ${e[1].toFixed(4)}, ${e[2].toFixed(4)})`}function C(e){return`${e.toFixed(2)}`}function w(e,t){let n=t.motion?`uniform float uTime;`:`const float uTime = 0.0;`;return`${`// Grout Shader reusable tile
// ${t.name} (${t.id})
// Sample with UV 0..1. The result is periodic — repeat it.
// Vertex: attribute vec2 aPos; varying vec2 vUv; gl_Position = vec4(aPos,0,0,1); vUv = aPos*0.5+0.5;
`}${_}${`
varying vec2 vUv;
const vec3 uC0 = ${S(t.colors[0])};
const vec3 uC1 = ${S(t.colors[1])};
const vec3 uC2 = ${S(t.colors[2])};
const vec3 uC3 = ${S(t.colors[3])};
${n}
const float uSeed = ${C(t.seed)};
const float uScale = ${C(t.scale)};
const float uPixels = ${C(t.pixels)};
const float uWear = ${C(t.wear)};
const float uLook = ${C(t.look)};
const float uRepeat = 1.0;
`}${v}${e}\n${y}`}function T(e){let t=e.replace(`#`,``);return[Number.parseInt(t.slice(0,2),16)/255,Number.parseInt(t.slice(2,4),16)/255,Number.parseInt(t.slice(4,6),16)/255]}var E=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]);function D(e,t){let n=e.getContext(`webgl`,{alpha:!1,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:t,premultipliedAlpha:!1});if(!n)throw Error(`WebGL is not available in this browser.`);return n.disable(n.DITHER),n}var O=class{gl;programs=new Map;errors=new Map;buffer;constructor(e,t){this.gl=D(e,t);let n=this.gl.createBuffer();if(!n)throw Error(`Could not allocate a shader buffer.`);this.buffer=n,this.gl.bindBuffer(this.gl.ARRAY_BUFFER,n),this.gl.bufferData(this.gl.ARRAY_BUFFER,E,this.gl.STATIC_DRAW)}program(e){let t=this.programs.get(e.id);if(t)return t;if(this.errors.has(e.id))return null;try{let t=A(this.gl,x(e.glsl));return this.programs.set(e.id,t),t}catch(t){let n=t instanceof Error?t.message:`Shader failed to compile.`;return this.errors.set(e.id,n),null}}draw(e,t,n,r){let i=this.program(e),a=this.gl;if(!i)return!1;a.viewport(0,0,n,r),a.useProgram(i),a.bindBuffer(a.ARRAY_BUFFER,this.buffer),a.enableVertexAttribArray(0),a.vertexAttribPointer(0,2,a.FLOAT,!1,0,0);let o=(e,t)=>{let n=a.getUniformLocation(i,e);n&&a.uniform1f(n,t)},s=(e,t)=>{let n=a.getUniformLocation(i,e);n&&a.uniform3f(n,t[0],t[1],t[2])};return s(`uC0`,t.colors[0]),s(`uC1`,t.colors[1]),s(`uC2`,t.colors[2]),s(`uC3`,t.colors[3]),o(`uTime`,t.time),o(`uSeed`,t.seed),o(`uScale`,t.scale),o(`uPixels`,t.pixels),o(`uWear`,t.wear),o(`uRepeat`,t.repeat),o(`uLook`,t.look),a.drawArrays(a.TRIANGLES,0,6),!0}dropPrograms(){for(let e of this.programs.values())this.gl.deleteProgram(e);this.programs.clear()}};function k(e,t,n){let r=e.createShader(t);if(!r)throw Error(`Could not create a shader.`);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r)||`compile failed`;throw e.deleteShader(r),Error(t)}return r}function A(e,t){let n=e.createProgram();if(!n)throw Error(`Could not create a program.`);let r=k(e,e.VERTEX_SHADER,g),i=k(e,e.FRAGMENT_SHADER,t);if(e.attachShader(n,r),e.attachShader(n,i),e.bindAttribLocation(n,0,`aPos`),e.linkProgram(n),e.deleteShader(r),e.deleteShader(i),!e.getProgramParameter(n,e.LINK_STATUS)){let t=e.getProgramInfoLog(n)||`link failed`;throw e.deleteProgram(n),Error(t)}return n}var j=class{display;util;thumbs=new Map;constructor(e,t){this.display=new O(e,!1),this.util=new O(t,!0);let n=e=>{e.gl.canvas.addEventListener(`webglcontextlost`,e=>{e.preventDefault()}),e.gl.canvas.addEventListener(`webglcontextrestored`,()=>{e.dropPrograms(),e.errors.clear()})};n(this.display),n(this.util)}error(e){return this.display.errors.get(e)??this.util.errors.get(e)}drawDisplay(e,t,n){return this.display.draw(t,n,e.width,e.height)}drawUtil(e,t,n){return this.util.draw(t,n,e.width,e.height)}thumbnail(e,t,n,r){let i=this.thumbs.get(r);if(i)return i;if(e.width=96,e.height=96,!this.util.draw(t,n,96,96))return null;let a=e.toDataURL(`image/jpeg`,.72);return this.thumbs.set(r,a),a}clearThumbs(){this.thumbs.clear()}dispose(){this.display.dropPrograms(),this.util.dropPrograms()}},M=[{id:`brick`,label:`Brick`,file:`/judge/brick.jpg`,styles:[`brick`,`herringbone`,`basket`,`chevron`,`diamond`,`hex-bond`,`honeycomb`,`pantile`,`shingle`]},{id:`stone`,label:`Stone`,file:`/judge/stone.jpg`,styles:[`stone`,`cobble`,`gravel`,`terrazzo`]},{id:`metal`,label:`Metal`,file:`/judge/metal.jpg`,styles:[`metal`,`brushed`,`tread`,`vent`,`anodized`]},{id:`plank`,label:`Plank`,file:`/judge/plank.jpg`,styles:[`wood`,`bark`,`cork`]},{id:`oak`,label:`Oak`,file:`/judge/oak.jpg`,styles:[`sawn-oak`]},{id:`panels`,label:`Dark panels`,file:`/judge/panels.jpg`,styles:[`dark-panels`]},{id:`toon`,label:`Toon wood`,file:`/judge/toon.jpg`,styles:[`toon-plank`,`knot-comic`,`crack-comic`]},{id:`grass`,label:`Grass`,file:`/judge/grass.jpg`,styles:[`grass`,`moss`]},{id:`sand`,label:`Sand`,file:`/judge/sand.jpg`,styles:[`sand`,`clay`]},{id:`water`,label:`Water`,file:`/judge/water.jpg`,styles:[`water`]},{id:`granite`,label:`Granite`,file:`/judge/granite.jpg`,styles:[`granite`]},{id:`slate`,label:`Slate`,file:`/judge/slate.jpg`,styles:[`slate`]}],N=new Map;for(let e of M)for(let t of e.styles)N.set(t,e);function ee(e){return N.get(e)}function P(e,t,n){return .2126*e+.7152*t+.0722*n}function te(e,t,n){let r=t*n,i=0,a=0,o=0,s=[0,0,0,0,0,0],c=0;for(let t=0;t<r;t++){let n=e[t*4]??0,r=e[t*4+1]??0,l=e[t*4+2]??0;i+=n,a+=r,o+=l;let u=Math.max(n,r,l),d=u-Math.min(n,r,l);if(d<8||u<12)continue;let f=0;f=u===n?(r-l)/d%6:u===r?(l-n)/d+2:(n-r)/d+4,f<0&&(f+=6);let p=Math.min(5,Math.floor(f));s[p]=(s[p]??0)+1,c+=1}if(i/=r,a/=r,o/=r,c>0)for(let e=0;e<6;e++)s[e]=(s[e]??0)/c;let l=0,u=0,d=0,f=(n,r)=>{let i=(r*t+n)*4;return P(e[i]??0,e[i+1]??0,e[i+2]??0)};for(let e=0;e<n;e++)for(let r=0;r<t;r++){let s=f(r,e);l+=(s-P(i,a,o))**2,r+1<t&&(u+=Math.abs(f(r+1,e)-s)),e+1<n&&(d+=Math.abs(f(r,e+1)-s))}let p=u+d;return{mean:[i,a,o],std:Math.sqrt(l/r),hue:s,energy:p/r,aniso:p>1?u/p:.5}}function ne(e,t,n){let r=0,i=0,a=(n,r,i)=>e[(r*t+n)*4+i]??0;for(let e=0;e<n;e++)for(let n=0;n<3;n++)r+=Math.abs(a(0,e,n)-a(t-1,e,n)),i+=1;for(let e=0;e<t;e++)for(let t=0;t<3;t++)r+=Math.abs(a(e,0,t)-a(e,n-1,t)),i+=1;return r/i/255}function re(e,t){let n=1-Math.min(1,Math.hypot(e.mean[0]-t.mean[0],e.mean[1]-t.mean[1],e.mean[2]-t.mean[2])/180),r=0,i=0,a=0;for(let n=0;n<6;n++){let o=e.hue[n]??0,s=t.hue[n]??0;r+=o*s,i+=o*o,a+=s*s}let o=i<1e-6||a<1e-6?.5:r/(Math.sqrt(i)*Math.sqrt(a)),s=1-Math.min(1,Math.abs(e.std-t.std)/50),c=1-Math.min(1,Math.abs(e.energy-t.energy)/30),l=1-Math.abs(e.aniso-t.aniso);return .42*n+.28*o+.12*s+.08*c+.1*l}function ie(e,t,n,r){return r?t===null?{pass:!1,reason:`no reference`}:n?{pass:!1,reason:`too flat`}:e>.16?{pass:!1,reason:`seam`}:t<.58?{pass:!1,reason:`unlike reference`}:{pass:!0,reason:`matches`}:{pass:!1,reason:`shader failed`}}function ae(e,t){return JSON.stringify({format:`grout-shader/1`,style:e.id,name:e.name,category:e.category,preset:e.preset??null,motion:!!e.motion,seed:t.seed,scale:t.scale,pixels:t.pixels,wear:Number(t.wear.toFixed(2)),palette:t.paletteId,look:t.look,colors:t.colors,repeatSafe:!0},null,2)}function oe(e,t){let n=t.colors.map(T),r={name:e.name,id:e.id,motion:!!e.motion,seed:t.seed,scale:t.scale,pixels:t.pixels,wear:t.wear,look:s(t.look),colors:n};return w(e.glsl,r)}function F(e){let t=-1;for(let n=0;n<e.length;n+=1){t^=e[n]??0;for(let e=0;e<8;e+=1)t=t>>>1^3988292384&-(t&1)}return~t>>>0}function I(e){let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),t}function se(e){let t=[],n=[],r=0,i=new TextEncoder;for(let a of e){let e=i.encode(a.name),o=F(a.data),s=new Uint8Array(30+e.length),c=new DataView(s.buffer);c.setUint32(0,67324752,!0),c.setUint16(4,20,!0),c.setUint16(8,0,!0),c.setUint32(14,o,!0),c.setUint32(18,a.data.length,!0),c.setUint32(22,a.data.length,!0),c.setUint16(26,e.length,!0),s.set(e,30),t.push(I(s),I(a.data));let l=new Uint8Array(46+e.length),u=new DataView(l.buffer);u.setUint32(0,33639248,!0),u.setUint16(4,20,!0),u.setUint16(6,20,!0),u.setUint32(16,o,!0),u.setUint32(20,a.data.length,!0),u.setUint32(24,a.data.length,!0),u.setUint16(28,e.length,!0),u.setUint32(42,r,!0),l.set(e,46),n.push(l),r+=s.length+a.data.length}let a=n.reduce((e,t)=>e+t.length,0),o=new Uint8Array(22),s=new DataView(o.buffer);return s.setUint32(0,101010256,!0),s.setUint16(8,e.length,!0),s.setUint16(10,e.length,!0),s.setUint32(12,a,!0),s.setUint32(16,r,!0),new Blob([...t,...n.map(I),I(o)],{type:`application/zip`})}var L=n(),R=`grout-shader-v1`,z=[1,2,3,4],ce=[1,2,3,4],le=[32,64,128,256,512],B={styleId:`brick`,seed:1204,scale:1,pixels:32,wear:.35,repeat:2,animate:!1,paletteId:`style`,look:`pixel`,exportSize:256,favorites:[],category:`All`,query:``};function V(e,t,n){return Math.min(n,Math.max(t,e))}function ue(){try{let e=localStorage.getItem(R);if(!e){let e=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;return{...B,animate:!e}}let t=JSON.parse(e),n=d.some(e=>e.id===t.styleId)?t.styleId:B.styleId,r=o.some(e=>e.value===t.pixels)?t.pixels:B.pixels,s=z.includes(t.scale)?t.scale:1,l=ce.includes(t.repeat)?t.repeat:2,u=le.includes(t.exportSize)?t.exportSize:256,f=c.some(e=>e.id===t.paletteId)?t.paletteId:`style`,p=a.some(e=>e.id===t.look)?t.look:B.look,m=`All`;(t.category===`All`||t.category===`Kept`||typeof t.category==`string`&&i.includes(t.category))&&(m=t.category);let h=Number(t.seed),g=Number(t.wear),_=Array.isArray(t.favorites)?t.favorites.filter(e=>d.some(t=>t.id===e)):[];return{styleId:n,seed:V(Number.isFinite(h)?Math.round(h):B.seed,0,999999),scale:s,pixels:r,wear:V(Number.isFinite(g)?g:B.wear,0,1),repeat:l,animate:!!t.animate,paletteId:f,look:p,exportSize:u,favorites:_,category:m,query:``}}catch{return B}}function H(e,t){let n=m(p(e.styleId),e.paletteId).map(T);return{seed:e.seed,scale:e.scale,pixels:e.pixels,wear:e.wear,repeat:e.repeat,time:t,look:s(e.look),colors:n}}function de(e,t,n){return{seed:7,scale:1,pixels:t,wear:.28,repeat:1,time:0,look:n,colors:p(e).palette.map(T)}}async function U(e){try{return await navigator.clipboard.writeText(e),!0}catch{return!1}}function W(e,t){let n=URL.createObjectURL(e),r=document.createElement(`a`);r.href=n,r.download=t,r.click(),URL.revokeObjectURL(n)}function G(e){let t=document.createElement(`canvas`);t.width=e.width,t.height=e.height;let n=t.getContext(`2d`);return n?(n.imageSmoothingEnabled=!1,n.drawImage(e,0,0),t):null}function fe(e){return new Promise(t=>{e.toBlob(async e=>{if(!e){t(null);return}t(new Uint8Array(await e.arrayBuffer()))},`image/png`)})}function K(){let e=(0,r.useRef)(null),t=(0,r.useRef)(null),n=(0,r.useRef)(null),l=(0,r.useRef)(B),u=(0,r.useRef)(null),f=(0,r.useRef)(()=>{}),g=(0,r.useRef)(!1),_=(0,r.useRef)(null),[v,y]=(0,r.useState)(B),[b,x]=(0,r.useState)(!1),[S,C]=(0,r.useState)(!1),[w,E]=(0,r.useState)(!1),[D,O]=(0,r.useState)(!1),[k,A]=(0,r.useState)(null),[N,P]=(0,r.useState)({}),[F,I]=(0,r.useState)({}),[K,pe]=(0,r.useState)(null),[me,J]=(0,r.useState)(``),[Y,he]=(0,r.useState)(0);l.current=v,(0,r.useEffect)(()=>{let r=e.current,i=t.current;if(!r||!i)return;let a;try{a=new j(r,i)}catch(e){pe(e instanceof Error?e.message:`WebGL failed to start.`);return}n.current=a;let o=0,c=!0,m=performance.now(),h=()=>{let e=Math.min(2,window.devicePixelRatio||1),t=Math.max(1,Math.floor(r.clientWidth*e)),n=Math.max(1,Math.floor(r.clientHeight*e));(r.width!==t||r.height!==n)&&(r.width=t,r.height=n)},g=e=>{let t=l.current,n=p(t.styleId);h(),a.drawDisplay(r,n,H(t,e));let i=a.error(n.id);i&&I(e=>e[n.id]===i?e:{...e,[n.id]:i})},_=e=>{if(!c)return;let t=l.current,n=p(t.styleId);t.animate&&n.motion&&document.visibilityState!==`hidden`&&(g((e-m)/1e3),o=requestAnimationFrame(_))},v=()=>{cancelAnimationFrame(o);let e=l.current,t=p(e.styleId);e.animate&&t.motion&&document.visibilityState!==`hidden`?o=requestAnimationFrame(_):g(0)};u.current=v;let y=new ResizeObserver(()=>v());y.observe(r),document.addEventListener(`visibilitychange`,v);let b=0,x=d.slice(),S={},C={},w=0,T=0,E=()=>{x=d.slice();let e=x.findIndex(e=>e.id===l.current.styleId);if(e>0){let t=x[e];t&&(x.splice(e,1),x.unshift(t))}},D=e=>{let t=Object.keys(S);if(t.length){let e={...S};for(let e of t)delete S[e];P(t=>({...t,...e}))}let n=Object.keys(C);if(n.length){let e={...C};for(let e of n)delete C[e];I(t=>({...t,...e}))}he(e)},O=()=>{if(!c)return;let e=T;if(document.visibilityState===`hidden`){w=window.setTimeout(O,500);return}let t=x[b];if(!t){D(b);return}b+=1;let n=l.current,r=`${t.id}:${n.look}:${n.pixels}`,o=a.thumbnail(i,t,de(t.id,n.pixels,s(n.look)),r);if(e!==T)return;o&&(S[t.id]=o);let u=a.error(t.id);u&&(C[t.id]=u),(b===x.length||b%4==0)&&D(b),b<x.length&&(w=window.setTimeout(O,b<8?16:48))};return f.current=()=>{T+=1,b=0;for(let e of Object.keys(S))delete S[e];for(let e of Object.keys(C))delete C[e];E(),a.clearThumbs(),window.clearTimeout(w),w=window.setTimeout(O,32)},v(),()=>{c=!1,window.clearTimeout(w),cancelAnimationFrame(o),y.disconnect(),document.removeEventListener(`visibilitychange`,v),a.dispose(),n.current=null,f.current=()=>{}}},[]),(0,r.useEffect)(()=>{y(ue()),x(!0)},[]),(0,r.useEffect)(()=>{b&&(P({}),he(0),f.current())},[b,v.look,v.pixels]),(0,r.useEffect)(()=>{b&&u.current?.()},[b,v.styleId,v.seed,v.scale,v.pixels,v.wear,v.repeat,v.animate,v.paletteId,v.look]),(0,r.useEffect)(()=>{if(!b)return;let{query:e,...t}=v;localStorage.setItem(R,JSON.stringify(t))},[b,v]);let X=p(v.styleId),ge=m(X,v.paletteId),Z=(0,r.useMemo)(()=>{let e=v.query.trim().toLowerCase();return d.filter(t=>v.category===`Kept`&&!v.favorites.includes(t.id)||v.category!==`All`&&v.category!==`Kept`&&t.category!==v.category?!1:!e||t.name.toLowerCase().includes(e)||t.id.includes(e)||t.category.toLowerCase().includes(e)||t.blurb.toLowerCase().includes(e)||(t.preset?.includes(e)??!1))},[v.category,v.favorites,v.query]);(0,r.useEffect)(()=>{let e=e=>{let t=e.target;if(t instanceof HTMLElement&&(t.tagName===`INPUT`||t.tagName===`TEXTAREA`||t.tagName===`SELECT`||t.isContentEditable)||e.key!==`ArrowRight`&&e.key!==`ArrowLeft`)return;let n=Z.length?Z:d,r=Math.max(0,n.findIndex(e=>e.id===l.current.styleId)),i=e.key===`ArrowRight`?n[(r+1)%n.length]:n[(r-1+n.length)%n.length];i&&(e.preventDefault(),y(e=>({...e,styleId:i.id})))};return window.addEventListener(`keydown`,e),()=>window.removeEventListener(`keydown`,e)},[Z]),(0,r.useEffect)(()=>{_.current?.scrollIntoView({block:`nearest`,inline:`nearest`})},[v.styleId,v.category,Z.length]),(0,r.useEffect)(()=>{if(!S)return;let e=e=>{e.key===`Escape`&&C(!1)};return window.addEventListener(`keydown`,e),()=>window.removeEventListener(`keydown`,e)},[S]);let _e=ae(X,{seed:v.seed,scale:v.scale,pixels:v.pixels,wear:v.wear,paletteId:v.paletteId,look:v.look,colors:ge}),Q=e=>y(t=>({...t,...e})),ve=async()=>{E(!0),C(!1),O(!0),A([]);let e=document.createElement(`canvas`),t=document.createElement(`canvas`),n=new j(e,t),r=document.createElement(`canvas`);r.width=96,r.height=96;let i=r.getContext(`2d`,{willReadFrequently:!0});if(!i){n.dispose(),O(!1);return}let a=new Map;for(let e of M){let t=new Image;t.src=e.file,await t.decode(),i.clearRect(0,0,96,96),i.drawImage(t,0,0,96,96),a.set(e.id,te(i.getImageData(0,0,96,96).data,96,96))}let o=[];for(let e of d){let r=ee(e.id);t.width=96,t.height=96;let s=e.palette.map(T),c=n.drawUtil(t,e,{seed:7,scale:1,pixels:0,wear:.08,repeat:1,time:0,look:2,colors:s});i.clearRect(0,0,96,96),c&&i.drawImage(t,0,0,96,96);let l=i.getImageData(0,0,96,96).data,u=te(l,96,96),d=c?ne(l,96,96):1,f=r?a.get(r.id):void 0,p=f?re(u,f):null,m=ie(d,p,u.std<6,c);o.push({id:e.id,name:e.name,ref:r?.label??`—`,seam:d,match:p,pass:m.pass,reason:m.reason}),A(o.slice()),await new Promise(e=>setTimeout(e,0))}n.dispose();for(let n of[e,t])n.getContext(`webgl`)?.getExtension(`WEBGL_lose_context`)?.loseContext();O(!1)},ye=`grout-${X.id}-s${v.seed}-${v.pixels||`smooth`}`,be=e=>{let r=n.current,i=t.current;return!r||!i?!1:(i.width=v.exportSize,i.height=v.exportSize,r.drawUtil(i,X,{...H(v,0),seed:e,repeat:1}))},xe=()=>{let e=t.current;if(!e||!be(v.seed)){J(`Could not render that tile.`);return}let n=G(e);if(!n){J(`Could not render that tile.`);return}n.toBlob(e=>{e&&(W(e,`${ye}.png`),J(`Tile saved`))},`image/png`)},Se=()=>{let e=t.current;if(!e)return;let n=v.exportSize,r=document.createElement(`canvas`);r.width=n*2,r.height=n*2;let i=r.getContext(`2d`);if(!i)return;let a=[v.seed,v.seed+11,v.seed+29,v.seed+47];for(let t=0;t<a.length;t+=1){let r=a[t];if(r===void 0||!be(r)){J(`Could not render the atlas.`);return}i.drawImage(e,t%2*n,Math.floor(t/2)*n,n,n)}r.toBlob(e=>{e&&(W(e,`${ye}-atlas.png`),J(`Atlas saved`))},`image/png`)},Ce=async()=>{if(g.current)return;g.current=!0,J(`Rendering catalog…`);let e=document.createElement(`canvas`),t=document.createElement(`canvas`),n=new j(e,t),r=v.exportSize,i=[];try{for(let e of d){t.width=r,t.height=r;let a=H({...v,styleId:e.id},0);if(a.repeat=1,!n.drawUtil(t,e,a))continue;let o=G(t),s=o?await fe(o):null;s&&(i.push({name:`${e.category.toLowerCase()}/${e.id}.png`,data:s}),i.length%6==0&&J(`Catalog ${i.length} / ${d.length}`),await new Promise(e=>setTimeout(e,0)))}}finally{n.dispose();for(let n of[e,t])n.getContext(`webgl`)?.getExtension(`WEBGL_lose_context`)?.loseContext();g.current=!1}if(!i.length){J(`Could not render the catalog.`);return}W(se(i),`grout-catalog-${v.pixels||`smooth`}-${v.look}.zip`),J(`Catalog saved, ${i.length} PNGs`)},$=v.favorites.includes(X.id),we=F[X.id]??K,Te=v.pixels>0||v.look===`pixel`;return(0,L.jsxs)(`main`,{className:`bench`,children:[(0,L.jsxs)(`header`,{className:`top`,children:[(0,L.jsxs)(`div`,{className:`id`,children:[(0,L.jsx)(`p`,{className:`mark`,children:Y>0&&Y<h?`Firing ${Y} / ${h}`:X.preset?`Reviewed`:X.category}),(0,L.jsx)(`h1`,{children:X.name})]}),(0,L.jsxs)(`div`,{className:`top-actions`,children:[(0,L.jsx)(`button`,{type:`button`,"aria-expanded":w,onClick:()=>w?E(!1):void ve(),children:D?`Judging`:`Judge`}),(0,L.jsx)(`button`,{type:`button`,"aria-expanded":S,onClick:()=>C(e=>!e),children:`Adjust`}),(0,L.jsx)(`button`,{type:`button`,className:`primary`,onClick:xe,children:`Save`})]})]}),(0,L.jsxs)(`section`,{className:`stage`,"aria-label":`Texture preview`,children:[(0,L.jsx)(`canvas`,{ref:e,className:Te?`pixelated`:void 0,"aria-label":`${X.name} texture preview`}),K?(0,L.jsx)(`p`,{className:`stage-error`,children:K}):null]}),(0,L.jsxs)(`div`,{className:`finder`,children:[(0,L.jsx)(`input`,{className:`rack-search`,type:`search`,value:v.query,onChange:e=>Q({query:e.target.value}),placeholder:`Search textures`,"aria-label":`Search styles`}),(0,L.jsx)(`div`,{className:`cats`,role:`tablist`,"aria-label":`Categories`,children:[`All`,`Kept`,...i].map(e=>{let t=v.category===e;return(0,L.jsx)(`button`,{type:`button`,role:`tab`,"aria-selected":t,onClick:()=>Q({category:e}),className:`cat`,children:e},e)})}),(0,L.jsxs)(`div`,{className:`looks`,children:[(0,L.jsx)(`div`,{className:`cat-set`,role:`radiogroup`,"aria-label":`Look`,children:a.map(e=>(0,L.jsx)(`button`,{type:`button`,role:`radio`,"aria-checked":v.look===e.id,className:`cat`,onClick:()=>Q({look:e.id,pixels:e.id===`pixel`?v.pixels||32:0}),children:e.label},e.id))}),(0,L.jsx)(`div`,{className:`cat-set`,role:`radiogroup`,"aria-label":`Size`,children:o.map(e=>(0,L.jsx)(`button`,{type:`button`,role:`radio`,"aria-checked":v.pixels===e.value,className:`cat`,onClick:()=>Q({pixels:e.value}),children:e.label},e.value))})]})]}),(0,L.jsx)(`div`,{className:`grid-scroll`,children:Z.length===0?(0,L.jsx)(`p`,{className:`recipe-empty`,children:`Nothing matches.`}):(0,L.jsx)(`ul`,{className:`tile-grid`,children:Z.map(e=>{let t=e.id===X.id;return(0,L.jsx)(`li`,{children:(0,L.jsxs)(`button`,{type:`button`,ref:t?_:void 0,"aria-pressed":t,"aria-label":e.name,onClick:()=>Q({styleId:e.id}),className:`tile`,children:[(0,L.jsx)(`span`,{className:`tile-face`,children:N[e.id]?(0,L.jsx)(`img`,{src:N[e.id],alt:``,className:Te?`pixelated`:void 0}):(0,L.jsx)(`span`,{className:`tile-fallback`,"aria-hidden":`true`,children:e.palette.map(e=>(0,L.jsx)(`i`,{style:{background:e}},e))})}),(0,L.jsx)(`span`,{className:`tile-name`,children:e.name})]})},e.id)})})}),(0,L.jsx)(`canvas`,{ref:t,className:`util-canvas`,"aria-hidden":`true`}),(0,L.jsxs)(`section`,{className:`judge`,"data-open":w,inert:!w,"aria-label":`Reference judge`,children:[(0,L.jsxs)(`div`,{className:`judge-head`,children:[(0,L.jsx)(`h2`,{children:`Reference judge`}),(0,L.jsx)(`button`,{type:`button`,onClick:()=>E(!1),children:`Close`})]}),(0,L.jsx)(`p`,{className:`lede`,children:`Each scored texture is compared with a generated seamless tile of the same material. A pass means it tiles and sits close to that tile.`}),(0,L.jsx)(`p`,{className:`judge-sum`,"data-judge-sum":`true`,children:k?`${k.filter(e=>e.pass).length} pass / ${k.filter(e=>e.reason!==`no reference`).length} scored${D?`…`:``}`:`Running…`}),(0,L.jsx)(`ul`,{className:`judge-list`,children:(k??[]).filter(e=>e.reason!==`no reference`).map(e=>(0,L.jsx)(`li`,{children:(0,L.jsxs)(`button`,{type:`button`,className:`judge-row`,"data-pass":e.pass,"data-judge-row":e.id,"data-seam":e.seam.toFixed(3),"data-match":e.match===null?``:e.match.toFixed(3),"data-reason":e.reason,onClick:()=>{Q({styleId:e.id,look:`real`,pixels:0}),E(!1)},children:[(0,L.jsx)(`span`,{children:e.name}),(0,L.jsx)(`span`,{className:`judge-ref`,children:e.ref}),(0,L.jsx)(`span`,{children:e.match===null?`—`:e.match.toFixed(2)}),(0,L.jsx)(`span`,{children:e.pass?`Pass`:e.reason})]})},e.id))})]}),(0,L.jsxs)(`section`,{className:`details`,"data-open":S,inert:!S,"aria-label":`Adjust texture`,children:[(0,L.jsx)(`h2`,{children:X.name}),(0,L.jsx)(`p`,{className:`lede`,children:X.blurb}),we?(0,L.jsx)(`p`,{className:`shader-fault`,children:we}):null,(0,L.jsxs)(`div`,{className:`fields`,children:[(0,L.jsxs)(`label`,{className:`field`,children:[`Seed`,(0,L.jsxs)(`span`,{className:`inline`,children:[(0,L.jsx)(`input`,{type:`number`,inputMode:`numeric`,min:0,max:999999,value:v.seed,"aria-label":`Seed`,onChange:e=>Q({seed:V(Math.round(Number(e.target.value)||0),0,999999)})}),(0,L.jsx)(`button`,{type:`button`,className:`ghost`,onClick:()=>Q({seed:Math.floor(Math.random()*1e5)}),children:`Random`})]})]}),(0,L.jsx)(q,{label:`Repeat`,children:(0,L.jsx)(`select`,{"aria-label":`Seam check`,value:v.repeat,onChange:e=>Q({repeat:Number(e.target.value)}),children:ce.map(e=>(0,L.jsxs)(`option`,{value:e,children:[e,`×`]},e))})}),(0,L.jsx)(q,{label:`Scale`,children:(0,L.jsx)(`select`,{"aria-label":`Motif scale`,value:v.scale,onChange:e=>Q({scale:Number(e.target.value)}),children:z.map(e=>(0,L.jsxs)(`option`,{value:e,children:[e,`×`]},e))})}),(0,L.jsxs)(`label`,{className:`field`,children:[`Wear`,(0,L.jsx)(`input`,{type:`range`,min:0,max:1,step:.01,value:v.wear,"aria-label":`Wear`,"aria-valuetext":v.wear.toFixed(2),onChange:e=>Q({wear:Number(e.target.value)})})]}),(0,L.jsx)(q,{label:`Export`,children:(0,L.jsx)(`select`,{"aria-label":`Export size`,value:v.exportSize,onChange:e=>Q({exportSize:Number(e.target.value)}),children:le.map(e=>(0,L.jsxs)(`option`,{value:e,children:[e,` px`]},e))})}),(0,L.jsx)(`div`,{className:`palette-row`,role:`radiogroup`,"aria-label":`Palette`,children:c.map(e=>{let t=e.colors??X.palette,n=v.paletteId===e.id;return(0,L.jsx)(`button`,{type:`button`,role:`radio`,"aria-label":e.name,"aria-checked":n,onClick:()=>Q({paletteId:e.id}),className:`palette-chip`,children:(0,L.jsx)(`span`,{className:`swatches`,"aria-hidden":`true`,children:t.map(e=>(0,L.jsx)(`i`,{style:{background:e}},e))})},e.id)})})]}),(0,L.jsxs)(`div`,{className:`links`,children:[(0,L.jsxs)(`button`,{type:`button`,"aria-pressed":v.animate,onClick:()=>Q({animate:!v.animate}),children:[`Drift `,v.animate?`on`:`off`]}),(0,L.jsx)(`button`,{type:`button`,"aria-pressed":$,onClick:()=>Q({favorites:$?v.favorites.filter(e=>e!==X.id):[...v.favorites,X.id]}),children:$?`Kept`:`Keep`}),(0,L.jsx)(`button`,{type:`button`,onClick:Se,children:`2×2 atlas`}),(0,L.jsx)(`button`,{type:`button`,onClick:()=>void Ce(),children:`PNG catalog`}),(0,L.jsx)(`button`,{type:`button`,onClick:()=>{U(_e).then(e=>J(e?`Recipe copied`:`Copy failed — select the recipe below`))},children:`Copy recipe`}),(0,L.jsx)(`button`,{type:`button`,onClick:()=>{U(oe(X,{seed:v.seed,scale:v.scale,pixels:v.pixels,wear:v.wear,paletteId:v.paletteId,look:v.look,colors:ge})).then(e=>J(e?`GLSL copied`:`Copy failed`))},children:`Copy GLSL`})]}),(0,L.jsx)(`p`,{className:`drawer-status`,children:me}),(0,L.jsx)(`pre`,{children:_e}),(0,L.jsx)(`button`,{type:`button`,className:`done`,onClick:()=>C(!1),children:`Done`})]})]})}function q({label:e,children:t}){return(0,L.jsxs)(`label`,{className:`field`,children:[e,t]})}var pe=K;export{pe as component};