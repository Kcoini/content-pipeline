// Phase 2-14: WordPress Final Draft Payload Review.
// WordPress draft post/featured media/Rank Math SEO metadata/category·tag/
// source citation/AD_SLOT marker가 하나의 draft에 정상 반영되었는지 이미
// 저장된 상태를 바탕으로 checklist 형태로 점검한다. 실제 WordPress API를
// 다시 호출하지 않으며(이미 각 단계에서 확인된 상태를 재집계), 공개(publish)는
// 어떤 경우에도 수행하지 않는다.

import { getArticleById, saveWordPressFinalDraftReviewResult } from "@/lib/repositories/article-repository";
import { savePublishLog, getSuccessfulWordPressDraft } from "@/lib/repositories/publish-repository";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import { AD_SLOT_MARKERS, adSlotMarkerComment } from "@/lib/articles/article-modes";
import type { Article } from "@/lib/types/domain";

export const WORDPRESS_FINAL_DRAFT_REVIEW_TARGET = "wordpress_final_draft_review";

const MIN_CITED_SOURCES = 3;

export type ChecklistItemStatus = "passed" | "failed" | "warning";

export interface ChecklistItem {
  key: string;
  label: string;
  status: ChecklistItemStatus;
  detail: string;
}

export interface ReviewFinalDraftResult {
  success: boolean;
  message: string;
  status: "reviewed" | "missing_wordpress_draft" | "failed";
  score?: number;
  checklist?: ChecklistItem[];
}

async function logReviewEvent(
  type: LogEventType,
  status: LogStatus,
  message: string,
  articleId: string,
  article: Article,
  details?: Record<string, unknown>
): Promise<void> {
  await logEvent({
    type,
    status,
    message,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
    ...(details ? { details } : {}),
  });
}

function checkFeaturedMedia(article: Article): ChecklistItem {
  if (article.wordpressFeaturedMediaAttachStatus === "attached") {
    return { key: "featured_media", label: "Featured media 연결", status: "passed", detail: "featured_media가 draft post에 연결되었습니다." };
  }
  if (article.featuredImageWordpressMediaId) {
    return {
      key: "featured_media",
      label: "Featured media 연결",
      status: "warning",
      detail: "WordPress media id는 있지만 draft post에 연결되었는지 확인되지 않았습니다.",
    };
  }
  return { key: "featured_media", label: "Featured media 연결", status: "warning", detail: "연결된 featured media가 없습니다 (선택 사항)." };
}

function checkSeoMetadata(article: Article): ChecklistItem {
  if (article.seoPluginProvider === "none") {
    return { key: "seo_metadata", label: "Rank Math SEO metadata 반영", status: "warning", detail: "SEO plugin provider가 none이어서 확인 대상이 아닙니다." };
  }
  const actualWriteVerified = article.seoPluginActualWriteStatus === "success" && article.seoPluginActualWriteVerified;
  const customEndpointVerified = article.seoPluginCustomEndpointStatus === "success" && article.seoPluginCustomEndpointVerified;
  if (actualWriteVerified || customEndpointVerified) {
    return { key: "seo_metadata", label: "Rank Math SEO metadata 반영", status: "passed", detail: "SEO plugin metadata 반영이 확인되었습니다." };
  }
  return {
    key: "seo_metadata",
    label: "Rank Math SEO metadata 반영",
    status: "failed",
    detail: "SEO plugin metadata 반영이 확인되지 않았습니다 (실제 write 또는 custom endpoint 재시도가 필요할 수 있습니다).",
  };
}

function checkCategoryTag(article: Article): ChecklistItem {
  const hasCategory = article.wpCategoryIds.length > 0 || article.wpCategoryNames.length > 0;
  const hasTag = article.wpTagIds.length > 0 || article.wpTagNames.length > 0;
  if (hasCategory && hasTag) {
    return { key: "category_tag", label: "Category/Tag", status: "passed", detail: "category와 tag가 모두 준비되어 있습니다." };
  }
  return {
    key: "category_tag",
    label: "Category/Tag",
    status: "failed",
    detail: `category ${hasCategory ? "있음" : "없음"}, tag ${hasTag ? "있음" : "없음"}.`,
  };
}

function checkSourceCitation(article: Article): ChecklistItem {
  const count = article.citedSourceIds.length;
  if (count >= MIN_CITED_SOURCES) {
    return { key: "source_citation", label: "출처 인용", status: "passed", detail: `인용된 출처 ${count}개.` };
  }
  return { key: "source_citation", label: "출처 인용", status: "failed", detail: `인용된 출처가 ${count}개뿐입니다 (최소 ${MIN_CITED_SOURCES}개 필요).` };
}

function checkAdSlotMarkers(article: Article): ChecklistItem {
  if (article.articleMode !== "monetized_blog") {
    return { key: "ad_slot_marker", label: "AD_SLOT marker", status: "warning", detail: "monetized_blog 모드가 아니어서 확인 대상이 아닙니다." };
  }
  const missing = AD_SLOT_MARKERS.filter((position) => !article.content.includes(adSlotMarkerComment(position)));
  if (missing.length === 0) {
    return { key: "ad_slot_marker", label: "AD_SLOT marker", status: "passed", detail: "모든 AD_SLOT marker가 본문에 존재합니다." };
  }
  return { key: "ad_slot_marker", label: "AD_SLOT marker", status: "failed", detail: `누락된 marker: ${missing.join(", ")}` };
}

function buildChecklist(article: Article): ChecklistItem[] {
  return [
    { key: "wordpress_draft", label: "WordPress draft post", status: "passed", detail: "WordPress draft post가 생성되어 있습니다." },
    checkFeaturedMedia(article),
    checkSeoMetadata(article),
    checkCategoryTag(article),
    checkSourceCitation(article),
    checkAdSlotMarkers(article),
  ];
}

function computeScore(checklist: ChecklistItem[]): number {
  const applicable = checklist.filter((item) => item.status !== "warning");
  if (applicable.length === 0) return 100;
  const passed = applicable.filter((item) => item.status === "passed").length;
  return Math.round((passed / applicable.length) * 100);
}

/**
 * article의 WordPress final draft payload를 checklist 기준으로 점검한다.
 * WordPress draft post가 없으면(publish_logs.target='wordpress', status=
 * 'success', external_post_id 존재 기록이 없으면) 실제 점검을 시도하지 않고
 * missing_wordpress_draft로 처리한다. 실제 WordPress API를 호출하지 않으며,
 * 공개(publish)는 어떤 경우에도 수행하지 않는다.
 */
export async function reviewWordPressFinalDraft(articleId: string): Promise<ReviewFinalDraftResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}`, status: "failed" };
  }

  try {
    const existingDraft = await getSuccessfulWordPressDraft(articleId);
    if (!existingDraft) {
      const message = `기사(${articleId})에 대해 생성된 WordPress draft post가 없습니다. 먼저 'WordPress 초안 생성'을 실행하세요.`;
      await saveWordPressFinalDraftReviewResult(articleId, { status: "missing_wordpress_draft", score: null, summary: {} });
      await logReviewEvent("wordpress_final_draft_review_skipped_missing_draft", "info", message, articleId, article);
      await savePublishLog({
        articleId,
        target: WORDPRESS_FINAL_DRAFT_REVIEW_TARGET,
        status: "skipped",
        details: { actual: false, reason: "missing_wordpress_draft" },
      });
      return { success: false, message, status: "missing_wordpress_draft" };
    }

    await logReviewEvent(
      "wordpress_final_draft_review_started",
      "info",
      `기사(${articleId})의 WordPress final draft payload review를 시작합니다.`,
      articleId,
      article,
      { postId: existingDraft.externalPostId }
    );

    const checklist = buildChecklist(article);
    const score = computeScore(checklist);
    const failedItems = checklist.filter((item) => item.status === "failed").map((item) => item.key);
    const summary = {
      checklist: checklist.map(({ key, label, status, detail }) => ({ key, label, status, detail })),
      failedItems,
      checkedAt: new Date().toISOString(),
    };

    await saveWordPressFinalDraftReviewResult(articleId, { status: "reviewed", score, summary, errorMessage: null });

    await logReviewEvent(
      "wordpress_final_draft_review_completed",
      failedItems.length > 0 ? "failed" : "success",
      `기사(${articleId})의 WordPress final draft payload review를 완료했습니다 (score: ${score}).`,
      articleId,
      article,
      { score, failedItems }
    );

    await savePublishLog({
      articleId,
      target: WORDPRESS_FINAL_DRAFT_REVIEW_TARGET,
      status: "success",
      externalPostId: existingDraft.externalPostId,
      postUrl: existingDraft.postUrl ?? undefined,
      details: { actual: false, score, checklist: summary.checklist, failedItems },
    });

    return {
      success: true,
      message:
        failedItems.length > 0
          ? `검토를 완료했지만 일부 항목이 실패했습니다 (score: ${score}).`
          : `모든 항목을 통과했습니다 (score: ${score}).`,
      status: "reviewed",
      score,
      checklist,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

    try {
      await saveWordPressFinalDraftReviewResult(articleId, { status: "failed", errorMessage: message });
    } catch {
      // 결과 저장 실패는 무시하고 원래 오류를 그대로 알린다.
    }

    await logReviewEvent(
      "wordpress_final_draft_review_failed",
      "failed",
      `WordPress final draft payload review 실패: ${message}`,
      articleId,
      article
    );

    await savePublishLog({
      articleId,
      target: WORDPRESS_FINAL_DRAFT_REVIEW_TARGET,
      status: "failed",
      errorMessage: message,
      details: { actual: false },
    });

    return { success: false, message, status: "failed" };
  }
}
