// Phase 1-13: 트렌드 API 공통 타입

/** 네이버/다음 API에서 수집된 기사 검색 결과 */
export interface TrendSearchResult {
  platform: "naver" | "daum";
  keyword: string;
  title: string;
  snippet: string;
  url: string;
  rankPosition: number;
  publishedAt: string | null;
}

/** API 클라이언트 검색 옵션 */
export interface TrendSearchOptions {
  query: string;
  limit?: number;
  sort?: "sim" | "date" | "accuracy" | "recency";
}
