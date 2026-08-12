// Phase 3-12: Rewrite Version Quality Recheck & Comparison — 비교 preview.
// 실제로 비교 결과를 저장하지 않고, 원본/rewrite 요약과 예상 차이점만
// 보여준다(읽기 전용). full body 전문은 여기서도 잘라서만 노출한다.

import { getSocialPostForVersionComparison } from "@/lib/repositories/social-posts-repository";
import { decideRecommendedVersion, compareVersionQuality, comparePlatformFit, compareToneFit, compareStructure } from "./rewrite-version-comparison-rules";

export interface VersionComparisonPreviewSide {
  id: string;
  versionNumber: number;
  qualityStatus: string;
  qualityScore: number | null;
  performanceStatus: string;
  performanceScore: number | null;
  postTitlePreview: string | null;
  postBodyLength: number;
  captionLength: number;
  hashtagCount: number;
  threadItemCount: number;
  cardItemCount: number;
}

export interface RewriteVersionComparisonPreviewResult {
  ok: boolean;
  original?: VersionComparisonPreviewSide;
  rewrite?: VersionComparisonPreviewSide;
  differences: string[];
  warnings: string[];
  recommendationPreview?: { comparisonStatus: string; recommendedSocialPostId: string | null; recommendationReason: string };
  error?: string;
}

function truncate(text: string | null, length: number): string | null {
  if (!text) return null;
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

/**
 * rewrite version과 원본을 비교하기 전에 미리보기를 만든다. 아무것도
 * 저장하지 않는다(읽기 전용).
 */
export async function buildRewriteVersionComparisonPreview(rewriteSocialPostId: string): Promise<RewriteVersionComparisonPreviewResult> {
  const rewrite = await getSocialPostForVersionComparison(rewriteSocialPostId);
  if (!rewrite) {
    return { ok: false, differences: [], warnings: [], error: `social post를 찾을 수 없습니다: ${rewriteSocialPostId}` };
  }

  const originalId = rewrite.rewriteAppliedFromSocialPostId ?? rewrite.parentSocialPostId;
  if (!originalId) {
    return { ok: false, differences: [], warnings: [], error: "parent_social_post_id(원본)가 없어 비교할 수 없습니다." };
  }

  const original = await getSocialPostForVersionComparison(originalId);
  if (!original) {
    return { ok: false, differences: [], warnings: [], error: `원본 social post를 찾을 수 없습니다: ${originalId}` };
  }

  const toSide = (post: typeof original): VersionComparisonPreviewSide => ({
    id: post.id,
    versionNumber: post.versionNumber,
    qualityStatus: post.qualityStatus,
    qualityScore: post.qualityScore,
    performanceStatus: post.performanceStatus,
    performanceScore: post.latestPerformanceScore,
    postTitlePreview: truncate(post.postTitle, 60),
    postBodyLength: post.postBody?.length ?? 0,
    captionLength: post.caption?.length ?? 0,
    hashtagCount: post.hashtags.length,
    threadItemCount: post.threadItems.length,
    cardItemCount: post.cardItems.length,
  });

  const differences: string[] = [];
  if (original.postTitle !== rewrite.postTitle) differences.push("post_title이 다릅니다.");
  if (original.postBody !== rewrite.postBody) differences.push("post_body가 다릅니다.");
  if (original.caption !== rewrite.caption) differences.push("caption이 다릅니다.");
  if (JSON.stringify(original.hashtags) !== JSON.stringify(rewrite.hashtags)) differences.push("hashtags가 다릅니다.");
  if (JSON.stringify(original.threadItems) !== JSON.stringify(rewrite.threadItems)) differences.push("thread_items가 다릅니다.");
  if (JSON.stringify(original.cardItems) !== JSON.stringify(rewrite.cardItems)) differences.push("card_items가 다릅니다.");
  if (original.toneStyle !== rewrite.toneStyle) differences.push(`tone_style이 다릅니다 (${original.toneStyle} → ${rewrite.toneStyle}).`);

  const warnings: string[] = [];
  if (rewrite.performanceStatus === "not_measured") {
    warnings.push("rewrite version에 아직 성과 데이터가 없어 quality 중심으로만 비교됩니다.");
  }
  if (rewrite.qualityStatus === "not_checked") {
    warnings.push("rewrite version이 아직 quality gate를 거치지 않았습니다 — 먼저 quality recheck를 권장합니다.");
  }

  const checklist = [
    ...compareVersionQuality(original, rewrite),
    ...comparePlatformFit(original, rewrite),
    ...compareToneFit(original, rewrite),
    ...compareStructure(original, rewrite),
  ];
  const decision = decideRecommendedVersion({ original, rewrite, checklist });

  return {
    ok: true,
    original: toSide(original),
    rewrite: toSide(rewrite),
    differences,
    warnings,
    recommendationPreview: {
      comparisonStatus: decision.comparisonStatus,
      recommendedSocialPostId: decision.recommendedSocialPostId,
      recommendationReason: decision.recommendationReason,
    },
  };
}
