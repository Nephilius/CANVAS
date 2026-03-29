import { create } from "zustand";
import type { AppSnapshot, Asset, Board, Item, SketchStroke, WorkspaceSettings } from "../../shared/domain";
import {
  createSketchStroke,
  createDefaultBoard,
  createDefaultProject,
  createInitialSnapshot,
  touchUpdatedAt
} from "../../shared/domain";
import { fitViewportToItems } from "../features/boards/geometry";
import {
  createQuickItem,
  createConnectorBetweenItems,
  createSwatchPaletteItems,
  duplicateItems
} from "../features/items/itemFactory";
import type { Rect } from "../features/boards/geometry";

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
  clearSession: () => void;
  setActiveProject: (projectId: string) => void;
  setActiveBoard: (boardId: string) => void;
  updateBoardViewport: (boardId: string, viewport: Board["viewport"], trackHistory?: boolean) => void;
  addQuickItem: (
    type: "note" | "sticky" | "title" | "checklist" | "swatch" | "frame",
    position: { x: number; y: number }
  ) => void;
  addImportedContent: (assets: Asset[], items: Item[]) => void;
  addConnector: (fromItemId: string, toItemId: string) => void;
  addStroke: (input: {
    boardId: string;
    points: SketchStroke["points"];
    color: string;
    size: number;
    opacity: number;
    smoothing: number;
  }) => void;
  replaceAssetReference: (previousAssetId: string, nextAsset: Asset) => void;
  moveSelectedItems: (delta: { x: number; y: number }) => void;
  applyLiveSelectionDelta: (delta: { x: number; y: number }) => void;
  applyLiveItemBounds: (
    itemId: string,
    bounds: Partial<Pick<Item, "x" | "y" | "width" | "height">>
  ) => void;
  updateSelectedText: (value: string) => void;
  updateItemText: (itemId: string, value: string) => void;
  updateSelectedMetadata: (metadata: Record<string, string | number | boolean | null>) => void;
  updateSelectedStyle: (style: Record<string, string | number | boolean>) => void;
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

const FRAME_HEADER_OFFSET = 44;

const getFrameChildren = (items: Item[], frame: Item) =>
  items.filter(
    (candidate) =>
      candidate.type !== "connector" &&
      candidate.id !== frame.id &&
      candidate.boardId === frame.boardId &&
      candidate.x >= frame.x &&
      candidate.y >= frame.y + FRAME_HEADER_OFFSET &&
      candidate.x + candidate.width <= frame.x + frame.width &&
      candidate.y + candidate.height <= frame.y + frame.height
  );

const moveFrameChildrenByDelta = (
  items: Item[],
  frame: Item,
  delta: { x: number; y: number },
  selectedIds: string[]
) => {
  const childIds = new Set(
    getFrameChildren(items, frame)
      .filter((child) => !selectedIds.includes(child.id))
      .map((child) => child.id)
  );

  if (!childIds.size) return items;

  const now = new Date().toISOString();
  return items.map((item) =>
    childIds.has(item.id)
      ? { ...item, x: item.x + delta.x, y: item.y + delta.y, updatedAt: now }
      : item
  );
};

const scaleFrameChildren = (
  items: Item[],
  frame: Item,
  nextFrame: Rect
) => {
  const children = getFrameChildren(items, frame);
  if (!children.length) return items;

  const scaleX = nextFrame.width / frame.width;
  const scaleY = nextFrame.height / frame.height;
  const now = new Date().toISOString();
  const childIds = new Set(children.map((child) => child.id));

  return items.map((item) => {
    if (!childIds.has(item.id)) return item;
    const relativeX = item.x - frame.x;
    const relativeY = item.y - frame.y;

    return {
      ...item,
      x: nextFrame.x + relativeX * scaleX,
      y: nextFrame.y + relativeY * scaleY,
      width: Math.max(24, item.width * scaleX),
      height: Math.max(24, item.height * scaleY),
      updatedAt: now
    };
  });
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
  clearSession: () =>
    set((state) => ({
      snapshot: createInitialSnapshot(),
      selectedItemIds: [],
      history: { undo: [], redo: [] },
      ui: { ...state.ui, saveState: "dirty" }
    })),
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
  addConnector: (fromItemId, toItemId) => {
    const snapshot = get().snapshot;
    const fromItem = snapshot.items.find((item) => item.id === fromItemId);
    const toItem = snapshot.items.find((item) => item.id === toItemId);
    if (
      !fromItem ||
      !toItem ||
      fromItem.boardId !== toItem.boardId ||
      fromItem.type === "connector" ||
      toItem.type === "connector" ||
      fromItem.id === toItem.id
    ) {
      return;
    }

    const duplicate = snapshot.items.find(
      (item) =>
        item.type === "connector" &&
        ((item.content.fromItemId === fromItemId && item.content.toItemId === toItemId) ||
          (item.content.fromItemId === toItemId && item.content.toItemId === fromItemId))
    );
    if (duplicate) return;

    get().commitMutation("Create connector", (draft) => {
      const topZ = Math.max(0, ...draft.items.map((item) => item.zIndex));
      draft.items.push(createConnectorBetweenItems(fromItem.boardId, fromItemId, toItemId, topZ + 1));
    });
  },
  addStroke: ({ boardId, points, color, size, opacity, smoothing }) => {
    if (points.length < 2) return;
    get().commitMutation("Draw stroke", (draft) => {
      draft.strokes.push(createSketchStroke(boardId, points, color, size, opacity, smoothing));
    });
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
      const originalFrame =
        selection.length === 1
          ? draft.items.find((item) => item.id === selection[0] && item.type === "frame") ?? null
          : null;
      let nextItems = draft.items.map((item) =>
        selection.includes(item.id)
          ? touchUpdatedAt({ ...item, x: item.x + delta.x, y: item.y + delta.y })
          : item
      );
      if (originalFrame) {
        nextItems = moveFrameChildrenByDelta(nextItems, originalFrame, delta, selection);
      }
      draft.items = nextItems;
    });
  },
  applyLiveSelectionDelta: (delta) => {
    const selection = get().selectedItemIds;
    if (!selection.length) return;
    set((state) => ({
      snapshot: {
        ...state.snapshot,
        items: (() => {
          const originalFrame =
            selection.length === 1
              ? state.snapshot.items.find((item) => item.id === selection[0] && item.type === "frame") ?? null
              : null;
          let nextItems = state.snapshot.items.map((item) =>
            selection.includes(item.id)
              ? { ...item, x: item.x + delta.x, y: item.y + delta.y, updatedAt: new Date().toISOString() }
              : item
          );
          if (originalFrame) {
            nextItems = moveFrameChildrenByDelta(nextItems, originalFrame, delta, selection);
          }
          return nextItems;
        })()
      }
    }));
  },
  applyLiveItemBounds: (itemId, bounds) =>
    set((state) => ({
      snapshot: {
        ...state.snapshot,
        items: (() => {
          const currentItem = state.snapshot.items.find((item) => item.id === itemId);
          if (!currentItem) return state.snapshot.items;
          const nextFrameBounds = {
            x: bounds.x ?? currentItem.x,
            y: bounds.y ?? currentItem.y,
            width: bounds.width ?? currentItem.width,
            height: bounds.height ?? currentItem.height
          };

          let nextItems = state.snapshot.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  ...bounds,
                  updatedAt: new Date().toISOString()
                }
              : item
          );

          if (currentItem.type === "frame") {
            nextItems = scaleFrameChildren(nextItems, currentItem, nextFrameBounds);
          }

          return nextItems;
        })()
      }
    })),
  updateSelectedText: (value) => {
    const itemId = get().selectedItemIds[0];
    if (!itemId) return;
    get().updateItemText(itemId, value);
  },
  updateItemText: (itemId, value) => {
    const nextValue = value.trim();
    get().commitMutation("Edit content", (draft) => {
      draft.items = draft.items.map((item): Item => {
        if (item.id !== itemId) return item;
        switch (item.type) {
          case "note":
          case "sticky":
          case "title":
            return touchUpdatedAt({ ...item, content: { text: nextValue || item.content.text } });
          case "checklist":
            return touchUpdatedAt({
              ...item,
              content: { ...item.content, title: nextValue || item.content.title }
            });
          case "frame":
            return touchUpdatedAt({
              ...item,
              content: { label: nextValue || item.content.label }
            });
          case "link":
            return touchUpdatedAt({
              ...item,
              content: { ...item.content, label: nextValue || item.content.label }
            });
          case "pdf":
            return touchUpdatedAt({
              ...item,
              content: { ...item.content, label: nextValue || item.content.label }
            });
          case "swatch":
            return touchUpdatedAt({
              ...item,
              content: {
                ...item.content,
                name: nextValue || item.content.name
              }
            });
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
  updateSelectedStyle: (style) => {
    const selection = get().selectedItemIds;
    if (!selection.length) return;
    get().commitMutation("Update item color", (draft) => {
      draft.items = draft.items.map((item): Item => {
        if (!selection.includes(item.id)) return item;
        if (item.type === "swatch" && typeof style.fillColor === "string") {
          return touchUpdatedAt({
            ...item,
            content: {
              ...item.content,
              color: style.fillColor,
              hex: style.fillColor.toUpperCase()
            },
            style: {
              ...item.style,
              ...style
            }
          });
        }

        if (item.type === "connector" && typeof style.strokeColor === "string") {
          return touchUpdatedAt({
            ...item,
            style: {
              ...item.style,
              strokeColor: style.strokeColor
            }
          });
        }

        return touchUpdatedAt({
          ...item,
          style: {
            ...item.style,
            ...style
          }
        });
      });
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
      const currentItem = draft.items.find((item) => item.id === itemId);
      if (!currentItem) return;

      const nextBounds = {
        x: currentItem.x,
        y: currentItem.y,
        width: Math.max(size.width, currentItem.type === "frame" ? 220 : 80),
        height: Math.max(size.height, currentItem.type === "frame" ? 140 : 64)
      };

      let nextItems = draft.items.map((item) =>
        item.id === itemId
          ? touchUpdatedAt({
              ...item,
              width: nextBounds.width,
              height: nextBounds.height
            })
          : item
      );

      if (currentItem.type === "frame") {
        nextItems = scaleFrameChildren(nextItems, currentItem, nextBounds);
      }

      draft.items = nextItems;
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
      draft.items = draft.items.filter((item) => {
        if (selection.includes(item.id)) return false;
        if (
          item.type === "connector" &&
          (selection.includes(item.content.fromItemId) || selection.includes(item.content.toItemId))
        ) {
          return false;
        }
        return true;
      });
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

export const selectBoardStrokes = (snapshot: AppSnapshot, boardId: string) =>
  snapshot.strokes
    .filter((stroke) => stroke.boardId === boardId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export const selectAssetsById = (snapshot: AppSnapshot) =>
  new Map(snapshot.assets.map((asset) => [asset.id, asset]));
