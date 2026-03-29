import type { AppSnapshot, Asset } from "./domain";

export interface ImportedAsset extends Asset {
  kind: "image" | "pdf" | "file";
}

export interface ImportFilesResult {
  imported: ImportedAsset[];
  rejected: Array<{
    path: string;
    reason: string;
  }>;
}

export interface ClipboardImportInput {
  name: string;
  dataUrl: string;
}

export interface PatchManifest {
  appId: string;
  version: string;
  minSupportedVersion: string;
  packageFormat: "zip-patch";
  entry: string;
}

export interface PatchValidationResult {
  ok: boolean;
  filePath: string | null;
  fileName: string | null;
  status:
    | "idle"
    | "cancelled"
    | "validating"
    | "ready"
    | "invalid"
    | "installing"
    | "installed"
    | "failed";
  message: string;
  manifest?: PatchManifest;
  requiresRestart?: boolean;
  packagedOnly?: boolean;
}

export interface PatchInstallResult {
  ok: boolean;
  status: "installed" | "failed";
  message: string;
  willRelaunch?: boolean;
}

export interface PatchProgressState {
  phase:
    | "idle"
    | "validating"
    | "staging"
    | "preparing-helper"
    | "ready-to-restart"
    | "quitting"
    | "failed";
  percent: number;
  message: string;
}

export interface CrashReportResult {
  ok: boolean;
  path: string;
}

export interface FocusOverlayPayload {
  src: string;
  label: string;
  opacity?: number;
}

export interface FocusOverlayWindowState {
  clickThrough: boolean;
  shortcutHint: string;
}

export interface AppApi {
  loadSnapshot: () => Promise<AppSnapshot>;
  saveSnapshot: (snapshot: AppSnapshot) => Promise<{ savedAt: string }>;
  importFiles: (paths: string[]) => Promise<ImportFilesResult>;
  importClipboardImage: (input: ClipboardImportInput) => Promise<ImportedAsset>;
  openImportDialog: () => Promise<string[]>;
  getAppVersion: () => Promise<{ version: string; packaged: boolean }>;
  getCrashReportsDirectory: () => Promise<{ path: string }>;
  selectPatchFile: () => Promise<string | null>;
  validatePatch: (filePath: string) => Promise<PatchValidationResult>;
  installPatch: (filePath: string) => Promise<PatchInstallResult>;
  onPatchProgress: (listener: (progress: PatchProgressState) => void) => () => void;
  openFocusOverlay: (payload: FocusOverlayPayload) => Promise<{ ok: boolean }>;
  setFocusOverlayOpacity: (opacity: number) => Promise<{ ok: boolean }>;
  setFocusOverlayClickThrough: (enabled: boolean) => Promise<FocusOverlayWindowState>;
  getFocusOverlayWindowState: () => Promise<FocusOverlayWindowState>;
  onFocusOverlayWindowState: (listener: (state: FocusOverlayWindowState) => void) => () => void;
  closeFocusOverlay: () => Promise<{ ok: boolean }>;
  reportRendererCrash: (payload: {
    source: string;
    message: string;
    stack?: string;
    extra?: string;
  }) => Promise<CrashReportResult>;
}
