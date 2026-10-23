import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const root = new URL("../", import.meta.url);
const read = path => fs.readFile(new URL(path, root), "utf8");

test("standalone builds use standard Vite commands without host adapters or environment wrappers", async () => {
  const pkg = JSON.parse(await read("package.json")), config = await read("vite.config.ts");
  assert.equal(pkg.scripts.dev, "vite dev --host 0.0.0.0 --port 8080");
  assert.equal(pkg.scripts.build, "vite build");
  assert.equal(pkg.scripts["build:pages"], "vite build --mode pages");
  assert.equal(pkg.dependencies.nitro, undefined);
  assert.doesNotMatch(config, /grok|vercel|nitro|appEnvPlugin/i);
  for (const path of ["/", "/gallery", "/studio", "/examples"]) assert.ok(config.includes(`path: "${path}"`));
  assert.match(config, /prerender: \{ enabled: true/);
});
test("standalone HTML shell retains native assets and styles without remote host injection", async () => {
  const shell = await read("src/routes/__root.tsx");
  assert.doesNotMatch(shell, /grok|vercel|PreviewHostBridge|SERVES_GROK_MANIFEST/i);
  assert.match(shell, /favicon\.svg/);
  assert.match(shell, /<Outlet/);
  assert.match(shell, /<Scripts/);
});
test("simplified root keeps required contracts and routes historical captures under docs", async () => {
  for (const path of ["AGENTS.md", "README.md", "package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "summary_bank.json", "run.cmd", "version.json", ".tools/config/eslint.config.mjs", ".tools/config/prettier.json"]) await fs.access(new URL(path, root));
  for (const path of [".grok", ".vercel", "server", "source", "screenshots", "vercel.json", "startup.sh", "eslint.config.mjs", ".prettierrc"]) await assert.rejects(fs.access(new URL(path, root)), {code:"ENOENT"});
  await fs.access(new URL("docs/look-dev/screenshots/look-pixel.png", root));
});
