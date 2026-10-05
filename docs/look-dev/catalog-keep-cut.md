# Catalog keep / cut / needs-ref — first pass

Owner: Swatch (Look-dev / Visual Director). Partner: Tessera (Technical Artist).
Repo tip at review: `main` @ `1cc892cdf4c99ec71cc5a368807a8faf0104bc12`.
Bond Cut A landed via PR #2 (`fa6a992`): buttered, subway, and mosaic are keep-via-ref.
Ground Cut A landed via PR #10 (`04a9f20`): dirt, mud, and ash are keep-via-ref. Peat and snow are keep-via-ref after PRs #12/#14 / tip `4530f7d`. erosion is keep-via-ref after Ground Cut B / tip `7d2044f`. asphalt stays needs-ref.
Scope: catalog + looks only — **no new shaders**.

## Four looks

| id | label | value |
| --- | --- | --- |
| `pixel` | Pixel art | 0 |
| `painted` | Painted | 1 |
| `real` | Hyper real | 2 |
| `poster` | Poster | 3 |

Live look shots in `screenshots/look-{pixel,painted,real,poster}.png`.

## Palettes

`style` (per-style colors), `mortar`, `kiln`, `moss`, `sea`, `ember`, `ink`, `copper`, `bone`.

## Verdict legend

- **keep** — stays in catalog; judge mapping exists (screenshot optional polish).
- **needs-ref** — stays for now; add `JUDGE_REFS` (and ideally a screenshot) before calling Show done.
- **cut** — removed from the catalog. Justin GO via Umbra (executed by Swatch / Look-dev) applied the held Signal FX + hazard cuts; none remain pending.

## Counts: keep=42 · needs-ref=33 · cut=0 · total=75

Justin GO via Umbra executed. The 10 cut style ids are gone from `STYLES`. The empty Signal category chip went with them. Fiber `dark-panels`, judge RefDef `panels`, and `public/judge/panels.jpg` stay. Pixel-look Bayer / ordered dither in `glsl.ts` stays.

## Table

| Verdict | Category | Id | Name | Judge ref | Screenshot | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| keep | Reviewed | `brick` | Running Bond | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Reviewed | `stone` | Rubble | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Reviewed | `metal` | Rivet Panel | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Reviewed | `wood` | Plank Grain | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Fiber | `sawn-oak` | Sawn Oak | yes | yes | Judge-mapped core surface; live screenshot on file |
| keep | Fiber | `toon-plank` | Toon Plank | yes | yes | Judge-mapped core surface; live screenshot on file |
| keep | Fiber | `knot-comic` | Knot Comic | yes | yes | Judge-mapped core surface; live screenshot on file |
| keep | Fiber | `crack-comic` | Crack Comic | yes | yes | Judge-mapped core surface; live screenshot on file |
| keep | Fiber | `dark-panels` | Dark Panels | yes | yes | Judge-mapped core surface; live screenshot on file |
| keep | Reviewed | `grass` | Turf | yes | no | Judge-mapped core surface; add screenshot when convenient |
| needs-ref | Reviewed | `checkerboard` | Checker | no | no | Reviewed cookbook style but missing JUDGE_REFS entry |
| keep | Reviewed | `water` | Shallow Water | yes | no | Judge-mapped core surface; add screenshot when convenient |
| needs-ref | Reviewed | `lava` | Magma | no | no | Reviewed cookbook style but missing JUDGE_REFS entry |
| keep | Reviewed | `sand` | Dry Sand | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Bond | `buttered` | Buttered Grout | yes | no | Maps via brick RefDef (`styles[]` includes buttered) after PR #2 / tip `fa6a992` |
| keep | Bond | `herringbone` | Herringbone | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Bond | `basket` | Basket Weave | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Bond | `subway` | Subway Tile | yes | no | New subway RefDef + `public/judge/subway.jpg` on main |
| keep | Bond | `chevron` | Chevron | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Bond | `diamond` | Diamond Tile | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Bond | `mosaic` | Tessera | yes | no | New mosaic RefDef + `public/judge/mosaic.jpg` on main |
| keep | Bond | `cobble` | Cobble | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Bond | `hex-bond` | Hex Bond | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Bond | `honeycomb` | Honeycomb | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Ground | `dirt` | Packed Dirt | yes | no | New dirt RefDef + `public/judge/dirt.jpg` after PR #10 / tip `04a9f20` |
| keep | Ground | `gravel` | Gravel | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Ground | `mud` | Wet Mud | yes | no | New mud RefDef + `public/judge/mud.jpg` after PR #10 / tip `04a9f20` |
| keep | Ground | `snow` | Snow Field | yes | no | New snow RefDef + `public/judge/snow.jpg` after PRs #12/#14 / tip `4530f7d` |
| keep | Ground | `ash` | Ash | yes | no | New ash RefDef + `public/judge/ash.jpg` after PR #10 / tip `04a9f20` |
| keep | Ground | `clay` | Raw Clay | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Ground | `peat` | Peat | yes | no | New peat RefDef + `public/judge/peat.jpg` after PRs #12/#14 / tip `4530f7d` |
| keep | Ground | `moss` | Moss Clumps | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Ground | `granite` | Granite | yes | no | Judge-mapped core surface; add screenshot when convenient |
| needs-ref | Ground | `asphalt` | Asphalt | no | no | In catalog; no judge ref and no style screenshot yet |
| keep | Ground | `erosion` | Strata | yes | no | New erosion RefDef + `public/judge/erosion.jpg` after Ground Cut B (PR #17) / tip `7d2044f` |
| needs-ref | Built | `concrete` | Concrete | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Built | `stucco` | Stucco | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Built | `cinder` | Cinder Block | no | no | In catalog; no judge ref and no style screenshot yet |
| keep | Built | `shingle` | Shingles | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Built | `pantile` | Pantile | yes | no | Judge-mapped core surface; add screenshot when convenient |
| needs-ref | Built | `plaster` | Cracked Plaster | no | no | In catalog; no judge ref and no style screenshot yet |
| keep | Built | `terrazzo` | Terrazzo | yes | no | Judge-mapped core surface; add screenshot when convenient |
| keep | Built | `slate` | Slate | yes | no | Judge-mapped core surface; add screenshot when convenient |
| needs-ref | Built | `rebar` | Rebar Grid | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Built | `ceramic` | Glazed Tile | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Fiber | `canvas` | Canvas | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Fiber | `linen` | Linen | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Fiber | `knit` | Knit | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Fiber | `quilt` | Quilt | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Fiber | `thatch` | Thatch | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Fiber | `denim` | Denim | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Fiber | `corduroy` | Corduroy | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Fiber | `burlap` | Burlap | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Fiber | `reed` | Woven Reed | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Fiber | `paper` | Laid Paper | no | no | In catalog; no judge ref and no style screenshot yet |
| keep | Metal | `brushed` | Brushed Steel | yes | no | Judge-mapped core surface; add screenshot when convenient |
| needs-ref | Metal | `rust` | Rust | no | no | In catalog; no judge ref and no style screenshot yet |
| keep | Metal | `tread` | Diamond Plate | yes | no | Judge-mapped core surface; add screenshot when convenient |
| needs-ref | Metal | `carbon` | Carbon Twill | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Metal | `copper` | Copper Sheet | no | no | In catalog; no judge ref and no style screenshot yet |
| keep | Metal | `vent` | Vent | yes | no | Judge-mapped core surface; add screenshot when convenient |
| needs-ref | Metal | `gold` | Gold Leaf | no | no | In catalog; no judge ref and no style screenshot yet |
| keep | Metal | `anodized` | Anodized | yes | no | Judge-mapped core surface; add screenshot when convenient |
| needs-ref | Metal | `chainmail` | Chainmail | no | no | In catalog; no judge ref and no style screenshot yet |
| keep | Nature | `bark` | Bark | yes | no | Judge-mapped core surface; add screenshot when convenient |
| needs-ref | Nature | `marble` | Marble | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Nature | `ice` | Ice | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Nature | `leather` | Leather | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Nature | `cloud` | Cloud Deck | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Nature | `coral` | Coral | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Nature | `scales` | Scales | no | no | In catalog; no judge ref and no style screenshot yet |
| keep | Nature | `cork` | Cork | yes | no | Judge-mapped core surface; add screenshot when convenient |
| needs-ref | Nature | `bamboo` | Bamboo | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Nature | `foam` | Sea Foam | no | no | In catalog; no judge ref and no style screenshot yet |
| needs-ref | Nature | `obsidian` | Obsidian | no | no | In catalog; no judge ref and no style screenshot yet |

## Removed (Justin GO)

Justin GO via Umbra executed. These 10 ids are no longer in the mill catalog (not pending cut):

| Status | Category | Id | Name | Reason |
| --- | --- | --- | --- | --- |
| removed | Metal | `hazard` | Hazard | Decorative stripe motif, not a tile material for the mill |
| removed | Signal | `circuit` | Circuit | Signal/FX filter, not a material surface for the tile mill catalog |
| removed | Signal | `panel` | Sci Panel | Signal/FX filter, not a material surface for the tile mill catalog |
| removed | Signal | `dither` | Ordered Dither | Signal/FX filter, not a material surface for the tile mill catalog. Catalog style only — pixel-look Bayer in `glsl.ts` is unchanged |
| removed | Signal | `plasma` | Plasma | Signal/FX filter, not a material surface for the tile mill catalog |
| removed | Signal | `film` | Film Grain | Signal/FX filter, not a material surface for the tile mill catalog |
| removed | Signal | `hatch` | Crosshatch | Signal/FX filter, not a material surface for the tile mill catalog |
| removed | Signal | `oil` | Oil Slick | Signal/FX filter, not a material surface for the tile mill catalog |
| removed | Signal | `static` | Static | Signal/FX filter, not a material surface for the tile mill catalog |
| removed | Signal | `phosphor` | Phosphor | Signal/FX filter, not a material surface for the tile mill catalog |

Preserved on purpose: Fiber style `dark-panels`, judge RefDef id `panels`, `public/judge/panels.jpg`, and dark-panels screenshots.

## Priority needs-ref (Tessera tech view, after cuts)

Tessera signed off the 10-cut list and the original 33 keep. Bond Cut A (PR #2) moved buttered, subway, and mosaic to keep. Ground Cut A (PR #10) moved dirt, mud, and ash to keep. Peat and snow are keep-via-ref after PRs #12/#14 / tip `4530f7d`. erosion is keep-via-ref after Ground Cut B / tip `7d2044f` (42 keep / 33 needs-ref). Remaining Ground needs-ref is asphalt. Ordered priority for the remaining needs-ref work:

1. Ground: asphalt
2. Built: concrete, stucco, plaster, cinder, ceramic, rebar
3. Metal leftovers: rust, carbon, copper, gold, chainmail
4. Nature / Fiber / Reviewed (checkerboard, lava) after that

## Next

1. Tessera: judge scoring / PBR untouched this pass.
2. Swatch: Justin GO via Umbra executed — the 10 cuts are applied in this draft. Priority needs-ref list is unchanged and still open.
3. Lens may borrow later for proof — not this PR.
4. Console palettes landed in mill `PALETTES`: `pico8`, `gameboy`, `nes` (see `console-palettes.md`). `style` stays the default.
5. Public PNG hosting plan: [public-publish-png-plan.md](./public-publish-png-plan.md). Docs only — no catalog row changes.

---
Work: 2026-10-05T09:05:00-04:00 | agent=Swatch | role=Look-dev / Visual Director | where=Shoozes/mountain-cabin-bloom-honey | what=first catalog keep/cut/needs-ref pass
Work: 2026-10-05T13:15:00Z | agent=docs | where=Shoozes/mountain-cabin-bloom-honey | what=Bond Cut A keep-via-ref (buttered, subway, mosaic) after PR #2 `fa6a992`; tip `1cc892c`
Work: 2026-10-05T16:46:00Z | agent=Swatch | role=Look-dev / Visual Director | where=Shoozes/mountain-cabin-bloom-honey | what=Justin GO via Umbra executed: removed hazard, circuit, panel, dither, plasma, film, hatch, oil, static, phosphor; counts keep=36 needs-ref=39 cut=0 total=75
Work: 2026-10-05T17:30:00Z | agent=docs | where=Shoozes/mountain-cabin-bloom-honey | what=Ground Cut A keep-via-ref (dirt, mud, ash) after PR #10 `04a9f20`; peat and snow stay needs-ref; counts keep=39 needs-ref=36 cut=0 total=75
Work: 2026-10-05T20:45:00Z | agent=docs | where=Shoozes/mountain-cabin-bloom-honey | what=keep-via-ref peat and snow after PRs #12/#14 / tip `4530f7d`; asphalt and erosion stay needs-ref; counts keep=41 needs-ref=34 cut=0 total=75
Work: 2026-10-05T21:10:00Z | agent=docs | where=Shoozes/mountain-cabin-bloom-honey | what=keep-via-ref erosion after Ground Cut B / tip `7d2044f`; asphalt stays needs-ref; counts keep=42 needs-ref=33 cut=0 total=75
