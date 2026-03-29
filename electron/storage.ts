import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { app, nativeImage } from "electron";
import { getImportKindFromExtension, SUPPORTED_IMPORT_EXTENSIONS } from "../shared/imports";
import {
  DEFAULT_PERSPECTIVE_GRID,
  DEFAULT_WORKSPACE_SETTINGS,
  SCHEMA_VERSION,
  createInitialSnapshot,
  type AppSnapshot,
  type Asset,
  type Board,
  type Item,
  type Project,
  type Workspace
} from "../shared/domain";
import type { ClipboardImportInput, ImportFilesResult, ImportedAsset } from "../shared/ipc";

const DB_FILE = "canvas-studio.sqlite";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

const ensureSql = async () => {
  if (SQL) return SQL;
  SQL = await initSqlJs({
    locateFile: (file: string) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file)
  });
  return SQL;
};

const getDbPath = () => path.join(app.getPath("userData"), DB_FILE);
const getAssetCacheDir = () => path.join(app.getPath("userData"), "asset-cache");

const writeDbToDisk = () => {
  if (!db) return;
  fs.writeFileSync(getDbPath(), Buffer.from(db.export()));
};

const ensureSchema = (database: Database) => {
  database.run(`
    CREATE TABLE IF NOT EXISTS workspace (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS project (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS board (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS item (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS asset (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
};

const getOpenDb = async () => {
  if (db) return db;
  const sql = await ensureSql();
  const dbPath = getDbPath();
  db = fs.existsSync(dbPath)
    ? new sql.Database(new Uint8Array(fs.readFileSync(dbPath)))
    : new sql.Database();
  ensureSchema(db);
  if (!fs.existsSync(dbPath)) {
    await saveSnapshot(createInitialSnapshot());
  }
  return db;
};

const readRows = <T>(table: string): T[] => {
  if (!db) return [];
  const result = db.exec(`SELECT data FROM ${table}`);
  return result[0] ? result[0].values.map((row: unknown[]) => JSON.parse(String(row[0])) as T) : [];
};

const upsertEntities = <T extends { id: string }>(table: string, rows: T[]) => {
  if (!db) return;
  db.run(`DELETE FROM ${table}`);
  const stmt = db.prepare(`INSERT INTO ${table} (id, data) VALUES (?, ?)`);
  rows.forEach((row) => stmt.run([row.id, JSON.stringify(row)]));
  stmt.free();
};

const setMeta = (key: string, value: string) => {
  if (!db) return;
  db.run(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
};

const getMeta = (key: string) => {
  if (!db) return null;
  const result = db.exec(`SELECT value FROM app_meta WHERE key = ?`, [key]);
  return result[0]?.values[0]?.[0] ? String(result[0].values[0][0]) : null;
};

export const loadSnapshot = async (): Promise<AppSnapshot> => {
  await getOpenDb();
  const snapshot: AppSnapshot = {
    schemaVersion: Number(getMeta("schemaVersion") ?? SCHEMA_VERSION),
    workspaces: readRows<Workspace>("workspace"),
    projects: readRows<Project>("project"),
    boards: readRows<Board>("board"),
    items: readRows<Item>("item"),
    assets: readRows<Asset>("asset"),
    activeWorkspaceId: getMeta("activeWorkspaceId") ?? "",
    activeProjectId: getMeta("activeProjectId") ?? "",
    activeBoardId: getMeta("activeBoardId") ?? "",
    lastOpenedBoardId: getMeta("lastOpenedBoardId") ?? ""
  };
  if (!snapshot.workspaces.length || !snapshot.projects.length || !snapshot.boards.length) {
    const seeded = createInitialSnapshot();
    await saveSnapshot(seeded);
    return seeded;
  }
  return {
    ...snapshot,
    schemaVersion: SCHEMA_VERSION,
    workspaces: snapshot.workspaces.map((workspace) => ({
      ...workspace,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        ...workspace.settings
      }
    })),
    boards: snapshot.boards.map((board) => ({
      ...board,
      perspectiveGrid: {
        ...DEFAULT_PERSPECTIVE_GRID,
        ...board.perspectiveGrid
      }
    }))
  };
};

export const saveSnapshot = async (snapshot: AppSnapshot): Promise<{ savedAt: string }> => {
  await getOpenDb();
  upsertEntities("workspace", snapshot.workspaces);
  upsertEntities("project", snapshot.projects);
  upsertEntities("board", snapshot.boards);
  upsertEntities("item", snapshot.items);
  upsertEntities("asset", snapshot.assets);
  setMeta("schemaVersion", String(snapshot.schemaVersion));
  setMeta("activeWorkspaceId", snapshot.activeWorkspaceId);
  setMeta("activeProjectId", snapshot.activeProjectId);
  setMeta("activeBoardId", snapshot.activeBoardId);
  setMeta("lastOpenedBoardId", snapshot.lastOpenedBoardId);
  writeDbToDisk();
  return { savedAt: new Date().toISOString() };
};

const hashBuffer = (buffer: Buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

const inferKind = (filePath: string): ImportedAsset["kind"] => {
  return getImportKindFromExtension(path.extname(filePath));
};

const copyAssetIntoCache = (
  sourcePath: string,
  buffer: Buffer,
  hash: string
): ImportedAsset => {
  fs.mkdirSync(getAssetCacheDir(), { recursive: true });
  const ext = path.extname(sourcePath) || ".bin";
  const cachedPath = path.join(getAssetCacheDir(), `${hash}${ext}`);
  if (!fs.existsSync(cachedPath)) fs.writeFileSync(cachedPath, buffer);
  const kind = inferKind(sourcePath);
  const image = kind === "image" ? nativeImage.createFromPath(cachedPath) : null;
  const size = image?.getSize() ?? { width: 0, height: 0 };
  const now = new Date().toISOString();

  return {
    id: `asset_${hash.slice(0, 12)}`,
    originalPath: sourcePath,
    cachedPath,
    thumbnailPath: kind === "image" ? cachedPath : null,
    mimeType:
      kind === "image"
        ? `image/${ext.replace(".", "")}`
        : kind === "pdf"
          ? "application/pdf"
          : "application/octet-stream",
    width: size.width,
    height: size.height,
    fileSize: buffer.byteLength,
    hash,
    importMode: "copy",
    createdAt: now,
    updatedAt: now,
    kind
  };
};

const listImportableFiles = (inputPaths: string[]) => {
  const resolved: string[] = [];
  const rejected: ImportFilesResult["rejected"] = [];
  const walk = (entry: string) => {
    const stat = fs.statSync(entry);
    if (stat.isDirectory()) {
      fs.readdirSync(entry).forEach((child) => walk(path.join(entry, child)));
      return;
    }
    const kind = inferKind(entry);
    if (kind === "file") {
      rejected.push({
        path: entry,
        reason: `Unsupported format. Supported: ${SUPPORTED_IMPORT_EXTENSIONS.join(", ")}`
      });
      return;
    }
    resolved.push(entry);
  };
  inputPaths.filter(fs.existsSync).forEach(walk);
  return { files: resolved, rejected };
};

export const importFiles = async (inputPaths: string[]): Promise<ImportFilesResult> => {
  await getOpenDb();
  const existingAssets = readRows<Asset>("asset");
  const byHash = new Map(existingAssets.map((asset) => [asset.hash, asset]));
  const { files, rejected } = listImportableFiles(inputPaths);

  const imported = files.map((filePath) => {
    const buffer = fs.readFileSync(filePath);
    const hash = hashBuffer(buffer);
    const existing = byHash.get(hash);
    if (existing) return { ...existing, kind: inferKind(filePath) };
    return copyAssetIntoCache(filePath, buffer, hash);
  });

  return {
    imported,
    rejected
  };
};

export const importClipboardImage = async (
  input: ClipboardImportInput
): Promise<ImportedAsset> => {
  const [, payload] = input.dataUrl.split(",");
  const buffer = Buffer.from(payload, "base64");
  fs.mkdirSync(getAssetCacheDir(), { recursive: true });
  const tempPath = path.join(getAssetCacheDir(), input.name.endsWith(".png") ? input.name : `${input.name}.png`);
  fs.writeFileSync(tempPath, buffer);
  return copyAssetIntoCache(tempPath, buffer, hashBuffer(buffer));
};
