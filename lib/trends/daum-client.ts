// Phase 1-13: 카카오 Daum 웹 검색 API 클라이언트.
// API 호출은 서버 측에서만 수행한다. 키는 절대 클라이언트에 노출하지 않는다.
// /v2/search/web 엔드포인트를 사용한다 (/search/news는 앱 별도 설정 필요).

import type { TrendSearchResult } from "./types";

const DAUM_WEB_URL = "https://dapi.kakao.com/v2/search/web";

interface DaumDocument {
  title: string;
  contents: string;
  url: string;
  datetime: string;
}

/** Daum 검색 결과 title/contents에 포함된 HTML 태그와 엔티티를 제거한다. */
export function stripDaumHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

interface DaumSearchResponse {
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
  documents: DaumDocument[];
}

/**
 * 카카오 Daum 뉴스 검색 API를 호출해 결과를 반환한다.
 * KAKAO_REST_API_KEY가 설정되지 않으면 오류를 던진다.
 */
export async function searchDaumNews(
  query: string,
  size = 10
): Promise<TrendSearchResult[]> {
  const apiKey = process.env.KAKAO_REST_API_KEY;

  if (!apiKey) {
    throw new Error("KAKAO_REST_API_KEY가 설정되지 않았습니다.");
  }

  const url = new URL(DAUM_WEB_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("size", String(Math.min(size, 50)));
  url.searchParams.set("sort", "recency");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`카카오 API 네트워크 오류: ${msg}`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(`카카오 API 인증 실패 (HTTP ${response.status}). KAKAO_REST_API_KEY를 확인하세요.`);
  }
  if (response.status === 429) {
    throw new Error("카카오 API 요청 한도 초과 (rate limit). 잠시 후 다시 시도하세요.");
  }
  if (!response.ok) {
    let bodyExcerpt = "";
    try {
      const text = await response.text();
      bodyExcerpt = text.substring(0, 200);
    } catch { /* body 읽기 실패는 무시 */ }
    throw new Error(
      `카카오 API 오류 (HTTP ${response.status} ${response.statusText}, query: ${query}): ${bodyExcerpt}`
    );
  }

  const data: DaumSearchResponse = await response.json() as DaumSearchResponse;

  return (data.documents ?? []).map((doc, index) => ({
    platform: "daum" as const,
    keyword: query,
    title: stripDaumHtml(doc.title),
    snippet: stripDaumHtml(doc.contents),
    url: doc.url,
    rankPosition: index + 1,
    publishedAt: doc.datetime || null,
  }));
}
