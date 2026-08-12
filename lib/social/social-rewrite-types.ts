// Phase 3-10: Performance-based Rewrite Suggestion 타입 정의.
// 실제 글 자동 덮어쓰기/재게시는 하지 않는다 — 제안만 별도 테이블에
// 저장하고, 사람이 확인하기 전까지 적용되지 않는다.

import type { SocialPlatform, ToneStyle, ThreadItem, CardItem } from "./social-platform-types";

export type RewriteSuggestionStatus = "draft" | "ready" | "needs_review" | "approved" | "rejected" | "applied" | "blocked" | "failed";

export interface RewriteSuggestionOutline {
  order: number;
  heading: string;
}

/** social_post_rewrite_suggestions row 하나. */
export interface SocialPostRewriteSuggestion {
  id: string;
  socialPostId: string;
  articleId: string;
  platform: SocialPlatform;
  toneStyle: ToneStyle;
  originalPerformanceStatus: string | null;
  originalPerformanceScore: number | null;
  suggestionStatus: RewriteSuggestionStatus;
  diagnosis: Record<string, unknown>;
  suggestedChanges: Record<string, unknown>;
  suggestedTitle: string | null;
  suggestedHook: string | null;
  suggestedBodyOutline: RewriteSuggestionOutline[];
  suggestedCta: string | null;
  suggestedHashtags: string[];
  suggestedThreadItems: ThreadItem[];
  suggestedCardItems: CardItem[];
  suggestedToneStyle: ToneStyle | null;
  riskNotes: string[];
  qualityNotes: string[];
  expectedImprovementReason: string | null;
  generatedBy: string | null;
  generatedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  appliedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
  /** Phase 3-11: Rewrite Application & Versioning Workflow */
  appliedSocialPostId: string | null;
  applicationStatus: RewriteApplicationStatus;
  applicationError: string | null;
  applicationNotes: string | null;
}

export type RewriteApplicationStatus = "not_applied" | "applied" | "blocked" | "failed";

/** social_post_versions row 하나. */
export interface SocialPostVersion {
  id: string;
  socialPostId: string;
  articleId: string;
  rootSocialPostId: string;
  parentSocialPostId: string | null;
  versionNumber: number;
  versionLabel: string | null;
  versionStatus: string;
  platform: SocialPlatform;
  toneStyle: ToneStyle;
  rewriteSourceSuggestionId: string | null;
  changeSummary: Record<string, unknown>;
  appliedBy: string | null;
  appliedAt: string | null;
  createdAt: string;
}

/** Phase 3-12: 원본 vs rewrite version 비교 결과(social_post_version_comparisons row). */
export interface SocialPostVersionComparison {
  id: string;
  articleId: string;
  rootSocialPostId: string;
  originalSocialPostId: string;
  rewriteSocialPostId: string;
  rewriteSourceSuggestionId: string | null;
  platform: SocialPlatform;
  originalVersionNumber: number | null;
  rewriteVersionNumber: number | null;
  originalQualityStatus: string | null;
  originalQualityScore: number | null;
  rewriteQualityStatus: string | null;
  rewriteQualityScore: number | null;
  originalPerformanceStatus: string | null;
  originalPerformanceScore: number | null;
  rewritePerformanceStatus: string | null;
  rewritePerformanceScore: number | null;
  comparisonStatus: "not_compared" | "original_better" | "rewrite_better" | "similar" | "needs_review" | "blocked" | "failed";
  comparisonScore: number | null;
  recommendedSocialPostId: string | null;
  recommendationReason: string | null;
  comparisonSummary: Record<string, unknown>;
  checklist: { key: string; label: string; status: "pass" | "warning" | "fail" | "blocked"; message: string }[];
  warnings: string[];
  failures: string[];
  comparedBy: string | null;
  comparedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVersionComparisonInput {
  articleId: string;
  rootSocialPostId: string;
  originalSocialPostId: string;
  rewriteSocialPostId: string;
  rewriteSourceSuggestionId?: string | null;
  platform: SocialPlatform;
  originalVersionNumber?: number | null;
  rewriteVersionNumber?: number | null;
  originalQualityStatus?: string | null;
  originalQualityScore?: number | null;
  rewriteQualityStatus?: string | null;
  rewriteQualityScore?: number | null;
  originalPerformanceStatus?: string | null;
  originalPerformanceScore?: number | null;
  rewritePerformanceStatus?: string | null;
  rewritePerformanceScore?: number | null;
  comparisonStatus: SocialPostVersionComparison["comparisonStatus"];
  comparisonScore?: number | null;
  recommendedSocialPostId?: string | null;
  recommendationReason?: string | null;
  comparisonSummary?: Record<string, unknown>;
  checklist?: SocialPostVersionComparison["checklist"];
  warnings?: string[];
  failures?: string[];
  comparedBy?: string | null;
  comparedAt?: string | null;
}

export interface CreateSocialPostVersionInput {
  socialPostId: string;
  articleId: string;
  rootSocialPostId: string;
  parentSocialPostId?: string | null;
  versionNumber: number;
  versionLabel?: string | null;
  versionStatus?: string;
  platform: SocialPlatform;
  toneStyle: ToneStyle;
  rewriteSourceSuggestionId?: string | null;
  changeSummary?: Record<string, unknown>;
  appliedBy?: string | null;
  appliedAt?: string | null;
}

/** rewrite suggestion을 새로 만들 때 필요한 입력. */
export interface CreateRewriteSuggestionInput {
  socialPostId: string;
  articleId: string;
  platform: SocialPlatform;
  toneStyle: ToneStyle;
  originalPerformanceStatus?: string | null;
  originalPerformanceScore?: number | null;
  suggestionStatus: RewriteSuggestionStatus;
  diagnosis: Record<string, unknown>;
  suggestedChanges: Record<string, unknown>;
  suggestedTitle?: string | null;
  suggestedHook?: string | null;
  suggestedBodyOutline?: RewriteSuggestionOutline[];
  suggestedCta?: string | null;
  suggestedHashtags?: string[];
  suggestedThreadItems?: ThreadItem[];
  suggestedCardItems?: CardItem[];
  suggestedToneStyle?: ToneStyle | null;
  riskNotes?: string[];
  qualityNotes?: string[];
  expectedImprovementReason?: string | null;
  generatedBy?: string | null;
}

/** 성과 진단 결과(diagnoseSocialPostPerformance의 반환값). */
export interface PerformanceDiagnosisResult {
  status: "ok" | "needs_review" | "blocked";
  diagnosis: Record<string, unknown>;
  improvementTargets: string[];
  warnings: string[];
  blockedReasons: string[];
}
