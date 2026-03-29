import fs from "node:fs";
import path from "node:path";

const targets = ["dist", "dist-electron", "release", "coverage"];

for (const target of targets) {
  const resolved = path.resolve(target);
  if (fs.existsSync(resolved)) {
    fs.rmSync(resolved, { recursive: true, force: true });
    console.log(`Removed ${resolved}`);
  }
}

console.log("Workspace build artifacts cleaned.");
