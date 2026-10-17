import {
  importSpriteLayers,
  type SpriteImportLayer,
  type SpriteImportOptions,
} from "../../packages/grout-art/index.mjs";

type Decoder = {
  completed: Promise<void>;
  tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null };
  decode(options: {
    frameIndex: number;
    completeFramesOnly: boolean;
  }): Promise<{ image: VideoFrame }>;
  close(): void;
};
type DecoderConstructor = new (options: {
  data: Uint8Array;
  type: string;
  colorSpaceConversion: string;
  preferAnimation: boolean;
}) => Decoder;

/** Decode full composited GIF frames, preserving their timeline and layer identity. */
export async function importSpriteFiles(
  files: File[],
  options: SpriteImportOptions,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  if (!files.length || files.length > 16) throw new Error("Choose 1–16 aligned PNG or GIF layers");
  if (files.reduce((n, f) => n + f.size, 0) > 16 * 1024 * 1024)
    throw new Error("Choose images totaling no more than 16 MiB");
  const layers: SpriteImportLayer[] = [];
  let decodedPixels = 0;
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    signal.throwIfAborted();
    const view = new DataView(bytes.buffer);
    const png =
      bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
    const gif =
      bytes.length >= 13 && /^GIF8[79]a$/.test(String.fromCharCode(...bytes.subarray(0, 6)));
    if (!png && !gif) throw new Error(`${file.name}: choose a valid PNG or GIF`);
    const width = png ? view.getUint32(16) : view.getUint16(6, true),
      height = png ? view.getUint32(20) : view.getUint16(8, true);
    if (!width || !height || width > 8192 || height > 8192 || width * height > 1048576)
      throw new Error("Sprite import supports at most 1,048,576 decoded source pixels");
    if (png)
      for (let p = 8; p + 12 <= bytes.length;) {
        const length = view.getUint32(p),
          type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
        if (type === "acTL")
          throw new Error("Animated PNG is not supported; use GIF or a PNG grid sheet");
        if (length > bytes.length - p - 12) throw new Error("Truncated PNG chunk");
        p += length + 12;
      }
    const sourceSha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    signal.throwIfAborted();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not decode sprite pixels");
    const frames: SpriteImportLayer["frames"] = [],
      durationsMs: number[] = [];
    const capture = (source: CanvasImageSource) => {
      context.clearRect(0, 0, width, height);
      context.drawImage(source, 0, 0);
      frames.push({ width, height, data: context.getImageData(0, 0, width, height).data });
    };
    if (gif) {
      const ImageDecoder = (globalThis as unknown as { ImageDecoder?: DecoderConstructor })
        .ImageDecoder;
      if (!ImageDecoder)
        throw new Error(
          "Animated GIF decoding is unavailable in this browser. Use Chrome/Edge or a PNG grid sheet.",
        );
      const decoder = new ImageDecoder({
        data: bytes,
        type: "image/gif",
        colorSpaceConversion: "none",
        preferAnimation: true,
      });
      const cancel = () => decoder.close();
      signal.addEventListener("abort", cancel, { once: true });
      try {
        await decoder.completed;
        await decoder.tracks.ready;
        signal.throwIfAborted();
        const count = decoder.tracks.selectedTrack?.frameCount ?? 0;
        decodedPixels += width * height * count;
        if (count < 1 || count > 256 || decodedPixels > 1048576)
          throw new Error("GIF exceeds the decoded frame/pixel budget");
        for (let frameIndex = 0; frameIndex < count; frameIndex++) {
          signal.throwIfAborted();
          const { image } = await decoder.decode({ frameIndex, completeFramesOnly: true });
          try {
            signal.throwIfAborted();
            if (image.displayWidth !== width || image.displayHeight !== height)
              throw new Error("GIF frame dimensions do not match its sheet");
            capture(image);
            durationsMs.push((image.duration ?? 0) / 1000);
          } finally {
            image.close();
          }
        }
      } finally {
        signal.removeEventListener("abort", cancel);
        decoder.close();
      }
    } else {
      decodedPixels += width * height;
      if (decodedPixels > 1048576) throw new Error("Images exceed the decoded pixel budget");
      const bitmap = await createImageBitmap(file, {
        colorSpaceConversion: "none",
        premultiplyAlpha: "none",
      });
      try {
        signal.throwIfAborted();
        capture(bitmap);
      } finally {
        bitmap.close();
      }
    }
    layers.push({
      name: file.name.replace(/\.(png|gif)$/i, ""),
      sourceName: file.name,
      sourceSha256,
      frames,
      ...(frames.length > 1 ? { durationsMs } : {}),
    });
  }
  return importSpriteLayers(
    layers,
    { ...options, name: options.name ?? files[0].name.replace(/\.(png|gif)$/i, "").slice(0, 120) },
    { signal },
  );
}
