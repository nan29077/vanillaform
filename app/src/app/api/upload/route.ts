import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// CRITICAL: Increase body size limit for file uploads
// Next.js 14 App Router default is ~4MB, we need 25MB for large images
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Explicitly increase body parser size for this API route
export const maxDuration = 60; // seconds

// Detect image type from file header (magic bytes)
function detectImageFromBytes(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return "jpg";
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return "png";
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return "gif";
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return "webp";
  // BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) return "bmp";
  // TIFF: 49 49 2A 00 or 4D 4D 00 2A
  if ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) ||
      (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A)) return "tiff";
  // HEIF/HEIC/AVIF: ftyp box at offset 4
  if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    const brand = buffer.slice(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') return "avif";
    return "heic";
  }
  // SVG: starts with < (XML-like)
  if (buffer[0] === 0x3C) {
    const head = buffer.slice(0, Math.min(256, buffer.length)).toString('utf8').toLowerCase();
    if (head.includes('<svg')) return "svg";
  }
  // PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return "pdf";
  
  return null;
}

// Fallback: guess extension from file name or MIME type
function guessExtension(fileName: string, mimeType: string): string {
  const nameExt = (fileName || "").split(".").pop()?.toLowerCase() || "";
  const allExts = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico", "tiff", "tif", "avif", "heic", "heif", "raw", "cr2", "nef", "arw", "dng", "raf", "orf", "rw2", "pef", "sr2", "jfif", "psd", "ai", "eps", "pdf"]);
  if (allExts.has(nameExt)) return nameExt === "jpeg" ? "jpg" : nameExt;
  // Accept any extension from filename
  if (nameExt && nameExt.length <= 10) return nameExt;
  if (mimeType) {
    const mimeExt = mimeType.split("/").pop()?.toLowerCase() || "";
    if (mimeExt === "jpeg") return "jpg";
    if (mimeExt && mimeExt.length <= 10) return mimeExt;
  }
  return "jpg"; // safe default
}

// S3 설정 (환경변수가 있을 때만 활성화)
const S3_BUCKET = process.env.AWS_S3_BUCKET;
const S3_REGION = process.env.AWS_S3_REGION || "ap-northeast-2";
const S3_PREFIX = process.env.AWS_S3_PREFIX || "uploads";
const S3_PUBLIC_URL = process.env.AWS_S3_PUBLIC_URL; // 예: https://d1234.cloudfront.net 또는 https://bucket.s3.region.amazonaws.com

const s3Client = S3_BUCKET
  ? new S3Client({
      region: S3_REGION,
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          }
        : undefined, // EC2 인스턴스 역할(IAM Role)로도 자동 인증됨
    })
  : null;

async function uploadToS3(buffer: Buffer, uniqueName: string, mimeType: string): Promise<string> {
  const key = `${S3_PREFIX}/${uniqueName}`;
  await s3Client!.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: mimeType || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  // 커스텀 퍼블릭 URL (CloudFront 등) > S3 기본 URL
  if (S3_PUBLIC_URL) return `${S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    }

    let files: File[] = [];

    // Try to parse FormData with multiple strategies
    try {
      const formData = await req.formData();

      // Try "files" first, then "file" as fallback key
      files = formData.getAll("files") as File[];
      if (files.length === 0) {
        files = formData.getAll("file") as File[];
      }
      // Also try to collect any File entries in formData
      if (files.length === 0) {
        for (const [key, value] of formData.entries()) {
          if (value instanceof File && value.size > 0) {
            files.push(value);
          }
        }
      }
    } catch (parseError: any) {
      console.error("[Upload] FormData parsing FAILED:", parseError?.message || parseError);
      console.error("[Upload] This is likely a body size limit issue or malformed request");
      
      return NextResponse.json({ 
        error: "파일 전송 오류가 발생했습니다. 파일 크기를 줄이거나 한 장씩 업로드해 주세요.",
        debug: parseError?.message 
      }, { status: 400 });
    }

    // Filter out any invalid File objects (size 0 or non-File)
    files = files.filter(f => f instanceof File && f.size > 0);

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "파일이 없습니다. 사진을 선택해 주세요." }, { status: 400 });
    }

    // S3 미설정 시 로컬 파일시스템 fallback (개발 환경용)
    const useS3 = !!s3Client;
    let uploadDir = "";
    if (!useS3) {
      uploadDir = join(process.cwd(), "public", "uploads");
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }
    }

    const urls: string[] = [];
    const errors: string[] = [];
    const processedNames = new Set<string>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Skip duplicate files
      const fileKey = `${file.name}-${file.size}`;
      if (processedNames.has(fileKey)) continue;
      processedNames.add(fileKey);

      try {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const actualSize = buffer.length;

        if (actualSize === 0) {
          errors.push(`${file.name}: 빈 파일`);
          continue;
        }

        // Detect image type from magic bytes (primary method)
        let ext = detectImageFromBytes(buffer);
        if (!ext) ext = guessExtension(file.name, file.type);

        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

        if (useS3) {
          // ✅ S3 업로드 (영구 저장 — 배포 재시작 시 소실 없음)
          const mimeMap: Record<string, string> = {
            jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
            gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
            avif: "image/avif", heic: "image/heic",
          };
          const contentType = mimeMap[ext] || file.type || "application/octet-stream";
          const url = await uploadToS3(buffer, uniqueName, contentType);
          urls.push(url);
        } else {
          // fallback: 로컬 파일시스템 (개발 전용)
          const filePath = join(uploadDir, uniqueName);
          await writeFile(filePath, buffer);
          urls.push(`/uploads/${uniqueName}`);
        }
      } catch (fileErr: any) {
        console.error(`[Upload] Error processing ${file.name}:`, fileErr?.message || fileErr);
        errors.push(`${file.name}: 처리 실패`);
      }
    }

    if (urls.length === 0) {
      return NextResponse.json(
        { error: "이미지를 저장할 수 없습니다. 다시 시도해 주세요.", errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ urls, errors: errors.length > 0 ? errors : undefined });
  } catch (error: any) {
    console.error("[Upload] Unexpected error:", error?.message || error);
    return NextResponse.json({ error: "업로드 실패. 다시 시도해 주세요." }, { status: 500 });
  }
}
