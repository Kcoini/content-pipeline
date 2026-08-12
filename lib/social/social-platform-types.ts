// Phase 3-1: Multi-platform Writing Schema & Foundation.
// article 하나를 플랫폼별/문체별로 변환한 글(social_posts)에 대한 도메인
// 타입 정의. 이 단계에서는 실제 AI 생성이나 실제 플랫폼 게시를 구현하지
// 않으며, 구조(스키마/타입/검증)만 준비한다.

export type SocialPlatform =
  | "wordpress_blog"
  | "naver_blog"
  | "naver_cafe"
  | "x"
  | "threads"
  | "instagram";

export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  "wordpress_blog",
  "naver_blog",
  "naver_cafe",
  "x",
  "threads",
  "instagram",
];

export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return typeof value === "string" && (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

export type ToneStyle =
  | "explanatory"
  | "informational"
  | "persuasive"
  | "warning"
  | "loss_aversion"
  | "curiosity"
  | "comparison"
  | "story";

export const TONE_STYLES: readonly ToneStyle[] = [
  "explanatory",
  "informational",
  "persuasive",
  "warning",
  "loss_aversion",
  "curiosity",
  "comparison",
  "story",
];

export function isToneStyle(value: unknown): value is ToneStyle {
  return typeof value === "string" && (TONE_STYLES as readonly string[]).includes(value);
}

export type SocialPostQualityStatus = "not_checked" | "ready" | "needs_revision" | "blocked" | "failed";

export type SocialPostApprovalStatus = "not_requested" | "pending_review" | "approved" | "rejected" | "revoked";

/** Phase 3-5: manual export 진행 상태. publish_status와 별개의 트랙이다. */
export type SocialPostExportStatus = "not_exported" | "ready" | "exported" | "blocked" | "failed";

/** Phase 3-6: 플랫폼별 게시 가능 조건 검사 상태. 실제 게시 여부와는 별개의 트랙이다. */
export type PlatformPublishGuardStatus = "not_checked" | "ready" | "needs_revision" | "blocked" | "failed";

/** Phase 3-7: 플랫폼별 게시 직전 dry-run payload 생성 상태. 실제 게시 여부와는 별개의 트랙이다. */
export type PlatformPublishDryRunStatus = "not_created" | "ready" | "blocked" | "failed";

/** Phase 3-7: 사람이 dry-run 결과를 확인하고 수동 게시 준비를 마쳤는지 상태. 실제 게시 완료를 의미하지 않는다. */
export type HandoffStatus = "not_started" | "ready" | "completed" | "blocked" | "failed";

/** Phase 3-8: 사람이 실제 플랫폼에 수동으로 게시한 결과 기록 상태. 'posted'는 API 자동 게시가 아니라 사람이 직접 게시했다는 기록이다. */
export type ManualPostStatus = "not_recorded" | "ready_to_record" | "posted" | "skipped" | "failed" | "blocked";

/** Phase 3-8: manual posting checklist 항목 하나. */
export interface ManualPostingChecklistItem {
  key: string;
  label: string;
  status: "pending" | "confirmed";
}

/** Phase 3-9: social post 성과(metrics) 측정 상태. 내부 비교용이며 실제 마케팅 지표가 아니다. */
export type SocialPerformanceStatus = "not_measured" | "low" | "average" | "good" | "excellent" | "needs_review";

/** Phase 3-10: social_posts에 저장되는 rewrite suggestion 요약 상태. */
export type SocialRewriteSuggestionSummaryStatus = "not_created" | "suggested" | "approved" | "rejected" | "applied" | "blocked" | "failed";

/** Phase 3-10: social_post_rewrite_suggestions 한 건의 상태. */
export type RewriteSuggestionStatus = "draft" | "ready" | "needs_review" | "approved" | "rejected" | "applied" | "blocked" | "failed";

/** Phase 3-11: social_posts 버전 상태. */
export type SocialPostVersionStatus = "current" | "archived" | "superseded" | "draft" | "rejected";

/** Phase 3-12: 원본 vs rewrite version 비교 상태. */
export type VersionComparisonStatus = "not_compared" | "original_better" | "rewrite_better" | "similar" | "needs_review" | "blocked" | "failed";

/** 실제 자동 게시(외부 플랫폼 API 호출)는 이번 단계에서 구현하지 않는다 — 상태값만 준비한다. */
export type SocialPostPublishStatus =
  | "not_published"
  | "dry_run"
  | "exported"
  | "scheduled"
  | "published"
  | "failed"
  | "blocked";

/** x(thread)/instagram(card news) 등에서 사용하는 항목 하나. */
export interface ThreadItem {
  order: number;
  text: string;
}

export interface CardItem {
  order: number;
  heading: string;
  body: string;
}

export interface MediaRequirements {
  requiresImage: boolean;
  recommendedCount?: number;
  aspectRatio?: string;
  notes?: string;
}

export interface SocialPost {
  id: string;
  articleId: string;
  platform: SocialPlatform;
  toneStyle: ToneStyle;
  postTitle: string | null;
  postBody: string | null;
  caption: string | null;
  excerpt: string | null;
  hashtags: string[];
  threadItems: ThreadItem[];
  cardItems: CardItem[];
  mediaRequirements: Record<string, unknown>;
  platformMetadata: Record<string, unknown>;
  generationContext: Record<string, unknown>;
  qualityStatus: SocialPostQualityStatus;
  qualityScore: number | null;
  qualitySummary: Record<string, unknown>;
  approvalStatus: SocialPostApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  publishStatus: SocialPostPublishStatus;
  externalPostId: string | null;
  postUrl: string | null;
  exportFormat: string | null;
  exportPayload: Record<string, unknown>;
  errorMessage: string | null;
  generatedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Phase 3-4: Review & Editing Workflow */
  editedAt: string | null;
  editedBy: string | null;
  reviewNotes: string | null;
  revisionCount: number;
  lastQualityCheckedAt: string | null;
  approvalRequestedAt: string | null;
  rejectionReason: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  /** Phase 3-5: Manual Export & Copy Workflow */
  exportStatus: SocialPostExportStatus;
  exportedAt: string | null;
  exportedBy: string | null;
  exportError: string | null;
  exportCopyCount: number;
  lastCopiedAt: string | null;
  exportNotes: string | null;
  /** Phase 3-6: Platform-specific Approval & Publishing Guard */
  platformPublishGuardStatus: PlatformPublishGuardStatus;
  platformPublishGuardScore: number | null;
  platformPublishGuardSummary: Record<string, unknown>;
  platformPublishGuardError: string | null;
  platformPublishGuardCheckedAt: string | null;
  platformPublishReady: boolean;
  platformPublishBlockedReason: string | null;
  /** Phase 3-7: Platform Publish Dry-run & Export Handoff */
  platformPublishDryRunStatus: PlatformPublishDryRunStatus;
  platformPublishDryRunPayload: Record<string, unknown>;
  platformPublishDryRunError: string | null;
  platformPublishDryRunCreatedAt: string | null;
  platformPublishDryRunCreatedBy: string | null;
  handoffStatus: HandoffStatus;
  handoffPayload: Record<string, unknown>;
  handoffNotes: string | null;
  handoffCompletedAt: string | null;
  handoffCompletedBy: string | null;
  handoffError: string | null;
  /** Phase 3-8: Platform Manual Posting Checklist & Result Recording */
  manualPostStatus: ManualPostStatus;
  manualPostUrl: string | null;
  manualPostedAt: string | null;
  manualPostedBy: string | null;
  manualPostResultNotes: string | null;
  manualPostError: string | null;
  manualPostRecordedAt: string | null;
  manualPostRecordedBy: string | null;
  manualPostChecklist: Record<string, unknown>[];
  /** Phase 3-9: Social Metrics Manual Input & Performance Tracking */
  latestMetricsId: string | null;
  latestMetricsRecordedAt: string | null;
  latestViews: number;
  latestImpressions: number;
  latestLikes: number;
  latestComments: number;
  latestShares: number;
  latestSaves: number;
  latestClicks: number;
  latestEngagementRate: number | null;
  latestClickThroughRate: number | null;
  latestPerformanceScore: number | null;
  performanceStatus: SocialPerformanceStatus;
  performanceSummary: Record<string, unknown>;
  /** Phase 3-10: Performance-based Rewrite Suggestion */
  latestRewriteSuggestionId: string | null;
  rewriteSuggestionStatus: SocialRewriteSuggestionSummaryStatus;
  rewriteSuggestionCount: number;
  latestRewriteSuggestedAt: string | null;
  /** Phase 3-11: Rewrite Application & Versioning Workflow */
  parentSocialPostId: string | null;
  rootSocialPostId: string | null;
  versionNumber: number;
  versionLabel: string | null;
  versionStatus: SocialPostVersionStatus;
  rewriteSourceSuggestionId: string | null;
  rewriteAppliedFromSocialPostId: string | null;
  rewriteAppliedAt: string | null;
  rewriteAppliedBy: string | null;
  rewriteApplicationNotes: string | null;
  isRewriteVersion: boolean;
  /** Phase 3-12: Rewrite Version Quality Recheck & Comparison */
  latestVersionComparisonId: string | null;
  versionComparisonStatus: VersionComparisonStatus;
  versionComparisonScore: number | null;
  recommendedForRepost: boolean;
  versionComparisonCheckedAt: string | null;
}

/** Phase 3-6: publishing guard 체크리스트 항목 하나. */
export interface PlatformPublishGuardChecklistItem {
  key: string;
  label: string;
  status: "pass" | "warning" | "fail" | "blocked";
  message: string;
}

/** Phase 3-6: runPlatformPublishingGuard()의 반환 결과. */
export interface PlatformPublishGuardResult {
  status: PlatformPublishGuardStatus;
  score: number;
  ready: boolean;
  blockedReason?: string;
  checklist: PlatformPublishGuardChecklistItem[];
  warnings: string[];
  failures: string[];
  blockedReasons: string[];
}

/** social_posts row 하나를 새로 만들 때 필요한 최소 입력. */
export interface SocialPostDraftInput {
  articleId: string;
  platform: SocialPlatform;
  toneStyle: ToneStyle;
  postTitle?: string | null;
  postBody?: string | null;
  caption?: string | null;
  excerpt?: string | null;
  hashtags?: string[];
  threadItems?: ThreadItem[];
  cardItems?: CardItem[];
  mediaRequirements?: Record<string, unknown>;
  platformMetadata?: Record<string, unknown>;
  generationContext?: Record<string, unknown>;
  generatedAt?: string | null;
}

export interface SocialPostQualityChecklistItem {
  key: string;
  label: string;
  status: "pass" | "warning" | "fail" | "blocked";
  message: string;
}

export interface SocialPostQualityResult {
  status: SocialPostQualityStatus;
  score: number;
  checklist: SocialPostQualityChecklistItem[];
  warnings: string[];
  failures: string[];
  blockedReasons: string[];
}

export interface PlatformWritingConfig {
  platform: SocialPlatform;
  purpose: string;
  supportsTitle: boolean;
  supportsBody: boolean;
  supportsCaption: boolean;
  supportsHashtags: boolean;
  supportsThreads: boolean;
  supportsImages: boolean;
  requiresImage: boolean;
  preferredLength:
    | "short"
    | "short_to_medium"
    | "medium"
    | "medium_to_long"
    | "long"
    | "caption";
  exportFormat:
    | "html_or_markdown"
    | "markdown_copy"
    | "plain_text_copy"
    | "thread_json"
    | "caption_and_card_items";
  maxLength: number;
  minLength: number;
  recommendedHashtagCount: number;
  /** 이 단계에서는 모든 플랫폼이 사람 승인을 반드시 거쳐야 한다 (true 고정). */
  requiresHumanApproval: boolean;
  /** 이번 단계에서는 모든 플랫폼이 자동 게시를 지원하지 않는다 (false 고정). */
  allowAutoPublish: boolean;
  prohibitedPatterns: string[];
  qualityChecklistKeys: string[];
}

export interface ToneStyleConfig {
  toneStyle: ToneStyle;
  label: string;
  description: string;
  guidance: string[];
  prohibitedPatterns: string[];
}
