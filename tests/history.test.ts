import { beforeEach, describe, expect, it } from "vitest";
import { createInitialSnapshot } from "../shared/domain";
import { useAppStore } from "../src/state/useAppStore";

describe("history", () => {
  beforeEach(() => {
    useAppStore.setState({
      snapshot: createInitialSnapshot(),
      selectedItemIds: [],
      ui: {
        paletteOpen: false,
        paletteQuery: "",
        helpOpen: false,
        settingsOpen: false,
        saveState: "idle",
        lastSavedAt: null
      },
      history: { undo: [], redo: [] }
    });
  });

  it("creates undo and redo snapshots", () => {
    const before = useAppStore.getState().snapshot.items.length;
    useAppStore.getState().addQuickItem("note", { x: 0, y: 0 });
    expect(useAppStore.getState().snapshot.items.length).toBe(before + 1);
    useAppStore.getState().undo();
    expect(useAppStore.getState().snapshot.items.length).toBe(before);
    useAppStore.getState().redo();
    expect(useAppStore.getState().snapshot.items.length).toBe(before + 1);
  });
});
