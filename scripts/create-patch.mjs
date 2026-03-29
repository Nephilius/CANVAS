import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { STORED } = require("adm-zip/util/constants");

const version = process.argv[2];
const sourceAsar = process.argv[3] ?? path.resolve("release", "win-unpacked", "resources", "app.asar");

if (!version) {
  console.error("Usage: npm run create:patch -- <new-version> [path-to-app.asar]");
  process.exit(1);
}

if (!fs.existsSync(sourceAsar)) {
  console.error(`Missing app.asar at ${sourceAsar}`);
  process.exit(1);
}

const zip = new AdmZip(undefined, { method: STORED, noSort: true });
zip.addFile(
  "manifest.json",
  Buffer.from(
    JSON.stringify(
      {
        appId: "canvas-studio",
        version,
        minSupportedVersion: "0.1.0",
        packageFormat: "zip-patch",
        entry: "payload/app.asar"
      },
      null,
      2
    ),
    "utf8"
  )
);
const payloadEntry = zip.addFile("payload/app.asar", fs.readFileSync(sourceAsar));
payloadEntry.header.method = STORED;

const outputDir = path.resolve("release", "patches", version);
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `canvas-studio-patch-${version}.zip`);
zip.writeZip(outputPath);
const stats = fs.statSync(outputPath);
console.log(`Created fast patch zip: ${outputPath} (${Math.round(stats.size / 1024 / 1024)} MB)`);
