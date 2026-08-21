'use client';

import { useEffect, useRef } from "react";
import { Download } from "lucide-react";
import QRCode from "qrcode";

interface Props { slug: string }

const QR_SIZE = 156;
const BEE_RATIO = 0.22;
const BEE_PATH = "/favicon.svg";

/** Returns local (row, col) within a 7x7 finder block if the cell belongs to one; null otherwise. */
function getFinderLocal(
  row: number,
  col: number,
  size: number
): { lr: number; lc: number } | null {
  if (row < 7 && col < 7) return { lr: row, lc: col };
  if (row < 7 && col >= size - 7) return { lr: row, lc: col - (size - 7) };
  if (row >= size - 7 && col < 7) return { lr: row - (size - 7), lc: col };
  return null;
}

function drawModules(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  size: number,
  moduleSize: number
): void {
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const isDark = data[row * size + col] !== 0;
      const x = col * moduleSize;
      const y = row * moduleSize;
      const finder = getFinderLocal(row, col, size);
      if (finder !== null) {
        const { lr, lc } = finder;
        const inOuter = lr === 0 || lr === 6 || lc === 0 || lc === 6;
        const inInner3 = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
        if (inOuter) {
          ctx.fillStyle = (lr + lc) % 2 === 0 ? "#4C8E6B" : "#1A1A1A";
        } else if (inInner3) {
          ctx.fillStyle = "#4C8E6B";
        } else {
          ctx.fillStyle = "#FFFFFF";
        }
      } else {
        ctx.fillStyle = isDark ? "#111827" : "#FFFFFF";
      }
      ctx.fillRect(x, y, moduleSize, moduleSize);
    }
  }
}

function buildQRCanvas(url: string): Promise<HTMLCanvasElement> {
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const { size, data } = qr.modules;
  const moduleSize = Math.floor(QR_SIZE / size);
  const totalPx = moduleSize * size;

  const canvas = document.createElement("canvas");
  canvas.width = totalPx;
  canvas.height = totalPx;

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, totalPx, totalPx);
  drawModules(ctx, data, size, moduleSize);

  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const beeSize = Math.round(totalPx * BEE_RATIO);
      const beeXY = Math.round((totalPx - beeSize) / 2);
      ctx.drawImage(img, beeXY, beeXY, beeSize, beeSize);
      resolve(canvas);
    };
    img.onerror = () => resolve(canvas);
    img.src = BEE_PATH;
  });
}

export default function ShopQRSection({ slug }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const url = `${window.location.origin}/shop/${slug}`;
    const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
    const { size, data } = qr.modules;
    const moduleSize = Math.floor(QR_SIZE / size);
    const totalPx = moduleSize * size;

    canvas.width = totalPx;
    canvas.height = totalPx;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, totalPx, totalPx);
    drawModules(ctx, data, size, moduleSize);

    const img = new window.Image();
    img.onload = () => {
      const beeSize = Math.round(totalPx * BEE_RATIO);
      const beeXY = Math.round((totalPx - beeSize) / 2);
      ctx.drawImage(img, beeXY, beeXY, beeSize, beeSize);
    };
    img.onerror = () => {};
    img.src = BEE_PATH;
  }, [slug]);

  const handleDownload = async () => {
    const url = `${window.location.origin}/shop/${slug}`;
    const offCanvas = await buildQRCanvas(url);
    const dataUrl = offCanvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `shop-qr-${slug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mt-4">
      <h3 className="text-sm font-bold text-gray-900 mb-4">
        샵 QR코드 다운로드
      </h3>
      <div className="flex flex-col items-start gap-2">
        <div className="border border-gray-200 rounded-xl shadow-sm p-2 bg-white">
          <canvas ref={canvasRef} className="rounded" />
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-200"
        >
          <Download size={12} strokeWidth={1.5} />
          <span>QR코드 다운로드</span>
        </button>
      </div>
    </div>
  );
}
