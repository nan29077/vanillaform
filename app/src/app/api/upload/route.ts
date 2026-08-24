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

// ─────────────────────────────────────────────────────────────
// 업로드 정책
//
//  1) 확장자는 **매직바이트로만** 결정한다. 파일명/MIME 은 클라이언트가 마음대로
//     보낼 수 있으므로 신뢰하지 않는다. 판별에 실패하면 업로드를 거부한다.
//     (예전엔 판별 실패 시 파일명 확장자를 그대로 썼기 때문에 .html/.svg/.js 같은
//      실행 가능한 확장자로 저장돼 저장형 XSS 로 이어질 수 있었다)
//  2) SVG 는 임의의 <script> 를 품을 수 있어 원천 차단한다.
//  3) 파일 크기 상한 — 이미지 10MB, 그 외(PDF·동영상 등) 5MB.
// ─────────────────────────────────────────────────────────────

/** 이미지 파일 크기 상한 (10MB) */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** 이미지 외(PDF·동영상 등) 크기 상한 (5MB) */
const MAX_OTHER_BYTES = 5 * 1024 * 1024;

/** 저장을 허용하는 확장자 화이트리스트 — 이미지 */
const ALLOWED_IMAGE_EXTS = new Set([
  "jpg",
  "png",
  "gif",
  "webp",
  "bmp",
  "tiff",
  "avif",
  "heic",
  "ico",
  "psd",
]);

/** 저장을 허용하는 확장자 화이트리스트 — 그 외 */
const ALLOWED_OTHER_EXTS = new Set(["pdf", "mp4", "mov", "webm"]);

function isImageExt(ext: string): boolean {
  return ALLOWED_IMAGE_EXTS.has(ext);
}

function isAllowedExt(ext: string): boolean {
  return ALLOWED_IMAGE_EXTS.has(ext) || ALLOWED_OTHER_EXTS.has(ext);
}

function formatMB(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;
}

/**
 * 파일 헤더(매직바이트)로 실제 형식을 판별한다.
 * 판별 불가 → null (호출부에서 업로드 거부)
 * SVG 는 판별은 하되 "svg" 로 돌려주고, 호출부가 명시적으로 거부한다.
 */
function detectFileFromBytes(buffer: Buffer): string | null {
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
  // ISO BMFF 계열 — ICO/BMP 시그니처보다 **먼저** 판별해야 한다.
  // (박스 크기가 0x00000100 인 mp4 는 앞 4바이트가 ICO 시그니처 00 00 01 00 과 같다)
  // ISO BMFF — offset 4 에 "ftyp" 박스. major brand 로 이미지/동영상을 가른다.
  if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    const brand = buffer.slice(8, 12).toString("ascii").trim().toLowerCase();
    if (brand === "avif" || brand === "avis") return "avif";
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heim", "heis"].includes(brand)) return "heic";
    if (brand === "qt") return "mov";
    if (["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "mmp4", "avc1", "dash", "m4v", "m4a", "3gp4", "3gp5", "3g2a"].includes(brand)) {
      return "mp4";
    }
    // 알 수 없는 브랜드는 거부 (판별 실패로 취급)
    return null;
  }
  // BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) return "bmp";
  // ICO: 00 00 01 00  (파비콘 업로드용)
  if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) return "ico";
  // PSD: 38 42 50 53 ("8BPS")
  if (buffer[0] === 0x38 && buffer[1] === 0x42 && buffer[2] === 0x50 && buffer[3] === 0x53) return "psd";
  // TIFF (및 TIFF 기반 RAW: CR2/NEF/ARW/DNG): 49 49 2A 00 or 4D 4D 00 2A
  if ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) ||
      (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A)) return "tiff";
  // Matroska/WebM: 1A 45 DF A3
  if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) return "webm";
  // PDF: 25 50 44 46
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return "pdf";
  // SVG (XML) — 허용하지 않지만, "알 수 없음"이 아니라 "SVG 라서 거부"라고 안내하기 위해 판별한다.
  if (buffer[0] === 0x3C || (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF)) {
    const head = buffer.slice(0, Math.min(512, buffer.length)).toString("utf8").toLowerCase();
    if (head.includes("<svg")) return "svg";
  }

  return null;
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

/** 확장자 → 저장 시 사용할 Content-Type */
const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  tiff: "image/tiff",
  avif: "image/avif",
  heic: "image/heic",
  ico: "image/x-icon",
  psd: "image/vnd.adobe.photoshop",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

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
        // 본문을 읽기 전에 선언된 크기로 1차 차단 (가장 큰 상한 기준).
        if (file.size > MAX_IMAGE_BYTES) {
          errors.push(`${file.name}: 파일이 너무 큽니다 (최대 ${formatMB(MAX_IMAGE_BYTES)})`);
          continue;
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const actualSize = buffer.length;

        if (actualSize === 0) {
          errors.push(`${file.name}: 빈 파일`);
          continue;
        }

        // 형식 판별 — 매직바이트만 신뢰한다.
        const ext = detectFileFromBytes(buffer);

        if (ext === "svg") {
          errors.push(`${file.name}: SVG 파일은 업로드할 수 없습니다.`);
          continue;
        }
        if (!ext) {
          errors.push(`${file.name}: 지원하지 않거나 손상된 파일 형식입니다.`);
          continue;
        }
        if (!isAllowedExt(ext)) {
          errors.push(`${file.name}: 허용되지 않는 파일 형식입니다. (${ext})`);
          continue;
        }

        // 형식별 크기 상한 재검사 (이미지 10MB / 그 외 5MB)
        const limit = isImageExt(ext) ? MAX_IMAGE_BYTES : MAX_OTHER_BYTES;
        if (actualSize > limit) {
          errors.push(`${file.name}: 파일이 너무 큽니다 (최대 ${formatMB(limit)})`);
          continue;
        }

        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const contentType = MIME_MAP[ext] || "application/octet-stream";

        if (useS3) {
          // ✅ S3 업로드 (영구 저장 — 배포 재시작 시 소실 없음)
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
        { error: errors[0] || "이미지를 저장할 수 없습니다. 다시 시도해 주세요.", errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ urls, errors: errors.length > 0 ? errors : undefined });
  } catch (error: any) {
    console.error("[Upload] Unexpected error:", error?.message || error);
    return NextResponse.json({ error: "업로드 실패. 다시 시도해 주세요." }, { status: 500 });
  }
}
