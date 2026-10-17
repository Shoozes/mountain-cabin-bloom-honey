import assert from "node:assert/strict";
import path from "node:path";

/** Actual Studio controls plus portable shader parity on the animated import. */
export async function verifyOutlineControls({
  page,
  recipe,
  animatedRecipe,
  readRecipe,
  waitPixels,
  proof,
  mode,
}) {
  const original = structuredClone(recipe),
    settings = { enabled: true, color: "#26323f", width: 1, corners: "stepped" };
  await page.getByText("Outline", { exact: true }).click();
  await page.getByLabel("Preview and export outline", { exact: true }).check();
  await waitPixels(page, { ...original, outline: settings });
  await page.getByLabel("Outline width", { exact: true }).selectOption("2");
  await page.getByLabel("Outline corners", { exact: true }).selectOption("square");
  await page.getByLabel("Outline color", { exact: true }).fill("#17324f");
  const expected = {
    ...original,
    outline: { ...settings, width: 2, corners: "square", color: "#17324f" },
  };
  await waitPixels(page, expected);
  assert.deepEqual(await readRecipe(page), expected);
  for (const key of ["parts", "layers", "frames", "clips", "palette", "importedSprite"])
    assert.deepEqual(expected[key], original[key]);
  await page.getByRole("button", { name: "Undo (Ctrl or Command plus Z)", exact: true }).click();
  await waitPixels(page, { ...expected, outline: { ...expected.outline, color: settings.color } });
  await page
    .getByRole("button", { name: "Redo (Ctrl or Command plus Shift plus Z)", exact: true })
    .click();
  await waitPixels(page, expected);
  await page.getByLabel("Preview and export outline", { exact: true }).uncheck();
  await waitPixels(page, original);
  await page.getByLabel("Preview and export outline", { exact: true }).check();
  await waitPixels(page, expected);
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("grout-art-studio/1")).outline?.color === "#17324f",
  );
  await page.reload();
  await waitPixels(page, expected);
  assert.deepEqual(await readRecipe(page), expected);
  await page.getByText("Outline", { exact: true }).click();
  assert.equal(
    await page.getByLabel("Preview and export outline", { exact: true }).isChecked(),
    true,
  );
  // Source editing owns its unsaved text; controls cannot replace that draft.
  await page.getByText("Recipe source and technique modules", { exact: true }).click();
  const editor = page.getByLabel("Recipe JSON, including custom technique source"),
    source = await editor.inputValue();
  await editor.fill(source + " ");
  assert.equal(await page.getByLabel("Preview and export outline").isDisabled(), true);
  await page.getByRole("button", { name: "Reset text", exact: true }).click();
  await page.getByText("Recipe source and technique modules", { exact: true }).click();
  await page.getByLabel("Outline width", { exact: true }).selectOption("3");
  await page.getByLabel("Outline width", { exact: true }).selectOption("1");
  await page.getByLabel("Outline width", { exact: true }).selectOption("2");
  await waitPixels(page, expected);
  for (let i = 0; i < recipe.frames.length; i++) {
    await page.locator(".art-frame-button").nth(i).click();
    await waitPixels(page, expected, i);
  }
  await page.locator(".art-frame-button").first().click();
  await waitPixels(page, expected);
  // GPU matrix uses an independent animated source, all widths/corners, hidden layers,
  // per-frame edits, clipping, palette zero and a disabled effect.
  const gpu = await page.evaluate(async (recipe) => {
    const api = await import("/__art-sdk/index.mjs");
    let comparisons = 0;
    for (const backend of ["webgl2", "webgpu"]) {
      const renderer = await api.createRenderer({ backend });
      if (renderer.backend !== backend) throw Error("Missing " + backend);
      try {
        const variants = [];
        for (const corners of ["stepped", "square"])
          for (const width of [1, 2, 3])
            variants.push({
              ...recipe,
              outline: { enabled: true, color: "#17324f", width, corners },
            });
        variants.push({
          ...recipe,
          outline: { enabled: false, color: "#17324f", width: 3, corners: "square" },
        });
        const hidden = structuredClone(variants[0]);
        hidden.layers[0].visible = false;
        variants.push(hidden);
        const erased = api.editPixel(variants[1], 0, variants[1].layers[1].id, 4, 4, null);
        variants.push(erased);
        for (const r of variants)
          for (let i = 0; i < r.frames.length; i++) {
            const a = api.renderFrame(r, i),
              b = await renderer.render(r, i);
            if (a.data.some((v, j) => v !== b.data[j]))
              throw Error(`${backend} outline pixel mismatch ${i}`);
            comparisons++;
          }
      } finally {
        renderer.dispose();
      }
    }
    return comparisons;
  }, animatedRecipe);
  assert.equal(gpu, 72);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".art-frame-button")[0]?.getAttribute("aria-current") !== "true",
  );
  await page.getByLabel("Outline width").selectOption("3");
  await page.getByLabel("Outline width").selectOption("2");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.locator(".art-frame-button").first().click();
  await waitPixels(page, expected);
  assert.deepEqual((await readRecipe(page)).clips, original.clips);
  await page.screenshot({ path: path.join(proof, `${mode}-outline-desktop.png`), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Outline width").selectOption("1");
  await waitPixels(page, { ...expected, outline: { ...expected.outline, width: 1 } });
  await page.getByLabel("Outline width").selectOption("2");
  await waitPixels(page, expected);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByLabel("Outline width").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(proof, `${mode}-outline-mobile.png`), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  return { recipe: expected, gpu };
}
