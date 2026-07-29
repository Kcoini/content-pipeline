// 로컬 컴퓨터에서 업로드한 대표 이미지 파일을 Supabase Storage에 저장하는
// helper. image binary는 DB/로그에 저장하지 않으며(공개 URL 문자열만
// 저장), 이 파일이 실제 업로드를 전담한다 (server action에서만 호출).
//
// Vercel 등 서버리스 환경은 파일시스템에 영속적으로 쓸 수 없으므로(요청마다
// 다른 인스턴스에서 실행될 수 있음), 로컬 디스크 대신 Supabase Storage를
// 사용한다 — 이렇게 저장한 공개 URL은 이후 WordPress media upload 단계에서
// 기존 external_url 처리 경로(HTTP로 이미지를 내려받아 업로드)를 그대로
// 재사용할 수 있다.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAllowedMimeType, getMaxUploadSizeMb, ALLOWED_MIME_TYPES } from "@/lib/publish/wordpress-media-config";

const FEATURED_IMAGE_BUCKET = "featured-images";

export interface SaveLocalUploadFileResult {
  success: boolean;
  /** Supabase Storage의 공개 URL (WordPress media upload가 external_url처럼 사용한다). */
  url?: string;
  filename?: string;
  mimeType?: string;
  error?: string;
}

function sanitizeFilename(original: string): string {
  const base = original.replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 0 ? base : "featured-image";
}

async function ensureBucketExists(
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<void> {
  const { error } = await supabase.storage.createBucket(FEATURED_IMAGE_BUCKET, { public: true });
  if (error && !/already exists/i.test(error.message)) {
    throw error;
  }
}

/**
 * 업로드된 파일(Web File 객체)을 검증(MIME type/크기)한 뒤 Supabase
 * Storage에 저장하고 공개 URL을 반환한다. image binary는 반환값에
 * 포함하지 않는다(URL 문자열만 반환).
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
  const objectPath = `${articleId}/${Date.now()}-${safeOriginalName}`;

  try {
    const supabase = createServerSupabaseClient();
    await ensureBucketExists(supabase);

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(FEATURED_IMAGE_BUCKET)
      .upload(objectPath, buffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      return { success: false, error: `파일 저장에 실패했습니다: ${uploadError.message}` };
    }

    const { data } = supabase.storage.from(FEATURED_IMAGE_BUCKET).getPublicUrl(objectPath);

    return { success: true, url: data.publicUrl, filename: safeOriginalName, mimeType };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `파일 저장에 실패했습니다: ${message}` };
  }
}
