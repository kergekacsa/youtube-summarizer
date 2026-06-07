import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SIZES = [16, 48, 128];
const BG = "#FF0000";
const FG = "#FFFFFF";
const RADIUS_RATIO = 0.2;

const out = join(__dirname, "..", "icons");
mkdirSync(out, { recursive: true });

for (const size of SIZES) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const r = Math.round(size * RADIUS_RATIO);

  // Rounded red background
  ctx.fillStyle = BG;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // White bold Y
  const fontSize = Math.round(size * 0.65);
  ctx.fillStyle = FG;
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Y", size / 2, size / 2 + size * 0.03);

  writeFileSync(join(out, `icon-${size}.png`), canvas.toBuffer("image/png"));
  console.log(`icon-${size}.png`);
}
