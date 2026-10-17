# Texture tools, ownership and next work

The texture mill owns material recipes, previews and baking. Grout13 owns small
indexed atlas delivery; its compiler is still generated from Grout-Library.
GaimEngine owns ordinary material admission/rendering. Games own composition,
art approval and restricted purchased inputs. These repositories remain separate.

| Capability / source | Input → output | Dependency and evidence | Decision / limitation |
| --- | --- | --- | --- |
| Catalog (`src/shader/catalog.ts`, `glsl.ts`) | GLSL + palette/seed → color PNG/recipe | WebGL, existing Chromium corpus baker | Reuse now for color studies; existing artwork unapproved, no coherent PBR channels |
| Seam/judge (`seam.ts`, `judge.ts`) | RGBA → wrap/feature scores | Node; 15 focused tests pass | Reuse now for technical rejection; scores cannot approve artwork |
| Cliff material (`material.mjs`) | Seeded structure + pigment palette → four matched channels | Shared browser/Node implementation; deterministic/wrap/cancellation tests | `hd2d-cliff-strata` is additive; legacy `hd2d-cliff` channel hashes remain pinned; visual approval pending |
| [Realistic surfaces](realistic-materials.md) (`material-realistic.mjs`) | Six original continuous material recipes → albedo/height/+Y normal/roughness | Shared browser/Node fields, smooth repeats and neutral lit authoring preview | Additive `realistic-surface/1`; previous recipes preserved; procedural candidates remain unapproved |
| Environment authoring (`environment.mjs`, `bake-environment.mjs`) | Original or bounded Radiance HDR → portable diffuse/specular cube buffers | Offline Node bake; full local tests and lint pass | Preparation delivered for GaimEngine receiving; engine/material qualification and visual approval remain separate |
| Vertex-color bake (`vertex-colors.mjs`, `bake-vertex-colors.mjs`) | Generated albedo + authored mesh UVs → linear RGB vertex colors | Offline Node bake; deterministic sampling and cache tests | Preparation delivered for GaimEngine receiving; mesh/art approval remains separate |
| Existing exports (`recipe.ts`, `zip-store.ts`) | Recipe/pixels → JSON/PNG/ZIP | Browser canvas and existing ZIP encoder | Reuse now; preserve legacy format and explicit review status |
| Grout-Library variation/palettes | Pixel steps/seed → authored variations | Parent code is source-confirmed; no new runtime adoption | Needs focused qualification against a real pixel asset; not a material-map generator |
| Grout-Library conversion/layers | Images or recipes → exact reviewed pixels | Parent's existing tests; provenance must be independently clear | Needs focused qualification; automatic grouping does not infer material semantics |
| Grout13 compiler/runtime | Pixel recipes → indexed atlas + small decoder | Published artifact smoke passes | Reuse for pixel assets; defer use for normal/roughness maps until fidelity/size justify it |

## Priorities

Current local findings, verification and the selected next pass are maintained
in [our TODO](../TODO.md). Dated receipts below retain their historical scope; paths under `.artifacts`
and sibling repositories refer to locally retained evidence, not published links.
The current [portable closeout record](closeout-20261011.json) includes checked
source hashes, commands and dev/Pages browser summaries.

The [original retro terrain kit](retro-terrain.md) now supplies a separate
64×64 color-texture authoring route with connected grass/dirt corners, using
the global pixel-art craft guidance. Its source, recipe and export contract
does not change the earlier multi-channel material candidates.
The [growth recipe](retro-terrain-growth.md) adds curated native layouts,
gravel paths, weathering, independent palettes and multi-seed previews while
preserving the original recipe. Both art sets remain unapproved.

1. **Delivered locally:** original cliff export, the additive strata recipe, and
   GaimEngine/Willowmere receiving, with cached-export integrity, cancellation
   and unexported draft recovery.
   Both hosts reload selected maps. Artwork remains unapproved.
2. **Visual review:** the [grass/dirt study](grass-dirt-study.md) is complete and
   recommends dirt structure refinement first, then grass tuft readability.
   Continue with cobble/wood/roof afterward, one family at a time.
   Judge native-scale tiles, repeated sheets and actual terrain under dry,
   wet and night lighting. No automatic promotion of the existing corpus.
3. **Pixel authoring:** qualify only the needed Grout layer/palette/variation
   mechanisms with an original asset and exact render/atlas roundtrip.
4. **Grout13 independence:** plan a separately approved source-ownership handoff;
   stop parent synchronization before making the child canonical. No handoff now.
   The 2026-10-07 parent-owned local synchronization closes the demonstrated
   257-asset guard drift. Six canonical mirrors and five source/ESM/global
   artifact roundtrips now agree. This qualifies compiler admission, not broader
   donor adoption, artwork or an independence transfer. The verified parent/child
   batches now have qualified guarded Git publication paths.
5. **Higher-end materials:** environment prefiltering and portable receiving
   preparation are delivered locally. Neutral dielectric/metal/roughness response,
   filtering quality and measured receiving still come before claims about
   realistic visual families.

New material outputs stay outside `public/textures`; public corpus publication
is unchanged. Purchased textures, grayscale conversions and derived masks remain
private game-owned files. Their restrictions survive modification. No training
inputs or automatic public promotion are part of this workflow.

## Offline environment-map authoring

`src/shader/environment.mjs` and `scripts/bake-environment.mjs` import bounded
Radiance RGBE files or regenerate the original `studio-softboxes` and `open-sky`
sources, then bake deterministic cosine diffuse and GGX specular cube maps. Use
the public command with an explicit ignored output directory:

```powershell
npm run bake:environment -- --environment studio-softboxes --profile preview --out .artifacts/SHADER-003
npm run bake:environment -- --environment open-sky --profile final --out .artifacts/SHADER-003
npm run bake:environment -- --hdr C:/assets/studio.hdr --id my-studio --profile preview --usage-restriction "licensed for this project only" --out .artifacts/SHADER-003
```

Preview uses 128-pixel specular faces, 16-pixel diffuse faces, and 64/128
specular/diffuse samples. Final uses 512/32 faces and 128/256 samples. Both use
one coherent Hammersley low-discrepancy sequence per convolution, avoiding
independent per-texel sample jitter. Final doubles sample counts and stores about
16 MiB of specular plus 48 KiB of diffuse data per environment (Preview stores
about 1 MiB plus 12 KiB). Bake time and output size rise with that quality
increase. The `original-cosine-ggx/2` generator does not tone-map, denoise
afterward, or silently reduce radiance. Analytical direction-field tests check
orientation and edge values on every cube face and mip, in addition to constant
energy.

The importer accepts 2:1 equirectangular, sRGB/Rec.709-primary Radiance RGBE
sources up to 64 MiB and 4096×2048 pixels, in flat or scanline-RLE form. It
preserves Y/X orientation, removes cumulative `EXPOSURE` and `COLORCORR` factors
to restore source linear radiance, and rejects zero correction factors, unsupported
primaries, malformed packets, nonfinite values, and radiance above the engine's
RGBA16F range. The current authoring sources contain no concentrated solar disk.

Each ignored bake directory contains `environment.json`, an `environment-map/1`
descriptor, and little-endian RGBA16F buffers. Specular mips are packed mip-major,
then faces `+X,-X,+Y,-Y,+Z,-Z`, then top-to-bottom rows; diffuse is a single mip
in that same face order and stores irradiance divided by π. RGB remains linear
sRGB/Rec.709 radiance and alpha is exactly one. The manifest records source and
generator hashes, profile, input metadata, buffer hashes, and provenance. Cache
reuse verifies these identities and every buffer before returning it. Aborts
leave no pending directory; rerun the same command to reuse a verified result.

HDR imports are offline-only and retain only a source basename and hash in the
manifest. The generated files are engine inputs for local qualification, not
reviewed artwork or public texture-corpus entries. The manifest starts with
`visualReview: unreviewed`; an authoring bake does not grant art or provenance
approval. Caller-supplied HDR maps default to
`provenance.restrictedInputs: ["usage-unverified/local-only"]`; use
`--usage-restriction <text>` or the API's `restrictedInputs` array to record an
explicit restriction. The tool never infers rights. Original analytic maps keep
an empty restricted-input list. Restrictions are normalized and bound into the
cache identity and verified on reuse; outputs created before this provenance
change remain historical rather than being treated as cleared cache entries.
For an external HDR, only an explicit API `restrictedInputs: []` declaration
clears the unverified marker; omitting the field never implies unrestricted use.

## Additive HD-2D cliff strata recipe - 2026-10-08

`hd2d-cliff-strata` (`hd2d-cliff-strata/1`) is an additional seeded material
recipe with bounded strata controls. It is accepted by both offline bake
commands; the previous `hd2d-cliff` recipe remains the default and its raw
channel bytes are preserved for seeds 1204, 1215 and 1233. The regression test
pins all four channel hashes for those legacy seeds and exercises both CLIs
with the new ID:

```powershell
npm run bake:material -- --recipe hd2d-cliff --seed 1204 --out .artifacts/materials
npm run bake:material -- --recipe hd2d-cliff-strata --seed 1204 --out .artifacts/materials
npm run bake:vertex-colors -- --mesh C:/work/mesh.json --recipe hd2d-cliff --seed 1204 --out .artifacts/vertex-colors
npm run bake:vertex-colors -- --mesh C:/work/mesh.json --recipe hd2d-cliff-strata --seed 1204 --out .artifacts/vertex-colors
```

The vertex-color path samples generated albedo onto authored UV geometry; it
does not bake illumination. GaimEngine's receiving contract and offline
base-color baking checkpoint are documented in its
`GaimEngine/docs/CURRENT_PROOF.md#offline-base-color-vertex-baking---2026-10-08`.
Engine tests establish technical receiving behavior, not approval of these
generated cliff materials. Their `visualReview` remains unapproved; artistic
evaluation and family qualification are separate work.

## Style surface families and styles - 2026-10-11

The additive `style-surface/1` recipe covers ten repeating families (`grass`,
`dirt`, `moss`, `cliff`, `stone`, `cobble`, `bark`, `timber`, `plaster`,
`roof`) across four appearances (`hd2d`, `cel-ink`, `soft-cartoon`, `pbr`):
40 family/style combinations. Default dimensions are 128, 256, 256 and 512
pixels in that style order. Valid explicit sizes are 64, 128, 256 and 512.
Each family supplies a distinct repeating structure and its own pigment ramp,
including green grass/moss, brown soil/wood, and readable mineral/roof colors.
Cliffs use interrupted strata; stone and cobble retain their cell structure.
The `relief` control and selected style affect height and derived normals.

The channels have distinct roles: albedo is unlit pigment, height is grayscale
authoring relief, normal is wrapped +Y tangent-space data derived from height,
and roughness is grayscale repeated in RGB. The `earth`, `slate` and `ochre`
palette choice changes albedo only; it does not alter height, normals or
roughness. Soft Cartoon quantizes pigment, while PBR keeps a continuous pigment
ramp. No directional lighting is painted into these maps. Engine receiving uses
albedo, normal and roughness; height remains authoring data. Every channel
records dimensions, color space, sampling mode and SHA-256 identity in
`texture-material/1` metadata.

Pass a recipe JSON file to select a family and style. This example uses the
family/style defaults at seed 1204; size can be set to any supported dimension.

```json
{
  "id": "style-surface",
  "family": "grass",
  "style": "hd2d",
  "seed": 1204,
  "size": 128,
  "palette": "earth",
  "strataScale": 4,
  "fracture": 0.28,
  "relief": 0.55,
  "roughness": 0.84
}
```

Use the CLI's `--variant-set single` to author only the requested seed, or omit
the option to keep the default three-seed `catalog` set (offsets 0, 11 and 29):

```powershell
npm run bake:material -- --recipe C:/work/grass-hd2d.json --variant-set single --out .artifacts/materials
npm run bake:material -- --recipe C:/work/grass-hd2d.json --variant-set catalog --out .artifacts/materials
```

`single` is explicit in its manifest and cache identity. The legacy `catalog`
identity and omitted `variantSet` field remain the default, preserving existing
variant behavior. Manifests bind the normalized recipe, generator version,
source file paths and SHA-256 hashes, provenance and channel hashes. Source
hashes change when the material generator or baker changes; even where old
`hd2d-cliff` channel bytes remain identical, a prior-source bake is historical
and is not reused as a current-source cache entry. The original `hd2d-cliff`
and `hd2d-cliff-strata` recipe IDs and their pinned outputs remain intact.

These 40 procedural combinations are original candidates, not visual approvals.
They retain `visualReview: unapproved`, `training: false` and an empty
`restrictedInputs` list. Generated material packages stay outside
`public/textures`; no catalog publication or rights inference is implied. For
browser preview QA, run `npm run build:pages` before using the Pages preview so
it serves current `dist/client`. `npm run build:dev` writes Vercel output and
can leave `dist/client` stale.

## Style-surface material-set closeout - 2026-10-11

The current browser receipt covers all 40 family/style controls at their
default dimensions, channel export, recoverable invalid-seed correction,
persisted recipe drafts, and edits made while export is in flight; it reports
no browser errors. See
`.artifacts/proof/material-browser/1791697077831-8892/receipt.json`.
The closeout test log records 203 script tests and 76 source tests passing
(279 total, zero failures):
`.artifacts/texture-closeout-tests.log`.
The same closeout records passing typecheck, lint, and Pages build in
`.artifacts/texture-closeout-typecheck.log`,
`.artifacts/texture-closeout-lint.log`, and
`.artifacts/texture-closeout-build.log`.
The final development build passed with its command, source hashes, and logs
retained in
`.artifacts/build-dev-20261011-024600.receipt.json`.

The tool emits original procedural candidate maps with
`visualReview: unapproved`; this proof establishes authoring, export and
recovery behavior, not approval as game art. GaimEngine receives its own
source-closed PNG/manifest snapshots from its
`GaimEngine/tests/fixtures/showcase-materials/index.json`
and consumes ordinary texture resources without a texture-tool runtime
dependency. GaimEngine owns material selection, renderer behavior and receiving
proof. Game composition, tree geometry, character assets and finished advanced
realism remain separately owned work. These generated materials stay outside
`public/textures`.

## Offline mesh vertex-color bake

`scripts/bake-vertex-colors.mjs` samples the existing original
`generateMaterial(recipe).channels.albedo` onto an authored mesh. It does not
sample runtime lighting, shadows, or PBR shading. Provide triangle geometry
with 3–8192 positions, 3–49,152 triangle indices, and authored UVs finite
within the engine's ±100,000 coordinate bound. UV2 remains `[0,1]` when present.

```powershell
npm run bake:vertex-colors -- --mesh C:/work/mesh.json --recipe hd2d-cliff --seed 1204 --out .artifacts/vertex-colors
npm run bake:vertex-colors -- --mesh C:/work/mesh.json --recipe C:/work/recipe.json --settings C:/work/sampling.json --out .artifacts/vertex-colors
```

Optional settings JSON accepts only `filter` (`nearest` or `linear`), `wrap`
(`repeat` or `clamp`), `uvScale` (two finite nonzero values with magnitude at
most 64), and `tint` (sRGB `#rrggbb`, default white). Defaults are nearest,
repeat, unit UV scale, and white tint. Mesh UV `v` increases upward while
source image rows are top-to-bottom. Linear filtering interpolates in linear
light; tint is converted from sRGB before multiplication. The source must be
opaque 8-bit RGBA albedo; generated material albedo satisfies that requirement.
Output `colors` contains linear-sRGB RGB values in `[0,1]` and replaces prior
colors. Positions, indices, normals, UVs, UV2, splat weights, and other mesh
metadata are preserved.

The CLI writes a content-addressed directory with `mesh.json` and
`vertex-colors.json` (`vertex-colors/1`). Input geometry, recipe, sampling
settings, source/generator hashes, output hash, and provenance are bound to the
identity; cache reuse validates the manifest and output bytes. Caller-supplied
mesh provenance defaults to
`provenance.restrictedInputs: ["usage-unverified/local-only"]`; use the API's
`restrictedInputs: []` only when the caller asserts there are no usage
restrictions. Rights are never inferred. Output JSON is limited to 4 MiB; the
bake is offline and does not alter the public texture catalog.

## Historical local proof - 2026-10-07

At that dated checkpoint, `npm test` passed 203 script and 76 source tests;
`npm run lint`, `npm run typecheck` and `npm run build:pages` passed.
`node scripts/test-material-browser.mjs --playwright-root
<installed-playwright-core>` verifies visible material controls, palette/relief,
PNG ZIP export, persistence and narrow layout. Latest captures/receipt are under
`.artifacts/proof/material-browser/1791399234389-27332`. Cached bakes reject
altered metadata/provenance and mid-read cancellation. Browser exports preserve
edits made while saving and recover unexported drafts after reload.

Full lint is clean after explaining the existing opaque-token fallback catch
and removing its unrelated obsolete hook suppression. Auth/data behavior is
unchanged and its existing tests pass. Desktop/mobile screenshots were inspected;
exports, concurrent save edits and unsaved draft recovery pass without console errors.
GaimEngine records receiving details in its `docs/CURRENT_PROOF.md`; game proof
is local to Willowmere. Generated output is ignored and source-inventoried.

## Reviewed Git publication

Stage named verified files and write an explicit UTF-8 JSON
`{"paths":["README.md"]}` allowlist under ignored `.artifacts`. The local
entrypoint delegates to the Grout-Library publication owner:

```powershell
pwsh -NoProfile -File .tools/gitpush.ps1 -PublisherRoot C:/DevStuff/Grout-Library -StagedOnly -Yes -Allowlist .artifacts/publication-paths.json -Message "Describe the verified change"
```

The registered existing main/origin, selected staged paths, secret scan and
remote identity must agree. Unsafe history fails without rewriting it;
credentials remain in the parent. The publisher's 49 guard assertions pass on
PowerShell 7 and 5.1. Git publication does not approve artwork or add an explicit
Pages deployment invocation.

AI-edited: 2026-10-07 | agent=Codex/root | model=unknown | effort=unknown | task=texture-tools | change=recorded source-confirmed roles and bounded material delivery

AI-edited: 2026-10-07 | agent=Codex/root | model=unknown | effort=unknown | task=material-integrity | change=closed evidenced material faults and recorded compiler guard gap

AI-edited: 2026-10-07 | agent=Codex/root | model=unknown | effort=unknown | task=compiler-guard-alignment | change=closed local guard prerequisite while preserving donor and art review scope

AI-edited: 2026-10-07 | agent=Codex/root | model=unknown | effort=unknown | task=texture-tools-publish | change=closed lint and publisher gaps with current browser material proof

## SHADER-003 offline preparation checks - 2026-10-08

The offline authoring slice is delivered locally: `npm test` and `npm run lint`
both pass on Node v26.5.0 / npm 11.6.2. The full test command includes Radiance
flat/RLE decoding, cumulative exposure and color-correction handling, bounded
malformed-input rejection, deterministic diffuse/specular baking, directional
continuity across cube faces/mips, cache verification and abort behavior. The
compact command/source record is
`.artifacts/SHADER-003/proof.jsonl`.

The latest manifests and every referenced buffer hash/byte length were checked
for all four original bake profiles: `studio-softboxes-7831ce0ecd60` (preview),
`studio-softboxes-ac26845c7791` (final), `open-sky-b3d82302df1a` (preview), and
`open-sky-48f66197733e` (final). Their manifests bind source tip
`c26d117c6de03432b469abbfc55e061778512735`; those receipts record the source
identity at that bake. The later JSDoc-only environment repair changed the
module hash, so these output identities are historical, not current-source cache
matches. No `.pending-*` bake directory remained. This proves offline
preparation and payload integrity only. Browser/native receiving, material
response, performance, and visual/art approval are not claimed by these
texture-tool checks; manifests retain `visualReview: unreviewed`. These earlier
source receipts also predate the restriction-bound cache identity; the pixel
algorithm and encoded output remain unchanged, and engine assets were not
regenerated for the metadata correction.

AI-edited: 2026-10-08 | agent=Codex/root | model=unknown | effort=unknown | task=shader-003 | change=recorded local environment preparation checks without claiming engine or art approval

## SHADER-004 offline vertex-color preparation and receiving - 2026-10-08

The offline `bake:vertex-colors` tool samples generated albedo onto authored
mesh vertices and emits a source-bound ordinary mesh package. Final
`npm test` at that checkpoint passed 224 script and 76 source tests; focused
bake tests passed 7/7 and `npm run lint` passed. The ignored command/source
journal is `.artifacts/SHADER-004/vertex-color-proof.jsonl`. The earlier
environment-module typecheck blocker has since been repaired with JSDoc-only
annotations: executable expressions and exact HDR bake payload bytes remain
unchanged, while the source hash changed. The bake keeps input and usage
restrictions bound in its manifest and does not include lighting or alpha.

GaimEngine's bounded SHADER-004 receiving checkpoint now passes browser and
native: sampled constant color matches the material-color reference pixel
exactly, depth and normal buffers remain unchanged, and exported-package
reload, rollback, and disposal pass. The exact paired receipts are retained in
`GaimEngine/docs/CURRENT_PROOF.md` under “SHADER-004 vertex-color receiving”.
This is a controlled receiving check, not approval of the generated artwork.
Sparse vertex interpolation loses fine texture detail; the original output
remains unreviewed, and broader engine/material and PSX-family qualification
continues separately. No texture catalog or deployment files were changed.

AI-edited: 2026-10-08 | agent=Codex/root | model=unknown | effort=unknown | task=shader-004 | change=recorded offline vertex-color preparation with bounded engine receiving evidence and art limitations

## Current recipe and typing checks - 2026-10-08

The additive material update passes `npm test` (230 script and 76 source tests)
and the current `npm run typecheck`, `npm run lint`, and `npm run build:pages`
all pass. The browser material proof also passes after the accessible channel
label fix: `.artifacts/proof/material-browser/1791489226109-35220/receipt.json`.

The JSDoc repair changes only source typing in `src/shader/environment.mjs`.
Its receipt at `.artifacts/proof/environment-type-repair/receipt.json` compares
six payload hashes: the Studio and Open Sky source HDRs plus each source's
diffuse and specular preview buffers. All six hashes and byte lengths match
before and after; the module hash changed from
`7f05a95413a5edf9d09edc8836c918aa42536dab78c58cb355e2bd671626b679` to
`3af22b28f87c45b8706ce6bf763afefbf9f5b5285fb7d58d138a98245b0c4f2a`. The
earlier environment manifests and receipts remain historical evidence for
identical payload bytes, not current-source cache identity. These technical
checks do not approve generated cliff artwork; its visual review remains open.

AI-edited: 2026-10-08 | agent=Codex/root | model=unknown | effort=unknown | task=material-strata | change=recorded additive recipe compatibility and environment typing repair without claiming art approval

## Material-cache review and repair - 2026-10-08

Cache reuse now compares every generated channel PNG and the contact sheet to
deterministic expected bytes. A coordinated PNG change plus matching manifest
hash previously passed reuse; the regression reproduces that failure before the
repair and rejects it afterward. Manifest and asset reads are bounded; failed
reuse leaves completed output intact. Thirteen focused material tests, full
`npm test`, typecheck and lint pass. The engine-owned compact command/source
record is `.artifacts/proof/material-study-review/` under GaimEngine.

The generator and immutable assets are unchanged. The baker source hash and
source-bound cache identities change; existing manifests remain historical.
Next work stays original-material art review before additional families, as
routed in `GaimEngine/docs/TODO.md`. Technical
cache validity does not approve artwork.

AI-edited: 2026-10-08 | agent=Codex/root | model=unknown | effort=unknown | task=material-study-review | change=closed coordinated cache tampering and corrected the cross-repository proof route

AI-edited: 2026-10-11 | agent=Codex/next_graphics_batch | model=unknown | effort=unknown | task=style-surface-recipes | change=documented family/style material semantics, variant modes and browser preview build route

AI-edited: 2026-10-11 | agent=Codex/next_graphics_batch | model=unknown | effort=unknown | task=style-surface-closeout | change=recorded current tool proof and independent engine snapshot ownership

## Review, recheck and scoped cleanup - 2026-10-11

The local pass closes oversized environment-cache reads, uncaught mill-storage
writes, judge loading failures and cancellation, incorrect material-family
labels, and stale artwork-approval metadata. Catalog thumbnail work and hidden
display animation pause during material preview or judging, then resume without
discarding thumbnail progress. The judge's 30-second deadline applies to each
reference load rather than stopping healthy shader scoring.

The browser harness now supports `--dev-url http://127.0.0.1:8080/` and a focused
`--export-only` diagnostic. Its concurrent-export check waits for the held route
handler, records source-read latency, and retains failure-state diagnostics.
The final full dev and Pages passes cover all 40 family/style choices, matching
labels, persisted drafts, concurrent edits, exports, missing-reference recovery,
cancel/retry, resumed catalog work and local-storage quota failure. Both desktop
and mobile captures were inspected; there were no unexpected console/page errors.
The deliberate reference-404 console error is recorded separately.

`npm test` passes 313 tests (233 script, 80 source). Typecheck, lint, the normal
production build and Pages build pass. [Our TODO](../TODO.md) records the exact
commands, receipts, coverage limits and next selected batch. Source-bound cache
identities change with the environment baker repair; earlier bakes are retained
as historical output. Material-generator pixels and art-approval status are
unchanged. No other repository, public corpus PNG, Git index or publication was
modified by this pass.

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=review-recheck-cleanup | change=recorded bounded integrity repairs and current verification

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=grass-dirt-study | change=linked completed source-identified study and ordered the next material refinements

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=closeout-publish | change=linked portable current proof and identified historical local evidence paths

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=retro-terrain-growth | change=linked separate curated drawing and path authoring route

AI-edited: 2026-10-12 | agent=Codex/root | model=unknown | effort=unknown | task=realistic-material-catalog | change=added original realistic material authoring ownership and export route
