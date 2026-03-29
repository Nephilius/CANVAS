import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import type { PatchManifest, PatchValidationResult } from "../shared/ipc";

export const PATCH_APP_ID = "canvas-studio";
export const PATCH_FORMAT = "zip-patch";
export const DEFAULT_ENTRY = "payload/app.asar";

export const compareVersions = (left: string, right: string) => {
  const normalize = (value: string) => value.split(".").map((part) => Number(part || "0"));
  const a = normalize(left);
  const b = normalize(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

const invalid = (
  filePath: string | null,
  message: string,
  fileName?: string | null
): PatchValidationResult => ({
  ok: false,
  filePath,
  fileName: fileName ?? (filePath ? path.basename(filePath) : null),
  status: filePath ? "invalid" : "cancelled",
  message
});

export const readManifest = (zip: AdmZip): PatchManifest => {
  const manifestEntry = zip.getEntry("manifest.json");
  if (!manifestEntry) {
    throw new Error("Missing manifest.json");
  }

  return JSON.parse(zip.readAsText(manifestEntry)) as PatchManifest;
};

export const validatePatchArchive = (
  filePath: string,
  currentVersion: string,
  packaged: boolean
): PatchValidationResult => {
  if (!filePath) {
    return invalid(null, "No patch selected.");
  }

  const fileName = path.basename(filePath);
  if (!fs.existsSync(filePath)) {
    return invalid(filePath, "Patch file does not exist.", fileName);
  }
  if (path.extname(filePath).toLowerCase() !== ".zip") {
    return invalid(filePath, "Invalid patch file. Expected a .zip package.", fileName);
  }
  const stat = fs.statSync(filePath);
  if (!stat.size) {
    return invalid(filePath, "Patch file is empty.", fileName);
  }

  try {
    const zip = new AdmZip(filePath);
    if (!zip.getEntries().length) {
      return invalid(filePath, "Zip file is empty.", fileName);
    }

    const manifest = readManifest(zip);
    if (manifest.appId !== PATCH_APP_ID) {
      return invalid(filePath, "Patch is not compatible with this app.", fileName);
    }
    if (manifest.packageFormat !== PATCH_FORMAT) {
      return invalid(filePath, "Unsupported patch package format.", fileName);
    }
    if (!manifest.entry || !zip.getEntry(manifest.entry)) {
      return invalid(filePath, "Missing patch payload.", fileName);
    }
    if (compareVersions(currentVersion, manifest.minSupportedVersion) < 0) {
      return invalid(filePath, "Patch requires a newer base version of Canvas Studio.", fileName);
    }
    if (compareVersions(manifest.version, currentVersion) <= 0) {
      return invalid(filePath, "Patch version is older than or equal to the current app version.", fileName);
    }

    return {
      ok: true,
      filePath,
      fileName,
      status: "ready",
      message: packaged
        ? "Ready to install. The app will restart to finish applying the patch."
        : "Patch is valid, but installation only works in the packaged app.",
      manifest,
      packagedOnly: !packaged,
      requiresRestart: true
    };
  } catch (error) {
    return invalid(
      filePath,
      error instanceof Error ? `Invalid zip patch: ${error.message}` : "Invalid zip patch.",
      fileName
    );
  }
};
