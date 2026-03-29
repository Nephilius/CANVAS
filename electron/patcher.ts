import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import AdmZip from "adm-zip";
import { app, type OpenDialogOptions } from "electron";
import type { PatchInstallResult, PatchProgressState } from "../shared/ipc";
import { DEFAULT_ENTRY, readManifest, validatePatchArchive } from "./patch-format";

const buildHelperScript = (options: {
  targetAsar: string;
  stagedAsar: string;
  backupDir: string;
  appExe: string;
  waitPid: number;
  resultFile: string;
}) => `
$ErrorActionPreference = "Stop"
$target = "${options.targetAsar.replace(/\\/g, "\\\\")}"
$staged = "${options.stagedAsar.replace(/\\/g, "\\\\")}"
$backupDir = "${options.backupDir.replace(/\\/g, "\\\\")}"
$appExe = "${options.appExe.replace(/\\/g, "\\\\")}"
$waitPid = ${options.waitPid}
$resultFile = "${options.resultFile.replace(/\\/g, "\\\\")}"

try {
  while (Get-Process -Id $waitPid -ErrorAction SilentlyContinue) {
    Start-Sleep -Milliseconds 75
  }

  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupFile = Join-Path $backupDir ("app-" + $timestamp + ".asar.bak")
  Copy-Item -LiteralPath $target -Destination $backupFile -Force
  Remove-Item -LiteralPath $target -Force
  Move-Item -LiteralPath $staged -Destination $target -Force
  Set-Content -LiteralPath $resultFile -Value "ok"
  Start-Process -FilePath $appExe
}
catch {
  Set-Content -LiteralPath $resultFile -Value $_.Exception.Message
}
`;

export const installPatchArchive = async (
  filePath: string,
  currentVersion: string,
  onProgress?: (progress: PatchProgressState) => void
): Promise<PatchInstallResult> => {
  try {
    onProgress?.({
      phase: "validating",
      percent: 10,
      message: "Validating selected patch package..."
    });
    const validation = validatePatchArchive(filePath, currentVersion, app.isPackaged);
    if (!validation.ok) {
      onProgress?.({
        phase: "failed",
        percent: 100,
        message: validation.message
      });
      return {
        ok: false,
        status: "failed",
        message: validation.message
      };
    }

    if (!app.isPackaged) {
      onProgress?.({
        phase: "failed",
        percent: 100,
        message: "Patch installation only works in the packaged Windows app."
      });
      return {
        ok: false,
        status: "failed",
        message: "Patch installation only works in the packaged Windows app."
      };
    }

    const stagingDir = path.join(app.getPath("userData"), "patch-staging", randomUUID());
    fs.mkdirSync(stagingDir, { recursive: true });
    onProgress?.({
      phase: "staging",
      percent: 35,
      message: "Extracting patch payload into a safe staging area..."
    });

    const zip = new AdmZip(filePath);
    const manifest = validation.manifest ?? readManifest(zip);
    const entryName = manifest.entry || DEFAULT_ENTRY;
    const entry = zip.getEntry(entryName);
    if (!entry) {
      throw new Error("Patch payload entry is missing from the archive.");
    }

    onProgress?.({
      phase: "staging",
      percent: 48,
      message: "Reading patch payload and staging it for restart..."
    });
    const payload = zip.readFile(entry);
    if (!payload) {
      throw new Error("Patch payload could not be read from the archive.");
    }

    const stagedAsar = path.join(stagingDir, entryName);
    fs.mkdirSync(path.dirname(stagedAsar), { recursive: true });
    fs.writeFileSync(stagedAsar, payload);

    if (!fs.existsSync(stagedAsar)) {
      throw new Error("Patch payload could not be staged.");
    }

    const helperScriptPath = path.join(stagingDir, "apply-patch.ps1");
    const resultFile = path.join(stagingDir, "patch-result.txt");
    const targetAsar = path.join(process.resourcesPath, "app.asar");
    const backupDir = path.join(app.getPath("userData"), "patch-backups");
    onProgress?.({
      phase: "preparing-helper",
      percent: 68,
      message: "Preparing restart helper and backup handoff..."
    });

    fs.writeFileSync(
      helperScriptPath,
      buildHelperScript({
        targetAsar,
        stagedAsar,
        backupDir,
        appExe: process.execPath,
        waitPid: process.pid,
        resultFile
      }),
      "utf8"
    );

    const child = spawn(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        helperScriptPath
      ],
      {
        detached: true,
        stdio: "ignore"
      }
    );

    child.unref();
    onProgress?.({
      phase: "ready-to-restart",
      percent: 90,
      message: "Patch staged. Restarting now to apply the update."
    });

    setTimeout(() => {
      onProgress?.({
        phase: "quitting",
        percent: 100,
        message: "Closing app so the patch can be applied, then relaunching..."
      });
      app.quit();
    }, 120);

    return {
      ok: true,
      status: "installed",
      message: "Patch staged successfully. Canvas Studio will restart to apply it.",
      willRelaunch: true
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onProgress?.({
      phase: "failed",
      percent: 100,
      message
    });
    return {
      ok: false,
      status: "failed",
      message
    };
  }
};

export const getPatchDialogOptions = (): OpenDialogOptions => ({
  properties: ["openFile"],
  filters: [
    {
      name: "Canvas Studio Patch",
      extensions: ["zip"]
    }
  ]
});
