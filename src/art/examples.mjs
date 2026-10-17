/** Static, provenance-bound Grout-Library catalog; generated from the read-only inventory at 34016ee. */
export const GROUT_LIBRARY_COMMIT = "34016ee";
export const GROUT_LIBRARY_EXAMPLE_GROUPS = [
  {
    "id": "core-rendering",
    "title": "Core Rendering & JSON",
    "description": "Start with the package, render a spec, and learn the compact recipe model."
  },
  {
    "id": "color-and-palettes",
    "title": "Color & Palettes",
    "description": "Create, extract, name, and test palettes, alpha, and direct color values."
  },
  {
    "id": "geometry-and-paths",
    "title": "Geometry & Paths",
    "description": "Compare curves, polylines, and visual shape construction."
  },
  {
    "id": "atlas-and-sprite-pipelines",
    "title": "Atlas & Sprite Pipelines",
    "description": "Build, pack, inspect, optimize, and hand off sprite atlases."
  },
  {
    "id": "gb-studio",
    "title": "GB Studio",
    "description": "GB Studio-oriented atlas, textbox, and Three.js companion workflows."
  },
  {
    "id": "phaser",
    "title": "Phaser",
    "description": "Compare Phaser 3 integration with Phaser 4 preload, runtime texture, and Grout13 atlas handoffs."
  },
  {
    "id": "threejs-and-3d",
    "title": "Three.js & 3D",
    "description": "Use Grout textures in live 3D previews, dice, and procedural skyboxes."
  },
  {
    "id": "textures-and-tiles",
    "title": "Textures & Tiles",
    "description": "Generate retro textures, tilesets, autotiles, and procedural art for game scenes."
  },
  {
    "id": "animation-and-variation",
    "title": "Animation & Variation",
    "description": "Reveal, animate, transform, and vary sprite recipes without duplicating source data."
  },
  {
    "id": "renderers-and-workers",
    "title": "Renderers & Workers",
    "description": "Compare Canvas/WebGL/WebGPU selection and move rendering into workers or shader paths."
  },
  {
    "id": "conversion-and-dev-tools",
    "title": "Conversion & Dev Tools",
    "description": "Convert formats, inspect JSON, and keep visual/debug utilities together without presenting them as release proofs."
  },
  {
    "id": "model-and-dataset",
    "title": "Model & Dataset Workflows",
    "description": "Produce deterministic pixel-art prompt/spec records for downstream training experiments."
  },
  {
    "id": "internal-template",
    "title": "Internal & Template",
    "description": "Scaffolding for new examples and development-only pages."
  }
];
export const ART_WORKBENCH_EXAMPLES = [
  {
    "id": "geometry",
    "title": "Native geometry and palette roles",
    "summary": "Build crisp native-resolution silhouettes from reusable shapes, masks and named palette roles.",
    "workflow": "geometry",
    "backends": [
      "cpu",
      "webgl2",
      "webgpu"
    ],
    "tags": [
      "geometry",
      "masks",
      "palette",
      "exact-pixels"
    ],
    "provenance": "Original Grout Art recipe; informed by the donor basic-usage example, with no donor artwork copied.",
    "donorSources": [
      "examples/basic-usage.html"
    ]
  },
  {
    "id": "traveler",
    "title": "Layered traveler animation",
    "summary": "Edit a twelve-frame traveler as separate body, clothing, cap and bag layers, then preview the walk cycle.",
    "workflow": "animation",
    "backends": [
      "cpu",
      "webgl2",
      "webgpu"
    ],
    "tags": [
      "layers",
      "animation",
      "anchors",
      "onion-skin"
    ],
    "provenance": "Fresh original Grout Art sprite authored for this workbench; no donor artwork copied.",
    "donorSources": [
      "examples/animation-loop.html",
      "examples/layer-flattening-example.html"
    ]
  },
  {
    "id": "custom-technique",
    "title": "Custom GLSL and WGSL technique",
    "summary": "Inspect a named shader technique beside its CPU fallback graph, then compare its rendered pixel output.",
    "workflow": "technique",
    "backends": [
      "cpu",
      "webgl2",
      "webgpu"
    ],
    "tags": [
      "glsl",
      "wgsl",
      "cpu-fallback",
      "techniques"
    ],
    "provenance": "Original technique recipe informed by the donor renderer examples; no donor artwork or shader source copied.",
    "donorSources": [
      "examples/webgl-renderer.html",
      "examples/webgpu-renderer.html",
      "examples/automatic-renderer-selection.html"
    ]
  },
  {
    "id": "atlas",
    "title": "Atlas packing and reconstruction",
    "summary": "Inspect packed pages, frame rectangles, trim offsets and anchors, then reconstruct the original frames.",
    "workflow": "atlas",
    "backends": [
      "cpu"
    ],
    "tags": [
      "atlas",
      "packing",
      "trimming",
      "extrusion",
      "reconstruction"
    ],
    "provenance": "Original atlas build from Grout Art frames; algorithm study references the donor atlas examples, with no donor artwork copied.",
    "donorSources": [
      "examples/rgba-atlas-package.html",
      "examples/sprite-packing-demo.html"
    ]
  },
  {
    "id": "variations",
    "title": "Seeded variations without duplicate art",
    "summary": "Change the seed and palette roles while keeping reusable parts and frame structure intact.",
    "workflow": "variation",
    "backends": [
      "cpu",
      "webgl2",
      "webgpu"
    ],
    "tags": [
      "seeded",
      "variation",
      "palette",
      "reusable-parts"
    ],
    "provenance": "Original seeded Grout Art recipe informed by donor variation workflows; no donor artwork copied.",
    "donorSources": [
      "examples/variation-basic.html",
      "examples/variation-advanced.html",
      "examples/variation-templates.html"
    ]
  },
  {
    "id": "comparison",
    "title": "Renderer and recipe-size comparison",
    "summary": "Compare actual CPU and GPU render reports plus readable, compressed and packed asset costs.",
    "workflow": "comparison",
    "backends": [
      "cpu",
      "webgl2",
      "webgpu"
    ],
    "tags": [
      "renderer",
      "metrics",
      "compression",
      "size-budget"
    ],
    "provenance": "Live measurements from the local Grout Art implementation; donor examples are technique references only.",
    "donorSources": [
      "examples/code-golfing-example.html",
      "examples/js13k-compact-atlas.html",
      "examples/automatic-renderer-selection.html"
    ]
  }
];
export const GROUT_LIBRARY_EXAMPLES = [
  {
    "id": "cdn-usage",
    "title": "CDN Usage",
    "summary": "Version-pinned npm CDN and local dist usage without build tooling",
    "sourcePath": "examples/cdn-usage.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/cdn-usage.html",
    "releaseTier": "tier1",
    "primaryGroup": "core-rendering",
    "tags": [
      "core-rendering",
      "renderer",
      "json"
    ],
    "backends": [
      "cdn",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "basic-usage",
    "title": "Basic Usage",
    "summary": "Generated dist core rendering walkthrough with basic shapes, direct colors, icon recipes, and compact output",
    "sourcePath": "examples/basic-usage.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/basic-usage.html",
    "releaseTier": "tier1",
    "primaryGroup": "core-rendering",
    "tags": [
      "core-rendering",
      "palette",
      "geometry",
      "renderer",
      "compression",
      "json"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "partial",
    "localExampleId": "geometry"
  },
  {
    "id": "custom-palette",
    "title": "Custom Palette",
    "summary": "Generated dist palette rendering walkthrough with multiple RGB24 themes",
    "sourcePath": "examples/custom-palette.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/custom-palette.html",
    "releaseTier": "tier1",
    "primaryGroup": "color-and-palettes",
    "tags": [
      "color-and-palettes",
      "palette",
      "renderer"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "rgba-atlas-package",
    "title": "DOM-Free RGBA Atlas Package",
    "summary": "Pinned CDN atlas build/extract/metadata package surface",
    "sourcePath": "examples/rgba-atlas-package.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/rgba-atlas-package.html",
    "releaseTier": "tier1",
    "primaryGroup": "atlas-and-sprite-pipelines",
    "tags": [
      "atlas-and-sprite-pipelines",
      "atlas",
      "palette",
      "conversion"
    ],
    "backends": [
      "cdn",
      "node",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "partial",
    "localExampleId": "atlas"
  },
  {
    "id": "gb-studio-atlas-generator",
    "title": "GB Studio Atlas Generator",
    "summary": "Pinned CDN compact game asset recipe that builds a typed RGBA atlas and engine metadata",
    "sourcePath": "examples/gb-studio-atlas-generator.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/gb-studio-atlas-generator.html",
    "releaseTier": "tier1",
    "primaryGroup": "atlas-and-sprite-pipelines",
    "tags": [
      "atlas-and-sprite-pipelines",
      "atlas",
      "palette",
      "compression",
      "json"
    ],
    "backends": [
      "cdn",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "phaser4-preload-atlas",
    "title": "Phaser 4 Preload Atlas",
    "summary": "Raw Phaser 4 scene that generates Grout art during preload and consumes atlas frames during gameplay",
    "sourcePath": "examples/phaser4-preload-atlas.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/phaser4-preload-atlas.html",
    "releaseTier": "tier1",
    "primaryGroup": "phaser",
    "tags": [
      "phaser",
      "animation",
      "atlas"
    ],
    "backends": [
      "phaser4",
      "phaser",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "grout-skills-showcase",
    "title": "Grout Atlas Bench",
    "summary": "Generated dist top-down adventure atlas benchmark harness with fixture-backed trainer-sheet prompt, archived broad-prompt baselines that are not current rankings, guided pipeline gates, mirrored-left trainer frames, extraction verification, metadata, and room animation proof",
    "sourcePath": "examples/grout-skills-showcase.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/grout-skills-showcase.html",
    "releaseTier": "tier1",
    "primaryGroup": "atlas-and-sprite-pipelines",
    "tags": [
      "atlas-and-sprite-pipelines",
      "animation",
      "atlas",
      "conversion"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "js13k-compact-atlas",
    "title": "JS13k Compact Atlas",
    "summary": "Pinned CDN size-budgeted compact atlas payload with a tiny-game mock scene",
    "sourcePath": "examples/js13k-compact-atlas.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/js13k-compact-atlas.html",
    "releaseTier": "tier1",
    "primaryGroup": "atlas-and-sprite-pipelines",
    "tags": [
      "atlas-and-sprite-pipelines",
      "atlas",
      "compression"
    ],
    "backends": [
      "cdn",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "partial",
    "localExampleId": "comparison"
  },
  {
    "id": "grout13-story-atlas",
    "title": "Grout13 Story Atlas",
    "summary": "Unreleased local generated-dist proof with tiny runtime, payload story, atlas canvas, shell ZIP metrics, and frame rectangles",
    "sourcePath": "examples/grout13-story-atlas.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/grout13-story-atlas.html",
    "releaseTier": "tier1",
    "primaryGroup": "atlas-and-sprite-pipelines",
    "tags": [
      "atlas-and-sprite-pipelines",
      "animation",
      "atlas",
      "renderer"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "ui-art-pack-atlas",
    "title": "UI Art Pack Atlas",
    "summary": "Pinned CDN companion UI art atlas with nineslice, theme, and Phaser metadata",
    "sourcePath": "examples/ui-art-pack-atlas.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/ui-art-pack-atlas.html",
    "releaseTier": "tier1",
    "primaryGroup": "atlas-and-sprite-pipelines",
    "tags": [
      "atlas-and-sprite-pipelines",
      "atlas",
      "phaser"
    ],
    "backends": [
      "phaser",
      "cdn",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "worker-rendering",
    "title": "Worker Rendering",
    "summary": "Generated dist worker entry with client helper, sync fallback, and transferable render results",
    "sourcePath": "examples/worker-rendering.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/worker-rendering.html",
    "releaseTier": "tier1",
    "primaryGroup": "renderers-and-workers",
    "tags": [
      "renderers-and-workers",
      "renderer",
      "worker"
    ],
    "backends": [
      "worker",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "pixel-art-model-training-pipeline",
    "title": "Pixel Art Model Training Pipeline",
    "summary": "Generated dist LLM/LoRA JSONL dataset builder with readable and compact records",
    "sourcePath": "examples/pixel-art-model-training-pipeline.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/pixel-art-model-training-pipeline.html",
    "releaseTier": "tier1",
    "primaryGroup": "model-and-dataset",
    "tags": [
      "model-and-dataset",
      "compression",
      "json",
      "ml-dataset"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "draw-reveal-animation",
    "title": "Animated Drawing Reveal",
    "summary": "Pinned CDN example that reveals ordered recipe steps, partial strokes, and flattened sprite pixels over time",
    "sourcePath": "examples/draw-reveal-animation.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/draw-reveal-animation.html",
    "releaseTier": "tier1",
    "primaryGroup": "animation-and-variation",
    "tags": [
      "animation-and-variation",
      "animation",
      "variation",
      "layering",
      "json"
    ],
    "backends": [
      "cdn",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "animation-loop",
    "title": "Grout Animation Example",
    "summary": "Donor reference for grout animation example; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/animation-loop.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/animation-loop.html",
    "releaseTier": "tier2",
    "primaryGroup": "core-rendering",
    "tags": [
      "core-rendering",
      "animation",
      "renderer",
      "json"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "partial",
    "localExampleId": "traveler"
  },
  {
    "id": "gradients",
    "title": "Grout Gradients Example",
    "summary": "Donor reference for grout gradients example; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/gradients.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/gradients.html",
    "releaseTier": "tier2",
    "primaryGroup": "core-rendering",
    "tags": [
      "core-rendering",
      "renderer",
      "json"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "sprite-packing-demo",
    "title": "Sprite Packing Demo - Character Count Reduction",
    "summary": "Donor reference for sprite packing demo - character count reduction; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/sprite-packing-demo.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/sprite-packing-demo.html",
    "releaseTier": "tier2",
    "primaryGroup": "atlas-and-sprite-pipelines",
    "tags": [
      "atlas-and-sprite-pipelines",
      "atlas"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "partial",
    "localExampleId": "atlas"
  },
  {
    "id": "code-golfing-example",
    "title": "Grout - Code Golfing Shorthand Example",
    "summary": "Donor reference for grout - code golfing shorthand example; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/code-golfing-example.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/code-golfing-example.html",
    "releaseTier": "tier2",
    "primaryGroup": "core-rendering",
    "tags": [
      "core-rendering",
      "renderer",
      "compression",
      "json"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "partial",
    "localExampleId": "comparison"
  },
  {
    "id": "rgba-transparency",
    "title": "Grout Example - RGBA Transparency",
    "summary": "Donor reference for grout example - rgba transparency; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/rgba-transparency.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/rgba-transparency.html",
    "releaseTier": "tier2",
    "primaryGroup": "color-and-palettes",
    "tags": [
      "color-and-palettes",
      "palette",
      "alpha"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "modifiers-and-hue-shift",
    "title": "Grout - Rotation, Flip & Hue Shift Modifiers",
    "summary": "Donor reference for grout - rotation, flip & hue shift modifiers; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/modifiers-and-hue-shift.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/modifiers-and-hue-shift.html",
    "releaseTier": "tier2",
    "primaryGroup": "animation-and-variation",
    "tags": [
      "animation-and-variation",
      "animation",
      "variation"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "bezier-curves-showcase",
    "title": "Grout Bezier Curves - Real-World Icon Examples",
    "summary": "Donor reference for grout bezier curves - real-world icon examples; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/bezier-curves-showcase.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/bezier-curves-showcase.html",
    "releaseTier": "tier2",
    "primaryGroup": "geometry-and-paths",
    "tags": [
      "geometry-and-paths",
      "geometry"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "polyline-example",
    "title": "Grout - Polyline Example",
    "summary": "Donor reference for grout - polyline example; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/polyline-example.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/polyline-example.html",
    "releaseTier": "tier2",
    "primaryGroup": "geometry-and-paths",
    "tags": [
      "geometry-and-paths",
      "geometry"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "svg-converter",
    "title": "Grout - SVG to Grout Converter",
    "summary": "Donor reference for grout - svg to grout converter; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/svg-converter.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/svg-converter.html",
    "releaseTier": "tier2",
    "primaryGroup": "conversion-and-dev-tools",
    "tags": [
      "conversion-and-dev-tools",
      "conversion"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "sprite-batch-converter",
    "title": "Grout Sprite Island Batch Converter",
    "summary": "Donor reference for grout sprite island batch converter; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/sprite-batch-converter.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/sprite-batch-converter.html",
    "releaseTier": "tier2",
    "primaryGroup": "conversion-and-dev-tools",
    "tags": [
      "conversion-and-dev-tools",
      "conversion"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "grout-ai-workspace",
    "title": "Grout AI Art Workspace",
    "summary": "Local Grout JSON art workspace for layering, exact pixel comparison, deterministic replay, and stage recording.",
    "sourcePath": "examples/grout-ai-workspace.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/grout-ai-workspace.html",
    "releaseTier": "tier2",
    "primaryGroup": "conversion-and-dev-tools",
    "tags": [
      "conversion-and-dev-tools",
      "layering",
      "json"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "layer-flattening-example",
    "title": "Layer Flattening Example - Grout Library",
    "summary": "Donor reference for layer flattening example - grout library; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/layer-flattening-example.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/layer-flattening-example.html",
    "releaseTier": "tier2",
    "primaryGroup": "atlas-and-sprite-pipelines",
    "tags": [
      "atlas-and-sprite-pipelines",
      "atlas",
      "layering"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "partial",
    "localExampleId": "traveler"
  },
  {
    "id": "color-name-semantics-extraction",
    "title": "Grout Color Analyzer - Pixel & Palette Analysis",
    "summary": "Donor reference for grout color analyzer - pixel & palette analysis; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/color-name-semantics-extraction.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/color-name-semantics-extraction.html",
    "releaseTier": "tier2",
    "primaryGroup": "color-and-palettes",
    "tags": [
      "color-and-palettes",
      "palette",
      "conversion"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "color-palette-generator",
    "title": "Grout Library - Color Palette Generator",
    "summary": "Donor reference for grout library - color palette generator; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/color-palette-generator.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/color-palette-generator.html",
    "releaseTier": "tier2",
    "primaryGroup": "color-and-palettes",
    "tags": [
      "color-and-palettes",
      "palette"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "palette-extraction",
    "title": "Grout - Palette Extraction",
    "summary": "Donor reference for grout - palette extraction; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/palette-extraction.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/palette-extraction.html",
    "releaseTier": "tier2",
    "primaryGroup": "color-and-palettes",
    "tags": [
      "color-and-palettes",
      "palette",
      "conversion"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "texture-utils-showcase",
    "title": "Texture Utils Showcase - Grout Library",
    "summary": "Donor reference for texture utils showcase - grout library; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/texture-utils-showcase.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/texture-utils-showcase.html",
    "releaseTier": "tier2",
    "primaryGroup": "textures-and-tiles",
    "tags": [
      "textures-and-tiles",
      "texture",
      "typography"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "tiles-and-tilesets",
    "title": "Grout - Tiles & Tilesets",
    "summary": "Donor reference for grout - tiles & tilesets; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/tiles-and-tilesets.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/tiles-and-tilesets.html",
    "releaseTier": "tier2",
    "primaryGroup": "textures-and-tiles",
    "tags": [
      "textures-and-tiles",
      "texture",
      "typography"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "variation-basic",
    "title": "Grout Variation Engine - Basic Usage",
    "summary": "Donor reference for grout variation engine - basic usage; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/variation-basic.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/variation-basic.html",
    "releaseTier": "tier2",
    "primaryGroup": "animation-and-variation",
    "tags": [
      "animation-and-variation",
      "animation",
      "variation"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "partial",
    "localExampleId": "variations"
  },
  {
    "id": "variation-advanced",
    "title": "Grout Variation Engine - Advanced Techniques",
    "summary": "Donor reference for grout variation engine - advanced techniques; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/variation-advanced.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/variation-advanced.html",
    "releaseTier": "tier2",
    "primaryGroup": "animation-and-variation",
    "tags": [
      "animation-and-variation",
      "animation",
      "variation"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "partial",
    "localExampleId": "variations"
  },
  {
    "id": "variation-templates",
    "title": "Grout Variation Engine - Pre-made Templates",
    "summary": "Donor reference for grout variation engine - pre-made templates; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/variation-templates.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/variation-templates.html",
    "releaseTier": "tier2",
    "primaryGroup": "animation-and-variation",
    "tags": [
      "animation-and-variation",
      "animation",
      "variation"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "partial",
    "localExampleId": "variations"
  },
  {
    "id": "automatic-renderer-selection",
    "title": "Grout Automatic Renderer Selection Example",
    "summary": "Donor reference for grout automatic renderer selection example; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/automatic-renderer-selection.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/automatic-renderer-selection.html",
    "releaseTier": "tier3",
    "primaryGroup": "renderers-and-workers",
    "tags": [
      "renderers-and-workers",
      "renderer",
      "worker"
    ],
    "backends": [
      "worker",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "partial",
    "localExampleId": "comparison"
  },
  {
    "id": "webgl-renderer",
    "title": "Grout WebGL Renderer Example",
    "summary": "Donor reference for grout webgl renderer example; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/webgl-renderer.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/webgl-renderer.html",
    "releaseTier": "tier3",
    "primaryGroup": "renderers-and-workers",
    "tags": [
      "renderers-and-workers",
      "shader",
      "renderer",
      "worker"
    ],
    "backends": [
      "webgl2",
      "worker",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "partial",
    "localExampleId": "custom-technique"
  },
  {
    "id": "webgpu-renderer",
    "title": "Grout WebGPU Renderer Example",
    "summary": "Donor reference for grout webgpu renderer example; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/webgpu-renderer.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/webgpu-renderer.html",
    "releaseTier": "tier3",
    "primaryGroup": "renderers-and-workers",
    "tags": [
      "renderers-and-workers",
      "shader",
      "renderer",
      "worker"
    ],
    "backends": [
      "webgpu",
      "worker",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "partial",
    "localExampleId": "custom-technique"
  },
  {
    "id": "shader-text-effects",
    "title": "Grout - Shader Text Effects (GlyphBatch)",
    "summary": "Donor reference for grout - shader text effects (glyphbatch); retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/shader-text-effects.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/shader-text-effects.html",
    "releaseTier": "tier3",
    "primaryGroup": "renderers-and-workers",
    "tags": [
      "renderers-and-workers",
      "shader",
      "renderer",
      "worker",
      "typography"
    ],
    "backends": [
      "webgl2",
      "worker",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "wasm-atlas-hiding",
    "title": "WASM Atlas Hiding Example",
    "summary": "Donor reference for wasm atlas hiding example; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/wasm-atlas-hiding.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/wasm-atlas-hiding.html",
    "releaseTier": "tier3",
    "primaryGroup": "atlas-and-sprite-pipelines",
    "tags": [
      "atlas-and-sprite-pipelines",
      "atlas"
    ],
    "backends": [
      "wasm",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "phaser-integration",
    "title": "Grout + Phaser 3 Integration",
    "summary": "Donor reference for grout + phaser 3 integration; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/phaser-integration.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/phaser-integration.html",
    "releaseTier": "tier3",
    "primaryGroup": "phaser",
    "tags": [
      "phaser"
    ],
    "backends": [
      "phaser",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "phaser4-runtime-texture",
    "title": "Grout + Phaser 4 Runtime Texture Helper",
    "summary": "Donor reference for grout + phaser 4 runtime texture helper; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/phaser4-runtime-texture.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/phaser4-runtime-texture.html",
    "releaseTier": "tier3",
    "primaryGroup": "phaser",
    "tags": [
      "phaser",
      "texture",
      "typography"
    ],
    "backends": [
      "phaser4",
      "phaser",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "phaser4-facade-character",
    "title": "Grout Layered Character + Phaser 4 Facade",
    "summary": "Donor reference for grout layered character + phaser 4 facade; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/phaser4-facade-character.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/phaser4-facade-character.html",
    "releaseTier": "tier3",
    "primaryGroup": "phaser",
    "tags": [
      "phaser",
      "layering"
    ],
    "backends": [
      "phaser4",
      "phaser",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "moss-post-v4",
    "title": "Moss Post V4 · Grout + Phaser 4 Facade",
    "summary": "Donor reference for moss post v4 · grout + phaser 4 facade; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/moss-post-v4.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/moss-post-v4.html",
    "releaseTier": "tier3",
    "primaryGroup": "phaser",
    "tags": [
      "phaser"
    ],
    "backends": [
      "phaser4",
      "phaser",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "grout13-phaser-handoff",
    "title": "Grout13 + Phaser 4 Handoff",
    "summary": "Donor reference for grout13 + phaser 4 handoff; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/grout13-phaser-handoff.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/grout13-phaser-handoff.html",
    "releaseTier": "tier3",
    "primaryGroup": "phaser",
    "tags": [
      "phaser"
    ],
    "backends": [
      "phaser4",
      "phaser",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "atlas-asset-demo",
    "title": "Grout - Atlas Assets &amp; Sprite Management",
    "summary": "Donor reference for grout - atlas assets &amp; sprite management; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/atlas-asset-demo.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/atlas-asset-demo.html",
    "releaseTier": "tier3",
    "primaryGroup": "atlas-and-sprite-pipelines",
    "tags": [
      "atlas-and-sprite-pipelines",
      "atlas"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "autotile-maker",
    "title": "Grout - Autotile Architect",
    "summary": "Donor reference for grout - autotile architect; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/autotile-maker.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/autotile-maker.html",
    "releaseTier": "tier3",
    "primaryGroup": "textures-and-tiles",
    "tags": [
      "textures-and-tiles",
      "texture",
      "typography"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "retro-gaming-textures",
    "title": "Retro Gaming Textures - PS1, N64, Doom Style",
    "summary": "Donor reference for retro gaming textures - ps1, n64, doom style; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/retro-gaming-textures.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/retro-gaming-textures.html",
    "releaseTier": "tier3",
    "primaryGroup": "textures-and-tiles",
    "tags": [
      "textures-and-tiles",
      "texture",
      "typography"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "procedural-art-generator",
    "title": "Grout - Procedural Art Generator",
    "summary": "Donor reference for grout - procedural art generator; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/procedural-art-generator.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/procedural-art-generator.html",
    "releaseTier": "tier3",
    "primaryGroup": "textures-and-tiles",
    "tags": [
      "textures-and-tiles",
      "texture",
      "typography"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "monochrome-sprite-packing-tool",
    "title": "Pixel Packer Pro",
    "summary": "Donor reference for pixel packer pro; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/monochrome-sprite-packing-tool.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/monochrome-sprite-packing-tool.html",
    "releaseTier": "tier3",
    "primaryGroup": "atlas-and-sprite-pipelines",
    "tags": [
      "atlas-and-sprite-pipelines",
      "atlas"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "gb-studio-textbox",
    "title": "Grout – GB Studio Textbox Designer",
    "summary": "Donor reference for grout – gb studio textbox designer; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/gb-studio-textbox.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/gb-studio-textbox.html",
    "releaseTier": "tier3",
    "primaryGroup": "gb-studio",
    "tags": [
      "gb-studio",
      "typography"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "gb-studio-textbox-threejs",
    "title": "Grout – GB Textbox · Three.js",
    "summary": "Donor reference for grout – gb textbox · three.js; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/gb-studio-textbox-threejs.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/gb-studio-textbox-threejs.html",
    "releaseTier": "tier3",
    "primaryGroup": "gb-studio",
    "tags": [
      "gb-studio",
      "threejs",
      "typography",
      "experimental"
    ],
    "backends": [
      "threejs",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "threejs-live-editor",
    "title": "Interactive Three.js Texture Demo - Grout Library",
    "summary": "Donor reference for interactive three.js texture demo - grout library; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/threejs-live-editor.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/threejs-live-editor.html",
    "releaseTier": "tier3",
    "primaryGroup": "threejs-and-3d",
    "tags": [
      "threejs-and-3d",
      "threejs",
      "texture",
      "typography",
      "experimental"
    ],
    "backends": [
      "threejs",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "threejs-dice",
    "title": "Grout + Three.js Dice Example",
    "summary": "Donor reference for grout + three.js dice example; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/threejs-dice.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/threejs-dice.html",
    "releaseTier": "tier3",
    "primaryGroup": "threejs-and-3d",
    "tags": [
      "threejs-and-3d",
      "threejs",
      "experimental"
    ],
    "backends": [
      "threejs",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "threejs-skybox",
    "title": "Grout + Three.js Procedural Skybox",
    "summary": "Donor reference for grout + three.js procedural skybox; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/threejs-skybox.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/threejs-skybox.html",
    "releaseTier": "tier3",
    "primaryGroup": "threejs-and-3d",
    "tags": [
      "threejs-and-3d",
      "threejs",
      "experimental"
    ],
    "backends": [
      "threejs",
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "_template",
    "title": "Grout Example - Your Feature",
    "summary": "Donor reference for grout example - your feature; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/_template.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/_template.html",
    "releaseTier": "tier4",
    "primaryGroup": "internal-template",
    "tags": [
      "internal-template"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "json-playground",
    "title": "Grout JSON Playground - Live Testing",
    "summary": "Donor reference for grout json playground - live testing; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/json-playground.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/json-playground.html",
    "releaseTier": "tier4",
    "primaryGroup": "conversion-and-dev-tools",
    "tags": [
      "conversion-and-dev-tools",
      "json",
      "experimental"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "curved-lines-comparison",
    "title": "Grout Curved Lines - Before & After Comparison",
    "summary": "Donor reference for grout curved lines - before & after comparison; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/curved-lines-comparison.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/curved-lines-comparison.html",
    "releaseTier": "tier4",
    "primaryGroup": "geometry-and-paths",
    "tags": [
      "geometry-and-paths",
      "geometry"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "rgba-alpha-blending-test",
    "title": "Grout - RGBA Alpha Blending Test",
    "summary": "Donor reference for grout - rgba alpha blending test; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/rgba-alpha-blending-test.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/rgba-alpha-blending-test.html",
    "releaseTier": "tier4",
    "primaryGroup": "color-and-palettes",
    "tags": [
      "color-and-palettes",
      "palette",
      "alpha",
      "experimental"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "test-curves",
    "title": "Grout Curved Lines Test (Dev Utility)",
    "summary": "Donor reference for grout curved lines test (dev utility); retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/test-curves.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/test-curves.html",
    "releaseTier": "tier4",
    "primaryGroup": "geometry-and-paths",
    "tags": [
      "geometry-and-paths",
      "geometry",
      "experimental"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "test-heart",
    "title": "Heart Shape Visual Test",
    "summary": "Donor reference for heart shape visual test; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/test-heart.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/test-heart.html",
    "releaseTier": "tier4",
    "primaryGroup": "geometry-and-paths",
    "tags": [
      "geometry-and-paths",
      "geometry",
      "experimental"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "test-shapes-popout",
    "title": "Shapes Pop-out Panel Demo — jspaint/mspaint Style",
    "summary": "Donor reference for shapes pop-out panel demo — jspaint/mspaint style; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/test-shapes-popout.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/test-shapes-popout.html",
    "releaseTier": "tier4",
    "primaryGroup": "conversion-and-dev-tools",
    "tags": [
      "conversion-and-dev-tools",
      "geometry",
      "experimental"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  },
  {
    "id": "test-shapes-visual",
    "title": "Heart &amp; Shield Visual Test — 0,0 to 15,15",
    "summary": "Donor reference for heart &amp; shield visual test — 0,0 to 15,15; retained as a source page while this workflow is reviewed for migration.",
    "sourcePath": "examples/test-shapes-visual.html",
    "sourceCommit": "34016ee",
    "sourceUrl": "https://github.com/Shoozes/Grout-Library/blob/34016ee/examples/test-shapes-visual.html",
    "releaseTier": "tier4",
    "primaryGroup": "conversion-and-dev-tools",
    "tags": [
      "conversion-and-dev-tools",
      "geometry",
      "experimental"
    ],
    "backends": [
      "browser"
    ],
    "provenance": "Grout-Library example reference at 34016ee; source artwork stays in the donor repository and is not included here.",
    "migration": "source-only"
  }
];
export function getWorkbenchExample(id) { return ART_WORKBENCH_EXAMPLES.find(example => example.id === id); }
