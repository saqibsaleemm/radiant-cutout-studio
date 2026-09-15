/**
 * Client-side cutout engine helpers.
 * The heavy AI model is loaded lazily in the browser only.
 */

export const ACCEPTED_TYPES = ["image/png", "image/jpeg"] as const;
export const MAX_OUTPUT_EDGE = 3840; // 4K long edge
const MAX_MODEL_EDGE = 2048; // model input cap, keeps it fast on mobile

export type Progress = { label: string; value: number };

export function isSupportedFile(file: File) {
  return (ACCEPTED_TYPES as readonly string[]).includes(file.type);
}

export function createCanvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

export function ctxOf(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  return ctx;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image could not be opened."));
    img.src = src;
  });
}

export function fitWithin(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Draw an image onto a fresh canvas, capped to 4K on the long edge. */
export async function fileToCanvas(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, MAX_OUTPUT_EDGE);
    const canvas = createCanvas(width, height);
    ctxOf(canvas).drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not export the image."))),
      type,
      quality,
    );
  });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(blob);
  });
}

function maskFromImage(source: HTMLCanvasElement, cut: HTMLImageElement) {
  const mask = createCanvas(source.width, source.height);
  const mctx = ctxOf(mask);
  mctx.imageSmoothingQuality = "high";
  mctx.drawImage(cut, 0, 0, source.width, source.height);
  return mask;
}

/**
 * Removes the background with the remove.bg service (highest accuracy on hair
 * and transparent objects). Returns a mask canvas the size of `source`.
 */
export async function buildMaskRemote(
  source: HTMLCanvasElement,
  onProgress?: (p: Progress) => void,
): Promise<HTMLCanvasElement> {
  const { removeBackgroundRemote } = await import("@/lib/removebg.functions");

  const small = fitWithin(source.width, source.height, MAX_MODEL_EDGE);
  const input = createCanvas(small.width, small.height);
  ctxOf(input).drawImage(source, 0, 0, small.width, small.height);
  const inputBlob = await canvasToBlob(input);

  onProgress?.({ label: "Sending to the AI cutout service", value: 30 });
  const imageBase64 = await blobToBase64(inputBlob);
  const { pngBase64 } = await removeBackgroundRemote({ data: { imageBase64 } });

  onProgress?.({ label: "Detecting edges", value: 80 });
  const cut = await loadImage(`data:image/png;base64,${pngBase64}`);
  const mask = maskFromImage(source, cut);
  onProgress?.({ label: "Finishing up", value: 100 });
  return mask;
}

/**
 * Runs the on-device AI segmentation model and returns a mask canvas the size of
 * `source`. Used as a fallback when the cutout service is unavailable.
 */
export async function buildMask(
  source: HTMLCanvasElement,
  onProgress?: (p: Progress) => void,
): Promise<HTMLCanvasElement> {
  const { removeBackground } = await import("@imgly/background-removal");

  const small = fitWithin(source.width, source.height, MAX_MODEL_EDGE);
  const input = createCanvas(small.width, small.height);
  ctxOf(input).drawImage(source, 0, 0, small.width, small.height);
  const inputBlob = await canvasToBlob(input);


  const resultBlob = await removeBackground(inputBlob, {
    output: { format: "image/png", quality: 1 },
    progress: (key, current, total) => {
      const share = total > 0 ? current / total : 0;
      const downloading = key.startsWith("fetch");
      onProgress?.({
        label: downloading ? "Loading the AI model" : "Detecting edges",
        value: Math.round((downloading ? share * 55 : 55 + share * 40) || 0),
      });
    },
  });

  const url = URL.createObjectURL(resultBlob);
  try {
    const cut = await loadImage(url);
    const mask = createCanvas(source.width, source.height);
    const mctx = ctxOf(mask);
    mctx.imageSmoothingQuality = "high";
    mctx.drawImage(cut, 0, 0, source.width, source.height);
    onProgress?.({ label: "Finishing up", value: 100 });
    return mask;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type BackgroundOption =
  | { type: "transparent" }
  | { type: "color"; color: string }
  | { type: "gradient"; from: string; to: string; angle: number }
  | { type: "image"; image: HTMLImageElement };

/** Paint the chosen background across a canvas context. */
function paintBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bg: BackgroundOption,
) {
  if (bg.type === "transparent") return;

  if (bg.type === "color") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (bg.type === "gradient") {
    const rad = ((bg.angle - 90) * Math.PI) / 180;
    const cx = width / 2;
    const cy = height / 2;
    const len = Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad));
    const gradient = ctx.createLinearGradient(
      cx - (Math.cos(rad) * len) / 2,
      cy - (Math.sin(rad) * len) / 2,
      cx + (Math.cos(rad) * len) / 2,
      cy + (Math.sin(rad) * len) / 2,
    );
    gradient.addColorStop(0, bg.from);
    gradient.addColorStop(1, bg.to);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const img = bg.image;
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
}

/** Composite source + mask (+ feather) + background into `target`. */
export function renderComposite(
  target: HTMLCanvasElement,
  source: HTMLCanvasElement,
  mask: HTMLCanvasElement,
  feather: number,
  bg: BackgroundOption,
) {
  const { width, height } = source;
  if (target.width !== width || target.height !== height) {
    target.width = width;
    target.height = height;
  }

  const cut = createCanvas(width, height);
  const cctx = ctxOf(cut);
  cctx.drawImage(source, 0, 0);
  cctx.globalCompositeOperation = "destination-in";
  if (feather > 0) cctx.filter = `blur(${feather}px)`;
  cctx.drawImage(mask, 0, 0);
  cctx.filter = "none";
  cctx.globalCompositeOperation = "source-over";

  const tctx = ctxOf(target);
  tctx.clearRect(0, 0, width, height);
  paintBackground(tctx, width, height, bg);
  tctx.drawImage(cut, 0, 0);
}

export async function exportCanvas(canvas: HTMLCanvasElement, format: "png" | "jpeg") {
  if (format === "png") return canvasToBlob(canvas, "image/png");
  const flat = createCanvas(canvas.width, canvas.height);
  const ctx = ctxOf(flat);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  return canvasToBlob(flat, "image/jpeg", 0.95);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Soft round brush stroke on the mask. `mode` erases or restores the subject. */
export function paintStroke(
  mask: HTMLCanvasElement,
  mode: "erase" | "restore",
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
  hardness: number,
) {
  const ctx = ctxOf(mask);
  ctx.save();
  ctx.globalCompositeOperation = mode === "erase" ? "destination-out" : "source-over";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (radius / 3)));
  const inner = Math.max(0.01, Math.min(0.99, hardness));

  for (let i = 0; i <= steps; i += 1) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    const gradient = ctx.createRadialGradient(x, y, radius * inner, x, y, radius);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function cloneCanvas(canvas: HTMLCanvasElement) {
  const copy = createCanvas(canvas.width, canvas.height);
  ctxOf(copy).drawImage(canvas, 0, 0);
  return copy;
}
