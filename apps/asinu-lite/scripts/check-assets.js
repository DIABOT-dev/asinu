const fs = require("fs");
const path = require("path");

const requiredTargets = [
  { path: "assets/icon.png", type: "file" },
  { path: "assets/splash.png", type: "file" },
  { path: "assets/android/adaptive-foreground.png", type: "file" },
  { path: "assets/android/adaptive-background.png", type: "file" },
  { path: "assets/android/mipmap", type: "dir" },
  { path: "assets/ios/AppIcon.appiconset", type: "dir" },
];

const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".json"]);

function fail(message) {
  console.error(`[ASSET ERROR] ${message}`);
  process.exit(1);
}

function checkFile(targetPath) {
  const stats = fs.statSync(targetPath);
  if (!stats.isFile()) {
    fail(`Expected file but found directory at ${targetPath}`);
  }
  if (stats.size === 0) {
    fail(`Empty file detected: ${targetPath}`);
  }

  const ext = path.extname(targetPath).toLowerCase();
  if (!allowedExtensions.has(ext)) {
    fail(`Unexpected extension (${ext}) at ${targetPath}`);
  }
}

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath);
  if (entries.length === 0) {
    fail(`Directory is empty: ${dirPath}`);
  }

  entries.forEach((entry) => {
    const resolved = path.join(dirPath, entry);
    const stats = fs.statSync(resolved);
    if (stats.isDirectory()) {
      walk(resolved);
    } else {
      checkFile(resolved);
    }
  });
}

requiredTargets.forEach(({ path: targetPath, type }) => {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    fail(`Missing ${type}: ${targetPath}`);
  }

  const stats = fs.statSync(resolved);
  if (type === "dir" && !stats.isDirectory()) {
    fail(`Expected directory but found file at ${targetPath}`);
  }
  if (type === "file") {
    checkFile(resolved);
  } else {
    walk(resolved);
  }
});

console.log("[ASSET CHECK] OK");
