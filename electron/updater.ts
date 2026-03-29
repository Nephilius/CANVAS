import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { autoUpdater } from "electron-updater";

const UPDATE_CONFIG_FILE = "update-config.json";

interface UpdateConfig {
  provider: "generic";
  url: string;
  channel?: string;
}

const readUpdateConfig = (): UpdateConfig | null => {
  const candidates = [
    path.join(process.cwd(), UPDATE_CONFIG_FILE),
    path.join(path.dirname(process.execPath), UPDATE_CONFIG_FILE),
    path.join(app.getPath("userData"), UPDATE_CONFIG_FILE)
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf8")) as UpdateConfig;
      if (parsed.provider === "generic" && parsed.url) {
        return parsed;
      }
    } catch (error) {
      console.error("Failed to parse update config", candidate, error);
    }
  }

  return null;
};

export const configureAutoUpdates = () => {
  if (!app.isPackaged) {
    return;
  }

  const config = readUpdateConfig();
  if (!config) {
    console.log("Auto-update disabled: no update-config.json found.");
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableWebInstaller = false;
  autoUpdater.allowDowngrade = false;

  autoUpdater.setFeedURL({
    provider: config.provider,
    url: config.url,
    channel: config.channel ?? "latest"
  });

  autoUpdater.on("checking-for-update", () => {
    console.log("Checking for update...");
  });
  autoUpdater.on("update-available", (info) => {
    console.log("Update available", info.version);
  });
  autoUpdater.on("update-not-available", () => {
    console.log("No update available.");
  });
  autoUpdater.on("download-progress", (progress) => {
    console.log(`Update download ${Math.round(progress.percent)}%`);
  });
  autoUpdater.on("update-downloaded", (info) => {
    console.log(`Update downloaded: ${info.version}. Will install on quit.`);
  });
  autoUpdater.on("error", (error) => {
    console.error("Auto-update failed", error);
  });

  void autoUpdater.checkForUpdates().catch((error) => {
    console.error("Failed to start auto-update check", error);
  });
};
