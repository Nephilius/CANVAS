import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";
import { validatePatchArchive } from "../electron/patch-format";

const createdDirs: string[] = [];

const makeZip = (options: {
  manifest?: object;
  withPayload?: boolean;
  extension?: string;
}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "canvas-patch-"));
  createdDirs.push(dir);
  const ext = options.extension ?? ".zip";
  const filePath = path.join(dir, `patch${ext}`);
  const zip = new AdmZip();
  if (options.manifest) {
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(options.manifest), "utf8"));
  }
  if (options.withPayload) {
    zip.addFile("payload/app.asar", Buffer.from("asar-bytes"));
  }
  zip.writeZip(filePath);
  return filePath;
};

afterEach(() => {
  createdDirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

describe("patch validation", () => {
  it("accepts a valid patch zip", () => {
    const patchPath = makeZip({
      manifest: {
        appId: "canvas-studio",
        version: "0.1.1",
        minSupportedVersion: "0.1.0",
        packageFormat: "zip-patch",
        entry: "payload/app.asar"
      },
      withPayload: true
    });

    const result = validatePatchArchive(patchPath, "0.1.0", true);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
  });

  it("fails when manifest is missing", () => {
    const patchPath = makeZip({ withPayload: true });
    const result = validatePatchArchive(patchPath, "0.1.0", true);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("manifest");
  });

  it("fails incompatible app ids", () => {
    const patchPath = makeZip({
      manifest: {
        appId: "wrong-app",
        version: "0.1.1",
        minSupportedVersion: "0.1.0",
        packageFormat: "zip-patch",
        entry: "payload/app.asar"
      },
      withPayload: true
    });
    const result = validatePatchArchive(patchPath, "0.1.0", true);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("compatible");
  });
});
