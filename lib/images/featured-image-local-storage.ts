// Phase 2-19: 로컬 컴퓨터에서 업로드한 대표 이미지 파일을 서버 디스크에
// 저장하는 helper. image binary는 DB/로그에 저장하지 않으며, 이 파일이
// 실제 디스크 write를 전담한다 (server action에서만 호출).
//
// 주의: 이 구현은 로컬/단일 서버 배포를 전제로 한다. Vercel 등 서버리스
// 환경에서는 파일시스템이 영속적이지 않으므로, 운영 환경에서는 Supabase
// Storage 등으로 교체하는 것을 권장한다 (docs/phase-2-19-*.md 참고).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isAllowedMimeType, getMaxUploadSizeMb, ALLOWED_MIME_TYPES } from "@/lib/publish/wordpress-media-config";

const UPLOAD_DIR = path.join(process.cwd(), ".uploads", "featured-images");

export interface SaveLocalUploadFileResult {
  success: boolean;
  localPath?: string;
  filename?: string;
  mimeType?: string;
  error?: string;
}

function sanitizeFilename(original: string): string {
  const base = original.replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 0 ? base : "featured-image";
}

/**
 * 업로드된 파일(Web File 객체)을 검증(MIME type/크기)한 뒤 서버 디스크에
 * 저장한다. image binary는 반환값에 포함하지 않는다(경로 문자열만 반환).
 */
export async function saveLocalUploadFile(articleId: string, file: File): Promise<SaveLocalUploadFileResult> {
  const mimeType = file.type;

  if (!isAllowedMimeType(mimeType)) {
    return {
      success: false,
      error: `허용되지 않는 이미지 형식입니다 (허용: ${ALLOWED_MIME_TYPES.join(", ")}). 업로드된 형식: ${mimeType || "알 수 없음"}`,
    };
  }

  const maxSizeBytes = getMaxUploadSizeMb() * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      success: false,
      error: `파일 크기가 너무 큽니다 (최대 ${getMaxUploadSizeMb()}MB, 업로드된 크기: ${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  const safeOriginalName = sanitizeFilename(file.name || "featured-image");
  const filename = `${articleId}-${Date.now()}-${safeOriginalName}`;
  const localPath = path.join(UPLOAD_DIR, filename);

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(localPath, buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `파일 저장에 실패했습니다: ${message}` };
  }

  return { success: true, localPath, filename: safeOriginalName, mimeType };
}
