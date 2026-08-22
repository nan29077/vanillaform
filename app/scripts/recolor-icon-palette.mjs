import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ICON_DIR = path.join(ROOT, "public", "icons");

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) return [0, 0, lightness];

  const delta = max - min;
  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min);
  let hue;

  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  return [(hue * 60) % 360, saturation, lightness];
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];

  if (h < 60) [r, g] = [c, x];
  else if (h < 120) [r, g] = [x, c];
  else if (h < 180) [g, b] = [c, x];
  else if (h < 240) [g, b] = [x, c];
  else if (h < 300) [r, b] = [x, c];
  else [r, b] = [c, x];

  return [r, g, b].map((v) => Math.round((v + m) * 255));
}

const iconFiles = fs.readdirSync(ICON_DIR).filter((file) => file.endsWith(".png"));
let changedFiles = 0;
let changedPixels = 0;

for (const file of iconFiles) {
  const filePath = path.join(ICON_DIR, file);
  const original = fs.readFileSync(filePath);
  const png = PNG.sync.read(original);
  let filePixelCount = 0;

  for (let offset = 0; offset < png.data.length; offset += 4) {
    if (png.data[offset + 3] === 0) continue;

    const [hue, saturation, lightness] = rgbToHsl(
      png.data[offset],
      png.data[offset + 1],
      png.data[offset + 2],
    );

    // 기존 아이콘의 노랑·골드 픽셀만 바닐라폼 포레스트 그린 계열로 이동한다.
    // 피부색, 핑크 포인트, 크림색 하이라이트와 브랜드 고유색은 보존한다.
    if (hue < 38 || hue > 65 || saturation < 0.28 || lightness < 0.25 || lightness > 0.9) {
      continue;
    }

    const greenSaturation = Math.min(0.42, Math.max(0.3, saturation * 0.36));
    const greenLightness = Math.min(0.68, Math.max(0.16, lightness * 0.63));
    const [r, g, b] = hslToRgb(147, greenSaturation, greenLightness);
    png.data[offset] = r;
    png.data[offset + 1] = g;
    png.data[offset + 2] = b;
    filePixelCount += 1;
  }

  if (filePixelCount > 0) {
    fs.writeFileSync(filePath, PNG.sync.write(png));
    changedFiles += 1;
    changedPixels += filePixelCount;
  }
}

console.log(`[바닐라폼 아이콘] ${changedFiles}개 파일, ${changedPixels.toLocaleString("ko-KR")}개 노랑 픽셀을 초록색으로 변경했습니다.`);
