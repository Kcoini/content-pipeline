// Phase 3-17: Navigation Return Flow & Deep Links.
// returnTo query parameter를 안전하게 검증/생성/부착하기 위한 순수 helper.
// 이 파일의 어떤 함수도 실제로 redirect를 수행하지 않는다 — 문자열만
// 계산하며, 최종 redirect() 호출은 항상 server action/page 쪽 책임이다.
//
// 허용하는 내부 경로는 article 하위 5개 페이지(overview/blog/social/
// rewrite/performance)뿐이다. 그 외 모든 값(외부 URL, protocol-relative
// URL, javascript:/data: 스킴 등)은 안전하지 않다고 간주하고 fallback을
// 반환한다 — 이 프로젝트가 임의의 open redirect를 허용하지 않기 위함이다.

/** returnTo로 허용하는 내부 경로 패턴: /articles/[id](/blog|/social|/rewrite|/performance|/ab-tests)?(?query)(#hash) */
const SAFE_RETURN_TO_PATTERN = /^\/articles\/[^\/?#]+(\/(blog|social|rewrite|performance|ab-tests))?(\?[^\s]*)?(#[^\s]*)?$/;

/** 위험한 스킴/패턴이 값 어디에도 섞여 있지 않은지 확인한다 (인코딩 우회 방지를 위해 소문자로 비교). */
function containsUnsafeScheme(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes("javascript:") ||
    lower.includes("data:") ||
    lower.includes("http:") ||
    lower.includes("https:") ||
    lower.includes("\\")
  );
}

/**
 * value가 이 프로젝트의 article 하위 페이지를 가리키는 안전한 내부 경로인지 확인한다.
 * - 반드시 `/`로 시작해야 하고 `//`(protocol-relative)로 시작하면 안 된다.
 * - http(s):, javascript:, data: 스킴을 포함하면 안 된다.
 * - `/articles/[id]`, `/articles/[id]/blog`, `/articles/[id]/social`,
 *   `/articles/[id]/rewrite`, `/articles/[id]/performance` 형태만 허용한다
 *   (query/hash는 포함 가능).
 */
export function isSafeInternalReturnTo(value: string | null | undefined): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return false;
  if (containsUnsafeScheme(trimmed)) return false;
  return SAFE_RETURN_TO_PATTERN.test(trimmed);
}

/** value가 안전한 내부 경로이면 그대로, 아니면 fallback을 반환한다. */
export function getSafeReturnTo(value: string | null | undefined, fallback: string): string {
  if (isSafeInternalReturnTo(value)) return value.trim();
  return fallback;
}

/**
 * 현재 pathname과 searchParams로 "현재 페이지"를 가리키는 returnTo 문자열을 만든다.
 * page.tsx가 자신의 searchParams를 그대로 넘기면 하이라이트/필터 등 현재 상태를
 * 보존한 채로 나중에 이 페이지로 돌아올 수 있다.
 */
export function buildReturnTo(
  pathname: string,
  searchParams?: URLSearchParams | Record<string, string | string[] | undefined> | null
): string {
  if (!searchParams) return pathname;

  const params =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(
          Object.entries(searchParams).flatMap(([key, value]) => {
            if (value === undefined) return [];
            if (Array.isArray(value)) return value.map((item) => [key, item] as [string, string]);
            return [[key, value] as [string, string]];
          })
        );

  const query = params.toString();
  return query.length > 0 ? `${pathname}?${query}` : pathname;
}

/** url에 returnTo query parameter를 안전하게 덧붙인다. returnTo가 안전하지 않으면 url을 그대로 반환한다. */
export function appendReturnTo(url: string, returnTo: string | null | undefined): string {
  if (!isSafeInternalReturnTo(returnTo)) return url;
  try {
    const parsed = new URL(url, "http://internal.invalid");
    parsed.searchParams.set("returnTo", returnTo.trim());
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}
