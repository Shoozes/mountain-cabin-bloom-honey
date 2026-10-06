/**
 * Pixel-look paths for styles that fail the pixel bar with the shared
 * dither-and-snap finish (pixel-pass batch 1: herringbone, stone, concrete, water).
 *
 * Each style keeps its original `groutStyle` body for Painted, Hyper real and
 * Poster. Only `uLook < 0.5` takes the branch below, so the other looks are
 * unchanged.
 *
 * The pixel branch works on whole art pixels:
 * - `pkP()` is the design period. It always divides the pixel grid, so the
 *   tile wraps on all four edges. Scale 2 and 4 repeat the design 2 or 4
 *   times when the period stays at least 16. Scale 3 rounds to 2.
 * - `pkQ()` is the wrapped art pixel, with y pointing down like an image.
 * - `pkOut()` returns one palette entry minus the Bayer offset that `finish`
 *   adds back, so the snap lands on that entry exactly and there's no dither.
 *   The result is 4 colors at most and no checkerboard.
 * - Each style picks a palette index per pixel. If a pixel shares its index
 *   with none of its four neighbours (an orphan), it falls back to the
 *   material's base index.
 */

export const PIXEL_KIT = `
float pkP() {
  float g = max(pixelGrid(), 1.0);
  float s = SC();
  float k = s > 3.5 ? 4.0 : (s > 1.5 ? 2.0 : 1.0);
  if (g / k < 16.0) k = max(1.0, k * 0.5);
  if (g / k < 16.0) k = max(1.0, k * 0.5);
  return g / k;
}
vec2 pkQ(vec2 uv, float P) {
  float g = max(pixelGrid(), 1.0);
  vec2 p = floor(uv * g);
  p.y = g - 1.0 - p.y;
  return mod(p, P);
}
vec2 pkW(vec2 q, float P) {
  return mod(q, P);
}
float pkH(vec2 c, float salt) {
  vec3 p3 = fract(vec3(c.xyx) * vec3(0.1031, 0.1030, 0.0973) +
    fract(vec3(salt * 0.7131, salt * 0.3917, salt * 0.1571) + uSeed * vec3(0.01231, 0.02173, 0.03119)));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float pkFix(float k, float base, float a, float b, float c, float d) {
  if (a == k || b == k || c == k || d == k) return k;
  if (a == base || b == base || c == base || d == base) return base;
  if (a == b || a == c || a == d) return a;
  if (b == c || b == d) return b;
  if (c == d) return c;
  return a;
}
vec3 pkOut(float k, vec2 uv) {
  vec3 c = k < 0.5 ? uC0 : (k < 1.5 ? uC1 : (k < 2.5 ? uC2 : uC3));
  float grid = max(pixelGrid(), 1.0);
  float t = bayer4(floor(uv * grid)) / 16.0 - 0.5;
  return c - vec3(t * (0.03 + uWear * 0.05));
}
`;

/**
 * Real 2:1 herringbone. Unit w = 4 art px (8 at grid 64, 16 at grid 128);
 * planks are 2w by w with 1px grout on their right and bottom edges. The
 * lattice is (w, w) and (4w, 0), so the 4w period divides the tile and the
 * zig-zag wraps on all sides. A fixed offset puts the wrap between two
 * plank-interior columns and rows, so planks cross every tile edge. Each plank
 * has a light top row, a flat body and a short 1px shadow: on the right end of
 * horizontal planks and the lower half of the right side of vertical ones.
 * About one plank in seven is a darker variant. From w = 8 some planks also get
 * one grain line. There's no interior hash.
 */
export const HERRINGBONE_PIXEL = `
float hbUnit(float P) {
  return P >= 128.0 ? 16.0 : (P >= 64.0 ? 8.0 : 4.0);
}
float hbCls(vec2 q, float P) {
  float w = hbUnit(P);
  vec2 off = vec2(1.0 + w, 2.0 + 2.0 * w);
  q = pkW(q + off, P);
  vec2 u = floor(q / w);
  vec2 l = q - u * w;
  float d = mod(u.x - u.y, 4.0);
  float K = P / w;
  bool horiz = d < 1.5;
  vec2 o;
  vec2 pin;
  vec2 size;
  if (horiz) {
    o = vec2(d > 0.5 ? u.x - 1.0 : u.x, u.y);
    pin = vec2((d > 0.5 ? w : 0.0) + l.x, l.y);
    size = vec2(2.0 * w, w);
  } else {
    o = vec2(u.x, d > 2.5 ? u.y : u.y - 1.0);
    pin = vec2(l.x, (d > 2.5 ? 0.0 : w) + l.y);
    size = vec2(w, 2.0 * w);
  }
  if (pin.x > size.x - 1.5 || pin.y > size.y - 1.5) return 0.0;
  vec2 pid = mod(o, K) + (horiz ? vec2(0.0) : vec2(0.5, 0.25));
  float v = pkH(pid, 4.0);
  float body = v < 0.14 ? 1.0 : 2.0;
  if (pin.y < 0.5) return 3.0;
  if (horiz) {
    if (pin.x > size.x - 2.5) return 1.0;
  } else {
    if (pin.x > size.x - 2.5 && pin.y > w - 0.5) return 1.0;
  }
  if (w >= 8.0 && body > 1.5) {
    float gy = 2.0 + floor(pkH(pid, 6.0) * (w - 4.0));
    float gx0 = 2.0 + floor(pkH(pid, 7.0) * (w - 2.0));
    if (pkH(pid, 8.0) < 0.5) {
      if (horiz && abs(pin.y - gy) < 0.5 && pin.x >= gx0 && pin.x < gx0 + w * 0.75) return 1.0;
      if (!horiz && abs(pin.x - gy + 1.0) < 0.5 && pin.y >= gx0 && pin.y < gx0 + w * 0.75) return 1.0;
    }
  }
  return body;
}
vec3 hbPixel(vec2 uv) {
  float P = pkP();
  vec2 q = pkQ(uv, P);
  float k = hbCls(q, P);
  k = pkFix(k, 2.0, hbCls(q - vec2(0.0, 1.0), P), hbCls(q + vec2(1.0, 0.0), P), hbCls(q + vec2(0.0, 1.0), P), hbCls(q - vec2(1.0, 0.0), P));
  return pkOut(k, uv);
}
`;

/**
 * Rubble: a wrapped power diagram on a jittered grid (cells of about 5 art px
 * at grid 16 and 32, 9 at 64 and 12 at 128), with random weights so stone sizes
 * vary. A pixel is mortar when its right, down or down-right neighbour belongs
 * to another stone, so two stones never share an edge (corners can meet) and
 * the joints stay 4-connected. Stones in the first cell row and column are
 * centred on the tile edge, so stones cross the wrap and the cut runs through
 * stone faces. Stones are flat fills with a 1px light top edge and a 1px shadow
 * on the bottom and right. About one stone in seven is darker.
 */
export const STONE_PIXEL = `
float rbK(float P) {
  // About 5 to 6 art px per stone at 16 and 32, and larger stones at 64 and 128.
  return P >= 128.0 ? 11.0 : (P >= 64.0 ? 7.0 : max(3.0, floor(P / 6.4 + 0.5)));
}
float rbId(vec2 q, float P) {
  q = pkW(q, P);
  float k = rbK(P);
  float cs = P / k;
  vec2 p = (q + 0.5) / cs;
  vec2 i = floor(p);
  float best = 1e9;
  float bid = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = i + vec2(float(x), float(y));
      vec2 cw = mod(g, k);
      vec2 o = vec2(0.25) + 0.5 * vec2(pkH(cw, 11.0), pkH(cw, 12.0));
      // Stones in the first cell row and column straddle the tile edge, so the
      // wrap line runs through stone faces, not along joints.
      if (cw.x < 0.5) o.x = (pkH(cw, 15.0) - 0.5) * 0.3;
      if (cw.y < 0.5) o.y = (pkH(cw, 16.0) - 0.5) * 0.3;
      vec2 r = (g + o - p) * cs;
      float wgt = pkH(cw, 13.0) * cs * cs * 0.4;
      float dd = dot(r, r) - wgt;
      if (dd < best) {
        best = dd;
        bid = cw.x + cw.y * k;
      }
    }
  }
  return bid;
}
bool rbJ(float a, float right, float down, float diag) {
  // Joint test. The diagonal keeps joints 4-connected where a joint runs up-right.
  return right != a || down != a || diag != a;
}
float rbCls(vec2 q, float P) {
  vec2 X = vec2(1.0, 0.0);
  vec2 Y = vec2(0.0, 1.0);
  float c = rbId(q, P);
  float r = rbId(q + X, P);
  float d = rbId(q + Y, P);
  float rd = rbId(q + X + Y, P);
  if (rbJ(c, r, d, rd)) return 0.0;
  float k = rbK(P);
  float dark = pkH(vec2(mod(c, k), floor(c / k)), 14.0) < 0.14 ? 1.0 : 0.0;
  // Light edge: the pixel above is a joint.
  float u = rbId(q - Y, P);
  float ur = rbId(q - Y + X, P);
  if (rbJ(u, ur, c, r)) return dark > 0.5 ? 2.0 : 3.0;
  // Shadow: the pixel below or to the right is a joint.
  bool sh = rbJ(d, rd, rbId(q + 2.0 * Y, P), rbId(q + 2.0 * Y + X, P)) ||
            rbJ(r, rbId(q + 2.0 * X, P), rd, rbId(q + 2.0 * X + Y, P));
  if (sh) return 1.0;
  return dark > 0.5 ? 1.0 : 2.0;
}
vec3 rbPixel(vec2 uv) {
  float P = pkP();
  vec2 q = pkQ(uv, P);
  float k = rbCls(q, P);
  // Joints are never recoloured, so stones can't end up sharing an edge.
  if (k > 0.5) k = pkFix(k, 0.0, rbCls(q - vec2(0.0, 1.0), P), rbCls(q + vec2(1.0, 0.0), P), rbCls(q + vec2(0.0, 1.0), P), rbCls(q - vec2(1.0, 0.0), P));
  return pkOut(k, uv);
}
`;

/**
 * Concrete: a flat slab (uC2) as negative space. Sparse 2 to 5 px aggregate
 * or stain clusters (2x2, L, T and short bar shapes) sit one per 4 px cell at
 * most, with a gap on the cell's right and bottom, so they never touch. Cell
 * rows are staggered, and the grid is offset so clusters cross the wrap. At 64
 * and 128 the cluster unit grows to 2 and 4 px, so the on-screen size holds.
 * Density follows a coarse wrapped field, so some areas stay bare. Most
 * clusters are stains (uC1) and a few are light aggregate (uC3). Most seeds
 * also get one 4-connected hairline crack (uC1, one step above near-black)
 * that may run across the wrap. At grid 16 it's a 3-4px nick.
 */
export const CONCRETE_PIXEL = `
float ccShape(float s, vec2 l) {
  if (s < 0.38) return (l.x < 1.5 && l.y < 1.5) ? 1.0 : 0.0;
  if (s < 0.62) return ((l.x < 1.5 && l.y < 0.5) || (l.x < 0.5 && l.y < 1.5)) ? 1.0 : 0.0;
  if (s < 0.74) return ((l.x < 2.5 && l.y < 0.5) || (l.x > 0.5 && l.x < 1.5 && l.y < 1.5)) ? 1.0 : 0.0;
  if (s < 0.86) return (l.x < 2.5 && l.y < 1.5 && !(l.x > 1.5 && l.y > 0.5)) ? 1.0 : 0.0;
  return (l.x < 1.5 && l.y < 0.5) ? 1.0 : 0.0;
}
float ccDens(vec2 c, float K) {
  vec2 p = (c + 0.5) * 4.0 / K;
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = pkH(mod(i, 4.0), 21.0);
  float b = pkH(mod(i + vec2(1.0, 0.0), 4.0), 21.0);
  float d = pkH(mod(i + vec2(0.0, 1.0), 4.0), 21.0);
  float e = pkH(mod(i + vec2(1.0, 1.0), 4.0), 21.0);
  return mix(mix(a, b, f.x), mix(d, e, f.x), f.y);
}
float ccWalk(float seg) {
  // Crack height after seg segments. Each segment moves by -1, 0 or +1 row
  // and the total stays within 3 rows of the start.
  float y = 0.0;
  for (int i = 0; i < 48; i++) {
    if (float(i) >= seg) break;
    float h = pkH(vec2(float(i), 5.0), 31.0);
    float dy = h < 0.3 ? -1.0 : (h > 0.7 ? 1.0 : 0.0);
    y = clamp(y + dy, -3.0, 3.0);
  }
  return y;
}
float ccCrack(vec2 q, float P) {
  if (pkH(vec2(1.0, 9.0), 30.0) < 0.25) return 0.0;
  // At 16 the crack is a 3-4px nick, so it doesn't mark the period in a 3x3.
  float L = P < 24.0 ? 3.0 + floor(pkH(vec2(2.0, 9.0), 30.0) * 2.0)
                     : floor(P * (0.4 + 0.3 * pkH(vec2(2.0, 9.0), 30.0)));
  float x0 = floor(pkH(vec2(3.0, 9.0), 30.0) * P);
  float y0 = 4.0 + floor(pkH(vec2(4.0, 9.0), 30.0) * (P - 8.0));
  float dx = mod(q.x - x0, P);
  if (dx > L - 0.5) return 0.0;
  float seg = 4.0;
  float a0 = ccWalk(floor(dx / seg));
  float a1 = dx > L - 1.5 ? a0 : ccWalk(floor((dx + 1.0) / seg));
  float dy = q.y - y0;
  return (dy >= min(a0, a1) - 0.5 && dy <= max(a0, a1) + 0.5) ? 1.0 : 0.0;
}
float ccCls(vec2 q, float P) {
  q = pkW(q, P);
  // The crack uses uC1, one step above the near-black uC0.
  if (ccCrack(q, P) > 0.5) return 1.0;
  // Cluster unit: 1 art px up to grid 32, 2 at 64, 4 at 128, so clusters
  // keep the same chunky size on screen.
  float u = P >= 128.0 ? 4.0 : (P >= 64.0 ? 2.0 : 1.0);
  float cs = 4.0 * u;
  float K = P / cs;
  vec2 off = (vec2(2.0, 1.0) + floor(vec2(pkH(vec2(7.0, 3.0), 22.0), pkH(vec2(8.0, 3.0), 22.0)) * 2.0)) * u;
  vec2 qq = pkW(q + off, P);
  // Stagger each cell row so clusters don't line up in columns.
  qq.x = mod(qq.x + floor(pkH(vec2(mod(floor(qq.y / cs), K), 1.0), 28.0) * cs), P);
  vec2 c = floor(qq / cs);
  vec2 l = floor((qq - c * cs) / u);
  float dens = ccDens(c, K);
  // Grid 32 shows the most cells at the 1px unit, so it gets a lower rate.
  float rate = P > 24.0 && P < 48.0 ? 0.75 : 1.0;
  if (pkH(c, 23.0) > (0.1 + 0.6 * dens * dens) * rate) return 2.0;
  vec2 o = floor(vec2(pkH(c, 24.0), pkH(c, 25.0)) * 2.0);
  vec2 ll = l - o;
  if (ll.x < -0.5 || ll.y < -0.5 || ll.x > 2.5 || ll.y > 2.5) return 2.0;
  // A few light aggregate flecks (2px) among the darker stains.
  bool light = pkH(c, 27.0) > 0.85;
  if (ccShape(light ? 0.99 : pkH(c, 26.0), ll) < 0.5) return 2.0;
  return light ? 3.0 : 1.0;
}
vec3 ccPixel(vec2 uv) {
  float P = pkP();
  vec2 q = pkQ(uv, P);
  float k = ccCls(q, P);
  k = pkFix(k, 2.0, ccCls(q - vec2(0.0, 1.0), P), ccCls(q + vec2(1.0, 0.0), P), ccCls(q + vec2(0.0, 1.0), P), ccCls(q - vec2(1.0, 0.0), P));
  return pkOut(k, uv);
}
`;

/**
 * Shallow water: a flat body (uC1) with 1px ripple lines (uC2). The lines are
 * the 8-connected inner boundary of wavy, mostly horizontal bands of a wrapped
 * value-noise field, so they come out 4-connected and join where bands pinch.
 * The lines are broken in places for flow. A uC0 drop shadow sits 2px below
 * each line. There's 1 short uC3 highlight at grid 16 and 2 from 32 up. With
 * motion on, the field drifts in whole pixels.
 */
export const WATER_PIXEL = `
float wtVN(vec2 q, vec2 cs, float P, float salt) {
  vec2 K = max(vec2(1.0), P / cs);
  vec2 p = q / cs;
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = pkH(mod(i, K), salt);
  float b = pkH(mod(i + vec2(1.0, 0.0), K), salt);
  float c = pkH(mod(i + vec2(0.0, 1.0), K), salt);
  float d = pkH(mod(i + vec2(1.0, 1.0), K), salt);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
bool wtIn(vec2 q, float P) {
  // Bands of a wavy, mostly horizontal field: P / 8 levels per tile (always
  // even, so parity wraps). Noise bends the bands until neighbours nearly meet.
  q = pkW(q, P);
  float ny = max(2.0, floor(P / 8.0));
  float n = wtVN(q + 0.5, vec2(min(16.0, P * 0.5), 8.0), P, 41.0) * 0.7 +
            wtVN(q + 0.5, vec2(8.0, 4.0), P, 42.0) * 0.3;
  // The +0.5 phase keeps band edges off the horizontal wrap row for most seeds.
  float level = floor(q.y * ny / P + 0.5 + 1.3 * (n - 0.5));
  return mod(level, 2.0) < 0.5;
}
bool wtLine(vec2 q, float P) {
  if (!wtIn(q, P)) return false;
  bool edge = !wtIn(q + vec2(1.0, 0.0), P) || !wtIn(q - vec2(1.0, 0.0), P) ||
              !wtIn(q + vec2(0.0, 1.0), P) || !wtIn(q - vec2(0.0, 1.0), P) ||
              !wtIn(q + vec2(1.0, 1.0), P) || !wtIn(q - vec2(1.0, 1.0), P) ||
              !wtIn(q + vec2(1.0, -1.0), P) || !wtIn(q + vec2(-1.0, 1.0), P);
  if (!edge) return false;
  // Break blocks are offset from the tile edge so no break starts on the wrap.
  vec2 b = floor(pkW(q + vec2(2.0, 1.0), P) / vec2(4.0, 2.0));
  return pkH(mod(b, vec2(P / 4.0, P / 2.0)), 43.0) > 0.3;
}
float wtCls(vec2 q, vec2 drift, float P) {
  q = pkW(q, P);
  float n = P < 24.0 ? 1.0 : 2.0;
  for (int i = 0; i < 3; i++) {
    if (float(i) < n) {
      float len = P < 24.0 ? 2.0 : 2.0 + floor(pkH(vec2(float(i), 4.0), 44.0) * 2.0);
      // Keep each highlight inside the tile so none of them ends on the wrap.
      vec2 h = vec2(1.0, 1.0) + floor(vec2(pkH(vec2(float(i), 2.0), 44.0) * (P - len - 1.0),
                                           pkH(vec2(float(i), 3.0), 44.0) * (P - 2.0)));
      vec2 d = mod(q - h, P);
      if (d.y < 0.5 && d.x < len - 0.5) return 3.0;
    }
  }
  vec2 m = q + drift;
  if (wtLine(m, P)) return 2.0;
  if (wtLine(m - vec2(0.0, 2.0), P) && !wtLine(m - vec2(0.0, 1.0), P)) return 0.0;
  return 1.0;
}
vec3 wtPixel(vec2 uv) {
  float P = pkP();
  vec2 q = pkQ(uv, P);
  // Motion drifts the ripples in whole pixels. Highlights stay put.
  vec2 dr = floor(vec2(uTime * 2.0, uTime * 1.0));
  float k = wtCls(q, dr, P);
  k = pkFix(k, 1.0, wtCls(q - vec2(0.0, 1.0), dr, P), wtCls(q + vec2(1.0, 0.0), dr, P),
            wtCls(q + vec2(0.0, 1.0), dr, P), wtCls(q - vec2(1.0, 0.0), dr, P));
  return pkOut(k, uv);
}
`;
