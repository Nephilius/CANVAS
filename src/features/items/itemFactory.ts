import type { Asset, Item } from "../../../shared/domain";
import {
  createChecklistItem,
  createConnectorItem,
  createFrameItem,
  createImageItem,
  createLinkItem,
  createNoteLikeItem,
  createPdfItem,
  createSwatchItem
} from "../../../shared/domain";
import type { ImportedAsset } from "../../../shared/ipc";

export const createQuickItem = (
  boardId: string,
  type: "note" | "sticky" | "title" | "checklist" | "swatch" | "frame",
  x: number,
  y: number
): Item => {
  switch (type) {
    case "title":
      return createNoteLikeItem(boardId, "title", "Untitled Section", x, y);
    case "sticky":
      return createNoteLikeItem(boardId, "sticky", "New sticky note", x, y);
    case "checklist":
      return createChecklistItem(boardId, x, y);
    case "swatch":
      return createSwatchItem(boardId, "#84B8FF", "Accent", x, y);
    case "frame":
      return createFrameItem(boardId, x, y);
    case "note":
    default:
      return createNoteLikeItem(boardId, "note", "New note", x, y);
  }
};

export const createItemsFromImportedAssets = (
  boardId: string,
  importedAssets: ImportedAsset[],
  existingAssets: Asset[],
  origin: { x: number; y: number }
): { assets: Asset[]; items: Item[] } => {
  const items: Item[] = [];
  const assets: Asset[] = [...existingAssets];

  importedAssets.forEach((asset, index) => {
    if (!assets.find((existing) => existing.id === asset.id)) {
      assets.push(asset);
    }

    const x = origin.x + (index % 4) * 280;
    const y = origin.y + Math.floor(index / 4) * 240;
    if (asset.kind === "pdf") {
      items.push(createPdfItem(boardId, asset.id, "PDF Document", x, y));
      return;
    }

    const width = asset.width ? Math.min(380, asset.width) : 280;
    const height =
      asset.width && asset.height ? Math.round((width / asset.width) * asset.height) : 220;
    items.push(createImageItem(boardId, asset.id, x, y, width, height));
  });

  return { assets, items };
};

export const duplicateItems = (items: Item[]): Item[] =>
  items.map((item, index) => ({
    ...structuredClone(item),
    id: `${item.id}_copy_${index}`,
    x: item.x + 32,
    y: item.y + 32,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

export const createLinkFromText = (
  boardId: string,
  value: string,
  x: number,
  y: number
) => createLinkItem(boardId, value, value.replace(/^https?:\/\//, ""), x, y);

export const createSwatchPaletteItems = (
  boardId: string,
  colors: Array<{ hex: string; label?: string }>,
  origin: { x: number; y: number }
): Item[] =>
  colors.map((entry, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    return createSwatchItem(
      boardId,
      entry.hex,
      entry.label ?? entry.hex.toUpperCase(),
      origin.x + column * 196,
      origin.y + row * 156
    );
  });

export const createConnectorBetweenItems = (
  boardId: string,
  fromItemId: string,
  toItemId: string,
  zIndex: number
): Item => createConnectorItem(boardId, fromItemId, toItemId, zIndex);
