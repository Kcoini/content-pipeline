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
