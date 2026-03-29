import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { app } from "electron";

interface CrashPayload {
  source: string;
  message: string;
  stack?: string;
  extra?: string;
}

const getCrashReportsDirectory = () => path.join(app.getPath("userData"), "crash-reports");

const sanitize = (value: string) => value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-");

export const writeCrashReport = (payload: CrashPayload) => {
  fs.mkdirSync(getCrashReportsDirectory(), { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = sanitize(`crash-${timestamp}-${randomUUID().slice(0, 8)}.txt`);
  const filePath = path.join(getCrashReportsDirectory(), fileName);

  const contents = [
    `Canvas Studio Crash Report`,
    ``,
    `Timestamp: ${new Date().toISOString()}`,
    `Version: ${app.getVersion()}`,
    `Packaged: ${app.isPackaged}`,
    `Platform: ${process.platform}`,
    `Arch: ${process.arch}`,
    `OS: ${os.release()}`,
    `Source: ${payload.source}`,
    ``,
    `Message:`,
    payload.message || "Unknown error",
    ``,
    `Stack:`,
    payload.stack || "No stack available",
    ``,
    `Extra:`,
    payload.extra || "None"
  ].join("\n");

  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
};

export const getCrashReportDir = () => getCrashReportsDirectory();
