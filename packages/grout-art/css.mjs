import { parseRecipe } from "./core.mjs";

export const CSS_ATLAS_FORMAT = "grout-art-css/1";
const MAX_CSS_BYTES = 2 * 1048576;
const encoder = new TextEncoder();
const number = (value) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
const cssClass = (prefix, kind, id) => `.${prefix}-${kind}-${id}`;
const frameState = (frame, page) => [
  `left:${frame.trim.x}px`,
  `top:${frame.trim.y}px`,
  `width:${frame.width}px`,
  `height:${frame.height}px`,
  `background-image:url("atlas-${frame.pageIndex}.png")`,
  `background-position:-${frame.x}px -${frame.y}px`,
  `background-size:${page.width}px ${page.height}px`,
].join(";");
const frameRule = (selector, frame, page) =>
  `${selector}::before{${frameState(frame, page)};content:"";position:absolute;image-rendering:pixelated;background-repeat:no-repeat}`;

/** Build CSS frame classes and discrete clip playback for an existing atlas export. */
export function buildArtCss(kit, { classPrefix = "grout-art", signal } = {}) {
  signal?.throwIfAborted();
  if (typeof classPrefix !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/.test(classPrefix))
    throw Error("CSS class prefix must be 1..64 safe ASCII characters and start with a letter or underscore");
  if (!kit || !Array.isArray(kit.atlas?.pages) || !Array.isArray(kit.atlas?.frames))
    throw Error("CSS export requires a packed art export kit");
  const recipe = parseRecipe(kit.recipe), pages = kit.atlas.pages;
  if (!pages.length || pages.length > 256) throw Error("CSS export: invalid atlas page count");
  const pageByIndex = new Map();
  for (const page of pages) {
    if (!Number.isInteger(page.index) || page.index < 0 || page.index >= pages.length || pageByIndex.has(page.index) ||
        !Number.isInteger(page.width) || page.width < 1 || !Number.isInteger(page.height) || page.height < 1)
      throw Error("CSS export: invalid atlas page metadata");
    pageByIndex.set(page.index, page);
  }
  const atlasFrames = new Map(kit.atlas.frames.map((frame) => [frame.name, frame]));
  if (atlasFrames.size !== recipe.frames.length || recipe.frames.some((frame) => !atlasFrames.has(frame.name)))
    throw Error("CSS export: atlas frames do not match recipe frames");

  const rules = [];
  let cssBytes = 0;
  const addRule = (rule) => {
    cssBytes += encoder.encode(rule).length + 1;
    if (cssBytes > MAX_CSS_BYTES) throw Error("CSS export exceeds 2 MiB");
    rules.push(rule);
  };
  addRule(`/* ${CSS_ATLAS_FORMAT}; boxes use the source-frame top-left origin; anchors remain in atlas.json. */`);
  for (const page of pages) addRule(`/* atlas-${page.index}.png: ${page.width}x${page.height} */`);
  const frameMetadata = [];
  for (const source of recipe.frames) {
    signal?.throwIfAborted();
    const frame = atlasFrames.get(source.name), page = pageByIndex.get(frame.pageIndex);
    if (!page || ![frame.x, frame.y, frame.width, frame.height, frame.sourceWidth, frame.sourceHeight,
      frame.trim?.x, frame.trim?.y].every(Number.isInteger) || frame.width < 1 || frame.height < 1 ||
        frame.sourceWidth < 1 || frame.sourceHeight < 1 || frame.trim.x < 0 || frame.trim.y < 0 ||
        frame.trim.x + frame.width > frame.sourceWidth || frame.trim.y + frame.height > frame.sourceHeight ||
        frame.x < 0 || frame.y < 0 || frame.x + frame.width > page.width || frame.y + frame.height > page.height)
      throw Error("CSS export: invalid atlas frame geometry for " + source.name);
    const selector = cssClass(classPrefix, "frame", source.name);
    addRule(`${selector}{display:inline-block;position:relative;overflow:hidden;vertical-align:top;width:${frame.sourceWidth}px;height:${frame.sourceHeight}px;image-rendering:pixelated}`);
    addRule(frameRule(selector, frame, page));
    frameMetadata.push({ name: source.name, selector, page: frame.pageIndex,
      sourceSize: { width: frame.sourceWidth, height: frame.sourceHeight },
      trim: { ...frame.trim }, anchor: [...source.anchor] });
  }

  const clipMetadata = [];
  for (const [id, clip] of Object.entries(recipe.clips)) {
    signal?.throwIfAborted();
    const selector = cssClass(classPrefix, "clip", id), clipFrames = clip.frames.map((name) => atlasFrames.get(name));
    if (!clipFrames.length || clipFrames.some((frame) => !frame)) throw Error("CSS export: invalid clip frames for " + id);
    const width = Math.max(...clipFrames.map((frame) => frame.sourceWidth));
    const height = Math.max(...clipFrames.map((frame) => frame.sourceHeight));
    const duration = clip.frames.length / clip.fps;
    addRule(`${selector}{display:inline-block;position:relative;overflow:hidden;vertical-align:top;width:${width}px;height:${height}px;image-rendering:pixelated}`);
    addRule(frameRule(selector, clipFrames[0], pageByIndex.get(clipFrames[0].pageIndex)));
    const animation = `${classPrefix}-play-${id}`;
    addRule(`${selector}::before{animation:${animation} ${number(duration)}s infinite}`);
    let keyframes = `@keyframes ${animation}{`;
    let keyframesBytes = encoder.encode(keyframes).length;
    for (let index = 0; index < clipFrames.length; index++) {
      signal?.throwIfAborted();
      const percent = number(index * 100 / clipFrames.length), frame = clipFrames[index], page = pageByIndex.get(frame.pageIndex);
      const entry = `${percent}%{${frameState(frame, page)};animation-timing-function:steps(1,end)}`;
      keyframes += entry;
      keyframesBytes += encoder.encode(entry).length;
      if (cssBytes + keyframesBytes + 2 > MAX_CSS_BYTES) throw Error("CSS export exceeds 2 MiB");
    }
    const last = clipFrames.at(-1), lastPage = pageByIndex.get(last.pageIndex);
    keyframes += `100%{${frameState(last, lastPage)}}}`;
    addRule(keyframes);
    clipMetadata.push({ name: id, selector, frames: [...clip.frames], fps: clip.fps, durationSeconds: duration });
  }
  const css = rules.join("\n") + "\n";
  return { css, metadata: { format: CSS_ATLAS_FORMAT, path: "atlas.css", classPrefix,
    sourceSize: { width: recipe.width, height: recipe.height }, frames: frameMetadata, clips: clipMetadata } };
}
