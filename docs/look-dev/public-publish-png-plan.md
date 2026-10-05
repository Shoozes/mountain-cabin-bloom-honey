# Public publish / PNG hosting plan

Status: **draft plan**. P0 bake follow-up adds `scripts/bake-corpus.mjs`, the committed PNGs, and `public/textures/manifest.json`. Still no CI bake, no catalog edits, and no bake step inside `npm run build`.

| | |
| --- | --- |
| Repo | [Shoozes/mountain-cabin-bloom-honey](https://github.com/Shoozes/mountain-cabin-bloom-honey) (`visibility: public`) |
| Tip | `3a6ea14` — catalog cuts landed |
| Unlock | Justin GO via Umbra: public publish / PNG path is allowed after those cuts |
| Catalog | 75 styles in `STYLES`: **keep=36**, **needs-ref=39**, **cut=0** (see `catalog-keep-cut.md`) |
| This PR | Plan only. Browse and in-browser export stay as they are. |

Owner split: Swatch signs what is public. Tessera bakes. Keystone merges. Frame smokes browse. Justin GO only if a hosting choice would break browse or export.

## 1. Goal

A **public PNG corpus** is a set of static files a browser, bot, or later CLI can fetch by URL. Same bytes every time. Named so a Grok Bot showcase can point at one tile without opening the mill.

That is not what the mill does today. Export is **client-side only**: the page draws a tile and downloads a file to the visitor’s machine. Nothing is hosted. Nothing is stable across seeds, looks, or sizes unless the visitor matches the defaults below.

The corpus is the hosted copy of that export, for the keep list, at one locked recipe. In-browser Save / atlas / ZIP stay. They are the reference implementation the bake must match.

Out of scope here: new shaders, catalog deletes, SEAM/MATCH edits, a fetch API.

## 2. Current state

- **Save** (`exportPng` in `src/components/mill-app.tsx`) — one PNG. Filename `grout-{id}-s{seed}-{pixels|"smooth"}.png`. This filename is **not** the corpus path (see §3).
- **2×2 atlas** — four seeds (`seed`, `+11`, `+29`, `+47`) in one PNG. Not part of the corpus unless Swatch asks later.
- **PNG catalog** — ZIP of every current `STYLES` row via `zipStore` (`src/shader/zip-store.ts`). Entry name `{category}/{id}.png` with `category` lowercased (`Reviewed` → `reviewed`). Archive name `grout-catalog-{pixels|"smooth"}-{look}.zip`.
- Export pixel sizes: **32 / 64 / 128 / 256 / 512**. Default `exportSize` is **256**.
- Looks: `pixel` (0), `painted` (1), `real` (2), `poster` (3). Default look is `pixel`. Switching to a non-pixel look sets the chunk grid `pixels` to **0** (smooth). Pixel look keeps the chunk grid (default **32**).
- Draw defaults the bake must lock (`INITIAL` + the export override): seed **1204**, scale **1**, wear **0.35**, palette **`style`**, time **0**, **`repeat: 1`** (export forces this; the on-screen repeat control defaults to 2 and must not leak into the PNG).
- Palettes include console ramps `pico8`, `gameboy`, `nes` (`console-palettes.md`). `style` stays the corpus default.
- Deploy target is Vercel (`vite build`, nitro preset `vercel`). `public/` is copied to the site root. **`package.json` has no `homepage`.** `"private": true` only blocks npm publish; it is not the GitHub visibility flag.
- Repo is already public. Cuts at `3a6ea14` removed the 10 Signal/FX + `hazard` rows. Do not publish those ids.

## 3. Phased rollout

### Path (pick)

**PNG tree:** `public/textures/{look}/{category}/{id}.png`

Example: `public/textures/pixel/bond/subway.png` → deployed URL path `/textures/pixel/bond/subway.png`.

Why this and not a flat `public/corpus/` dump:

- The last two segments **are** the PNG-catalog ZIP entry (`{category}/{id}.png` in `exportCatalog`). A bake can write the file and drop the same relative name into the ZIP.
- `{look}` is the dimension the ZIP currently stores only in the archive filename. One tree can hold pixel and the other three looks without name clashes.
- `public/judge/` already holds reference photos. A sibling `textures/` does not collide with it.
- While the only published size is 256, **size stays out of the path**. Record it in the manifest. A later second size gets its own segment (`.../{size}/...`) instead of overwriting 256.

**ZIP + index sibling (not the PNG path):** `public/corpus/`. Bulk ZIPs and, if Frame adds one, a browse page. Individual tiles stay under `textures/`.

### Locked P0 recipe

| Field | Value | Why |
| --- | --- | --- |
| look | `pixel` | Mill default. Show preference for the first public set. |
| chunk grid `pixels` | `32` | Mill default on the pixel look. Not smooth. |
| `exportSize` | `256` | Mill default. Large enough for a showcase crop, small enough to commit. |
| palette | `style` | Mill default. Console ramps are a separate hero set (§3 showcase). |
| seed | `1204` | `INITIAL.seed`. Changing it is a new corpus version, not a silent overwrite. |
| scale / wear / time / repeat | `1` / `0.35` / `0` / `1` | Matches `paramsFor` + the export `repeat: 1` override. |

Bake must use the same draw as Save / PNG catalog: `ShaderMill.drawUtil` on a square canvas of `exportSize`, `repeat` forced to 1, `time` 0. Do not bake during `vite build`. Vercel has no WebGL step. A local or CI Playwright run (Chromium is already a devDependency) writes the files **before** deploy.

Bake script: `scripts/bake-corpus.mjs` (`npm run bake:corpus`). It reads the P0 list below, writes PNGs, and writes `public/textures/manifest.json`. `sourceTip` is `git rev-parse origin/main` at bake time. Re-run after a shader or recipe change and commit the PNGs. It is not part of `npm run build`.

Manifest (one object per file):

```json
{
  "format": "grout-corpus/1",
  "sourceTip": "3a6ea14",
  "files": [
    {
      "id": "subway",
      "name": "Subway Tile",
      "category": "Bond",
      "look": "pixel",
      "pixels": 32,
      "exportSize": 256,
      "palette": "style",
      "seed": 1204,
      "scale": 1,
      "wear": 0.35,
      "repeat": 1,
      "path": "textures/pixel/bond/subway.png"
    }
  ]
}
```

`path` is relative to `public/` (the URL path without the leading slash).

### P0 — Showcase bake

**36 keep styles × pixel × 256 × palette `style`.** 36 PNGs. Needs-ref ids are not in this list.

| Category | Id | Name | Output |
| --- | --- | --- | --- |
| Reviewed | `brick` | Running Bond | `public/textures/pixel/reviewed/brick.png` |
| Reviewed | `stone` | Rubble | `public/textures/pixel/reviewed/stone.png` |
| Reviewed | `metal` | Rivet Panel | `public/textures/pixel/reviewed/metal.png` |
| Reviewed | `wood` | Plank Grain | `public/textures/pixel/reviewed/wood.png` |
| Reviewed | `grass` | Turf | `public/textures/pixel/reviewed/grass.png` |
| Reviewed | `water` | Shallow Water | `public/textures/pixel/reviewed/water.png` |
| Reviewed | `sand` | Dry Sand | `public/textures/pixel/reviewed/sand.png` |
| Fiber | `sawn-oak` | Sawn Oak | `public/textures/pixel/fiber/sawn-oak.png` |
| Fiber | `toon-plank` | Toon Plank | `public/textures/pixel/fiber/toon-plank.png` |
| Fiber | `knot-comic` | Knot Comic | `public/textures/pixel/fiber/knot-comic.png` |
| Fiber | `crack-comic` | Crack Comic | `public/textures/pixel/fiber/crack-comic.png` |
| Fiber | `dark-panels` | Dark Panels | `public/textures/pixel/fiber/dark-panels.png` |
| Bond | `buttered` | Buttered Grout | `public/textures/pixel/bond/buttered.png` |
| Bond | `herringbone` | Herringbone | `public/textures/pixel/bond/herringbone.png` |
| Bond | `basket` | Basket Weave | `public/textures/pixel/bond/basket.png` |
| Bond | `subway` | Subway Tile | `public/textures/pixel/bond/subway.png` |
| Bond | `chevron` | Chevron | `public/textures/pixel/bond/chevron.png` |
| Bond | `diamond` | Diamond Tile | `public/textures/pixel/bond/diamond.png` |
| Bond | `mosaic` | Tessera | `public/textures/pixel/bond/mosaic.png` |
| Bond | `cobble` | Cobble | `public/textures/pixel/bond/cobble.png` |
| Bond | `hex-bond` | Hex Bond | `public/textures/pixel/bond/hex-bond.png` |
| Bond | `honeycomb` | Honeycomb | `public/textures/pixel/bond/honeycomb.png` |
| Ground | `gravel` | Gravel | `public/textures/pixel/ground/gravel.png` |
| Ground | `clay` | Raw Clay | `public/textures/pixel/ground/clay.png` |
| Ground | `moss` | Moss Clumps | `public/textures/pixel/ground/moss.png` |
| Ground | `granite` | Granite | `public/textures/pixel/ground/granite.png` |
| Built | `shingle` | Shingles | `public/textures/pixel/built/shingle.png` |
| Built | `pantile` | Pantile | `public/textures/pixel/built/pantile.png` |
| Built | `terrazzo` | Terrazzo | `public/textures/pixel/built/terrazzo.png` |
| Built | `slate` | Slate | `public/textures/pixel/built/slate.png` |
| Metal | `brushed` | Brushed Steel | `public/textures/pixel/metal/brushed.png` |
| Metal | `tread` | Diamond Plate | `public/textures/pixel/metal/tread.png` |
| Metal | `vent` | Vent | `public/textures/pixel/metal/vent.png` |
| Metal | `anodized` | Anodized | `public/textures/pixel/metal/anodized.png` |
| Nature | `bark` | Bark | `public/textures/pixel/nature/bark.png` |
| Nature | `cork` | Cork | `public/textures/pixel/nature/cork.png` |

**Optional look strip (4 looks) — keep heroes only.** Pixel files already come from the table above. Add `painted`, `real`, and `poster` for these four. Non-pixel looks use chunk grid `pixels: 0` (same as the look toggle). Palette stays `style`. Size stays 256. That is **12 extra PNGs**.

| Id | Category | Extra paths |
| --- | --- | --- |
| `brick` | Reviewed | `public/textures/{painted,real,poster}/reviewed/brick.png` |
| `stone` | Reviewed | `public/textures/{painted,real,poster}/reviewed/stone.png` |
| `subway` | Bond | `public/textures/{painted,real,poster}/bond/subway.png` |
| `mosaic` | Bond | `public/textures/{painted,real,poster}/bond/mosaic.png` |

**Held — do not bake in P0.** These were the other hero examples, and they are **needs-ref**. They are not “done” tiles. Swatch Show has to pass before any of them is published (P2):

| Id | Category | Blocker |
| --- | --- | --- |
| `dirt` | Ground | needs-ref |
| `concrete` | Built | needs-ref |
| `rust` | Metal | needs-ref |
| `ice` | Nature | needs-ref |

**Showcase stills (Grok Bot), optional, not the fetch corpus.** Pixel look, 256, seed 1204, but palette `pico8` / `gameboy` / `nes` on the four keep heroes only (12 PNGs). Separate tree so they do not overwrite palette `style`:

`public/showcase/{palette}/{category}/{id}.png`

Example: `public/showcase/pico8/bond/subway.png`.

Swatch picks which of those 12 are the actual hero shots. Prefer pixel + a console ramp over hyper-real for the bot card.

P0 ZIP (optional, same bytes as the 36): `public/corpus/grout-catalog-32-pixel.zip`. Entries are `{category}/{id}.png` only (the keep rows). That matches a PNG-catalog download taken on pixel / 32 / 256 / `style`, filtered to keep.

### P1 — Full keep corpus

All **36 keep** styles × **4 looks** × primary size **256**. **144 PNGs.** Palette `style`. Same locked seed / scale / wear / repeat.

| Look | Chunk grid | Files | ZIP name | ZIP entries |
| --- | --- | --- | --- | --- |
| `pixel` | 32 | `public/textures/pixel/{category}/{id}.png` | `grout-catalog-32-pixel.zip` | `{category}/{id}.png` |
| `painted` | 0 (smooth) | `public/textures/painted/{category}/{id}.png` | `grout-catalog-smooth-painted.zip` | `{category}/{id}.png` |
| `real` | 0 (smooth) | `public/textures/real/{category}/{id}.png` | `grout-catalog-smooth-real.zip` | `{category}/{id}.png` |
| `poster` | 0 (smooth) | `public/textures/poster/{category}/{id}.png` | `grout-catalog-smooth-poster.zip` | `{category}/{id}.png` |

ZIP names match `grout-catalog-${pixels || "smooth"}-${look}.zip`. Put the four archives in `public/corpus/`. Do not put look or size inside the ZIP entry; the archive name carries both, same as the button.

Other export sizes (32, 64, 128, 512) wait. Do not add a size segment until a second size is actually published.

### P2 — needs-ref stays unpublished

39 needs-ref styles stay in the mill catalog. They are **not** in `public/textures/` and not in the public ZIPs until:

1. Tessera lands the judge ref for that id.
2. Swatch Show marks it keep (or an explicit “publish this needs-ref anyway”).

Do not label a needs-ref PNG as a finished corpus tile. Ground tranche first (`dirt`, `mud`, `ash`, `peat`, `snow`, then `asphalt`, `erosion`) per the priority list in `catalog-keep-cut.md`. Publishing a needs-ref id is a follow-up that edits the keep list, not a silent bake.

### P3 — Hosting

- **P0/P1 bytes:** static files under `public/`, served by the deployed app. No third-party CDN.
- **URL shape:** `https://<deployed-host>/textures/pixel/bond/subway.png`. Host is whatever Vercel assigns. Do not hard-code it in the app. Do not set `package.json` `homepage` until that host is the one we mean to keep.
- **P0 bytes in git** (Justin via Umbra / Keystone): commit the 36 keep PNGs, the look strip, and the manifest. 256² PNGs are small. The deploy then serves them with no bake on Vercel. P1 (144) can follow the same way if the diff stays modest; if it doesn’t, P1 ZIPs go to a **GitHub Release** and the per-tile PNGs stay in `public/textures/`.
- **Do not** generate textures inside `npm run build`.
- Raw GitHub URLs (`raw.githubusercontent.com/.../public/textures/...`) work only because the repo is public and only for a pinned commit. The durable link is the deployed path, not a raw URL.
- Atlas button output is not hosted.

### P4 — Fetch surface (later, not this work)

A CLI, HTTP route, or MCP tool that returns either the PNG or the GLSL recipe (`grout-shader/1` from `recipeText` / `glslText` in `src/shader/recipe.ts`). Tessera and Keystone. It should read `manifest.json` and the `textures/` tree, not re-implement export. No route, no MCP server, no CLI in the plan PR.

## 4. Bake ownership

| Who | Does |
| --- | --- |
| Swatch | Signs the P0 list (the table above) and any showcase palette shots. Show PASS before a needs-ref id is added. |
| Tessera | `scripts/bake-corpus.mjs` (later PR). Headless draw, writes `public/textures/**` + `manifest.json`, optional `public/corpus/*.zip`. Recipe locked to §3. |
| Frame | Once URLs exist, smoke that `/textures/pixel/...` returns a PNG and that the mill’s own browse / Save / PNG catalog still work. A `/corpus` index page is optional; smoke it only if it exists. |
| Keystone | Merges the bake PR. Does not widen the public set. |
| Justin GO via Umbra | Only if the hosting choice would break browse or export, or if we drop the “commit the PNGs” assumption (§6). |

## 5. Safety / Courtesy / Show

- This plan does not delete catalog rows, edit shaders, or touch SEAM/MATCH.
- In-browser Save, 2×2 atlas, and PNG catalog keep working. Hosted files are an extra copy.
- Do not publish removed ids (`hazard`, `circuit`, `panel`, `dither`, `plasma`, `film`, `hatch`, `oil`, `static`, `phosphor`). Pixel-look Bayer in `glsl.ts` stays; that is not the cut style `dither`.
- `dark-panels`, judge ref `panels`, and `public/judge/panels.jpg` stay where they are. Do not move judge photos into `textures/`.
- Show for Grok Bot hero shots: **pixel look + a console palette** (`pico8`, `gameboy`, or `nes`) on the keep heroes. Corpus default palette remains `style`.

## 6. Open questions

For Umbra / Justin only if the working assumption is wrong. Tessera can start the P0 script against §3 without these answered.

1. **Public URL branding.** Is the Vercel host the public name, or do we want a stable custom host before anyone links the corpus? `homepage` stays unset until then.
2. **Git vs artifact.** Decided (Justin via Umbra / Keystone): commit the P0 PNGs into git. Not Release-only.
3. **License blurb** for redistributed PNGs. The repo has no root `LICENSE`. Public visibility is not a texture license. Do not add one in the bake PR until this is decided. Host branding (question 1) stays open.

## 7. Immediate next steps

After this doc merges:

1. **Swatch + Tessera — Ground needs-ref tranche.** Refs for `dirt`, `mud`, `ash`, `peat`, `snow` (then `asphalt`, `erosion`). No public PNGs for those ids until Show.
2. **Tessera — P0 bake.** `npm run bake:corpus` writes the 36 keep pixel PNGs, the 12-file look strip, and `public/textures/manifest.json`. Showcase palettes and the ZIP stay follow-ups.
3. **Frame — smoke the corpus** once those URLs exist (PNG bytes at `/textures/pixel/bond/subway.png`, mill browse and export still intact).

---
Work: 2026-10-05T17:05:00Z | agent=docs | where=Shoozes/mountain-cabin-bloom-honey | what=public publish / PNG hosting plan at tip `3a6ea14` (Justin GO unlock; keep=36)
