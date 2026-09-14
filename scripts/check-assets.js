const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const sourceRoots = ["app", "src"].map((directory) =>
  path.join(projectRoot, directory),
);
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const assetExtensions = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".wav"];
const missing = [];
const requirePattern = /require\(\s*["']([^"']+)["']\s*\)/g;

const walk = (directory) => {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(filePath));
    else if (sourceExtensions.has(path.extname(entry.name)))
      files.push(filePath);
  }
  return files;
};

const resolveAsset = (sourceFile, request) => {
  if (!request.startsWith(".")) return null;
  const requestExtension = path.extname(request).toLowerCase();
  if (!assetExtensions.includes(requestExtension)) return null;
  const basePath = path.resolve(path.dirname(sourceFile), request);
  const candidates = [
    basePath,
    ...assetExtensions.map((extension) => `${basePath}${extension}`),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || basePath;
};

for (const sourceRoot of sourceRoots) {
  for (const sourceFile of walk(sourceRoot)) {
    const source = fs.readFileSync(sourceFile, "utf8");
    for (const match of source.matchAll(requirePattern)) {
      const resolved = resolveAsset(sourceFile, match[1]);
      if (resolved && !fs.existsSync(resolved)) {
        missing.push({
          file: path.relative(projectRoot, sourceFile),
          request: match[1],
        });
      }
    }
  }
}

if (missing.length > 0) {
  console.error("Missing local asset references:");
  for (const item of missing) console.error(`- ${item.file}: ${item.request}`);
  process.exitCode = 1;
} else {
  console.log("Asset references are valid.");
}
