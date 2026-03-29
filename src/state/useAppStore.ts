import { create } from "zustand";
import type { AppSnapshot, Asset, Board, Item, WorkspaceSettings } from "../../shared/domain";
import {
  createDefaultBoard,
  createDefaultProject,
  createInitialSnapshot,
  touchUpdatedAt
} from "../../shared/domain";
import { fitViewportToItems } from "../features/boards/geometry";
import {
  createQuickItem,
  createSwatchPaletteItems,
  duplicateItems
} from "../features/items/itemFactory";

export interface HistoryEntry {
  label: string;
  before: AppSnapshot;
  after: AppSnapshot;
}

interface UiState {
  paletteOpen: boolean;
  paletteQuery: string;
  helpOpen: boolean;
  settingsOpen: boolean;
  saveState: "idle" | "dirty" | "saving" | "saved" | "error";
  lastSavedAt: string | null;
}

interface AppStore {
  snapshot: AppSnapshot;
  selectedItemIds: string[];
  ui: UiState;
  history: { undo: HistoryEntry[]; redo: HistoryEntry[] };
  bootstrap: (snapshot: AppSnapshot) => void;
  markSaved: (savedAt: string) => void;
  markSaving: () => void;
  markError: () => void;
  updatePalette: (payload: Partial<Pick<UiState, "paletteOpen" | "paletteQuery">>) => void;
  toggleHelp: (value?: boolean) => void;
  toggleSettings: (value?: boolean) => void;
  selectItems: (ids: string[]) => void;
  commitMutation: (label: string, mutate: (draft: AppSnapshot) => void) => void;
  pushHistoryEntry: (label: string, before: AppSnapshot) => void;
  createBoard: () => void;
  createSessionProject: () => void;
  setActiveProject: (projectId: string) => void;
  setActiveBoard: (boardId: string) => void;
  updateBoardViewport: (boardId: string, viewport: Board["viewport"], trackHistory?: boolean) => void;
  addQuickItem: (
    type: "note" | "sticky" | "title" | "checklist" | "swatch" | "frame",
    position: { x: number; y: number }
  ) => void;
  addImportedContent: (assets: Asset[], items: Item[]) => void;
  replaceAssetReference: (previousAssetId: string, nextAsset: Asset) => void;
  moveSelectedItems: (delta: { x: number; y: number }) => void;
  applyLiveSelectionDelta: (delta: { x: number; y: number }) => void;
  applyLiveItemBounds: (
    itemId: string,
    bounds: Partial<Pick<Item, "x" | "y" | "width" | "height">>
  ) => void;
  updateSelectedText: (value: string) => void;
  updateSelectedMetadata: (metadata: Record<string, string | number | boolean | null>) => void;
  updateSelectedOpacity: (opacity: number) => void;
  updateSelectedDimensions: (size: { width: number; height: number }) => void;
  renameSelection: (value: string) => void;
  adjustSelectionZOrder: (direction: "forward" | "backward") => void;
  toggleSelectionLock: () => void;
  resetActiveBoardView: () => void;
  addSwatchPaletteFromColors: (
    imageItemId: string,
    colors: Array<{ hex: string; label?: string }>
  ) => void;
  updateActiveBoard: (patch: Partial<Board>) => void;
  updateWorkspaceSettings: (settings: Partial<WorkspaceSettings>) => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  fitActiveBoardToContent: (frame: { width: number; height: number }) => void;
  undo: () => void;
  redo: () => void;
}

const cloneSnapshot = (snapshot: AppSnapshot): AppSnapshot => structuredClone(snapshot);

const patchBoard = (snapshot: AppSnapshot, boardId: string, updater: (board: Board) => Board) => {
  snapshot.boards = snapshot.boards.map((board) => (board.id === boardId ? updater(board) : board));
};

export const useAppStore = create<AppStore>((set, get) => ({
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
  history: { undo: [], redo: [] },
  bootstrap: (snapshot) =>
    set((state) => ({
      snapshot,
      selectedItemIds: [],
      ui: { ...state.ui, saveState: "saved" }
    })),
  markSaved: (savedAt) =>
    set((state) => ({ ui: { ...state.ui, saveState: "saved", lastSavedAt: savedAt } })),
  markSaving: () => set((state) => ({ ui: { ...state.ui, saveState: "saving" } })),
  markError: () => set((state) => ({ ui: { ...state.ui, saveState: "error" } })),
  updatePalette: (payload) => set((state) => ({ ui: { ...state.ui, ...payload } })),
  toggleHelp: (value) => set((state) => ({ ui: { ...state.ui, helpOpen: value ?? !state.ui.helpOpen } })),
  toggleSettings: (value) =>
    set((state) => ({ ui: { ...state.ui, settingsOpen: value ?? !state.ui.settingsOpen } })),
  selectItems: (ids) => set({ selectedItemIds: ids }),
  commitMutation: (label, mutate) => {
    const before = cloneSnapshot(get().snapshot);
    const after = cloneSnapshot(before);
    mutate(after);
    set((state) => ({
      snapshot: after,
      history: { undo: [...state.history.undo, { label, before, after }], redo: [] },
      ui: { ...state.ui, saveState: "dirty" }
    }));
  },
  pushHistoryEntry: (label, before) =>
    set((state) => ({
      history: {
        undo: [...state.history.undo, { label, before, after: cloneSnapshot(state.snapshot) }],
        redo: []
      },
      ui: { ...state.ui, saveState: "dirty" }
    })),
  createBoard: () => {
    get().commitMutation("Create board", (draft) => {
      const board = createDefaultBoard(draft.activeProjectId);
      board.title = `Board ${String(draft.boards.length + 1).padStart(2, "0")}`;
      draft.boards.push(board);
      draft.activeBoardId = board.id;
      draft.lastOpenedBoardId = board.id;
    });
    set({ selectedItemIds: [] });
  },
  createSessionProject: () => {
    get().commitMutation("Create session", (draft) => {
      const sessionIndex =
        draft.projects.filter((project) => project.workspaceId === draft.activeWorkspaceId).length + 1;
      const project = createDefaultProject(
        draft.activeWorkspaceId,
        `Session ${String(sessionIndex).padStart(2, "0")}`
      );
      const board = createDefaultBoard(project.id, "Workspace");
      draft.projects.push(project);
      draft.boards.push(board);
      draft.activeProjectId = project.id;
      draft.activeBoardId = board.id;
      draft.lastOpenedBoardId = board.id;
    });
    set({ selectedItemIds: [] });
  },
  setActiveProject: (projectId) =>
    set((state) => {
      const firstBoard =
        state.snapshot.boards.find((board) => board.projectId === projectId) ?? state.snapshot.boards[0];
      return {
        snapshot: {
          ...state.snapshot,
          activeProjectId: projectId,
          activeBoardId: firstBoard.id,
          lastOpenedBoardId: firstBoard.id
        },
        selectedItemIds: []
      };
    }),
  setActiveBoard: (boardId) =>
    set((state) => ({
      snapshot: { ...state.snapshot, activeBoardId: boardId, lastOpenedBoardId: boardId },
      selectedItemIds: []
    })),
  updateBoardViewport: (boardId, viewport, trackHistory = false) => {
    if (trackHistory) {
      get().commitMutation("Adjust viewport", (draft) => {
        patchBoard(draft, boardId, (board) => touchUpdatedAt({ ...board, viewport }));
      });
      return;
    }
    set((state) => {
      const snapshot = cloneSnapshot(state.snapshot);
      patchBoard(snapshot, boardId, (board) => ({ ...board, viewport }));
      return { snapshot };
    });
  },
  addQuickItem: (type, position) =>
    get().commitMutation(`Add ${type}`, (draft) => {
      const topZ = Math.max(0, ...draft.items.map((item) => item.zIndex));
      draft.items.push({
        ...createQuickItem(draft.activeBoardId, type, position.x, position.y),
        zIndex: topZ + 1
      });
    }),
  addImportedContent: (assets, items) => {
    get().commitMutation("Import assets", (draft) => {
      assets.forEach((asset) => {
        if (!draft.assets.find((existing) => existing.id === asset.id)) draft.assets.push(asset);
      });
      draft.items.push(...items);
    });
    set({ selectedItemIds: items.map((item) => item.id) });
  },
  replaceAssetReference: (previousAssetId, nextAsset) =>
    get().commitMutation("Relink asset", (draft) => {
      draft.assets = [...draft.assets.filter((asset) => asset.id !== previousAssetId), nextAsset];
      draft.items = draft.items.map((item): Item => {
        if (!("assetId" in item.content) || item.content.assetId !== previousAssetId) return item;
        if (item.type === "image") {
          return touchUpdatedAt({
            ...item,
            content: {
              ...item.content,
              assetId: nextAsset.id
            }
          });
        }
        if (item.type === "pdf") {
          return touchUpdatedAt({
            ...item,
            content: {
              ...item.content,
              assetId: nextAsset.id
            }
          });
        }
        return item;
      });
    }),
  moveSelectedItems: (delta) => {
    const selection = get().selectedItemIds;
    if (!selection.length) return;
    get().commitMutation("Move selection", (draft) => {
      draft.items = draft.items.map((item) =>
        selection.includes(item.id)
          ? touchUpdatedAt({ ...item, x: item.x + delta.x, y: item.y + delta.y })
          : item
      );
    });
  },
  applyLiveSelectionDelta: (delta) => {
    const selection = get().selectedItemIds;
    if (!selection.length) return;
    set((state) => ({
      snapshot: {
        ...state.snapshot,
        items: state.snapshot.items.map((item) =>
          selection.includes(item.id)
            ? { ...item, x: item.x + delta.x, y: item.y + delta.y, updatedAt: new Date().toISOString() }
            : item
        )
      }
    }));
  },
  applyLiveItemBounds: (itemId, bounds) =>
    set((state) => ({
      snapshot: {
        ...state.snapshot,
        items: state.snapshot.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                ...bounds,
                updatedAt: new Date().toISOString()
              }
            : item
        )
      }
    })),
  updateSelectedText: (value) => {
    const itemId = get().selectedItemIds[0];
    if (!itemId) return;
    get().commitMutation("Edit content", (draft) => {
      draft.items = draft.items.map((item): Item => {
        if (item.id !== itemId) return item;
        switch (item.type) {
          case "note":
          case "sticky":
          case "title":
            return touchUpdatedAt({ ...item, content: { text: value } });
          case "checklist":
            return touchUpdatedAt({ ...item, content: { ...item.content, title: value } });
          case "frame":
            return touchUpdatedAt({ ...item, content: { label: value } });
          case "link":
            return touchUpdatedAt({ ...item, content: { ...item.content, label: value } });
          case "pdf":
            return touchUpdatedAt({ ...item, content: { ...item.content, label: value } });
          case "swatch":
            return touchUpdatedAt({ ...item, content: { ...item.content, label: value } });
          case "image":
          default:
            return item;
        }
      });
    });
  },
  updateSelectedMetadata: (metadata) => {
    const selection = get().selectedItemIds;
    if (!selection.length) return;
    get().commitMutation("Update item settings", (draft) => {
      draft.items = draft.items.map((item) =>
        selection.includes(item.id)
          ? touchUpdatedAt({
              ...item,
              metadata: {
                ...item.metadata,
                ...metadata
              }
            })
          : item
      );
    });
  },
  updateSelectedOpacity: (opacity) => {
    const selection = get().selectedItemIds;
    if (!selection.length) return;
    get().commitMutation("Adjust opacity", (draft) => {
      draft.items = draft.items.map((item) =>
        selection.includes(item.id) ? touchUpdatedAt({ ...item, opacity }) : item
      );
    });
  },
  updateSelectedDimensions: (size) => {
    const itemId = get().selectedItemIds[0];
    if (!itemId) return;
    get().commitMutation("Resize item", (draft) => {
      draft.items = draft.items.map((item) =>
        item.id === itemId
          ? touchUpdatedAt({
              ...item,
              width: Math.max(size.width, item.type === "frame" ? 220 : 80),
              height: Math.max(size.height, item.type === "frame" ? 140 : 64)
            })
          : item
      );
    });
  },
  renameSelection: (value) => {
    const itemId = get().selectedItemIds[0];
    if (!itemId) return;
    get().updateSelectedText(value);
  },
  adjustSelectionZOrder: (direction) => {
    const selection = get().selectedItemIds;
    if (!selection.length) return;
    get().commitMutation("Adjust layer order", (draft) => {
      draft.items = draft.items.map((item) => {
        if (!selection.includes(item.id)) return item;
        return touchUpdatedAt({
          ...item,
          zIndex:
            direction === "forward"
              ? item.zIndex + 1
              : Math.max(0, item.zIndex - 1)
        });
      });
    });
  },
  toggleSelectionLock: () => {
    const selection = get().selectedItemIds;
    if (!selection.length) return;
    get().commitMutation("Toggle lock", (draft) => {
      draft.items = draft.items.map((item) =>
        selection.includes(item.id)
          ? touchUpdatedAt({
              ...item,
              locked: !item.locked
            })
          : item
      );
    });
  },
  resetActiveBoardView: () => {
    const snapshot = get().snapshot;
    get().updateBoardViewport(snapshot.activeBoardId, { x: 0, y: 0, zoom: 1 }, true);
  },
  addSwatchPaletteFromColors: (imageItemId, colors) => {
    const imageItem = get().snapshot.items.find((item) => item.id === imageItemId);
    if (!imageItem) return;
    get().commitMutation("Extract swatch palette", (draft) => {
      const sourceItem = draft.items.find((item) => item.id === imageItemId);
      if (!sourceItem) return;
      const origin = {
        x: sourceItem.x + sourceItem.width + 32,
        y: sourceItem.y
      };
      const swatches = createSwatchPaletteItems(sourceItem.boardId, colors, origin);
      const topZ = Math.max(0, ...draft.items.map((item) => item.zIndex));
      swatches.forEach((item, index) => {
        item.zIndex = topZ + index + 1;
      });
      draft.items.push(...swatches);
    });
  },
  updateActiveBoard: (patch) =>
    get().commitMutation("Update board settings", (draft) => {
      draft.boards = draft.boards.map((board) =>
        board.id === draft.activeBoardId
          ? touchUpdatedAt({
              ...board,
              ...patch,
              background: {
                ...board.background,
                ...patch.background
              },
              perspectiveGrid: {
                ...board.perspectiveGrid,
                ...patch.perspectiveGrid
              }
            })
          : board
      );
    }),
  updateWorkspaceSettings: (settings) =>
    get().commitMutation("Update preferences", (draft) => {
      draft.workspaces = draft.workspaces.map((workspace) =>
        workspace.id === draft.activeWorkspaceId
          ? touchUpdatedAt({ ...workspace, settings: { ...workspace.settings, ...settings } })
          : workspace
      );
    }),
  deleteSelection: () => {
    const selection = get().selectedItemIds;
    if (!selection.length) return;
    get().commitMutation("Delete selection", (draft) => {
      draft.items = draft.items.filter((item) => !selection.includes(item.id));
    });
    set({ selectedItemIds: [] });
  },
  duplicateSelection: () => {
    const selected = get().snapshot.items.filter((item) => get().selectedItemIds.includes(item.id));
    if (!selected.length) return;
    const copies = duplicateItems(selected);
    get().commitMutation("Duplicate selection", (draft) => {
      draft.items.push(...copies);
    });
    set({ selectedItemIds: copies.map((item) => item.id) });
  },
  fitActiveBoardToContent: (frame) => {
    const snapshot = get().snapshot;
    const items = snapshot.items.filter((item) => item.boardId === snapshot.activeBoardId);
    get().updateBoardViewport(snapshot.activeBoardId, fitViewportToItems(items, frame), true);
  },
  undo: () => {
    const last = get().history.undo.at(-1);
    if (!last) return;
    set((state) => ({
      snapshot: last.before,
      history: { undo: state.history.undo.slice(0, -1), redo: [...state.history.redo, last] },
      selectedItemIds: [],
      ui: { ...state.ui, saveState: "dirty" }
    }));
  },
  redo: () => {
    const last = get().history.redo.at(-1);
    if (!last) return;
    set((state) => ({
      snapshot: last.after,
      history: { undo: [...state.history.undo, last], redo: state.history.redo.slice(0, -1) },
      selectedItemIds: [],
      ui: { ...state.ui, saveState: "dirty" }
    }));
  }
}));

export const selectActiveWorkspace = (snapshot: AppSnapshot) =>
  snapshot.workspaces.find((workspace) => workspace.id === snapshot.activeWorkspaceId) ?? snapshot.workspaces[0];

export const selectActiveProject = (snapshot: AppSnapshot) =>
  snapshot.projects.find((project) => project.id === snapshot.activeProjectId) ?? snapshot.projects[0];

export const selectActiveBoard = (snapshot: AppSnapshot) =>
  snapshot.boards.find((board) => board.id === snapshot.activeBoardId) ?? snapshot.boards[0];

export const selectBoardItems = (snapshot: AppSnapshot, boardId: string) =>
  snapshot.items.filter((item) => item.boardId === boardId).sort((a, b) => a.zIndex - b.zIndex);

export const selectAssetsById = (snapshot: AppSnapshot) =>
  new Map(snapshot.assets.map((asset) => [asset.id, asset]));
