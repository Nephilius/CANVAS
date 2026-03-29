import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { AppApi } from "../shared/ipc";

const api: AppApi = {
  loadSnapshot: () => ipcRenderer.invoke("app:loadSnapshot"),
  saveSnapshot: (snapshot) => ipcRenderer.invoke("app:saveSnapshot", snapshot),
  openNewWindow: () => ipcRenderer.invoke("app:openNewWindow"),
  importFiles: (paths) => ipcRenderer.invoke("app:importFiles", paths),
  getPathsForDroppedFiles: (files) =>
    files
      .map((file) => {
        try {
          return webUtils.getPathForFile(file);
        } catch {
          return (file as File & { path?: string }).path ?? "";
        }
      })
      .filter(Boolean),
  importClipboardImage: (input) => ipcRenderer.invoke("app:importClipboardImage", input),
  openImportDialog: () => ipcRenderer.invoke("app:openImportDialog"),
  saveSessionFile: (snapshot) => ipcRenderer.invoke("app:saveSessionFile", snapshot),
  openSessionFile: () => ipcRenderer.invoke("app:openSessionFile"),
  getAppVersion: () => ipcRenderer.invoke("app:getAppVersion"),
  getCrashReportsDirectory: () => ipcRenderer.invoke("app:getCrashReportsDirectory"),
  selectPatchFile: () => ipcRenderer.invoke("app:selectPatchFile"),
  validatePatch: (filePath) => ipcRenderer.invoke("app:validatePatch", filePath),
  installPatch: (filePath) => ipcRenderer.invoke("app:installPatch", filePath),
  onPatchProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: Parameters<typeof listener>[0]) => {
      listener(progress);
    };
    ipcRenderer.on("app:patchProgress", handler);
    return () => {
      ipcRenderer.removeListener("app:patchProgress", handler);
    };
  },
  openFocusOverlay: (payload) => ipcRenderer.invoke("app:openFocusOverlay", payload),
  setFocusOverlayOpacity: (opacity) => ipcRenderer.invoke("app:setFocusOverlayOpacity", opacity),
  setFocusOverlayClickThrough: (enabled) => ipcRenderer.invoke("app:setFocusOverlayClickThrough", enabled),
  getFocusOverlayWindowState: () => ipcRenderer.invoke("app:getFocusOverlayWindowState"),
  onFocusOverlayWindowState: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, state: Parameters<typeof listener>[0]) => {
      listener(state);
    };
    ipcRenderer.on("app:focusOverlayWindowState", handler);
    return () => {
      ipcRenderer.removeListener("app:focusOverlayWindowState", handler);
    };
  },
  closeFocusOverlay: () => ipcRenderer.invoke("app:closeFocusOverlay"),
  reportRendererCrash: (payload) => ipcRenderer.invoke("app:reportRendererCrash", payload)
};

contextBridge.exposeInMainWorld("appApi", api);

window.addEventListener("error", (event) => {
  void ipcRenderer.invoke("app:reportRendererCrash", {
    source: "renderer-window-error",
    message: event.message,
    stack: event.error?.stack,
    extra: JSON.stringify(
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      },
      null,
      2
    )
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  void ipcRenderer.invoke("app:reportRendererCrash", {
    source: "renderer-unhandled-rejection",
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
});
