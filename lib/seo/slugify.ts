// Phase 2-3: WordPress 게시용 slug 생성 유틸.
// 영어/한글 제목을 URL-friendly slug로 변환한다. 한글을 완전히 제거하면
// 한글 제목의 slug가 비어버리는 경우가 많아, 기본값은 한글 음절을 유지한다
// (WordPress/브라우저 모두 UTF-8 slug를 percent-encoding으로 안전하게 처리한다).
// 영문 keyword가 있으면 그쪽을 우선 소스로 사용해 영문 slug를 만드는 편이 SEO에
// 유리하므로, 소스 선택은 호출부(lib/publish/wordpress-metadata-service.ts)에서
// target_keyword > title > theme.keywords 순으로 결정한다.

export interface SlugifyOptions {
  /** 최종 slug 최대 길이 (기본 60자) */
  maxLength?: number;
  /** 결과가 비어있을 때 사용할 fallback 문자열 (기본 "article") */
  fallback?: string;
  /** 한글 음절을 slug에 허용할지 여부 (기본 true) */
  allowKorean?: boolean;
}

const DEFAULT_MAX_LENGTH = 60;
const DEFAULT_FALLBACK = "article";

function slugifyFallback(fallback: string, maxLength: number): string {
  const cleaned = fallback
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return (cleaned || DEFAULT_FALLBACK).slice(0, maxLength) || DEFAULT_FALLBACK;
}

/**
 * 문자열을 URL-friendly slug로 변환한다.
 * - 공백은 hyphen(-)으로 변환한다.
 * - 허용되지 않는 특수문자는 제거한다.
 * - maxLength(기본 60자)를 넘으면 자르고, 끝에 남은 hyphen은 제거한다.
 * - 결과가 비어있으면 fallback(기본 "article")을 slug 규칙에 맞게 변환해 반환한다.
 */
export function slugify(input: string, options: SlugifyOptions = {}): string {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const allowKorean = options.allowKorean ?? true;
  const fallback = options.fallback ?? DEFAULT_FALLBACK;

  const allowedCharsPattern = allowKorean ? /[^a-z0-9가-힣\s-]/g : /[^a-z0-9\s-]/g;

  let working = input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['"’‘“”]/g, "")
    .replace(allowedCharsPattern, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (working.length > maxLength) {
    working = working.slice(0, maxLength).replace(/-+$/, "");
  }

  return working || slugifyFallback(fallback, maxLength);
}

/** article id 기반의 안전한 fallback slug를 만든다 (예: article-a1b2c3d4). */
export function articleIdSlugFallback(articleId: string): string {
  const shortId = articleId.replace(/-/g, "").slice(0, 8).toLowerCase();
  return `article-${shortId || "draft"}`;
}
