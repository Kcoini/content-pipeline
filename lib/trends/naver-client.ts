// Phase 1-13: 네이버 뉴스 검색 API 클라이언트.
// API 호출은 서버 측에서만 수행한다. 키는 절대 클라이언트에 노출하지 않는다.

import type { TrendSearchResult } from "./types";

const NAVER_NEWS_URL = "https://openapi.naver.com/v1/search/news.json";

interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

interface NaverSearchResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverNewsItem[];
}

/** 네이버 응답에 포함된 HTML 태그와 엔티티를 제거한다. */
export function stripNaverHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

/**
 * 네이버 뉴스 검색 API를 호출해 결과를 반환한다.
 * NAVER_CLIENT_ID / NAVER_CLIENT_SECRET이 설정되지 않으면 오류를 던진다.
 */
export async function searchNaverNews(
  query: string,
  display = 10
): Promise<TrendSearchResult[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.");
  }

  const url = new URL(NAVER_NEWS_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(Math.min(display, 100)));
  url.searchParams.set("sort", "date");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`네이버 API 네트워크 오류: ${msg}`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(`네이버 API 인증 실패 (HTTP ${response.status}). API key를 확인하세요.`);
  }
  if (response.status === 429) {
    throw new Error("네이버 API 요청 한도 초과 (rate limit). 잠시 후 다시 시도하세요.");
  }
  if (!response.ok) {
    throw new Error(`네이버 API 오류 (HTTP ${response.status})`);
  }

  const data: NaverSearchResponse = await response.json() as NaverSearchResponse;

  return (data.items ?? []).map((item, index) => ({
    platform: "naver" as const,
    keyword: query,
    title: stripNaverHtml(item.title),
    snippet: stripNaverHtml(item.description),
    url: item.originallink || item.link,
    rankPosition: index + 1,
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
  }));
}
