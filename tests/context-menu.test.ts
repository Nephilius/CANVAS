import { describe, expect, it } from "vitest";
import { createImageItem, createNoteLikeItem } from "../shared/domain";
import { buildBoardContextMenu, buildItemContextMenu } from "../src/features/context-menu/menuDefinitions";

describe("context menu definitions", () => {
  it("builds a board menu with working board actions", () => {
    const ids = buildBoardContextMenu().map((entry) => entry.id);
    expect(ids).toEqual([
      "new-note",
      "new-sticky",
      "new-frame",
      "import-image",
      "fit-view",
      "reset-view"
    ]);
  });

  it("adds swatch extraction actions only for image items", () => {
    const imageMenu = buildItemContextMenu(createImageItem("board-1", "asset-1", 0, 0, 320, 240));
    const noteMenu = buildItemContextMenu(createNoteLikeItem("board-1", "note", "Hello", 0, 0));

    expect(imageMenu.some((entry) => entry.label === "Focus Overlay Mode")).toBe(true);
    expect(imageMenu.some((entry) => entry.label === "Extract Color Swatch")).toBe(true);
    expect(noteMenu.some((entry) => entry.label === "Extract Color Swatch")).toBe(false);

    const extractGroup = imageMenu.find((entry) => entry.label === "Extract Color Swatch");
    expect(extractGroup?.children?.[0]?.id).toBe("extract-base-palette");
    expect(extractGroup?.children?.[1]?.children?.map((entry) => entry.id)).toEqual([
      "extract-all-8",
      "extract-all-12",
      "extract-all-16",
      "extract-all-24"
    ]);
  });
});
