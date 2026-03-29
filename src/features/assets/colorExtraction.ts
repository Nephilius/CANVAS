import { toAssetUrl } from "../../utils/assets";

const hexFromRgb = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();

const colorDistance = (
  left: { r: number; g: number; b: number },
  right: { r: number; g: number; b: number }
) =>
  Math.sqrt(
    (left.r - right.r) ** 2 + (left.g - right.g) ** 2 + (left.b - right.b) ** 2
  );

const loadImage = async (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode image for palette extraction."));
    image.src = src;
  });

export const extractPaletteFromAsset = async (
  filePath: string,
  count: number
): Promise<Array<{ hex: string; label: string }>> => {
  const image = await loadImage(toAssetUrl(filePath));
  const maxDimension = 96;
  const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height || 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Canvas context unavailable for palette extraction.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 20) continue;
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`;
    const current = buckets.get(key);
    if (current) {
      current.r += r;
      current.g += g;
      current.b += b;
      current.count += 1;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  const candidates = Array.from(buckets.values())
    .map((entry) => ({
      r: Math.round(entry.r / entry.count),
      g: Math.round(entry.g / entry.count),
      b: Math.round(entry.b / entry.count),
      count: entry.count
    }))
    .sort((a, b) => b.count - a.count);

  const palette: Array<{ hex: string; label: string; r: number; g: number; b: number }> = [];
  for (const candidate of candidates) {
    if (palette.every((existing) => colorDistance(existing, candidate) > 34)) {
      const hex = hexFromRgb(candidate.r, candidate.g, candidate.b);
      palette.push({
        ...candidate,
        hex,
        label: hex
      });
    }
    if (palette.length >= count) break;
  }

  return palette.map(({ hex, label }) => ({ hex, label }));
};
