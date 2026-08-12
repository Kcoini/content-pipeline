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
