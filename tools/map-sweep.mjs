import fs from "fs";
import path from "path";
import { SourceMapConsumer } from "source-map";

const mapPath = path.resolve("dist/_expo/static/js/android/entry-d41d8cd98f00b204e9800998ecf8427e.js.map");

// tâm lỗi
const baseLine = 191399;
const baseCol = 69;

// quét +/- 5 dòng, và cột 0..200
const LINE_SPREAD = 5;
const COL_MAX = 200;

async function main() {
  const rawMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  const consumer = await new SourceMapConsumer(rawMap);

  try {
    for (let dl = -LINE_SPREAD; dl <= LINE_SPREAD; dl++) {
      const line = baseLine + dl;
      for (let col = 0; col <= COL_MAX; col++) {
        const pos = consumer.originalPositionFor({ line, column: col });
        if (pos && pos.source) {
          console.log(`FOUND generated ${line}:${col} -> ${pos.source}:${pos.line}:${pos.column}`);
          return;
        }
      }
    }
    console.log("No mapped position found in sweep window.");
  } finally {
    consumer.destroy?.();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
