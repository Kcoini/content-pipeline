// 도메인 타입 정의 (Phase 1: Supabase 연동 전 메모리 스토어 기준)
// db/schema.sql의 themes/sources/articles와 필드를 최대한 맞춘다.

export type Language = "ko" | "en";

export interface Theme {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  language: Language;
  createdAt: string;
  /** Phase 1-12: 생성 방식 구분 { creation_method: 'manual' | 'trend_cluster', theme_cluster_id? } */
  metadata?: Record<string, unknown>;
}

/** Phase 1-12: 트렌드 후보 (네이버/다음/mock 수집 결과) */
export interface TrendCandidate {
  id: string;
  platform: string;
  keyword: string | null;
  title: string | null;
  snippet: string | null;
  url: string | null;
  rankPosition: number | null;
  collectedAt: string;
  createdAt: string;
}

export type ThemeClusterStatus = "candidate" | "selected" | "dismissed";

/** Phase 1-12: 공통 테마 클러스터 (키워드 빈도 기반 자동 추출 결과) */
export interface ThemeCluster {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  naverCount: number;
  daumCount: number;
  score: number;
  status: ThemeClusterStatus;
  createdAt: string;
  updatedAt: string;
}

/** Phase 1-13: 기사 URL 후보 상태 */
export type ArticleUrlCandidateStatus = "candidate" | "selected" | "dismissed" | "imported";

/** Phase 1-13: 테마 키워드 검색으로 수집된 기사 URL 후보 */
export interface ArticleUrlCandidate {
  id: string;
  themeId: string | null;
  themeClusterId: string | null;
  platform: string;
  query: string | null;
  title: string | null;
  snippet: string | null;
  url: string;
  publisher: string | null;
  publishedAt: string | null;
  rankPosition: number | null;
  status: ArticleUrlCandidateStatus;
  metadata: Record<string, unknown>;
  collectedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type FetchStatus = "pending" | "success" | "failed";
export type SummaryStatus = "pending" | "success" | "failed" | "skipped";

export interface Source {
  id: string;
  themeId: string;
  url: string;
  title: string;
  /** 출판사/기관명 */
  publisher: string;
  /** 발행일 (YYYY-MM-DD, 입력하지 않으면 빈 문자열) */
  publishedAt: string;
  summary: string;
  createdAt: string;
  /** Phase 1-9: URL 본문 수집 상태 */
  fetchStatus: FetchStatus;
  fetchError: string | null;
  rawContent: string | null;
  /** Phase 1-10: AI 자동 요약 상태 */
  summaryStatus: SummaryStatus;
  summaryError: string | null;
  summarizedAt: string | null;
  keyPoints: string[];
}

export type ArticleStatus = "draft" | "reviewed" | "published";

export interface Article {
  id: string;
  themeId: string;
  title: string;
  content: string;
  status: ArticleStatus;
  /** 기사가 인용한 출처 id 목록 (최소 3개) */
  citedSourceIds: string[];
  createdAt: string;
  updatedAt: string;
  /** 승인(reviewed) 시각. draft 상태이면 null. */
  reviewedAt: string | null;
  /** 승인자. draft 상태이면 null. */
  reviewedBy: string | null;
}
