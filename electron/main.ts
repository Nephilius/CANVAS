import path from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, globalShortcut, ipcMain } from "electron";
import { getCrashReportDir, writeCrashReport } from "./crash-logger";
import { getPatchDialogOptions, installPatchArchive } from "./patcher";
import { validatePatchArchive } from "./patch-format";
import { importClipboardImage, importFiles, loadSnapshot, saveSnapshot } from "./storage";
import { configureAutoUpdates } from "./updater";
import type { AppSnapshot } from "../shared/domain";
import type { FocusOverlayPayload, PatchProgressState } from "../shared/ipc";
import { SUPPORTED_IMPORT_EXTENSIONS } from "../shared/imports";

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let focusOverlayWindow: BrowserWindow | null = null;
let focusOverlayClickThrough = false;
const FOCUS_OVERLAY_SHORTCUT = "CommandOrControl+Shift+X";

const getRendererUrl = (search = "") => {
  if (isDev) {
    return `http://localhost:5173/${search}`;
  }

  const fileUrl = pathToFileURL(path.join(app.getAppPath(), "dist", "index.html")).toString();
  return `${fileUrl}${search}`;
};

const broadcastPatchProgress = (progress: PatchProgressState) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("app:patchProgress", progress);
  }
};

const attachCrashHooks = (win: BrowserWindow) => {
  win.webContents.on("render-process-gone", (_event, details) => {
    const crashPath = writeCrashReport({
      source: "renderer-process-gone",
      message: `Renderer process exited: ${details.reason}`,
      extra: JSON.stringify(details, null, 2)
    });
    console.error("Renderer process gone. Crash report:", crashPath);
  });

  win.webContents.on("unresponsive", () => {
    const crashPath = writeCrashReport({
      source: "renderer-unresponsive",
      message: "Renderer became unresponsive."
    });
    console.error("Renderer unresponsive. Crash report:", crashPath);
  });
};

const createMainWindow = async () => {
  const win = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#0c0d0f",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow = win;
  attachCrashHooks(win);
  await win.loadURL(getRendererUrl());

  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });
};

const getFocusOverlayWindowState = () => ({
  clickThrough: focusOverlayClickThrough,
  shortcutHint:
    process.platform === "darwin" ? "Cmd+Shift+X" : "Ctrl+Shift+X"
});

const unregisterFocusOverlayShortcut = () => {
  if (globalShortcut.isRegistered(FOCUS_OVERLAY_SHORTCUT)) {
    globalShortcut.unregister(FOCUS_OVERLAY_SHORTCUT);
  }
};

const applyFocusOverlayClickThrough = (enabled: boolean) => {
  focusOverlayClickThrough = enabled;
  if (focusOverlayWindow && !focusOverlayWindow.isDestroyed()) {
    focusOverlayWindow.setIgnoreMouseEvents(enabled, { forward: true });
    focusOverlayWindow.setFocusable(!enabled);
    if (!enabled) {
      focusOverlayWindow.focus();
    }
  }

  unregisterFocusOverlayShortcut();
  if (enabled) {
    globalShortcut.register(FOCUS_OVERLAY_SHORTCUT, () => {
      applyFocusOverlayClickThrough(false);
      if (focusOverlayWindow && !focusOverlayWindow.isDestroyed()) {
        focusOverlayWindow.webContents.send("app:focusOverlayWindowState", getFocusOverlayWindowState());
      }
    });
  }
};

const openFocusOverlayWindow = async (payload: FocusOverlayPayload) => {
  if (focusOverlayWindow && !focusOverlayWindow.isDestroyed()) {
    focusOverlayWindow.close();
  }
  focusOverlayClickThrough = false;

  const query = new URLSearchParams({
    focusOverlay: "1",
    src: payload.src,
    label: payload.label,
    opacity: String(payload.opacity ?? 0.95)
  });

  const win = new BrowserWindow({
    width: 420,
    height: 560,
    minWidth: 280,
    minHeight: 240,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#0f1114",
    alwaysOnTop: true,
    resizable: true,
    movable: true,
    skipTaskbar: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  focusOverlayWindow = win;
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setOpacity(Math.max(0.2, Math.min(1, payload.opacity ?? 0.95)));
  attachCrashHooks(win);
  await win.loadURL(getRendererUrl(`?${query.toString()}`));
  win.webContents.once("did-finish-load", () => {
    win.webContents.send("app:focusOverlayWindowState", getFocusOverlayWindowState());
  });

  win.on("closed", () => {
    unregisterFocusOverlayShortcut();
    if (focusOverlayWindow === win) {
      focusOverlayWindow = null;
    }
    focusOverlayClickThrough = false;
    mainWindow?.focus();
  });
};

process.on("uncaughtException", (error) => {
  const crashPath = writeCrashReport({
    source: "main-uncaught-exception",
    message: error.message,
    stack: error.stack
  });
  console.error("Main uncaught exception. Crash report:", crashPath, error);
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  const crashPath = writeCrashReport({
    source: "main-unhandled-rejection",
    message,
    stack
  });
  console.error("Main unhandled rejection. Crash report:", crashPath, reason);
});

app.whenReady().then(async () => {
  ipcMain.handle("app:loadSnapshot", () => loadSnapshot());
  ipcMain.handle("app:saveSnapshot", (_event, snapshot: AppSnapshot) => saveSnapshot(snapshot));
  ipcMain.handle("app:importFiles", (_event, paths: string[]) => importFiles(paths));
  ipcMain.handle("app:importClipboardImage", (_event, payload) => importClipboardImage(payload));
  ipcMain.handle("app:openImportDialog", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "openDirectory", "multiSelections"],
      filters: [
        {
          name: "Creative Assets",
          extensions: SUPPORTED_IMPORT_EXTENSIONS.map((extension) => extension.replace(".", ""))
        }
      ]
    });
    return result.canceled ? [] : result.filePaths;
  });
  ipcMain.handle("app:getAppVersion", () => ({
    version: app.getVersion(),
    packaged: app.isPackaged
  }));
  ipcMain.handle("app:getCrashReportsDirectory", () => ({
    path: getCrashReportDir()
  }));
  ipcMain.handle("app:selectPatchFile", async () => {
    const result = await dialog.showOpenDialog(getPatchDialogOptions());
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  ipcMain.handle("app:validatePatch", (_event, filePath: string) =>
    validatePatchArchive(filePath, app.getVersion(), app.isPackaged)
  );
  ipcMain.handle("app:installPatch", (_event, filePath: string) =>
    installPatchArchive(filePath, app.getVersion(), broadcastPatchProgress)
  );
  ipcMain.handle("app:openFocusOverlay", async (_event, payload: FocusOverlayPayload) => {
    await openFocusOverlayWindow(payload);
    return { ok: true };
  });
  ipcMain.handle("app:setFocusOverlayOpacity", (_event, opacity: number) => {
    if (focusOverlayWindow && !focusOverlayWindow.isDestroyed()) {
      focusOverlayWindow.setOpacity(Math.max(0.2, Math.min(1, opacity)));
    }
    return { ok: true };
  });
  ipcMain.handle("app:setFocusOverlayClickThrough", (_event, enabled: boolean) => {
    applyFocusOverlayClickThrough(enabled);
    if (focusOverlayWindow && !focusOverlayWindow.isDestroyed()) {
      focusOverlayWindow.webContents.send("app:focusOverlayWindowState", getFocusOverlayWindowState());
    }
    return getFocusOverlayWindowState();
  });
  ipcMain.handle("app:getFocusOverlayWindowState", () => getFocusOverlayWindowState());
  ipcMain.handle("app:closeFocusOverlay", () => {
    if (focusOverlayWindow && !focusOverlayWindow.isDestroyed()) {
      focusOverlayWindow.close();
    }
    return { ok: true };
  });
  ipcMain.handle(
    "app:reportRendererCrash",
    (_event, payload: { source: string; message: string; stack?: string; extra?: string }) => ({
      ok: true,
      path: writeCrashReport(payload)
    })
  );

  await createMainWindow();
  configureAutoUpdates();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  unregisterFocusOverlayShortcut();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
