import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, ".."),
  source = path.join(root, "packages/grout-art"),
  target = path.join(root, ".artifacts/grout-art-sdk");
await fs.mkdir(target, { recursive: true });
for (const name of await fs.readdir(source))
  if (/\.(mjs|mts|json|txt)$/.test(name))
    await fs.copyFile(path.join(source, name), path.join(target, name));
const sdk = await import(new URL("../.artifacts/grout-art-sdk/index.mjs", import.meta.url));
const renderer = await sdk.createRenderer({ backend: "cpu" });
try {
  const p = await renderer.render(sdk.createTravelerRecipe(), 0);
  if (p.data.length !== 1024) throw Error("SDK consumer pixels differ");
} finally {
  renderer.dispose();
}
await fs.writeFile(
  path.join(target, "traveler.json"),
  JSON.stringify(sdk.createTravelerRecipe(), null, 2) + "\n",
);
const wardrobe = path.join(target, "traveler-wardrobe");
const character = sdk.createCharacterDocument();
await fs.writeFile(path.join(target, "character.json"), JSON.stringify(character, null, 2) + "\n");
await fs.writeFile(path.join(target, "character.recipe.json"), JSON.stringify(sdk.compileCharacter(character), null, 2) + "\n");
await fs.mkdir(wardrobe, { recursive: true });
for (const { id: clothing } of sdk.TRAVELER_CLOTHING)
  for (const { id: hat } of sdk.TRAVELER_HATS)
    for (const { id: palette } of sdk.TRAVELER_PALETTES)
      await fs.writeFile(
        path.join(wardrobe, `${clothing}-${hat}${palette === "fern" ? "" : "-" + palette}.json`),
        JSON.stringify(sdk.createTravelerRecipe({ clothing, hat, palette }), null, 2) + "\n",
      );
execFileSync(
  process.execPath,
  [
    path.join(root, "node_modules/typescript/bin/tsc"),
    "--noEmit",
    "--strict",
    "--skipLibCheck",
    "--target",
    "ES2022",
    "--module",
    "NodeNext",
    "--lib",
    "ES2022,DOM",
    path.join(root, "scripts/fixtures/grout-art-consumer.mts"),
  ],
  { stdio: "inherit" },
);
console.log(
  "Private ESM SDK built; headless runtime and declaration consumers passed: .artifacts/grout-art-sdk",
);
