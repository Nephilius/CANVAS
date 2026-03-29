import { describe, expect, it } from "vitest";
import {
  fitViewportToItems,
  getSelectionBounds,
  resizeItemBounds,
  snapRectToGrid,
  snapRectToItems
} from "../src/features/boards/geometry";
import { createNoteLikeItem } from "../shared/domain";

describe("geometry helpers", () => {
  it("computes selection bounds", () => {
    const items = [
      createNoteLikeItem("board_1", "note", "A", 10, 20),
      createNoteLikeItem("board_1", "sticky", "B", 320, 140)
    ];
    const bounds = getSelectionBounds(items);
    expect(bounds).toMatchObject({ x: 10, y: 20 });
    expect(bounds?.width).toBeGreaterThan(300);
    expect(bounds?.height).toBeGreaterThan(140);
  });

  it("fits viewport to content", () => {
    const item = createNoteLikeItem("board_1", "note", "A", 200, 100);
    const viewport = fitViewportToItems([item], { width: 1000, height: 800 });
    expect(viewport.zoom).toBeGreaterThan(0.5);
    expect(viewport.zoom).toBeLessThanOrEqual(3.2);
  });

  it("resizes frame bounds with minimum constraints", () => {
    const frame = { ...createNoteLikeItem("board_1", "note", "A", 0, 0), type: "frame" as const, width: 260, height: 180 };
    const resized = resizeItemBounds(frame, "se", { x: -200, y: -120 });
    expect(resized.width).toBeGreaterThanOrEqual(220);
    expect(resized.height).toBeGreaterThanOrEqual(140);
  });

  it("snaps to the grid when close enough", () => {
    const snapped = snapRectToGrid({ x: 25, y: 46, width: 100, height: 80 }, true);
    expect(snapped.x).toBe(24);
    expect(snapped.y).toBe(48);
    expect(snapped.guides).toHaveLength(2);
  });

  it("snaps to nearby object anchors", () => {
    const snapped = snapRectToItems(
      { x: 98, y: 102, width: 120, height: 80 },
      [{ x: 220, y: 40, width: 120, height: 160 }],
      true
    );
    expect(snapped.x).toBe(100);
    expect(snapped.guides.some((guide) => guide.orientation === "vertical")).toBe(true);
  });
});
