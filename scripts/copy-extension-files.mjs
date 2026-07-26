import { cp, copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const distRoot = path.join(projectRoot, "dist");
const distSource = path.join(distRoot, "src");

await mkdir(distSource, { recursive: true });

await Promise.all([
  copyFile(
    path.join(projectRoot, "manifest.json"),
    path.join(distRoot, "manifest.json"),
  ),
  copyFile(
    path.join(projectRoot, "src", "background.js"),
    path.join(distSource, "background.js"),
  ),
  copyFile(
    path.join(projectRoot, "src", "offscreen.html"),
    path.join(distSource, "offscreen.html"),
  ),
  copyFile(
    path.join(projectRoot, "src", "offscreen.js"),
    path.join(distSource, "offscreen.js"),
  ),
  copyFile(
    path.join(projectRoot, "src", "blocked.html"),
    path.join(distRoot, "blocked.html"),
  ),
  copyFile(
    path.join(projectRoot, "src", "blocked.js"),
    path.join(distRoot, "blocked.js"),
  ),
  cp(path.join(projectRoot, "src", "core"), path.join(distSource, "core"), {
    recursive: true,
  }),
]);
