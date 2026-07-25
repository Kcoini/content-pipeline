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

/** Phase 2-1: 수익형 콘텐츠 글쓰기 모드 3종 */
export type ArticleMode = "general_news" | "source_based_explainer" | "monetized_blog";

export interface AdSlotEntry {
  position: string;
  marker: string;
}

export interface InternalLinkSuggestion {
  title: string;
  reason: string;
}

/** Phase 2-3: WordPress metadata 생성/검토 상태 */
export type WordPressMetadataStatus = "not_ready" | "generated" | "reviewed" | "failed";

/** Phase 2-4: 지원하는 WordPress SEO plugin */
export type SeoPluginProvider = "none" | "yoast" | "rank_math" | "aioseo";

/** Phase 2-4: SEO plugin metadata 생성/검토 상태 */
export type SeoPluginMetadataStatus = "not_ready" | "generated" | "reviewed" | "failed";

/** Phase 2-4: SEO plugin 실제 write 시도 상태 (safe stub — 현재는 success가 되지 않는다) */
export type SeoPluginWriteStatus =
  | "not_attempted"
  | "skipped_dry_run"
  | "skipped_provider_none"
  | "success"
  | "failed";

/** Phase 2-5: 대표 이미지(featured image) 준비/검토 상태. 'uploaded'는 실제 업로드 구현 후 사용한다. */
export type FeaturedImageStatus = "not_ready" | "prepared" | "reviewed" | "failed" | "uploaded";

/** Phase 2-6: featured image 원본 소스 종류 */
export type WordPressMediaSourceType = "none" | "generated_url" | "external_url" | "local_file" | "uploaded";

/** Phase 2-6: WordPress media upload 준비/시도 상태 (safe stub — 현재는 'uploaded'가 되지 않는다) */
export type WordPressMediaUploadStatus = "not_ready" | "prepared" | "dry_run" | "uploaded" | "failed" | "skipped";

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
  /** Phase 2-1: 글쓰기 모드 (기본값 source_based_explainer) */
  articleMode: ArticleMode;
  /** monetized_blog 전용: SEO 제목 (해당 없으면 null) */
  seoTitle: string | null;
  /** monetized_blog 전용: 메타 설명 */
  metaDescription: string | null;
  /** monetized_blog 전용: slug */
  slug: string | null;
  /** monetized_blog 전용: 타깃 키워드 */
  targetKeyword: string | null;
  /** monetized_blog 전용: 보조 키워드 목록 */
  secondaryKeywords: string[];
  /** monetized_blog 전용: 검색 의도 (정보성/거래성 등) */
  searchIntent: string | null;
  /** monetized_blog 전용: 독자 페르소나 */
  readerPersona: string | null;
  /** monetized_blog 전용: 본문에 삽입된 AD_SLOT marker 목록 (실제 광고 코드 아님) */
  adSlots: AdSlotEntry[];
  /** monetized_blog 전용: 내부 링크 추천 목록 */
  internalLinkSuggestions: InternalLinkSuggestion[];
  /** monetized_blog 전용: 수익화 적합도 점수 (0~100) */
  monetizationScore: number | null;
  /** monetized_blog 전용: AdSense 정책 위험도 점수 (0~100, 높을수록 위험) */
  policyRiskScore: number | null;
  /** 모드별 부가 메타데이터 (자유 형식). WordPress 전송용 정보는 formatMetadata.wordpress에 저장한다. */
  formatMetadata: Record<string, unknown>;
  /** Phase 2-3: WordPress 카테고리 이름 추천 목록 (실제 API 미연결 시 이름만 존재) */
  wpCategoryNames: string[];
  /** Phase 2-3: WordPress 태그 이름 추천 목록 */
  wpTagNames: string[];
  /** Phase 2-3: 실제 WordPress API 연결 후 동기화된 카테고리 ID (미연결 시 빈 배열) */
  wpCategoryIds: number[];
  /** Phase 2-3: 실제 WordPress API 연결 후 동기화된 태그 ID (미연결 시 빈 배열) */
  wpTagIds: number[];
  /** Phase 2-3: WordPress metadata 생성/검토 상태 */
  wpMetadataStatus: WordPressMetadataStatus;
  /** Phase 2-3: WordPress metadata가 마지막으로 생성된 시각 */
  wpMetadataGeneratedAt: string | null;
  /** Phase 2-4: 선택된 SEO plugin (기본값 none) */
  seoPluginProvider: SeoPluginProvider;
  /** Phase 2-4: plugin별 SEO metadata payload (mapping 결과) */
  seoPluginPayload: Record<string, unknown>;
  /** Phase 2-4: SEO plugin metadata 생성/검토 상태 */
  seoPluginMetadataStatus: SeoPluginMetadataStatus;
  /** Phase 2-4: SEO plugin metadata가 마지막으로 생성된 시각 */
  seoPluginMetadataGeneratedAt: string | null;
  /** Phase 2-4: 실제 SEO plugin write 시도 상태 (현재는 safe stub) */
  seoPluginWriteStatus: SeoPluginWriteStatus;
  /** Phase 2-4: SEO plugin write 실패 시 오류 메시지 */
  seoPluginWriteError: string | null;
  /** Phase 2-5: 대표 이미지 준비/검토 상태 (기본값 not_ready) */
  featuredImageStatus: FeaturedImageStatus;
  /** Phase 2-5: 이미지 생성 AI에 전달할 prompt (실제 이미지 생성은 하지 않음) */
  featuredImagePrompt: string | null;
  /** Phase 2-5: alt text (80~140자 권장, target keyword 자연스럽게 포함) */
  featuredImageAltText: string | null;
  /** Phase 2-5: caption (1문장, 글의 핵심 메시지와 연결) */
  featuredImageCaption: string | null;
  /** Phase 2-5: 이미지 스타일 (article_mode별 기본값) */
  featuredImageStyle: string | null;
  /** Phase 2-5: 이미지 비율 (기본값 16:9) */
  featuredImageAspectRatio: string;
  /** Phase 2-5: 모드/감정/시각 컨셉 등 부가 메타데이터 */
  featuredImageMetadata: Record<string, unknown>;
  /** Phase 2-5: 대표 이미지 정보가 마지막으로 생성된 시각 */
  featuredImageGeneratedAt: string | null;
  /** Phase 2-5: 대표 이미지 정보를 사람이 검토 완료한 시각 */
  featuredImageReviewedAt: string | null;
  /** Phase 2-5: 실제 업로드 후 WordPress media id (미구현 상태에서는 항상 null) */
  featuredImageWordpressMediaId: number | null;
  /** Phase 2-5: 실제 업로드 후 WordPress media URL (미구현 상태에서는 항상 null) */
  featuredImageWordpressUrl: string | null;
  /** Phase 2-5: 준비 실패 시 오류 메시지 */
  featuredImageError: string | null;
  /** Phase 2-6: featured image 원본 소스 종류 (기본값 none) */
  featuredImageSourceType: WordPressMediaSourceType;
  /** Phase 2-6: 원본 이미지 URL (generated_url/external_url일 때) */
  featuredImageSourceUrl: string | null;
  /** Phase 2-6: 로컬 파일 경로 (local_file일 때, 실제 파일 처리는 아직 구현 안 함) */
  featuredImageLocalPath: string | null;
  /** Phase 2-6: WordPress에 업로드할 파일명 (slug 기반 생성) */
  featuredImageFilename: string | null;
  /** Phase 2-6: MIME 타입 (기본값 image/webp) */
  featuredImageMimeType: string | null;
  /** Phase 2-6: WordPress media upload 준비/시도 상태 */
  featuredImageUploadStatus: WordPressMediaUploadStatus;
  /** Phase 2-6: WordPress media upload payload (준비된 요청 내용, 실제 전송 아님) */
  featuredImageUploadPayload: Record<string, unknown>;
  /** Phase 2-6: 업로드 준비/시도 실패 시 오류 메시지 */
  featuredImageUploadError: string | null;
  /** Phase 2-6: 업로드가 마지막으로 시도(준비/dry-run)된 시각 */
  featuredImageUploadAttemptedAt: string | null;
}
