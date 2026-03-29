import type { BoardViewport, Item } from "../../../shared/domain";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AlignmentGuide {
  orientation: "vertical" | "horizontal";
  position: number;
}

const GRID_SIZE = 24;
const SNAP_DISTANCE = 12;

export const clampZoom = (zoom: number) => Math.min(3.2, Math.max(0.1, zoom));

export const screenToBoard = (
  point: { x: number; y: number },
  viewport: BoardViewport
) => ({
  x: (point.x - viewport.x) / viewport.zoom,
  y: (point.y - viewport.y) / viewport.zoom
});

export const clientToBoard = (
  point: { x: number; y: number },
  bounds: Pick<DOMRect, "left" | "top">,
  viewport: BoardViewport
) =>
  screenToBoard(
    {
      x: point.x - bounds.left,
      y: point.y - bounds.top
    },
    viewport
  );

export const boardToScreen = (
  point: { x: number; y: number },
  viewport: BoardViewport
) => ({
  x: viewport.x + point.x * viewport.zoom,
  y: viewport.y + point.y * viewport.zoom
});

export type ResizeHandle =
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "nw";

export const getSelectionBounds = (items: Item[]): Rect | null => {
  if (!items.length) return null;
  const left = Math.min(...items.map((item) => item.x));
  const top = Math.min(...items.map((item) => item.y));
  const right = Math.max(...items.map((item) => item.x + item.width));
  const bottom = Math.max(...items.map((item) => item.y + item.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

export const rectsIntersect = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

export const fitViewportToItems = (
  items: Item[],
  frame: { width: number; height: number }
): BoardViewport => {
  const bounds = getSelectionBounds(items);
  if (!bounds || !frame.width || !frame.height) {
    return { x: frame.width / 2, y: frame.height / 2, zoom: 1 };
  }

  const paddedWidth = bounds.width + 240;
  const paddedHeight = bounds.height + 180;
  const zoom = clampZoom(Math.min(frame.width / paddedWidth, frame.height / paddedHeight));

  return {
    zoom,
    x: frame.width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: frame.height / 2 - (bounds.y + bounds.height / 2) * zoom
  };
};

export const itemToScreenRect = (item: Item, viewport: BoardViewport): Rect => ({
  x: viewport.x + item.x * viewport.zoom,
  y: viewport.y + item.y * viewport.zoom,
  width: item.width * viewport.zoom,
  height: item.height * viewport.zoom
});

export const resizeItemBounds = (
  item: Pick<Item, "x" | "y" | "width" | "height" | "type">,
  handle: ResizeHandle,
  deltaBoard: { x: number; y: number },
  options?: { lockAspectRatio?: boolean; minWidth?: number; minHeight?: number }
) => {
  const minWidth = options?.minWidth ?? (item.type === "frame" ? 220 : 80);
  const minHeight = options?.minHeight ?? (item.type === "frame" ? 140 : 64);
  const next = { x: item.x, y: item.y, width: item.width, height: item.height };

  if (handle.includes("e")) {
    next.width += deltaBoard.x;
  }
  if (handle.includes("s")) {
    next.height += deltaBoard.y;
  }
  if (handle.includes("w")) {
    next.x += deltaBoard.x;
    next.width -= deltaBoard.x;
  }
  if (handle.includes("n")) {
    next.y += deltaBoard.y;
    next.height -= deltaBoard.y;
  }

  if (options?.lockAspectRatio) {
    const aspectRatio = item.width / item.height || 1;
    if (Math.abs(deltaBoard.x) > Math.abs(deltaBoard.y)) {
      next.height = next.width / aspectRatio;
      if (handle.includes("n")) {
        next.y = item.y + (item.height - next.height);
      }
    } else {
      next.width = next.height * aspectRatio;
      if (handle.includes("w")) {
        next.x = item.x + (item.width - next.width);
      }
    }
  }

  if (next.width < minWidth) {
    if (handle.includes("w")) {
      next.x -= minWidth - next.width;
    }
    next.width = minWidth;
  }

  if (next.height < minHeight) {
    if (handle.includes("n")) {
      next.y -= minHeight - next.height;
    }
    next.height = minHeight;
  }

  return next;
};

const getAxisAnchors = (rect: Rect, axis: "x" | "y") => {
  if (axis === "x") {
    return [
      { kind: "start", value: rect.x },
      { kind: "center", value: rect.x + rect.width / 2 },
      { kind: "end", value: rect.x + rect.width }
    ];
  }

  return [
    { kind: "start", value: rect.y },
    { kind: "center", value: rect.y + rect.height / 2 },
    { kind: "end", value: rect.y + rect.height }
  ];
};

export const snapRectToGrid = (
  rect: Rect,
  enabled: boolean
): { x: number; y: number; guides: AlignmentGuide[] } => {
  if (!enabled) {
    return { x: rect.x, y: rect.y, guides: [] };
  }

  const snappedX = Math.round(rect.x / GRID_SIZE) * GRID_SIZE;
  const snappedY = Math.round(rect.y / GRID_SIZE) * GRID_SIZE;
  const guides: AlignmentGuide[] = [];

  if (Math.abs(snappedX - rect.x) <= SNAP_DISTANCE) {
    guides.push({ orientation: "vertical", position: snappedX });
  }
  if (Math.abs(snappedY - rect.y) <= SNAP_DISTANCE) {
    guides.push({ orientation: "horizontal", position: snappedY });
  }

  return {
    x: guides.some((guide) => guide.orientation === "vertical") ? snappedX : rect.x,
    y: guides.some((guide) => guide.orientation === "horizontal") ? snappedY : rect.y,
    guides
  };
};

export const snapRectToItems = (
  rect: Rect,
  otherRects: Rect[],
  enabled: boolean
): { x: number; y: number; guides: AlignmentGuide[] } => {
  if (!enabled || !otherRects.length) {
    return { x: rect.x, y: rect.y, guides: [] };
  }

  let snappedX = rect.x;
  let snappedY = rect.y;
  let bestX = SNAP_DISTANCE;
  let bestY = SNAP_DISTANCE;
  const guides: AlignmentGuide[] = [];
  const rectAnchorsX = getAxisAnchors(rect, "x");
  const rectAnchorsY = getAxisAnchors(rect, "y");

  for (const other of otherRects) {
    const otherAnchorsX = getAxisAnchors(other, "x");
    const otherAnchorsY = getAxisAnchors(other, "y");

    for (const own of rectAnchorsX) {
      for (const target of otherAnchorsX) {
        const distance = Math.abs(own.value - target.value);
        if (distance < bestX) {
          bestX = distance;
          snappedX = rect.x + (target.value - own.value);
          guides[0] = { orientation: "vertical", position: target.value };
        }
      }
    }

    for (const own of rectAnchorsY) {
      for (const target of otherAnchorsY) {
        const distance = Math.abs(own.value - target.value);
        if (distance < bestY) {
          bestY = distance;
          snappedY = rect.y + (target.value - own.value);
          const horizontalGuide = { orientation: "horizontal" as const, position: target.value };
          if (guides[0]?.orientation === "horizontal") {
            guides[0] = horizontalGuide;
          } else {
            guides[1] = horizontalGuide;
          }
        }
      }
    }
  }

  return {
    x: bestX < SNAP_DISTANCE ? snappedX : rect.x,
    y: bestY < SNAP_DISTANCE ? snappedY : rect.y,
    guides: guides.filter(Boolean)
  };
};
