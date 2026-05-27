// Copies manifest.json, background.js, and icons/ into dist/ after Vite build
import { copyFileSync, cpSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");

mkdirSync(dist, { recursive: true });

// manifest
copyFileSync(join(root, "manifest.json"), join(dist, "manifest.json"));

// background service worker
copyFileSync(join(root, "background.js"), join(dist, "background.js"));

// icons
const iconsDist = join(dist, "icons");
mkdirSync(iconsDist, { recursive: true });
cpSync(join(root, "icons"), iconsDist, { recursive: true });

console.log("Assets copied to dist/");
