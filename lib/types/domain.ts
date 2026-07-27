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
export type WordPressMediaSourceType =
  | "none"
  | "generated_url"
  | "external_url"
  | "local_file"
  | "uploaded"
  // Phase 2-19: 수동 대표 이미지 source 설정
  | "local_upload"
  | "wordpress_media_existing";

/** Featured Image Workflow: source 설정 자체의 상태 (WordPress 업로드 전 단계). */
export type FeaturedImageSourceStatus = "none" | "prepared" | "invalid" | "failed";

/** Phase 2-6: WordPress media upload 준비/시도 상태 (safe stub — 현재는 'uploaded'가 되지 않는다) */
export type WordPressMediaUploadStatus = "not_ready" | "prepared" | "dry_run" | "uploaded" | "failed" | "skipped";

/** Phase 2-11: WordPress draft post에 featured_media(대표 이미지)를 연결한 시도 상태 */
export type WordPressFeaturedMediaAttachStatus = "not_attached" | "attached" | "skipped_no_media_id" | "failed";

/** Phase 2-12: SEO plugin(Yoast/Rank Math/AIOSEO) 실제 post metadata write 시도 상태 */
export type SeoPluginActualWriteStatus =
  | "not_attempted"
  | "skipped_disabled"
  | "skipped_provider_none"
  | "skipped_no_wordpress_post"
  | "skipped_missing_target_keyword"
  | "success"
  | "failed"
  | "needs_custom_endpoint";

/** Phase 2-13: WordPress custom SEO endpoint(Rank Math 전용) write 시도 상태 */
export type SeoPluginCustomEndpointStatus =
  | "not_attempted"
  | "skipped_disabled"
  | "skipped_provider_not_supported"
  | "skipped_no_wordpress_post"
  | "skipped_missing_target_keyword"
  | "success"
  | "failed";

/** Phase 2-14: WordPress final draft payload review 상태 */
export type WordPressFinalDraftReviewStatus = "not_reviewed" | "reviewed" | "missing_wordpress_draft" | "failed";

/** Phase 2-15: Publish Quality Gate 상태 */
export type PublishQualityGateStatus = "not_checked" | "ready_to_publish" | "needs_revision" | "blocked" | "failed";

/** Phase 2-16: Human Approval Before Public Publish 상태 */
export type PublicPublishApprovalStatus = "not_requested" | "approved" | "revoked" | "blocked" | "failed";

/** Phase 2-17: WordPress Public Publish Test 상태 */
export type PublicPublishStatus = "not_published" | "published" | "blocked" | "failed" | "skipped_already_published";

/** Phase 2-7: 이미지 생성 provider */
export type ImageGenerationProvider = "mock" | "openai" | "custom";

/** Phase 2-7: 이미지 생성 상태 */
export type GeneratedImageStatus = "not_generated" | "queued" | "generating" | "generated" | "reviewed" | "failed";

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
  /** Featured Image Workflow: source 설정 자체의 상태 (none/prepared/invalid/failed) */
  featuredImageSourceStatus: FeaturedImageSourceStatus;
  /** Featured Image Workflow: source 설정 검증/저장 실패 시 안전한 오류 메시지 */
  featuredImageSourceError: string | null;
  /** Featured Image Workflow: 사용자가 직접 source를 저장한 시각 */
  featuredImageManualSourceSavedAt: string | null;
  /** Phase 2-7: 이미지 생성 상태 (기본값 not_generated) */
  generatedImageStatus: GeneratedImageStatus;
  /** Phase 2-7: 이미지를 생성한 provider (기본값 mock) */
  generatedImageProvider: ImageGenerationProvider;
  /** Phase 2-7: 실제 provider 호출 시 사용한 모델명 */
  generatedImageModel: string | null;
  /** Phase 2-7: 이미지 생성에 실제로 사용된 prompt */
  generatedImagePrompt: string | null;
  /** Phase 2-7: negative prompt (텍스트/워터마크/로고 등 피해야 할 요소) */
  generatedImageNegativePrompt: string | null;
  /** Phase 2-7: 생성된 이미지 URL (mock 또는 실제 provider 결과) */
  generatedImageUrl: string | null;
  /** Phase 2-7: 생성된 이미지의 로컬 파일 경로 (있는 경우) */
  generatedImageLocalPath: string | null;
  generatedImageWidth: number | null;
  generatedImageHeight: number | null;
  generatedImageFormat: string | null;
  /** Phase 2-7: provider 응답 등 부가 메타데이터 */
  generatedImageMetadata: Record<string, unknown>;
  /** Phase 2-7: 생성 실패 시 오류 메시지 (안전하게 정리된 메시지만 저장) */
  generatedImageError: string | null;
  generatedImageRequestedAt: string | null;
  generatedImageCompletedAt: string | null;
  /** Phase 2-7: 생성 결과를 사람이 검토 완료한 시각 */
  generatedImageReviewedAt: string | null;
  /** Phase 2-11: WordPress draft post에 featured_media 연결 시도 상태 */
  wordpressFeaturedMediaAttachStatus: WordPressFeaturedMediaAttachStatus;
  /** Phase 2-11: featured_media 연결이 마지막으로 시도된 시각 */
  wordpressFeaturedMediaAttachedAt: string | null;
  /** Phase 2-11: featured_media 연결 실패 시 안전한 오류 메시지 */
  wordpressFeaturedMediaAttachError: string | null;
  /** Phase 2-12: SEO plugin 실제 metadata write 시도 상태 */
  seoPluginActualWriteStatus: SeoPluginActualWriteStatus;
  /** Phase 2-12: 실제 write에 사용된 provider (시도 시점 기준) */
  seoPluginActualWriteProvider: string | null;
  /** Phase 2-12: 실제 write 대상 WordPress post id */
  seoPluginActualWritePostId: number | null;
  /** Phase 2-12: 실제 write 실패 시 안전한 오류 메시지 */
  seoPluginActualWriteError: string | null;
  /** Phase 2-12: 실제 write가 마지막으로 시도된 시각 */
  seoPluginActualWriteAttemptedAt: string | null;
  /** Phase 2-12: REST 응답으로 반영이 확인되었는지 여부 */
  seoPluginActualWriteVerified: boolean;
  /** Phase 2-12: 반영 확인 관련 warning (custom endpoint 필요 가능성 등) */
  seoPluginActualWriteWarning: string | null;
  /** Phase 2-13: WordPress custom SEO endpoint(Rank Math 전용) write 시도 상태 */
  seoPluginCustomEndpointStatus: SeoPluginCustomEndpointStatus;
  /** Phase 2-13: custom endpoint 응답으로 반영이 확인되었는지 여부 */
  seoPluginCustomEndpointVerified: boolean;
  /** Phase 2-13: custom endpoint 실패 시 안전한 오류 메시지 */
  seoPluginCustomEndpointError: string | null;
  /** Phase 2-13: custom endpoint가 마지막으로 시도된 시각 */
  seoPluginCustomEndpointAttemptedAt: string | null;
  /** Phase 2-14: WordPress final draft payload review 상태 */
  wordpressFinalDraftReviewStatus: WordPressFinalDraftReviewStatus;
  /** Phase 2-14: 체크리스트 통과 비율(0~100) — 항목이 없으면 null */
  wordpressFinalDraftReviewScore: number | null;
  /** Phase 2-14: 체크리스트 항목별 결과 요약 (본문 전체는 포함하지 않음) */
  wordpressFinalDraftReviewSummary: Record<string, unknown>;
  /** Phase 2-14: 검토 실행 자체가 실패했을 때의 안전한 오류 메시지 */
  wordpressFinalDraftReviewError: string | null;
  /** Phase 2-14: 검토가 마지막으로 시도된 시각 */
  wordpressFinalDraftReviewedAt: string | null;
  /** Phase 2-15: Publish Quality Gate 상태 */
  publishQualityGateStatus: PublishQualityGateStatus;
  /** Phase 2-15: checklist 통과 점수(0~100) */
  publishQualityGateScore: number | null;
  /** Phase 2-15: checklist 항목별 결과 요약 (본문 전체는 포함하지 않음) */
  publishQualityGateSummary: Record<string, unknown>;
  /** Phase 2-15: 게이트 실행 자체가 실패했을 때의 안전한 오류 메시지 */
  publishQualityGateError: string | null;
  /** Phase 2-15: 게이트가 마지막으로 실행된 시각 */
  publishQualityGateCheckedAt: string | null;
  /** Phase 2-15: ready_to_publish일 때만 true (실제 공개는 여전히 수행하지 않음) */
  publishReady: boolean;
  /** Phase 2-15: blocked 상태일 때의 안전한 사유 요약 */
  publishBlockedReason: string | null;
  /** Phase 2-16: Human Approval Before Public Publish 상태 */
  publicPublishApprovalStatus: PublicPublishApprovalStatus;
  /** Phase 2-16: 실제 공개 게시가 승인되었는지 여부 (approved 상태일 때만 true) */
  publicPublishApproved: boolean;
  /** Phase 2-16: 승인이 이루어진 시각 (중복 승인 시에도 덮어쓰지 않음) */
  publicPublishApprovedAt: string | null;
  /** Phase 2-16: 승인한 사용자 (미상이면 'unknown') */
  publicPublishApprovedBy: string | null;
  /** Phase 2-16: 승인/취소 처리 자체가 실패했을 때의 안전한 오류 메시지 */
  publicPublishApprovalError: string | null;
  /** Phase 2-16: 승인/취소 사유 메모 (본문 전체는 포함하지 않음) */
  publicPublishApprovalNotes: string | null;
  /** Phase 2-17: WordPress Public Publish Test 상태 */
  publicPublishStatus: PublicPublishStatus;
  /** Phase 2-17: 실제로 WordPress에 공개(publish)되었는지 여부 */
  publicPublished: boolean;
  /** Phase 2-17: 실제 공개(publish)가 완료된 시각 */
  publicPublishedAt: string | null;
  /** Phase 2-17: 공개된 WordPress post id */
  publicPublishPostId: number | null;
  /** Phase 2-17: 공개된 WordPress post의 공개 URL */
  publicPublishUrl: string | null;
  /** Phase 2-17: 공개 시도 자체가 실패했을 때의 안전한 오류 메시지 */
  publicPublishError: string | null;
  /** Phase 2-17: 공개 게시가 마지막으로 시도된 시각 (성공/실패/차단 모두 포함) */
  publicPublishAttemptedAt: string | null;
}
