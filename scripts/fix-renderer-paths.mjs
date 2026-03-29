import fs from "node:fs";
import path from "node:path";

const indexPath = path.resolve("dist", "index.html");

if (!fs.existsSync(indexPath)) {
  process.exit(0);
}

const current = fs.readFileSync(indexPath, "utf8");
const next = current
  .replaceAll('src="/assets/', 'src="./assets/')
  .replaceAll('href="/assets/', 'href="./assets/');

if (next !== current) {
  fs.writeFileSync(indexPath, next);
  console.log("Rewrote packaged renderer asset paths to relative URLs.");
}
