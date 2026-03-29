export type ItemType =
  | "image"
  | "note"
  | "sticky"
  | "title"
  | "checklist"
  | "swatch"
  | "frame"
  | "pdf"
  | "link"
  | "connector";

export type AssetImportMode = "copy" | "link";

export interface WorkspaceSettings {
  theme: "obsidian";
  density: "comfortable" | "compact";
  autosaveMs: number;
  importMode: AssetImportMode;
  snapToGrid: boolean;
  snapToObjects: boolean;
  showGrid: boolean;
  thumbnailQuality: "balanced" | "high";
}

export interface Workspace {
  id: string;
  name: string;
  settings: WorkspaceSettings;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  coverAssetId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BoardViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface BoardBackground {
  tone: string;
  texture: "dots" | "none";
}

export interface PerspectiveGridSettings {
  visible: boolean;
  mode: "none" | "1-point" | "2-point" | "3-point";
  horizon: number;
  intensity: number;
}

export interface Board {
  id: string;
  projectId: string;
  title: string;
  viewport: BoardViewport;
  background: BoardBackground;
  perspectiveGrid: PerspectiveGridSettings;
  snapToGrid: boolean;
  showGrid: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BaseItem {
  id: string;
  boardId: string;
  type: ItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  hidden: boolean;
  opacity: number;
  style: Record<string, string | number | boolean>;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
}

export interface ImageItem extends BaseItem {
  type: "image";
  content: {
    assetId: string;
    caption: string;
  };
}

export interface NoteItem extends BaseItem {
  type: "note" | "sticky" | "title";
  content: {
    text: string;
  };
}

export interface ChecklistItem extends BaseItem {
  type: "checklist";
  content: {
    title: string;
    items: Array<{ id: string; text: string; done: boolean }>;
  };
}

export interface SwatchItem extends BaseItem {
  type: "swatch";
  content: {
    name: string;
    color: string;
    hex: string;
  };
}

export interface FrameItem extends BaseItem {
  type: "frame";
  content: {
    label: string;
  };
}

export interface PdfItem extends BaseItem {
  type: "pdf";
  content: {
    assetId: string;
    label: string;
  };
}

export interface LinkItem extends BaseItem {
  type: "link";
  content: {
    url: string;
    label: string;
  };
}

export interface ConnectorItem extends BaseItem {
  type: "connector";
  content: {
    fromItemId: string;
    toItemId: string;
  };
}

export type Item =
  | ImageItem
  | NoteItem
  | ChecklistItem
  | SwatchItem
  | FrameItem
  | PdfItem
  | LinkItem
  | ConnectorItem;

export interface Asset {
  id: string;
  originalPath: string;
  cachedPath: string;
  thumbnailPath: string | null;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  hash: string;
  importMode: AssetImportMode;
  createdAt: string;
  updatedAt: string;
}

export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface SketchStroke {
  id: string;
  boardId: string;
  points: StrokePoint[];
  color: string;
  size: number;
  opacity: number;
  smoothing: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppSnapshot {
  schemaVersion: number;
  workspaces: Workspace[];
  projects: Project[];
  boards: Board[];
  items: Item[];
  strokes: SketchStroke[];
  assets: Asset[];
  activeWorkspaceId: string;
  activeProjectId: string;
  activeBoardId: string;
  lastOpenedBoardId: string;
}

export const SCHEMA_VERSION = 4;

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  theme: "obsidian",
  density: "comfortable",
  autosaveMs: 600,
  importMode: "copy",
  snapToGrid: false,
  snapToObjects: true,
  showGrid: true,
  thumbnailQuality: "balanced"
};

export const DEFAULT_PERSPECTIVE_GRID: PerspectiveGridSettings = {
  visible: false,
  mode: "2-point",
  horizon: 0.46,
  intensity: 0.7
};

export const nowIso = () => new Date().toISOString();
export const makeId = (prefix: string) =>
  `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;

export const createDefaultWorkspace = (): Workspace => {
  const now = nowIso();
  return {
    id: makeId("workspace"),
    name: "Studio Workspace",
    settings: DEFAULT_WORKSPACE_SETTINGS,
    createdAt: now,
    updatedAt: now
  };
};

export const createDefaultProject = (
  workspaceId: string,
  title = "Campaign Exploration"
): Project => {
  const now = nowIso();
  return {
    id: makeId("project"),
    workspaceId,
    title,
    description: "Reference gathering, board planning, and notes.",
    coverAssetId: null,
    tags: ["creative", "references"],
    createdAt: now,
    updatedAt: now
  };
};

export const createDefaultBoard = (projectId: string, title = "Board 01"): Board => {
  const now = nowIso();
  return {
    id: makeId("board"),
    projectId,
    title,
    viewport: { x: 0, y: 0, zoom: 1 },
    background: { tone: "#111315", texture: "dots" },
    perspectiveGrid: { ...DEFAULT_PERSPECTIVE_GRID },
    snapToGrid: false,
    showGrid: true,
    createdAt: now,
    updatedAt: now
  };
};

export const createBaseItem = <T extends ItemType>(
  boardId: string,
  type: T,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex = 1
): BaseItem & { type: T } => {
  const now = nowIso();
  return {
    id: makeId("item"),
    boardId,
    type,
    x,
    y,
    width,
    height,
    rotation: 0,
    zIndex,
    locked: false,
    hidden: false,
    opacity: 1,
    style: {},
    metadata: {},
    createdAt: now,
    updatedAt: now
  };
};

export const createNoteLikeItem = (
  boardId: string,
  type: "note" | "sticky" | "title",
  text: string,
  x: number,
  y: number
): NoteItem => ({
  ...createBaseItem(
    boardId,
    type,
    x,
    y,
    type === "title" ? 340 : 260,
    type === "title" ? 84 : 180
  ),
  content: { text }
});

export const createChecklistItem = (boardId: string, x: number, y: number): ChecklistItem => ({
  ...createBaseItem(boardId, "checklist", x, y, 260, 220),
  content: {
    title: "Tasks",
    items: [
      { id: makeId("chk"), text: "Collect references", done: false },
      { id: makeId("chk"), text: "Define visual themes", done: false }
    ]
  }
});

export const createSwatchItem = (
  boardId: string,
  color: string,
  name: string,
  x: number,
  y: number
): SwatchItem => ({
  ...createBaseItem(boardId, "swatch", x, y, 180, 140),
  content: { name, color, hex: color.toUpperCase() }
});

export const createFrameItem = (boardId: string, x: number, y: number): FrameItem => ({
  ...createBaseItem(boardId, "frame", x, y, 520, 360, 0),
  content: { label: "Section" },
  opacity: 0.6
});

export const createImageItem = (
  boardId: string,
  assetId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  caption = ""
): ImageItem => ({
  ...createBaseItem(boardId, "image", x, y, width, height),
  content: { assetId, caption }
});

export const createPdfItem = (
  boardId: string,
  assetId: string,
  label: string,
  x: number,
  y: number
): PdfItem => ({
  ...createBaseItem(boardId, "pdf", x, y, 240, 320),
  content: { assetId, label }
});

export const createLinkItem = (
  boardId: string,
  url: string,
  label: string,
  x: number,
  y: number
): LinkItem => ({
  ...createBaseItem(boardId, "link", x, y, 300, 120),
  content: { url, label }
});

export const createConnectorItem = (
  boardId: string,
  fromItemId: string,
  toItemId: string,
  zIndex = 1
): ConnectorItem => ({
  ...createBaseItem(boardId, "connector", 0, 0, 0, 0, zIndex),
  content: { fromItemId, toItemId },
  style: {
    strokeColor: "#D5B66F"
  },
  opacity: 0.92
});

export const touchUpdatedAt = <T extends { updatedAt: string }>(entity: T): T => ({
  ...entity,
  updatedAt: nowIso()
});

export const createSketchStroke = (
  boardId: string,
  points: StrokePoint[],
  color: string,
  size: number,
  opacity: number,
  smoothing: number
): SketchStroke => {
  const now = nowIso();
  return {
    id: makeId("stroke"),
    boardId,
    points,
    color,
    size,
    opacity,
    smoothing,
    createdAt: now,
    updatedAt: now
  };
};

export const createInitialSnapshot = (): AppSnapshot => {
  const workspace = createDefaultWorkspace();
  const project = createDefaultProject(workspace.id);
  const board = createDefaultBoard(project.id);

  return {
    schemaVersion: SCHEMA_VERSION,
    workspaces: [workspace],
    projects: [project],
    boards: [board],
    items: [
      createNoteLikeItem(board.id, "title", "Creative Direction", -220, -180),
      createNoteLikeItem(
        board.id,
        "sticky",
        "Drop references here or paste an image from the clipboard.",
        -260,
        -40
      ),
      createSwatchItem(board.id, "#D5B66F", "Warm Gold", 120, -120)
    ],
    strokes: [],
    assets: [],
    activeWorkspaceId: workspace.id,
    activeProjectId: project.id,
    activeBoardId: board.id,
    lastOpenedBoardId: board.id
  };
};
