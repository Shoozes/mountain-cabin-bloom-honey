/* Adapted from Grout-Library src/atlas/rgba-atlas.js at 34016ee.
 * Copyright (c) 2026 Shoozes. MIT; see LICENSE.grout-library.txt. */
/**
 * DOM-free typed RGBA atlas helpers for Grout.
 *
 * This module intentionally avoids browser DOM APIs so package consumers,
 * workers, build tools, and engine adapters can share the same atlas core.
 */

const MAX_RGBA_ATLAS_PIXELS = 16_777_216;

function throwIfAtlasCancelled(shouldCancel) {
  if (typeof shouldCancel === "function" && shouldCancel()) {
    const error = new Error("Render job cancelled");
    error.code = "ERR_RENDER_CANCELLED";
    throw error;
  }
}

function assertPositiveInt(value, name, max = 4096) {
  if (!Number.isInteger(value) || value <= 0 || value > max) {
    throw new Error(`${name} must be a positive integer <= ${max}, got ${value}`);
  }
}

function assertNonNegativeInt(value, name, max = 4096) {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new Error(`${name} must be a non-negative integer <= ${max}, got ${value}`);
  }
}

function normalizeRgbaFrame(frame, index) {
  if (!frame || typeof frame !== "object") {
    throw new Error(`buildRgbaAtlas: frame at index ${index} must be an object`);
  }
  assertPositiveInt(frame.width, `buildRgbaAtlas: frame ${index} width`);
  assertPositiveInt(frame.height, `buildRgbaAtlas: frame ${index} height`);
  if (!(frame.rgba instanceof Uint8ClampedArray) && !(frame.rgba instanceof Uint8Array)) {
    throw new Error(
      `buildRgbaAtlas: frame ${index} rgba must be a Uint8ClampedArray or Uint8Array`,
    );
  }
  const expectedLength = frame.width * frame.height * 4;
  if (frame.rgba.length < expectedLength) {
    throw new Error(
      `buildRgbaAtlas: frame ${index} rgba is too small (${frame.rgba.length}, expected ${expectedLength})`,
    );
  }

  return {
    name: frame.name || `frame_${index}`,
    width: frame.width,
    height: frame.height,
    rgba: frame.rgba,
    pivot: frame.pivot ? { ...frame.pivot } : undefined,
    animation: frame.animation ? { ...frame.animation } : undefined,
  };
}

function validateAtlasPixelBudget(frames, shouldCancel) {
  let totalPixels = 0;
  frames.forEach((frame, index) => {
    throwIfAtlasCancelled(shouldCancel);
    if (!frame || typeof frame !== "object") {
      throw new Error(`buildRgbaAtlas: frame at index ${index} must be an object`);
    }
    assertPositiveInt(frame.width, `buildRgbaAtlas: frame ${index} width`);
    assertPositiveInt(frame.height, `buildRgbaAtlas: frame ${index} height`);
    totalPixels += frame.width * frame.height;
    if (totalPixels > MAX_RGBA_ATLAS_PIXELS) {
      throw new Error(
        `buildRgbaAtlas: source frames must contain at most ${MAX_RGBA_ATLAS_PIXELS} decoded pixels in total`,
      );
    }
  });
}

function findTrimBounds(frame, shouldCancel) {
  let minX = frame.width;
  let minY = frame.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < frame.height; y++) {
    throwIfAtlasCancelled(shouldCancel);
    for (let x = 0; x < frame.width; x++) {
      const alpha = frame.rgba[(y * frame.width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function copyFrameRegion(source, srcX, srcY, width, height, shouldCancel) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    throwIfAtlasCancelled(shouldCancel);
    for (let x = 0; x < width; x++) {
      const src = ((srcY + y) * source.width + (srcX + x)) * 4;
      const dst = (y * width + x) * 4;
      out[dst] = source.rgba[src];
      out[dst + 1] = source.rgba[src + 1];
      out[dst + 2] = source.rgba[src + 2];
      out[dst + 3] = source.rgba[src + 3];
    }
  }
  return out;
}

function planAtlasPlacements(frames, options) {
  const { padding, extrude, layout, columns, maxWidth, maxHeight } = options;
  const { shouldCancel } = options;
  const gutter = padding + extrude;
  const planned = frames.map((frame) => ({
    frame,
    slotWidth: frame.width + gutter * 2,
    slotHeight: frame.height + gutter * 2,
    pageIndex: 0,
    x: 0,
    y: 0,
  }));
  planned.forEach((entry) => {
    throwIfAtlasCancelled(shouldCancel);
    if (maxWidth && entry.slotWidth > maxWidth) {
      throw new Error(
        `buildRgbaAtlas: frame "${entry.frame.name}" slot width ${entry.slotWidth} exceeds maxWidth ${maxWidth}`,
      );
    }
    if (maxHeight && entry.slotHeight > maxHeight) {
      throw new Error(
        `buildRgbaAtlas: frame "${entry.frame.name}" slot height ${entry.slotHeight} exceeds maxHeight ${maxHeight}`,
      );
    }
  });

  const createPage = (index) => ({ index, width: 1, height: 1, placements: [] });
  const pages = [createPage(0)];
  let pageIndex = 0;
  let currentPage = pages[0];
  const startPage = () => {
    pageIndex = pages.length;
    currentPage = createPage(pageIndex);
    pages.push(currentPage);
  };
  const placeEntry = (entry, x, y) => {
    entry.pageIndex = pageIndex;
    entry.x = x;
    entry.y = y;
    currentPage.placements.push(entry);
    currentPage.width = Math.max(currentPage.width, x + entry.slotWidth);
    currentPage.height = Math.max(currentPage.height, y + entry.slotHeight);
  };

  if (layout === "grid") {
    const cols = columns || Math.ceil(Math.sqrt(planned.length));
    let x = 0;
    let y = 0;
    let rowHeight = 0;
    let col = 0;
    planned.forEach((entry) => {
      throwIfAtlasCancelled(shouldCancel);
      if (col >= cols) {
        x = 0;
        y += rowHeight;
        rowHeight = 0;
        col = 0;
      }
      if (maxHeight && y > 0 && y + entry.slotHeight > maxHeight) {
        startPage();
        x = 0;
        y = 0;
        rowHeight = 0;
        col = 0;
      }
      placeEntry(entry, x, y);
      x += entry.slotWidth;
      rowHeight = Math.max(rowHeight, entry.slotHeight);
      col += 1;
    });
  } else if (maxWidth && maxHeight) {
    pages[0].freeRects = [{ x: 0, y: 0, width: maxWidth, height: maxHeight }];
    const placePackedEntry = (entry) => {
      let best = null;
      pages.forEach((page) => {
        throwIfAtlasCancelled(shouldCancel);
        (page.freeRects || []).forEach((rect) => {
          throwIfAtlasCancelled(shouldCancel);
          if (entry.slotWidth > rect.width || entry.slotHeight > rect.height) return;
          const remainingWidth = rect.width - entry.slotWidth;
          const remainingHeight = rect.height - entry.slotHeight;
          const candidate = {
            page,
            x: rect.x,
            y: rect.y,
            shortSideFit: Math.min(remainingWidth, remainingHeight),
            longSideFit: Math.max(remainingWidth, remainingHeight),
            areaFit: rect.width * rect.height - entry.slotWidth * entry.slotHeight,
          };
          if (
            !best ||
            candidate.shortSideFit < best.shortSideFit ||
            (candidate.shortSideFit === best.shortSideFit && candidate.areaFit < best.areaFit) ||
            (candidate.shortSideFit === best.shortSideFit &&
              candidate.areaFit === best.areaFit &&
              candidate.longSideFit < best.longSideFit) ||
            (candidate.shortSideFit === best.shortSideFit &&
              candidate.areaFit === best.areaFit &&
              candidate.longSideFit === best.longSideFit &&
              candidate.page.index < best.page.index) ||
            (candidate.shortSideFit === best.shortSideFit &&
              candidate.areaFit === best.areaFit &&
              candidate.longSideFit === best.longSideFit &&
              candidate.page.index === best.page.index &&
              candidate.y < best.y) ||
            (candidate.shortSideFit === best.shortSideFit &&
              candidate.areaFit === best.areaFit &&
              candidate.longSideFit === best.longSideFit &&
              candidate.page.index === best.page.index &&
              candidate.y === best.y &&
              candidate.x < best.x)
          ) {
            best = candidate;
          }
        });
      });

      if (!best) {
        startPage();
        currentPage.freeRects = [{ x: 0, y: 0, width: maxWidth, height: maxHeight }];
        best = {
          page: currentPage,
          x: 0,
          y: 0,
          shortSideFit: Math.min(maxWidth - entry.slotWidth, maxHeight - entry.slotHeight),
          longSideFit: Math.max(maxWidth - entry.slotWidth, maxHeight - entry.slotHeight),
          areaFit: maxWidth * maxHeight - entry.slotWidth * entry.slotHeight,
        };
      }

      pageIndex = best.page.index;
      currentPage = best.page;
      placeEntry(entry, best.x, best.y);
      splitPackedFreeRects(best.page, {
        x: best.x,
        y: best.y,
        width: entry.slotWidth,
        height: entry.slotHeight,
      });
    };

    planned.forEach(placePackedEntry);
    pages.forEach((page) => {
      throwIfAtlasCancelled(shouldCancel);
      delete page.freeRects;
    });
  } else {
    let x = 0;
    let y = 0;
    let rowHeight = 0;
    planned.forEach((entry) => {
      throwIfAtlasCancelled(shouldCancel);
      if (x > 0 && maxWidth && x + entry.slotWidth > maxWidth) {
        x = 0;
        y += rowHeight;
        rowHeight = 0;
      }
      if (maxHeight && y > 0 && y + entry.slotHeight > maxHeight) {
        startPage();
        x = 0;
        y = 0;
        rowHeight = 0;
      }
      placeEntry(entry, x, y);
      x += entry.slotWidth;
      rowHeight = Math.max(rowHeight, entry.slotHeight);
    });
  }

  return {
    placements: planned,
    width: pages[0].width,
    height: pages[0].height,
    pages,
  };
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function rectContains(a, b) {
  return (
    b.x >= a.x && b.y >= a.y && b.x + b.width <= a.x + a.width && b.y + b.height <= a.y + a.height
  );
}

function splitPackedFreeRects(page, used) {
  const next = [];
  (page.freeRects || []).forEach((rect) => {
    if (!rectsIntersect(rect, used)) {
      next.push(rect);
      return;
    }
    const rectRight = rect.x + rect.width;
    const rectBottom = rect.y + rect.height;
    const usedRight = used.x + used.width;
    const usedBottom = used.y + used.height;
    if (used.x > rect.x) {
      next.push({ x: rect.x, y: rect.y, width: used.x - rect.x, height: rect.height });
    }
    if (usedRight < rectRight) {
      next.push({ x: usedRight, y: rect.y, width: rectRight - usedRight, height: rect.height });
    }
    if (used.y > rect.y) {
      next.push({ x: rect.x, y: rect.y, width: rect.width, height: used.y - rect.y });
    }
    if (usedBottom < rectBottom) {
      next.push({ x: rect.x, y: usedBottom, width: rect.width, height: rectBottom - usedBottom });
    }
  });

  const filtered = next.filter((rect) => rect.width > 0 && rect.height > 0);
  const pruned = [];
  filtered.forEach((rect, index) => {
    const contained = filtered.some(
      (candidate, candidateIndex) => candidateIndex !== index && rectContains(candidate, rect),
    );
    if (!contained) pruned.push(rect);
  });
  pruned.sort((a, b) => a.y - b.y || a.x - b.x || a.width - b.width || a.height - b.height);
  page.freeRects = pruned;
}

function setRgbaPixel(rgba, atlasWidth, x, y, color) {
  const idx = (y * atlasWidth + x) * 4;
  rgba[idx] = color[0];
  rgba[idx + 1] = color[1];
  rgba[idx + 2] = color[2];
  rgba[idx + 3] = color[3];
}

function getFramePixel(frame, x, y) {
  const idx = (y * frame.width + x) * 4;
  return [frame.rgba[idx], frame.rgba[idx + 1], frame.rgba[idx + 2], frame.rgba[idx + 3]];
}

function writeFrameWithExtrusion(atlasRgba, atlasWidth, placement, options) {
  const { frame, shouldCancel } = placement;
  const frameX = placement.x + options.padding + options.extrude;
  const frameY = placement.y + options.padding + options.extrude;

  for (let y = 0; y < frame.height; y++) {
    throwIfAtlasCancelled(shouldCancel);
    for (let x = 0; x < frame.width; x++) {
      setRgbaPixel(atlasRgba, atlasWidth, frameX + x, frameY + y, getFramePixel(frame, x, y));
    }
  }

  for (let e = 1; e <= options.extrude; e++) {
    throwIfAtlasCancelled(shouldCancel);
    for (let y = 0; y < frame.height; y++) {
      setRgbaPixel(atlasRgba, atlasWidth, frameX - e, frameY + y, getFramePixel(frame, 0, y));
      setRgbaPixel(
        atlasRgba,
        atlasWidth,
        frameX + frame.width - 1 + e,
        frameY + y,
        getFramePixel(frame, frame.width - 1, y),
      );
    }
    for (let x = 0; x < frame.width; x++) {
      setRgbaPixel(atlasRgba, atlasWidth, frameX + x, frameY - e, getFramePixel(frame, x, 0));
      setRgbaPixel(
        atlasRgba,
        atlasWidth,
        frameX + x,
        frameY + frame.height - 1 + e,
        getFramePixel(frame, x, frame.height - 1),
      );
    }
    setRgbaPixel(atlasRgba, atlasWidth, frameX - e, frameY - e, getFramePixel(frame, 0, 0));
    setRgbaPixel(
      atlasRgba,
      atlasWidth,
      frameX + frame.width - 1 + e,
      frameY - e,
      getFramePixel(frame, frame.width - 1, 0),
    );
    setRgbaPixel(
      atlasRgba,
      atlasWidth,
      frameX - e,
      frameY + frame.height - 1 + e,
      getFramePixel(frame, 0, frame.height - 1),
    );
    setRgbaPixel(
      atlasRgba,
      atlasWidth,
      frameX + frame.width - 1 + e,
      frameY + frame.height - 1 + e,
      getFramePixel(frame, frame.width - 1, frame.height - 1),
    );
  }
}

/**
 * Build a deterministic DOM-free RGBA atlas from typed frame data.
 * @param {Array<{name?: string, width: number, height: number, rgba: Uint8ClampedArray|Uint8Array, pivot?: object, animation?: object}>} frames
 * @param {object} [options]
 * @returns {{width: number, height: number, rgba: Uint8ClampedArray, frames: Array, meta: object}}
 */
export function buildRgbaAtlas(frames, options = {}) {
  const shouldCancel = typeof options.shouldCancel === "function" ? options.shouldCancel : null;
  throwIfAtlasCancelled(shouldCancel);
  if (!Array.isArray(frames)) {
    throw new Error("buildRgbaAtlas: frames must be an array");
  }
  if (frames.length === 0) {
    throw new Error("buildRgbaAtlas: at least one frame is required");
  }
  validateAtlasPixelBudget(frames, shouldCancel);

  const padding = options.padding ?? 0;
  const extrude = options.extrude ?? 0;
  const layout = options.layout || "packed";
  const columns = options.columns ?? 0;
  const maxWidth = options.maxWidth ?? 0;
  const maxHeight = options.maxHeight ?? 0;

  assertNonNegativeInt(padding, "buildRgbaAtlas: padding", 256);
  assertNonNegativeInt(extrude, "buildRgbaAtlas: extrude", 64);
  if (layout !== "packed" && layout !== "grid") {
    throw new Error(`buildRgbaAtlas: layout must be "packed" or "grid", got ${layout}`);
  }
  if (columns !== 0) assertPositiveInt(columns, "buildRgbaAtlas: columns");
  if (maxWidth !== 0) assertPositiveInt(maxWidth, "buildRgbaAtlas: maxWidth", 32768);
  if (maxHeight !== 0) assertPositiveInt(maxHeight, "buildRgbaAtlas: maxHeight", 32768);

  const frameNames = new Set();
  const prepared = frames.map((frame, index) => {
    const normalized = normalizeRgbaFrame(frame, index);
    throwIfAtlasCancelled(shouldCancel);
    if (frameNames.has(normalized.name)) {
      throw new Error(
        `buildRgbaAtlas: frame name "${normalized.name}" is duplicated; frame names must be unique`,
      );
    }
    frameNames.add(normalized.name);
    const trim = options.trim
      ? findTrimBounds(normalized, shouldCancel)
      : {
          x: 0,
          y: 0,
          width: normalized.width,
          height: normalized.height,
        };
    return {
      ...normalized,
      sourceWidth: normalized.width,
      sourceHeight: normalized.height,
      sourceName: normalized.name,
      rgba: copyFrameRegion(normalized, trim.x, trim.y, trim.width, trim.height, shouldCancel),
      width: trim.width,
      height: trim.height,
      trim,
    };
  });

  const { placements, pages } = planAtlasPlacements(prepared, {
    padding,
    extrude,
    layout,
    columns,
    maxWidth,
    maxHeight,
    shouldCancel,
  });

  const atlasPixels = pages.reduce((sum, page) => sum + page.width * page.height, 0);
  if (!Number.isSafeInteger(atlasPixels) || atlasPixels > MAX_RGBA_ATLAS_PIXELS) {
    throw new Error(
      `buildRgbaAtlas: output pages must contain at most ${MAX_RGBA_ATLAS_PIXELS} decoded pixels in total`,
    );
  }

  const atlasPages = pages.map((page) => {
    throwIfAtlasCancelled(shouldCancel);
    return {
      index: page.index,
      width: page.width,
      height: page.height,
      rgba: new Uint8ClampedArray(page.width * page.height * 4),
    };
  });
  const atlasFrames = placements.map((placement) => {
    throwIfAtlasCancelled(shouldCancel);
    const page = atlasPages[placement.pageIndex];
    writeFrameWithExtrusion(
      page.rgba,
      page.width,
      { ...placement, shouldCancel },
      { padding, extrude },
    );
    const frameX = placement.x + padding + extrude;
    const frameY = placement.y + padding + extrude;
    return {
      name: placement.frame.name,
      page: placement.pageIndex,
      pageIndex: placement.pageIndex,
      x: frameX,
      y: frameY,
      width: placement.frame.width,
      height: placement.frame.height,
      sourceWidth: placement.frame.sourceWidth,
      sourceHeight: placement.frame.sourceHeight,
      trim: { ...placement.frame.trim },
      pivot: placement.frame.pivot ? { ...placement.frame.pivot } : undefined,
      animation: placement.frame.animation ? { ...placement.frame.animation } : undefined,
      u: frameX / page.width,
      v: frameY / page.height,
      uw: placement.frame.width / page.width,
      uh: placement.frame.height / page.height,
    };
  });
  const firstPage = atlasPages[0];

  return {
    width: firstPage.width,
    height: firstPage.height,
    rgba: firstPage.rgba,
    pages: atlasPages,
    frames: atlasFrames,
    meta: {
      layout,
      padding,
      extrude,
      trim: !!options.trim,
      maxWidth: maxWidth || undefined,
      maxHeight: maxHeight || undefined,
      pageCount: atlasPages.length,
    },
  };
}

function validateRgbaAtlas(atlas, functionName) {
  if (!atlas || typeof atlas !== "object") {
    throw new Error(`${functionName}: atlas must be an object`);
  }
  assertPositiveInt(atlas.width, `${functionName}: atlas.width`, 32768);
  assertPositiveInt(atlas.height, `${functionName}: atlas.height`, 32768);
  if (!Array.isArray(atlas.frames)) {
    throw new Error(`${functionName}: atlas.frames must be an array`);
  }
}

function isFrameTrimmed(frame) {
  return (
    !!frame.trim &&
    (frame.trim.x !== 0 ||
      frame.trim.y !== 0 ||
      frame.width !== frame.sourceWidth ||
      frame.height !== frame.sourceHeight)
  );
}

function cloneOptional(value) {
  return value && typeof value === "object" ? { ...value } : undefined;
}

function createAtlasFrameMetadata(frame) {
  const trimmed = isFrameTrimmed(frame);
  const pageIndex = Number.isInteger(frame.pageIndex)
    ? frame.pageIndex
    : Number.isInteger(frame.page)
      ? frame.page
      : 0;
  const entry = {
    page: pageIndex,
    pageIndex,
    frame: { x: frame.x, y: frame.y, w: frame.width, h: frame.height },
    rotated: false,
    trimmed,
    spriteSourceSize: {
      x: frame.trim ? frame.trim.x : 0,
      y: frame.trim ? frame.trim.y : 0,
      w: frame.width,
      h: frame.height,
    },
    sourceSize: {
      w: frame.sourceWidth || frame.width,
      h: frame.sourceHeight || frame.height,
    },
    uv: {
      u: frame.u,
      v: frame.v,
      u1: frame.u + frame.uw,
      v1: frame.v + frame.uh,
      uw: frame.uw,
      uh: frame.uh,
    },
  };
  const pivot = cloneOptional(frame.pivot);
  const animation = cloneOptional(frame.animation);
  if (pivot) entry.pivot = pivot;
  if (animation) entry.animation = animation;
  return entry;
}

/**
 * Export engine-neutral JSON metadata for a DOM-free RGBA atlas.
 * @param {object} atlas - Result from buildRgbaAtlas().
 * @param {object} [options]
 * @param {string} [options.image='atlas.png'] - Image filename paired with the RGBA bytes.
 * @returns {{format: string, image: string, size: object, meta: object, frames: object}}
 */
export function exportRgbaAtlasMetadata(atlas, options = {}) {
  validateRgbaAtlas(atlas, "exportRgbaAtlasMetadata");
  const image = options.image || "atlas.png";
  const frames = {};
  atlas.frames.forEach((frame) => {
    frames[frame.name] = createAtlasFrameMetadata(frame);
  });
  const pages = Array.isArray(atlas.pages)
    ? atlas.pages.map((page) => ({ index: page.index, width: page.width, height: page.height }))
    : [{ index: 0, width: atlas.width, height: atlas.height }];

  return {
    format: "grout-rgba-atlas",
    image,
    size: { w: atlas.width, h: atlas.height },
    pages,
    meta: { ...(atlas.meta || {}) },
    frames,
  };
}

/**
 * Export Phaser-compatible JSON-hash metadata for a DOM-free RGBA atlas.
 * @param {object} atlas - Result from buildRgbaAtlas().
 * @param {object} [options]
 * @param {string} [options.image='atlas.png'] - Image filename paired with the RGBA bytes.
 * @param {number} [options.version=3] - Phaser major version, 3 or 4.
 * @returns {{format: string, frames: object, meta: object}}
 */
export function exportPhaserAtlasMetadata(atlas, options = {}) {
  validateRgbaAtlas(atlas, "exportPhaserAtlasMetadata");
  const version = options.version ?? 3;
  if (version !== 3 && version !== 4) {
    throw new Error(`exportPhaserAtlasMetadata: version must be 3 or 4, got ${version}`);
  }
  const image = options.image || "atlas.png";
  const frames = {};
  atlas.frames.forEach((frame) => {
    frames[frame.name] = createAtlasFrameMetadata(frame);
  });

  return {
    format: `phaser${version}-json-hash`,
    frames,
    meta: {
      app: "grout-render",
      image,
      format: "RGBA8888",
      size: { w: atlas.width, h: atlas.height },
      pages: Array.isArray(atlas.pages)
        ? atlas.pages.map((page) => ({ index: page.index, width: page.width, height: page.height }))
        : [{ index: 0, width: atlas.width, height: atlas.height }],
      scale: "1",
    },
  };
}

/**
 * Export Three.js-oriented UV metadata for a DOM-free RGBA atlas.
 * @param {object} atlas - Result from buildRgbaAtlas().
 * @param {object} [options]
 * @param {string} [options.image='atlas.png'] - Image filename paired with the RGBA bytes.
 * @returns {{format: string, image: string, size: object, frames: Array}}
 */
export function exportThreeAtlasMetadata(atlas, options = {}) {
  validateRgbaAtlas(atlas, "exportThreeAtlasMetadata");
  const image = options.image || "atlas.png";
  return {
    format: "three-uv-atlas",
    image,
    size: { w: atlas.width, h: atlas.height },
    pages: Array.isArray(atlas.pages)
      ? atlas.pages.map((page) => ({ index: page.index, width: page.width, height: page.height }))
      : [{ index: 0, width: atlas.width, height: atlas.height }],
    frames: atlas.frames.map((frame) => {
      const entry = createAtlasFrameMetadata(frame);
      const threeOffsetY = 1 - entry.uv.v - entry.uv.uh;
      return {
        name: frame.name,
        page: entry.page,
        pageIndex: entry.pageIndex,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        sourceWidth: frame.sourceWidth || frame.width,
        sourceHeight: frame.sourceHeight || frame.height,
        trim: frame.trim
          ? { ...frame.trim }
          : { x: 0, y: 0, width: frame.width, height: frame.height },
        uv: entry.uv,
        offset: { x: entry.uv.u, y: threeOffsetY },
        repeat: { x: entry.uv.uw, y: entry.uv.uh },
        pivot: cloneOptional(frame.pivot),
        animation: cloneOptional(frame.animation),
      };
    }),
  };
}

/**
 * Extract an atlas frame into a new RGBA buffer.
 * @param {object} atlas - Result from buildRgbaAtlas().
 * @param {string|number} frameRef - Frame name or index.
 * @returns {{name: string, width: number, height: number, rgba: Uint8ClampedArray, frame: object}}
 */
export function extractAtlasFrameRgba(atlas, frameRef) {
  if (!atlas || typeof atlas !== "object") {
    throw new Error("extractAtlasFrameRgba: atlas must be an object");
  }
  if (!(atlas.rgba instanceof Uint8ClampedArray) && !(atlas.rgba instanceof Uint8Array)) {
    throw new Error("extractAtlasFrameRgba: atlas.rgba must be a Uint8ClampedArray or Uint8Array");
  }
  assertPositiveInt(atlas.width, "extractAtlasFrameRgba: atlas.width", 32768);
  assertPositiveInt(atlas.height, "extractAtlasFrameRgba: atlas.height", 32768);
  const frame =
    typeof frameRef === "number"
      ? atlas.frames && atlas.frames[frameRef]
      : atlas.frames && atlas.frames.find((candidate) => candidate.name === frameRef);
  if (!frame) {
    throw new Error(`extractAtlasFrameRgba: frame not found: ${frameRef}`);
  }
  const pageIndex = Number.isInteger(frame.pageIndex)
    ? frame.pageIndex
    : Number.isInteger(frame.page)
      ? frame.page
      : 0;
  const page = Array.isArray(atlas.pages) ? atlas.pages[pageIndex] : atlas;
  if (!page) {
    throw new Error(`extractAtlasFrameRgba: page not found: ${pageIndex}`);
  }
  assertPositiveInt(page.width, "extractAtlasFrameRgba: page.width", 32768);
  assertPositiveInt(page.height, "extractAtlasFrameRgba: page.height", 32768);
  if (!(page.rgba instanceof Uint8ClampedArray) && !(page.rgba instanceof Uint8Array)) {
    throw new Error("extractAtlasFrameRgba: page.rgba must be a Uint8ClampedArray or Uint8Array");
  }

  const out = new Uint8ClampedArray(frame.width * frame.height * 4);
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      const src = ((frame.y + y) * page.width + (frame.x + x)) * 4;
      const dst = (y * frame.width + x) * 4;
      out[dst] = page.rgba[src];
      out[dst + 1] = page.rgba[src + 1];
      out[dst + 2] = page.rgba[src + 2];
      out[dst + 3] = page.rgba[src + 3];
    }
  }

  return {
    name: frame.name,
    width: frame.width,
    height: frame.height,
    rgba: out,
    frame: { ...frame },
  };
}

/**
 * Slice a DOM-free RGBA atlas into fixed-grid tiles.
 * @param {{width: number, height: number, rgba: Uint8ClampedArray|Uint8Array}} source
 * @param {number} tileWidth
 * @param {number} tileHeight
 * @param {object} [options]
 * @returns {Array<{name: string, col: number, row: number, x: number, y: number, width: number, height: number, rgba: Uint8ClampedArray}>}
 */
export function sliceRgbaAtlasGrid(source, tileWidth, tileHeight, options = {}) {
  if (!source || typeof source !== "object") {
    throw new Error("sliceRgbaAtlasGrid: source must be an object");
  }
  assertPositiveInt(source.width, "sliceRgbaAtlasGrid: source.width", 32768);
  assertPositiveInt(source.height, "sliceRgbaAtlasGrid: source.height", 32768);
  if (!(source.rgba instanceof Uint8ClampedArray) && !(source.rgba instanceof Uint8Array)) {
    throw new Error("sliceRgbaAtlasGrid: source.rgba must be a Uint8ClampedArray or Uint8Array");
  }
  assertPositiveInt(tileWidth, "sliceRgbaAtlasGrid: tileWidth");
  assertPositiveInt(tileHeight, "sliceRgbaAtlasGrid: tileHeight");

  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? 0;
  const spacingX = options.spacingX ?? 0;
  const spacingY = options.spacingY ?? 0;
  const maxTiles = options.maxTiles ?? 0;
  const namePrefix = options.namePrefix || "tile";

  assertNonNegativeInt(offsetX, "sliceRgbaAtlasGrid: offsetX");
  assertNonNegativeInt(offsetY, "sliceRgbaAtlasGrid: offsetY");
  assertNonNegativeInt(spacingX, "sliceRgbaAtlasGrid: spacingX");
  assertNonNegativeInt(spacingY, "sliceRgbaAtlasGrid: spacingY");
  assertNonNegativeInt(maxTiles, "sliceRgbaAtlasGrid: maxTiles");

  const tiles = [];
  const cols = Math.floor((source.width - offsetX + spacingX) / (tileWidth + spacingX));
  const rows = Math.floor((source.height - offsetY + spacingY) / (tileHeight + spacingY));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (maxTiles > 0 && tiles.length >= maxTiles) break;
      const x = offsetX + col * (tileWidth + spacingX);
      const y = offsetY + row * (tileHeight + spacingY);
      if (x + tileWidth > source.width || y + tileHeight > source.height) continue;

      const rgba = new Uint8ClampedArray(tileWidth * tileHeight * 4);
      for (let py = 0; py < tileHeight; py++) {
        for (let px = 0; px < tileWidth; px++) {
          const src = ((y + py) * source.width + (x + px)) * 4;
          const dst = (py * tileWidth + px) * 4;
          rgba[dst] = source.rgba[src];
          rgba[dst + 1] = source.rgba[src + 1];
          rgba[dst + 2] = source.rgba[src + 2];
          rgba[dst + 3] = source.rgba[src + 3];
        }
      }
      tiles.push({
        name: `${namePrefix}_${col}_${row}`,
        col,
        row,
        x,
        y,
        width: tileWidth,
        height: tileHeight,
        rgba,
      });
    }
  }

  return tiles;
}
