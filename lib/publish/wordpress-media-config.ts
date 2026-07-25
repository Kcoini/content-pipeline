// Phase 2-6: WordPress Media Upload 설정 유틸.
// WORDPRESS_MEDIA_UPLOAD_ENABLED 환경 변수를 읽는다. 기본값은 항상 false다
// (실제 이미지 생성/업로드가 구현되기 전까지는 절대 true가 기본이 되어서는 안 된다).

import { slugify, articleIdSlugFallback } from "@/lib/seo/slugify";

/** WORDPRESS_MEDIA_UPLOAD_ENABLED=true일 때만 실제 media upload를 시도한다 (기본값 false). */
export function isWordPressMediaUploadEnabled(): boolean {
  return process.env.WORDPRESS_MEDIA_UPLOAD_ENABLED === "true";
}

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function getAllowedMimeTypes(): readonly string[] {
  return ALLOWED_MIME_TYPES;
}

const DEFAULT_MAX_UPLOAD_SIZE_MB = 5;

/** 업로드 허용 최대 용량(MB). WORDPRESS_MEDIA_MAX_SIZE_MB로 재정의할 수 있다 (기본 5MB). */
export function getMaxUploadSizeMb(): number {
  const raw = process.env.WORDPRESS_MEDIA_MAX_SIZE_MB;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_SIZE_MB;
}

const ALLOWED_EXTENSIONS = ["webp", "jpg", "jpeg", "png"] as const;
const DEFAULT_EXTENSION = "webp";
const FILENAME_SUFFIX = "-featured";
const FILENAME_MAX_LENGTH = 80;

/**
 * article의 slug 기반으로 안전한 featured image 파일명을 생성한다.
 * 예: slug="long-term-care-guide" → "long-term-care-guide-featured.webp"
 * slug가 없으면 article id 기반 fallback을 사용한다 (예: "article-a1b2c3d4-featured.webp").
 * 파일명은 한글을 포함하지 않는 ASCII 안전 문자열로 만든다 (서버/파일시스템 인코딩 문제 방지).
 */
export function getDefaultImageFilename(
  article: { slug: string | null; id: string },
  extension: string = DEFAULT_EXTENSION
): string {
  const ext = (ALLOWED_EXTENSIONS as readonly string[]).includes(extension) ? extension : DEFAULT_EXTENSION;
  const suffixWithExt = `${FILENAME_SUFFIX}.${ext}`;
  const maxBaseLength = Math.max(1, FILENAME_MAX_LENGTH - suffixWithExt.length);

  const source = article.slug || articleIdSlugFallback(article.id);
  const base = slugify(source, {
    allowKorean: false,
    maxLength: maxBaseLength,
    fallback: articleIdSlugFallback(article.id),
  });

  return `${base}${suffixWithExt}`;
}
