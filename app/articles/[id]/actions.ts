"use server";

// 기사 검토/수정/승인 서버 액션 (Phase 1-5).
// articles.status를 reviewed로 전환하는 로직은 반드시 이 모듈(서버)에서만
// 실행한다. 클라이언트는 Supabase를 직접 호출하지 않는다.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  approveArticle,
  updateDraftArticle,
  ArticleNotEditableError,
  ArticleNotFoundError,
  EmptyContentError,
} from "@/lib/repositories/article-repository";
import { logEvent } from "@/lib/harness/logger";
import {
  publishArticleToWordPressDraft,
  runWordPressConnectionTest,
  updateArticleWordPressDraftContent,
} from "@/lib/publish/publish-service";
import { getSocialPostById, archiveSocialPost } from "@/lib/repositories/social-posts-repository";
import { checkWordPressBlogPublishReadiness } from "@/lib/social/wordpress-blog-publish-readiness";
import { updateWordPressSeoMetadataFromBlogPost } from "@/lib/social/wordpress-blog-seo-metadata-service";
import { regenerateWordPressBlogMetadata } from "@/lib/social/wordpress-blog-metadata-regeneration-service";
import { writeWordPressBlogSeoPluginMetadata } from "@/lib/social/wordpress-blog-seo-plugin-service";
import {
  confirmWordPressBlogPersonalInfoFalsePositive,
  openWordPressBlogSafetyReview,
  checkWordPressBlogPersonalInfoOverrideEligibility,
} from "@/lib/social/wordpress-blog-personal-info-review";
import {
  generateWordPressBlogFeaturedImagePrompt,
  generateWordPressBlogFeaturedImage,
} from "@/lib/social/wordpress-blog-image-generation-service";
import { prepareWordPressBlogPostForPublishing } from "@/lib/social/wordpress-blog-publish-preparation-orchestrator";
import { buildWordPressBlogContentOverride } from "@/lib/social/wordpress-blog-content-override-builder";
import { saveWordPressFeaturedImageMediaForBlogPost } from "@/lib/social/wordpress-blog-featured-image-service";
import { uploadWordPressFeaturedImageFromBlogPost } from "@/lib/social/wordpress-blog-local-image-upload-service";
import { waiveWordPressFeaturedImageForBlogPost } from "@/lib/social/wordpress-blog-featured-image-waiver-service";
import {
  waiveArticleWordPressFeaturedImage,
  clearArticleWordPressFeaturedImageWaiver,
} from "@/lib/publish/article-wordpress-featured-image-waiver-service";
import { prepareArticleWordPressPublishing } from "@/lib/publish/article-wordpress-publish-preparation-orchestrator";
import { generateWordPressMetadata, reviewWordPressMetadata } from "@/lib/publish/wordpress-metadata-service";
import { generateSeoPluginPayload, reviewSeoPluginMetadata } from "@/lib/seo/seo-plugin-metadata-service";
import { isSeoPluginProvider } from "@/lib/seo/seo-plugin-types";
import { prepareFeaturedImage, reviewFeaturedImage } from "@/lib/images/featured-image-preparation-service";
import {
  prepareWordPressMediaUpload,
  confirmWordPressMediaUploadDryRun,
} from "@/lib/publish/wordpress-media-preparation-service";
import { uploadFeaturedImageToWordPress } from "@/lib/publish/wordpress-media-upload-service";
import { attachFeaturedMediaToDraft } from "@/lib/publish/wordpress-featured-media-service";
import {
  writeSeoPluginMetadataToWordPress,
  writeRankMathSeoViaCustomEndpoint,
} from "@/lib/seo/seo-plugin-actual-write-service";
import { reviewWordPressFinalDraft } from "@/lib/publish/wordpress-final-draft-review-service";
import { runPublishQualityGate } from "@/lib/publish/publish-quality-gate-service";
import { approvePublicPublish, revokePublicPublishApproval } from "@/lib/publish/public-publish-approval-service";
import { publishApprovedArticleToWordPress } from "@/lib/publish/wordpress-public-publish-service";
import { generateFeaturedImage, reviewGeneratedImage } from "@/lib/images/image-generation-service";
import {
  saveExternalImageUrl,
  saveExistingWordPressMedia,
  saveLocalImageUpload,
} from "@/lib/images/featured-image-source-service";
import {
  generatePlaceholderDraft,
  rerunSocialPostQualityGate,
  exportSocialPostDraft,
  editSocialPostContent,
} from "@/lib/social/social-post-service";
import { generateSocialDraft } from "@/lib/social/social-draft-generation-service";
import {
  generateSelectedPlatformPosts,
  generateAllPlatformPosts,
  type ToneSelectionMode,
} from "@/lib/social/multi-platform-generation-service";
import type { PlatformGenerationSummary } from "@/lib/social/multi-platform-generation-service";
import { isToneSelectionMode } from "@/lib/social/tone-selection-mode";
import {
  requestApproval as requestSocialPostApprovalService,
  approveSocialPost as approveSocialPostService,
  rejectSocialPost as rejectSocialPostService,
  revokeApproval as revokeSocialPostApprovalService,
} from "@/lib/social/social-post-approval-service";
import { generateManualExport } from "@/lib/social/social-manual-export-service";
import { recordSocialPostCopied } from "@/lib/social/social-copy-tracking-service";
import { runPlatformPublishingGuard } from "@/lib/social/platform-publishing-guard-service";
import { createPlatformPublishDryRun } from "@/lib/social/platform-publish-dry-run-service";
import { completePlatformExportHandoff } from "@/lib/social/platform-export-handoff-service";
import {
  prepareManualPostingRecord,
  recordManualPostingResult,
  markManualPostingSkipped,
  markManualPostingFailed,
} from "@/lib/social/platform-manual-posting-result-service";
import { markManualChecklistItemConfirmed } from "@/lib/social/manual-posting-checklist-confirmation-service";
import { recordSocialPostMetrics } from "@/lib/social/social-metrics-service";
import { generatePerformanceRewriteSuggestion } from "@/lib/social/performance-rewrite-suggestion-generator";
import { approveRewriteSuggestion, rejectRewriteSuggestion } from "@/lib/social/rewrite-suggestion-review-service";
import { applyRewriteSuggestion } from "@/lib/social/rewrite-application-service";
import { recheckRewriteVersionQuality } from "@/lib/social/rewrite-version-quality-recheck-service";
import { compareRewriteVersion } from "@/lib/social/rewrite-version-comparison-service";
import {
  requestRewriteReapproval,
  approveRewriteReapproval,
  rejectRewriteReapproval,
  revokeRewriteReapproval,
} from "@/lib/social/rewrite-reapproval-service";
import { prepareRewriteReexport, generateRewriteReexportPayload } from "@/lib/social/rewrite-reexport-service";
import { refreshRewriteRepublishWorkflowStatus } from "@/lib/social/rewrite-republish-workflow-service";
import { compareRewritePerformance } from "@/lib/social/rewrite-performance-comparison-service";
import {
  createAbTestDraft,
  addVariantToAbTest,
  createOriginalVsRewriteAbTest,
  markAbTestReady,
  startAbTest,
  pauseAbTest,
  completeAbTest,
  cancelAbTest,
  refreshAbTestVariantMetrics,
} from "@/lib/social/social-ab-test-service";
import { decideAbTestWinner } from "@/lib/social/social-ab-test-comparison-service";
import { isAbTestPrimaryMetric } from "@/lib/social/social-ab-test-service";
import { buildArticleAbTestsUrl } from "@/lib/navigation/article-deep-links";
import {
  isSocialPlatform,
  isToneStyle,
  SOCIAL_PLATFORMS,
  type ThreadItem,
  type CardItem,
  type SocialPost,
  type SocialPlatform,
  type ToneStyle,
} from "@/lib/social/social-platform-types";
import { getPlatformGroup } from "@/lib/social/content-type-classifier";
import { getSafeReturnTo } from "@/lib/navigation/return-to";
import {
  buildArticleOverviewUrl,
  buildArticleBlogUrl,
  buildArticleSocialUrl,
  buildSocialPostDeepLink,
  buildRewriteSuggestionDeepLink,
  buildRewriteVersionDeepLink,
  buildMetricsDeepLink,
  buildComparisonDeepLink,
} from "@/lib/navigation/article-deep-links";

/** Phase 1-5: 사용자 계정/권한 시스템이 없으므로 임시 식별자를 사용한다. */
const APPROVED_BY = "local-user";

/**
 * Phase 3-17: social/rewrite 관련 action 전용 redirect helper.
 *
 * - social_post 결과가 있으면 platform에 맞는 deep link(하이라이트 포함)로,
 *   없으면(post를 찾지 못했거나 아직 생성되지 않은 경우) formData의
 *   platform(있다면)이나 기사 개요 페이지로 돌아간다.
 * - 여기서 계산한 값은 어디까지나 "fallback"이다 — formData에 안전한
 *   returnTo가 있으면 항상 그 값이 우선한다(redirectToSafeTarget 참고).
 */
function socialPostFallbackUrl(articleId: string, socialPost: SocialPost | undefined, fallbackPlatformRaw?: string): string {
  if (socialPost) return buildSocialPostDeepLink(articleId, socialPost.platform, socialPost.id);
  if (isSocialPlatform(fallbackPlatformRaw)) {
    return getPlatformGroup(fallbackPlatformRaw) === "blog" ? buildArticleBlogUrl(articleId) : buildArticleSocialUrl(articleId);
  }
  return buildArticleOverviewUrl(articleId);
}

/** 성공/실패 메시지를 error 또는 publishMessage query로 url에 덧붙인다. */
function appendMessageQuery(url: string, message: string, isError: boolean): string {
  const key = isError ? "error" : "publishMessage";
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${key}=${encodeURIComponent(message)}`;
}

/** article 하위 5개 페이지를 모두 새로고침한다 (Phase 3-16 route 분리 이후 어느 페이지에서 action이 실행되어도 최신 상태를 보여주기 위함). */
function revalidateArticleWorkflowPaths(articleId: string): void {
  revalidatePath(`/articles/${articleId}`);
  revalidatePath(`/articles/${articleId}/blog`);
  revalidatePath(`/articles/${articleId}/social`);
  revalidatePath(`/articles/${articleId}/rewrite`);
  revalidatePath(`/articles/${articleId}/performance`);
  revalidatePath(`/articles/${articleId}/ab-tests`);
}

/**
 * Phase 3-17: formData의 returnTo(hidden input)를 읽어 안전하면 그 경로로,
 * 아니면 fallbackUrl(deep link)로 redirect한다. 외부 URL로는 절대
 * redirect하지 않는다(getSafeReturnTo가 내부 경로만 허용).
 */
function redirectToSafeTarget(formData: FormData, fallbackUrl: string, message: string, isError: boolean): never {
  const returnToRaw = formData.get("returnTo");
  const safeUrl = getSafeReturnTo(typeof returnToRaw === "string" ? returnToRaw : null, fallbackUrl);
  redirect(appendMessageQuery(safeUrl, message, isError));
}

function toUserMessage(error: unknown): string {
  if (
    error instanceof ArticleNotFoundError ||
    error instanceof ArticleNotEditableError ||
    error instanceof EmptyContentError
  ) {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "알 수 없는 오류가 발생했습니다.";
}

/** draft 상태 기사의 title/content를 수정한다. */
export async function updateArticleAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const title = String(formData.get("title") ?? "");
  const content = String(formData.get("content") ?? "");

  try {
    const article = await updateDraftArticle({ articleId, title, content });

    await logEvent({
      type: "article_updated",
      status: "success",
      message: `기사(${article.id})를 수정했습니다.`,
      themeId: article.themeId,
      articleId: article.id,
      targetType: "article",
      targetId: article.id,
    });
  } catch (error) {
    const message = toUserMessage(error);

    await logEvent({
      type: "article_updated",
      status: "failed",
      message,
      articleId,
      targetType: "article",
      targetId: articleId,
    });

    redirect(`/articles/${articleId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/articles/${articleId}`);
  revalidatePath("/articles");
  redirect(`/articles/${articleId}`);
}

/**
 * reviewed 상태의 기사를 WordPress에 draft post로 생성한다 (Phase 2-2).
 * WORDPRESS_PUBLISH_ENABLED=false이면 dry-run으로 처리되며, 실제 WordPress API는
 * 호출되지 않는다. 오류가 발생해도 Runtime Error로 터뜨리지 않고 사용자 메시지로
 * 반환하기 위해 publish-service의 결과(성공/실패 여부 포함)를 그대로 query param에 담는다.
 */
export async function publishToWordPressDraftAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await publishArticleToWordPressDraft(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * Phase 2-21: 이미 WordPress에 전송된 원본 article draft/post의 content를
 * 현재 article.content 기준으로 다시 Markdown→HTML 변환해서 갱신한다.
 * 이번 수정 이전에 raw Markdown이 그대로 전송되어 있던 글(예:
 * source_based_explainer)을 새 post를 만들지 않고 같은 post의 content만
 * 교체할 때 사용한다. status는 항상 draft로 고정 전송되므로 이미 공개된
 * 글이라도 이 action만으로는 공개 상태가 바뀌지 않는다 — 공개 여부는
 * WordPress 관리자 화면에서 사용자가 직접 확인해야 한다.
 */
export async function updateArticleWordPressDraftContentAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await updateArticleWordPressDraftContent(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * 고급 기능 "원본 article을 WordPress Draft로 전송" 섹션에서 "대표 이미지
 * 없이 진행"을 선택했을 때 실행된다. 사유 코드를 필수로 받고,
 * article.formatMetadata의 article 전용 waiver 키에만 저장한다
 * (lib/publish/article-wordpress-featured-image-waiver-service.ts —
 * wordpress_blog 카드의 waive와는 완전히 별개의 상태다).
 */
export async function waiveArticleWordPressFeaturedImageAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const reasonCode = formData.get("reasonCode");
  const memoRaw = formData.get("memo");
  const memo = typeof memoRaw === "string" && memoRaw.trim() ? memoRaw.trim() : undefined;

  let message: string;
  let isError: boolean;

  try {
    const result = await waiveArticleWordPressFeaturedImage(articleId, reasonCode, memo);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * Phase 2-20: 기사 개요 고급 기능 "원본 article WordPress 전송"의
 * "WordPress 게시 준비 자동 실행" 버튼이 사용하는 action이다.
 * WordPress Metadata/SEO Plugin Metadata(기본 Rank Math)/대표 이미지
 * 준비·생성(또는 자동 waiver)/Quality Gate를 한 번의 클릭으로 순서대로
 * 실행한다. 실제 WordPress 공개 게시는 수행하지 않는다 — WordPress
 * Draft 반영은 여전히 "WordPress Draft에 반영" 버튼(publishToWordPressDraftAction)을
 * 사용자가 직접 눌러야 실행된다.
 */
export async function prepareArticleWordPressPublishingAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const overwrite = formData.get("overwrite") === "true";

  let message: string;
  let isError: boolean;

  try {
    const result = await prepareArticleWordPressPublishing(articleId, { overwrite });
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * Article/Blog 페이지 역할 분리 리팩터링: wordpress_blog social_post를
 * 대상으로 하는 "메인" WordPress 게시 흐름 wrapper action이다.
 *
 * - platform이 wordpress_blog가 아니거나, quality_status/approval_status/
 *   콘텐츠/금지 표현 등 wordpress_blog 자체의 게시 준비 조건
 *   (checkWordPressBlogPublishReadiness)을 만족하지 못하면 실제 WordPress
 *   API를 호출하지 않고 즉시 차단한다.
 * - 준비 조건을 만족하면 기존 publishArticleToWordPressDraft(articleId)를
 *   그대로 재사용한다 — 새로운 실제 WordPress API 호출 코드를 추가하지
 *   않는다. (알려진 한계: 현재 이 경로는 여전히 article 본문을 WordPress로
 *   보낸다 — wordpress_blog social_post의 SEO 최적화 콘텐츠 자체를 실제
 *   payload로 보내는 것은 이번 리팩터링 범위 밖이며, docs에 다음 단계로
 *   기록해 두었다.)
 */
/**
 * wordpress_blog의 WordPress Draft 생성/업데이트가 진행해도 되는지
 * 판단한다. `checkWordPressBlogPublishReadiness` 자체는 바꾸지 않고,
 * 개인정보 false positive override가 적용 가능하면(다른 차단 사유
 * 없음, approval=approved, 실제 위험 없음, 확인 기록/지문 일치) 그
 * 사실을 함께 반환한다 — SEO Metadata 반영(writeWordPressBlogSeoPluginMetadata)과
 * 동일한 조건/판단 함수(checkWordPressBlogPersonalInfoOverrideEligibility)를
 * 재사용한다. 실제 개인정보가 남아 있으면 여전히 차단된다.
 */
async function resolveWordPressBlogDraftReadiness(
  articleId: string,
  socialPostId: string,
  post: SocialPost
): Promise<{ ready: boolean; blockers: string[]; overrideApplied: boolean }> {
  const readiness = checkWordPressBlogPublishReadiness(post);
  if (readiness.ready) {
    return { ready: true, blockers: [], overrideApplied: false };
  }

  await logEvent({
    type: "wordpress_blog_safety_override_requested",
    status: "info",
    message: `wordpress_blog 글(${socialPostId})의 WordPress Draft 생성/업데이트가 차단되어 override 가능 여부를 확인합니다.`,
    articleId,
    targetType: "article",
    targetId: articleId,
    details: { socialPostId, blockers: readiness.blockers },
  });

  const overrideCheck = checkWordPressBlogPersonalInfoOverrideEligibility(post, readiness);
  if (!overrideCheck.eligible) {
    return { ready: false, blockers: readiness.blockers, overrideApplied: false };
  }

  await logEvent({
    type: "wordpress_blog_safety_override_applied",
    status: "info",
    message: `wordpress_blog 글(${socialPostId})의 개인정보 false positive 확인을 근거로 WordPress Draft 생성/업데이트 차단을 override합니다.`,
    articleId,
    targetType: "article",
    targetId: articleId,
    details: { socialPostId },
  });

  return { ready: true, blockers: readiness.blockers, overrideApplied: true };
}

export async function createWordPressDraftFromBlogPostAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const returnToRaw = formData.get("returnTo");
  const returnTo = getSafeReturnTo(typeof returnToRaw === "string" ? returnToRaw : null, `/articles/${articleId}/blog`);

  let message: string;
  let isError: boolean;

  try {
    const post = await getSocialPostById(socialPostId);
    if (!post) {
      throw new Error(`블로그 글을 찾을 수 없습니다: ${socialPostId}`);
    }
    if (post.platform !== "wordpress_blog") {
      throw new Error(`이 기능은 wordpress_blog 글에서만 사용할 수 있습니다 (현재 platform: ${post.platform}).`);
    }

    const effectiveReadiness = await resolveWordPressBlogDraftReadiness(articleId, socialPostId, post);
    if (!effectiveReadiness.ready) {
      await logEvent({
        type: "blog_post_wordpress_draft_blocked",
        status: "failed",
        message: `wordpress_blog 글(${socialPostId})이 WordPress 게시 준비 조건을 만족하지 못해 차단되었습니다.`,
        details: { socialPostId, blockerCount: effectiveReadiness.blockers.length },
        articleId,
        targetType: "article",
        targetId: articleId,
      });
      throw new Error(`WordPress 게시 준비가 되지 않았습니다: ${effectiveReadiness.blockers.join(" / ")}`);
    }

    await logEvent({
      type: "blog_post_wordpress_draft_requested",
      status: "info",
      message: `wordpress_blog 글(${socialPostId})을 기준으로 WordPress Draft 생성을 요청합니다.`,
      details: { socialPostId },
      articleId,
      targetType: "article",
      targetId: articleId,
    });

    const result = await publishArticleToWordPressDraft(articleId, {
      contentOverride: buildWordPressBlogContentOverride(post),
    });
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}/blog`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}${query}`);
}

/**
 * wordpress_blog social_post를 대상으로 하는 게시 준비 action들
 * (Draft 생성/업데이트, SEO metadata 업데이트, featured image 연결,
 * publish guard, 일괄 실행)이 공통으로 쓰는 헬퍼: post를 조회하고
 * platform=wordpress_blog인지 확인한다. 실제 동작은 각 caller가
 * 콜백으로 넘긴다.
 */
async function withWordPressBlogPost<T>(
  socialPostId: string,
  run: (post: SocialPost) => Promise<T>
): Promise<T> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    throw new Error(`블로그 글을 찾을 수 없습니다: ${socialPostId}`);
  }
  if (post.platform !== "wordpress_blog") {
    throw new Error(`이 기능은 wordpress_blog 글에서만 사용할 수 있습니다 (현재 platform: ${post.platform}).`);
  }
  return run(post);
}

// buildWordPressBlogContentOverride는 lib/social/wordpress-blog-content-override-builder.ts로
// 옮겼다 — 오케스트레이터(wordpress-blog-publish-preparation-orchestrator.ts)와
// 로직을 공유해서, 두 곳이 서로 다르게 동작하는 일(예: 한쪽만 markdown→HTML
// 변환을 잊는 것)을 막기 위해서다.

/**
 * "WordPress Draft 업데이트" — 이미 생성된 WordPress draft가 있는 경우에만
 * 의미가 있다. 실제 update(PATCH) API는 이 프로젝트에 아직 구현되어 있지
 * 않으므로(외부 API 로직을 새로 추가하지 않기 위해), 기존
 * publishArticleToWordPressDraft의 force 옵션을 재사용해 draft를
 * 다시 생성한다 — 완전한 "같은 글 수정"은 아니라는 한계를 안내 메시지에
 * 남긴다.
 */
export async function updateWordPressDraftFromBlogPostAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const contentOverride = await withWordPressBlogPost(socialPostId, async (post) => {
      const effectiveReadiness = await resolveWordPressBlogDraftReadiness(articleId, socialPostId, post);
      if (!effectiveReadiness.ready) {
        throw new Error(`WordPress 게시 준비가 되지 않았습니다: ${effectiveReadiness.blockers.join(" / ")}`);
      }
      return buildWordPressBlogContentOverride(post);
    });

    const result = await publishArticleToWordPressDraft(articleId, { force: true, contentOverride });
    message = result.dryRun
      ? result.message
      : `${result.message} (실제 update API가 없어 draft를 다시 생성했습니다.)`;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleBlogUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

/**
 * wordpress_blog 글 기준으로 WordPress SEO metadata(seoTitle/
 * metaDescription 등)를 업데이트한다. article 원문이 아니라 wordpress_blog
 * 글 자체의 SEO 필드를 우선 사용한다 (lib/social/wordpress-blog-seo-metadata-service.ts).
 */
export async function updateWordPressSeoMetadataFromBlogPostAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await updateWordPressSeoMetadataFromBlogPost(articleId, socialPostId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleBlogUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

/**
 * wordpress_blog 글 카드의 "SEO Metadata 재생성" 버튼이 사용한다. post_title/
 * post_body는 다시 쓰지 않고, WordPress 게시용 metadata(seoTitle/
 * metaDescription/targetKeyword 등)만 다시 만든다
 * (lib/social/wordpress-blog-metadata-regeneration-service.ts).
 */
export async function regenerateWordPressBlogMetadataAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await regenerateWordPressBlogMetadata(articleId, socialPostId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleBlogUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

/**
 * wordpress_blog 글 카드의 "SEO Plugin Metadata" 섹션에서 provider를
 * 선택하고 실제 반영을 실행한다. wordpress_blog 자신의 seoTitle/
 * metaDescription/targetKeyword만 사용하며(article fallback 없음),
 * article과 같은 WordPress post를 대상으로 하지만 결과는
 * social_posts.platformMetadata에만 저장한다
 * (lib/social/wordpress-blog-seo-plugin-service.ts).
 */
export async function updateWordPressSeoPluginMetadataFromBlogPostAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const provider = formData.get("seoPluginProvider");

  let message: string;
  let isError: boolean;

  try {
    const result = await writeWordPressBlogSeoPluginMetadata(articleId, socialPostId, provider);
    message = result.message;
    isError = !result.success && !result.skipped;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleBlogUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

/**
 * wordpress_blog 글 카드에서 "차단 사유 상세 보기"/"의심 위치 확인" 버튼을
 * 눌렀을 때 호출한다. 데이터를 변경하지 않고(read-only), 사람이 상세를
 * 확인했다는 사실만 감사 로그(wordpress_blog_safety_review_opened)로
 * 남긴다.
 */
export async function openWordPressBlogSafetyReviewAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await openWordPressBlogSafetyReview(socialPostId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleBlogUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

/**
 * wordpress_blog 글 카드에서 개인정보 의심 항목을 "개인정보 아님"으로
 * 확인 처리한다. 실제 주민등록번호/010 휴대전화로 보이는 항목이 남아
 * 있으면 서비스 단에서 거부한다. 사유(reason)는 필수다.
 */
export async function confirmWordPressBlogPersonalInfoFalsePositiveAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    const result = await confirmWordPressBlogPersonalInfoFalsePositive(socialPostId, {
      reason,
      confirmedBy: APPROVED_BY,
    });
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleBlogUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

/**
 * wordpress_blog 글 카드의 "AI 대표 이미지 생성" 섹션에서 이미지 prompt를
 * 생성한다. wordpress_blog 자신의 title/targetKeyword/answerSummary만
 * 사용하고 article.featuredImagePrompt는 읽지 않는다
 * (lib/social/wordpress-blog-image-generation-service.ts).
 */
export async function generateWordPressBlogFeaturedImagePromptAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await generateWordPressBlogFeaturedImagePrompt(articleId, socialPostId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleBlogUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

/**
 * 준비된 prompt로 AI 대표 이미지를 생성한다. IMAGE_GENERATION_ENABLED=false이면
 * 실제 API를 호출하지 않고 mock/dry-run으로 처리한다. 결과는 article 컬럼이
 * 아니라 social_posts.platformMetadata에만 저장한다.
 */
export async function generateWordPressBlogFeaturedImageAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await generateWordPressBlogFeaturedImage(articleId, socialPostId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleBlogUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

/**
 * wordpress_blog 글 기준으로 대표 이미지를 WordPress draft에 연결한다.
 * media id가 아직 없으면 attachFeaturedMediaToDraft가 "아직 준비되지
 * 않았습니다" 메시지를 그대로 반환한다 — article 페이지로 이동하라고
 * 안내하지 않는다.
 */
/**
 * wordpress_blog 글 카드의 "대표 이미지 준비" 섹션에서 기존 WordPress
 * Media ID를 대표 이미지로 지정한다. 실제 이미지 업로드나 AI 생성은
 * 하지 않으며, 이미 WordPress Media Library에 있는 이미지의 id만
 * 저장한다 (lib/social/wordpress-blog-featured-image-service.ts).
 */
/**
 * wordpress_blog 글 카드의 "내 컴퓨터에서 이미지 업로드" 섹션에서
 * 선택한 로컬 파일을 Supabase Storage → 실제 WordPress Media Library로
 * 이어서 업로드한다 (lib/social/wordpress-blog-local-image-upload-service.ts,
 * 기존 Phase 2-5/2-10/2-19 경로 재사용 — 새 실제 API 호출 코드 없음).
 * alt text/caption 입력은 받지만 이번 단계에서는 저장하지 않는다(추후 지원).
 */
export async function uploadWordPressFeaturedImageFromBlogPostAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const fileRaw = formData.get("file");
  const file = fileRaw instanceof File ? fileRaw : null;

  let message: string;
  let isError: boolean;

  try {
    const result = await uploadWordPressFeaturedImageFromBlogPost(articleId, socialPostId, file);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleBlogUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

export async function saveWordPressFeaturedImageMediaForBlogPostAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const mediaIdRaw = String(formData.get("mediaId") ?? "");
  const mediaUrlRaw = formData.get("mediaUrl");
  const mediaUrl = typeof mediaUrlRaw === "string" && mediaUrlRaw.trim() ? mediaUrlRaw.trim() : undefined;

  let message: string;
  let isError: boolean;

  try {
    const mediaId = Number(mediaIdRaw);
    const result = await saveWordPressFeaturedImageMediaForBlogPost(articleId, socialPostId, mediaId, mediaUrl);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleBlogUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

/**
 * wordpress_blog 글 카드의 "대표 이미지 준비" 섹션에서 "대표 이미지 없이
 * 진행"을 선택했을 때 실행된다. 사유 코드를 필수로 받고, article의 대표
 * 이미지 관련 컬럼은 이미 허용된 'skipped' 상태로 정리하며, 실제 waive
 * 상태(waived/waivedReasonCode/waivedMemo)는 social_posts.platformMetadata
 * 에만 저장한다 (lib/social/wordpress-blog-featured-image-waiver-service.ts —
 * articles.featured_image_upload_status의 CHECK 제약 때문에 'waived' 값을
 * DB 컬럼에 직접 쓸 수 없다).
 */
export async function waiveWordPressFeaturedImageForBlogPostAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const reasonCode = formData.get("reasonCode");
  const memoRaw = formData.get("memo");
  const memo = typeof memoRaw === "string" && memoRaw.trim() ? memoRaw.trim() : undefined;

  let message: string;
  let isError: boolean;

  try {
    const result = await waiveWordPressFeaturedImageForBlogPost(articleId, socialPostId, reasonCode, memo);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleBlogUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

export async function attachWordPressFeaturedImageFromBlogPostAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    await withWordPressBlogPost(socialPostId, async (post) => {
      const readiness = checkWordPressBlogPublishReadiness(post);
      if (!readiness.ready) {
        throw new Error(`WordPress 게시 준비가 되지 않았습니다: ${readiness.blockers.join(" / ")}`);
      }
    });

    const result = await attachFeaturedMediaToDraft(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleBlogUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

/**
 * wordpress_blog 글의 WordPress 게시 준비 단계(draft 생성/업데이트 →
 * SEO metadata 업데이트 → featured image 연결 → publish guard)를 한
 * 버튼으로 순서대로 실행한다. 실제 공개(public) 게시는 어떤 단계에서도
 * 수행하지 않는다. 한 단계라도 실패하면 그 단계에서 멈추고, 어느
 * 단계까지 진행됐는지를 메시지에 담는다.
 */
export async function prepareWordPressBlogPostForPublishingAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await prepareWordPressBlogPostForPublishing(articleId, socialPostId);
    const stepSummary = result.steps.map((s) => `${s.step}:${s.status}`).join(", ");
    message = `${result.message} (${stepSummary})`;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleBlogUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

/**
 * WordPress 실제 연결을 테스트한다 (Phase 2-8). 특정 기사와 무관한 사이트 단위
 * 점검이지만, article 상세 페이지에서 결과를 확인할 수 있도록 이 화면으로
 * 돌아온다. Application Password/Authorization header는 절대 반환/표시하지 않는다.
 */
export async function testWordPressConnectionAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await runWordPressConnectionTest();
    isError = !result.connected;
    if (result.connected) {
      message = `WordPress 연결 성공 (${result.username ?? "알 수 없음"}${result.displayName ? `, ${result.displayName}` : ""})`;
    } else {
      const causes = result.likelyCauses && result.likelyCauses.length > 0 ? ` — 원인 후보: ${result.likelyCauses.join(" / ")}` : "";
      message = `${result.errorMessage ?? "WordPress 연결에 실패했습니다."}${causes}`;
    }
    if (result.warnings && result.warnings.length > 0) {
      message = `${message} (${result.warnings.join(" ")})`;
    }
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * article_mode/키워드/제목/본문 기반 규칙으로 WordPress metadata(카테고리/태그/SEO)를
 * 생성한다 (Phase 2-3). reviewed 여부와 무관하게 항상 호출 가능하다. 실제 WordPress
 * API를 호출하지 않으므로 WORDPRESS_PUBLISH_ENABLED 값과 무관하게 동작한다.
 */
export async function generateWordPressMetadataAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await generateWordPressMetadata(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/** WordPress metadata를 사람이 검토 완료했음을 표시한다 (wp_metadata_status='reviewed'). */
export async function reviewWordPressMetadataAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await reviewWordPressMetadata(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * article_mode/키워드/제목/본문 기반 규칙으로 SEO plugin(none/yoast/rank_math/aioseo)
 * metadata payload를 생성한다 (Phase 2-4). reviewed 여부와 무관하게 항상 호출 가능하다.
 * 실제 plugin write는 하지 않으므로 SEO_PLUGIN_WRITE_ENABLED 값과 무관하게 동작한다.
 */
export async function generateSeoPluginMetadataAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const providerRaw = formData.get("provider");
  const providerOverride = isSeoPluginProvider(providerRaw) ? providerRaw : undefined;

  let message: string;
  let isError: boolean;

  try {
    const result = await generateSeoPluginPayload(articleId, providerOverride);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/** SEO plugin metadata를 사람이 검토 완료했음을 표시한다 (seo_plugin_metadata_status='reviewed'). */
export async function reviewSeoPluginMetadataAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await reviewSeoPluginMetadata(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * article_mode/제목/키워드 기반 규칙으로 대표 이미지(featured image) 준비 정보
 * (prompt/alt text/caption/style)를 생성한다 (Phase 2-5). reviewed 여부와
 * 무관하게 항상 호출 가능하다. 실제 이미지 생성 API나 WordPress media upload는
 * 호출하지 않는다.
 */
export async function prepareFeaturedImageAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await prepareFeaturedImage(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/** 대표 이미지 준비 정보를 사람이 검토 완료했음을 표시한다 (featured_image_status='reviewed'). */
export async function reviewFeaturedImageAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await reviewFeaturedImage(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * 인터넷 이미지 URL을 대표 이미지 source로 저장한다 (Featured Image
 * Workflow Step 1: Source Setup). AI 이미지 생성 actual integration을
 * 연결하기 전까지의 임시 운영 방식이며, 사용 권한이 있는 이미지인지는
 * 사용자가 직접 확인해야 한다.
 */
export async function saveExternalImageUrlSourceAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const url = String(formData.get("imageUrl") ?? "");
  const filename = String(formData.get("filename") ?? "").trim();
  const mimeType = String(formData.get("mimeType") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    const result = await saveExternalImageUrl(articleId, {
      url,
      filename: filename.length > 0 ? filename : undefined,
      mimeType: mimeType.length > 0 ? mimeType : undefined,
    });
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * 로컬 컴퓨터에서 업로드한 이미지 파일을 서버에 저장하고 대표 이미지
 * source로 등록한다 (Featured Image Workflow Step 1: Source Setup).
 * image binary는 DB/로그에 저장하지 않는다.
 */
export async function saveLocalFeaturedImageAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const file = formData.get("imageFile");

  let message: string;
  let isError: boolean;

  try {
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("업로드할 이미지 파일을 선택하세요.");
    }

    const result = await saveLocalImageUpload(articleId, file);
    message = result.message;
    isError = !result.success;
    if (!isError) {
      // 실제로 대표 이미지가 새로 준비되었으므로 "이미지 없이 진행" 선택을 해제한다.
      await clearArticleWordPressFeaturedImageWaiver(articleId);
    }
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * 이미 WordPress Media Library에 있는 media id를 대표 이미지로 직접
 * 지정한다 (Featured Image Workflow Step 1: Source Setup). 이 경우
 * WordPress media upload를 다시 수행하지 않는다.
 */
export async function saveExistingWordPressMediaSourceAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const mediaIdRaw = String(formData.get("mediaId") ?? "");
  const mediaUrl = String(formData.get("mediaUrl") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    const mediaId = Number(mediaIdRaw);
    const result = await saveExistingWordPressMedia(articleId, {
      mediaId,
      mediaUrl: mediaUrl.length > 0 ? mediaUrl : undefined,
    });
    message = result.message;
    isError = !result.success;
    if (!isError) {
      // 실제로 대표 이미지가 새로 준비되었으므로 "이미지 없이 진행" 선택을 해제한다.
      await clearArticleWordPressFeaturedImageWaiver(articleId);
    }
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * Phase 2-5에서 준비한 featured image metadata(prompt/alt text/caption/style)를
 * 바탕으로 WordPress media upload payload를 준비한다 (Phase 2-6). 실제 이미지
 * 생성이나 WordPress media upload는 하지 않는다.
 */
export async function prepareWordPressMediaUploadAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await prepareWordPressMediaUpload(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * 준비된 WordPress media upload payload로 dry-run 확인을 수행한다 (Phase 2-6).
 * WORDPRESS_MEDIA_UPLOAD_ENABLED=false이면 실제 업로드를 시도하지 않는다.
 */
export async function confirmWordPressMediaUploadDryRunAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await confirmWordPressMediaUploadDryRun(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * 실제 WordPress Media Library에 featured image를 업로드한다 (Phase 2-10).
 * WORDPRESS_MEDIA_UPLOAD_ENABLED=false이면 실제 업로드를 시도하지 않고 skipped로
 * 처리한다. Application Password/Authorization header는 절대 반환/표시하지 않는다.
 */
export async function uploadFeaturedImageToWordPressAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await uploadFeaturedImageToWordPress(articleId);
    message = result.message;
    isError = !result.success;
    if (!isError && result.wordpressMediaId) {
      // 실제로 대표 이미지가 새로 준비되었으므로 "이미지 없이 진행" 선택을 해제한다.
      await clearArticleWordPressFeaturedImageWaiver(articleId);
    }
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * WordPress 이미지 업로드 상태를 다시 확인한다 (Phase 2-10). 별도의 API 호출
 * 없이 현재 페이지를 새로고침해 최신 업로드 상태(article 테이블)를 보여준다.
 */
export async function checkWordPressMediaUploadStatusAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  revalidatePath(`/articles/${articleId}`);
  redirect(`/articles/${articleId}`);
}

/**
 * 업로드된 WordPress media id를 기존 WordPress draft post의 featured_media로
 * 연결한다 (Phase 2-11). media id가 없거나 기존 draft가 없으면 안전하게
 * 실패 메시지를 반환한다. 공개 게시는 수행하지 않으며 post status는 항상
 * draft로 유지된다.
 */
export async function attachFeaturedMediaToDraftAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await attachFeaturedMediaToDraft(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * WordPress featured_media 연결 상태를 다시 확인한다 (Phase 2-11). 별도의 API
 * 호출 없이 현재 페이지를 새로고침해 최신 상태(article 테이블)를 보여준다.
 */
export async function checkWordPressFeaturedMediaAttachStatusAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  revalidatePath(`/articles/${articleId}`);
  redirect(`/articles/${articleId}`);
}

/**
 * SEO plugin metadata를 실제 WordPress draft post에 반영하는 테스트를 한다
 * (Phase 2-12). SEO_PLUGIN_PROVIDER=none이거나 SEO_PLUGIN_WRITE_ENABLED=false
 * 이면 실제 API를 호출하지 않고 안전하게 skip한다. 공개 게시는 수행하지
 * 않으며 post status는 항상 draft로 유지된다.
 */
export async function writeSeoPluginMetadataToWordPressAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await writeSeoPluginMetadataToWordPress(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * SEO plugin 실제 write 반영 상태를 다시 확인한다 (Phase 2-12). 별도의 API
 * 호출 없이 현재 페이지를 새로고침해 최신 상태(article 테이블)를 보여준다.
 */
export async function checkSeoPluginActualWriteStatusAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  revalidatePath(`/articles/${articleId}`);
  redirect(`/articles/${articleId}`);
}

/**
 * Rank Math SEO metadata를 WordPress custom REST endpoint(ai-pipeline/v1/
 * seo-meta)를 통해 update_post_meta로 직접 반영한다 (Phase 2-13). provider가
 * rank_math가 아니거나 custom endpoint가 비활성화되어 있거나 WordPress
 * draft post가 없으면 실제 API를 호출하지 않고 안전하게 skip한다. 실패해도
 * 표준 REST 방식으로 fallback하지 않는다.
 */
export async function writeRankMathSeoViaCustomEndpointAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await writeRankMathSeoViaCustomEndpoint(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * WordPress draft post/featured media/Rank Math SEO metadata/category·tag/
 * source citation/AD_SLOT marker가 정상 반영되었는지 checklist로 점검한다
 * (Phase 2-14). 실제 WordPress API를 다시 호출하지 않고 이미 저장된 상태를
 * 재집계하며, 공개(publish)는 절대 수행하지 않는다.
 */
export async function reviewWordPressFinalDraftAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await reviewWordPressFinalDraft(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * WordPress final draft review 상태를 다시 확인한다 (Phase 2-14). 별도의 API
 * 호출 없이 현재 페이지를 새로고침해 최신 상태(article 테이블)를 보여준다.
 */
export async function checkWordPressFinalDraftReviewStatusAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  revalidatePath(`/articles/${articleId}`);
  redirect(`/articles/${articleId}`);
}

/**
 * Publish Quality Gate를 실행한다 (Phase 2-15). 실제 공개(publish)는 어떤
 * 경우에도 수행하지 않으며, 검증 결과(articles.publish_quality_gate_*)만 저장한다.
 */
export async function runPublishQualityGateAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await runPublishQualityGate(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * Publish Quality Gate 결과를 다시 확인한다 (Phase 2-15). 별도의 API 호출 없이
 * 현재 페이지를 새로고침해 최신 상태(article 테이블)를 보여준다.
 */
export async function checkPublishQualityGateStatusAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  revalidatePath(`/articles/${articleId}`);
  redirect(`/articles/${articleId}`);
}

/**
 * WordPress public publish 승인을 시도한다 (Phase 2-16). 실제 공개(publish)는
 * 어떤 경우에도 수행하지 않으며, 승인 상태(articles.public_publish_approval_*)만
 * 저장한다.
 */
export async function approvePublicPublishAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    const result = await approvePublicPublish(articleId, APPROVED_BY, notes.length > 0 ? notes : undefined);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * WordPress public publish 승인을 취소한다 (Phase 2-16). 실제 공개(publish)는
 * 어떤 경우에도 수행하지 않는다.
 */
export async function revokePublicPublishApprovalAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    const result = await revokePublicPublishApproval(articleId, APPROVED_BY, reason.length > 0 ? reason : undefined);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * public publish 승인 상태를 다시 확인한다 (Phase 2-16). 별도의 API 호출 없이
 * 현재 페이지를 새로고침해 최신 상태(article 테이블)를 보여준다.
 */
export async function checkPublicPublishApprovalStatusAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  revalidatePath(`/articles/${articleId}`);
  redirect(`/articles/${articleId}`);
}

/**
 * 승인된 article 1개를 WordPress에 실제 공개(publish)한다 (Phase 2-17).
 * Publish Quality Gate/Human Approval을 모두 통과하고 WordPress draft post가
 * 존재하는 경우에만 실행되며, guard를 통과하지 못하면 WordPress API를 호출
 * 하지 않는다. 여러 article을 한 번에 처리하지 않고 항상 article 1개만
 * 처리한다.
 */
export async function publishApprovedArticleToWordPressAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await publishApprovedArticleToWordPress(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * WordPress public publish 상태를 다시 확인한다 (Phase 2-17). 별도의 API
 * 호출 없이 현재 페이지를 새로고침해 최신 상태(article 테이블)를 보여준다.
 */
export async function checkPublicPublishStatusAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  revalidatePath(`/articles/${articleId}`);
  redirect(`/articles/${articleId}`);
}

/**
 * Phase 2-5에서 준비한 featured image prompt/alt text/caption/style을 바탕으로
 * 실제 또는 mock 이미지를 생성한다 (Phase 2-7). provider가 실패해도 Runtime
 * Error로 터지지 않고 사용자 메시지로 반환된다.
 */
export async function generateFeaturedImageAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await generateFeaturedImage(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/** 생성된 이미지를 사람이 검토 완료했음을 표시한다 (generated_image_status='reviewed'). */
export async function reviewGeneratedImageAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await reviewGeneratedImage(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/** draft 상태 기사를 사용자 승인을 거쳐 reviewed로 전환한다 (FR-9). */
export async function approveArticleAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  try {
    const article = await approveArticle({ articleId, approvedBy: APPROVED_BY });

    await logEvent({
      type: "article_approved",
      status: "success",
      message: `기사(${article.id})를 승인했습니다 (status: ${article.status}).`,
      themeId: article.themeId,
      articleId: article.id,
      targetType: "article",
      targetId: article.id,
    });
  } catch (error) {
    const message = toUserMessage(error);

    await logEvent({
      type: "article_approved",
      status: "failed",
      message,
      articleId,
      targetType: "article",
      targetId: articleId,
    });

    redirect(`/articles/${articleId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/articles/${articleId}`);
  revalidatePath("/articles");
  redirect(`/articles/${articleId}`);
}

/**
 * Multi-platform Writing (Phase 3-1): 실제 AI 생성 전 구조 테스트를 위한
 * placeholder social post draft를 생성한다. 실제 AI 글쓰기나 실제 플랫폼
 * 게시는 이 단계에서 수행하지 않는다.
 */
export async function generatePlaceholderSocialPostAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const platformRaw = String(formData.get("platform") ?? "");
  const toneStyleRaw = String(formData.get("toneStyle") ?? "");

  let message: string;
  let isError: boolean;
  let createdSocialPost: SocialPost | undefined;

  try {
    if (!isSocialPlatform(platformRaw)) {
      throw new Error(`지원하지 않는 platform입니다: ${platformRaw}`);
    }
    if (!isToneStyle(toneStyleRaw)) {
      throw new Error(`지원하지 않는 tone_style입니다: ${toneStyleRaw}`);
    }

    const result = await generatePlaceholderDraft(articleId, platformRaw, toneStyleRaw);
    message = result.message;
    isError = !result.success;
    createdSocialPost = result.socialPost;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  // Phase 3-17: 생성된 social post의 platform에 맞는 deep link(하이라이트 포함)로 돌아간다.
  redirectToSafeTarget(formData, socialPostFallbackUrl(articleId, createdSocialPost, platformRaw), message, isError);
}

/**
 * Prompt/Context/Contract 구조(Phase 3-2)를 실제로 엮어 social post draft를
 * 생성한다. SOCIAL_AI_GENERATION_ENABLED=false(기본값)이면 mock 생성으로
 * 동작하며, 실제 플랫폼 게시는 수행하지 않는다.
 */
export async function generateSocialDraftAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const platformRaw = String(formData.get("platform") ?? "");
  const toneStyleRaw = String(formData.get("toneStyle") ?? "");

  let message: string;
  let isError: boolean;
  let createdSocialPost: SocialPost | undefined;

  try {
    if (!isSocialPlatform(platformRaw)) {
      throw new Error(`지원하지 않는 platform입니다: ${platformRaw}`);
    }
    if (!isToneStyle(toneStyleRaw)) {
      throw new Error(`지원하지 않는 tone_style입니다: ${toneStyleRaw}`);
    }

    const result = await generateSocialDraft(articleId, platformRaw, toneStyleRaw);
    message = result.message;
    isError = !result.success;
    createdSocialPost = result.socialPost;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  // Phase 3-17: 생성된 social post의 platform에 맞는 deep link(하이라이트 포함)로 돌아간다.
  redirectToSafeTarget(formData, socialPostFallbackUrl(articleId, createdSocialPost, platformRaw), message, isError);
}

/** PlatformGenerationSummary를 사람이 읽는 한 줄 요약으로 바꾼다("무반응 금지" 원칙 — 항상 결과를 보여준다). */
function formatPlatformGenerationSummary(summary: PlatformGenerationSummary): string {
  const parts = summary.results.map((r) => {
    const label =
      r.status === "generated" ? "생성 완료" : r.status === "skipped_existing" ? "이미 생성됨 — 건너뜀" : `생성 실패 — ${r.message}`;
    return `${r.platform}: ${label}`;
  });
  return `플랫폼별 글 생성 결과 — ${parts.join(" / ")}`;
}

function parseSelectedPlatforms(formData: FormData): SocialPlatform[] {
  return formData
    .getAll("platforms")
    .map((value) => String(value))
    .filter(isSocialPlatform);
}

function parseToneSelectionInputs(formData: FormData): {
  toneMode: ToneSelectionMode;
  uniformToneStyle?: ToneStyle;
  toneStylesByPlatform?: Partial<Record<SocialPlatform, ToneStyle>>;
} {
  const toneModeRaw = formData.get("toneMode");
  const toneMode: ToneSelectionMode = isToneSelectionMode(toneModeRaw) ? toneModeRaw : "auto_recommended";

  const uniformToneStyleRaw = formData.get("uniformToneStyle");
  const uniformToneStyle = isToneStyle(uniformToneStyleRaw) ? uniformToneStyleRaw : undefined;

  const toneStylesByPlatform: Partial<Record<SocialPlatform, ToneStyle>> = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const value = formData.get(`toneStyle_${platform}`);
    if (isToneStyle(value)) toneStylesByPlatform[platform] = value;
  }

  return { toneMode, uniformToneStyle, toneStylesByPlatform };
}

/**
 * Phase 3-21: 사용자가 체크박스로 선택한 플랫폼만 글을 생성한다("선택한
 * 플랫폼 글 생성" 메인 버튼). article context(원본 article)는 이미
 * 존재한다고 가정한다 — article이 아직 없으면(draft 미생성) 이 action
 * 이전에 "출처 기반 원고 context 준비" 단계(기존 기사 초안 생성)를 먼저
 * 완료해야 한다는 안내를 반환한다. 이미 생성된 플랫폼은 조용히
 * 덮어쓰지 않고 건너뛴다. 실제 WordPress 공개 게시는 호출하지 않는다.
 */
export async function generateSelectedPlatformPostsAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const platforms = parseSelectedPlatforms(formData);
  const { toneMode, uniformToneStyle, toneStylesByPlatform } = parseToneSelectionInputs(formData);

  let message: string;
  let isError: boolean;

  try {
    const result = await generateSelectedPlatformPosts({
      articleId,
      platforms,
      toneMode,
      uniformToneStyle,
      toneStylesByPlatform,
    });
    if ("error" in result) {
      message = result.error;
      isError = true;
    } else {
      message = formatPlatformGenerationSummary(result);
      isError = result.generatedCount === 0 && result.failedCount > 0;
    }
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleOverviewUrl(articleId), message, isError);
}

/**
 * Phase 3-21: 전체 플랫폼(wordpress_blog/naver_blog/naver_cafe/x/threads/
 * instagram) 글을 한 번에 생성한다. 이 action은 고급 옵션이며, 반드시
 * 화면의 확인 모달(비용 경고)을 거친 뒤에만 호출되어야 한다 —
 * `confirmed=true`가 없으면 실행하지 않고 안내만 반환한다. 이미 생성된
 * 플랫폼은 기본적으로 건너뛴다. 실제 WordPress 공개 게시는 호출하지 않는다.
 */
export async function generateAllPlatformPostsAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const confirmed = formData.get("confirmed") === "true";
  const { toneMode, uniformToneStyle, toneStylesByPlatform } = parseToneSelectionInputs(formData);

  let message: string;
  let isError: boolean;

  if (!confirmed) {
    message = "전체 플랫폼 글 생성은 비용 경고 확인 후에만 실행됩니다. 확인 모달에서 '전체 생성'을 눌러주세요.";
    isError = true;
    revalidateArticleWorkflowPaths(articleId);
    redirectToSafeTarget(formData, buildArticleOverviewUrl(articleId), message, isError);
  }

  try {
    const result = await generateAllPlatformPosts({ articleId, toneMode, uniformToneStyle, toneStylesByPlatform });
    message = formatPlatformGenerationSummary(result);
    isError = result.generatedCount === 0 && result.failedCount > 0;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleOverviewUrl(articleId), message, isError);
}

/** Multi-platform Writing 목록을 새로고침한다 (별도 API 호출 없이 페이지만 다시 렌더링). */
export async function refreshSocialPostsAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  revalidatePath(`/articles/${articleId}`);
  redirect(`/articles/${articleId}`);
}

/**
 * wordpress_blog/naver_blog 등 social post 목록에서 "삭제" 버튼을 누르면
 * 실행된다. hard delete가 아니라 soft delete(archived_at = now())만
 * 수행한다 — 앱 내부의 생성 글/상태만 삭제·숨김 처리되고, 이미 WordPress에
 * 생성된 Draft/Post는 이 action이 절대 건드리지 않는다(원격 삭제 기능
 * 자체를 만들지 않았다). 확인 모달은 화면(ConfirmSubmitButton)에서
 * 처리하므로 여기서는 실행만 담당한다.
 */
export async function archiveSocialPostAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  const post = await getSocialPostById(socialPostId);
  if (!post) {
    redirect(buildArticleOverviewUrl(articleId));
  }

  const fallbackUrl = getPlatformGroup(post.platform) === "blog" ? buildArticleBlogUrl(articleId) : buildArticleSocialUrl(articleId);

  if (post.archivedAt) {
    await logEvent({
      type: "social_post_delete_blocked",
      status: "failed",
      message: `social post(${socialPostId})는 이미 삭제(보관 처리)되어 있습니다.`,
      details: { socialPostId, platform: post.platform },
      articleId,
      targetType: "article",
      targetId: articleId,
    });
    redirectToSafeTarget(formData, fallbackUrl, "이미 삭제된 글입니다.", true);
  }

  await archiveSocialPost(socialPostId);

  await logEvent({
    type: "social_post_archived",
    status: "success",
    message: `social post(${socialPostId})가 삭제(보관 처리)되었습니다 (platform: ${post.platform}).`,
    details: {
      socialPostId,
      platform: post.platform,
      hasWordPressPost: Boolean(post.externalPostId),
    },
    articleId,
    targetType: "article",
    targetId: articleId,
  });

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, fallbackUrl, "글을 삭제했습니다.", false);
}

/** social post 하나에 대해 rule-based quality gate를 실행한다. */
export async function runSocialPostQualityGateAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;
  let socialPost: SocialPost | undefined;

  try {
    const result = await rerunSocialPostQualityGate(socialPostId);
    message = result.message;
    isError = !result.success;
    socialPost = result.socialPost;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  redirectToSafeTarget(formData, socialPostFallbackUrl(articleId, socialPost), message, isError);
}

/**
 * social post의 콘텐츠(제목/본문/캡션/해시태그/thread/card 등)를 수정한다 (Phase 3-4).
 * Phase 3-26: `/social-posts/[id]`의 "수정하기" 탭에서도 이 action을 그대로
 * 재사용할 수 있도록 returnTo를 지원하도록 바꿨다(redirectToSafeTarget).
 */
export async function editSocialPostAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;
  let socialPost: SocialPost | undefined;

  try {
    const postTitle = formData.get("postTitle");
    const postBody = formData.get("postBody");
    const caption = formData.get("caption");
    const excerpt = formData.get("excerpt");
    const hashtagsRaw = formData.get("hashtags");
    const threadItemsRaw = formData.get("threadItems");
    const cardItemsRaw = formData.get("cardItems");
    const reviewNotes = formData.get("reviewNotes");

    const hashtags =
      typeof hashtagsRaw === "string"
        ? hashtagsRaw
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0)
        : undefined;

    let threadItems: ThreadItem[] | undefined;
    if (typeof threadItemsRaw === "string" && threadItemsRaw.trim().length > 0) {
      const parsed: unknown = JSON.parse(threadItemsRaw);
      if (!Array.isArray(parsed)) throw new Error("thread_items는 배열이어야 합니다.");
      threadItems = parsed.map((item, index) => ({
        order: typeof (item as { order?: unknown }).order === "number" ? (item as { order: number }).order : index + 1,
        text: String((item as { text?: unknown }).text ?? ""),
      }));
    }

    let cardItems: CardItem[] | undefined;
    if (typeof cardItemsRaw === "string" && cardItemsRaw.trim().length > 0) {
      const parsed: unknown = JSON.parse(cardItemsRaw);
      if (!Array.isArray(parsed)) throw new Error("card_items는 배열이어야 합니다.");
      cardItems = parsed.map((item, index) => ({
        order: typeof (item as { order?: unknown }).order === "number" ? (item as { order: number }).order : index + 1,
        heading: String((item as { heading?: unknown }).heading ?? ""),
        body: String((item as { body?: unknown }).body ?? ""),
      }));
    }

    const result = await editSocialPostContent(socialPostId, {
      postTitle: typeof postTitle === "string" ? postTitle : undefined,
      postBody: typeof postBody === "string" ? postBody : undefined,
      caption: typeof caption === "string" ? caption : undefined,
      excerpt: typeof excerpt === "string" ? excerpt : undefined,
      hashtags,
      threadItems,
      cardItems,
      reviewNotes: typeof reviewNotes === "string" ? reviewNotes : undefined,
      editedBy: APPROVED_BY,
    });
    message = result.message;
    isError = !result.success;
    socialPost = result.socialPost;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  revalidatePath(`/social-posts/${socialPostId}`);

  redirectToSafeTarget(formData, socialPostFallbackUrl(articleId, socialPost), message, isError);
}

/** social post의 승인을 요청한다 (approval_status='pending_review'). */
export async function requestSocialPostApprovalAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  let message: string;
  let isError: boolean;
  let socialPost: SocialPost | undefined;

  try {
    const result = await requestSocialPostApprovalService(socialPostId, notes.length > 0 ? notes : undefined);
    message = result.message;
    isError = !result.success;
    socialPost = result.socialPost;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  redirectToSafeTarget(formData, socialPostFallbackUrl(articleId, socialPost), message, isError);
}

/**
 * social post를 승인한다. quality_status가 'ready'가 아니거나, publish_status가
 * blocked/published이거나, 이미 승인된 경우 차단된다.
 */
export async function approveSocialPostAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  let message: string;
  let isError: boolean;
  let socialPost: SocialPost | undefined;

  try {
    const result = await approveSocialPostService(socialPostId, APPROVED_BY, notes.length > 0 ? notes : undefined);
    message = result.message;
    isError = !result.success;
    socialPost = result.socialPost;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  redirectToSafeTarget(formData, socialPostFallbackUrl(articleId, socialPost), message, isError);
}

/** social post를 반려한다 (반려 사유 필수). */
export async function rejectSocialPostAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    if (reason.length === 0) {
      throw new Error("반려 사유를 입력하세요.");
    }
    const result = await rejectSocialPostService(socialPostId, APPROVED_BY, reason);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/** social post의 승인을 취소한다 (승인된 post만 대상, 사유 필수). */
export async function revokeSocialPostApprovalAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    if (reason.length === 0) {
      throw new Error("승인 취소 사유를 입력하세요.");
    }
    const result = await revokeSocialPostApprovalService(socialPostId, APPROVED_BY, reason);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * 승인된 social post를 플랫폼별 manual export payload로 변환한다.
 * 실제 외부 플랫폼 게시 API는 호출하지 않는다.
 */
export async function exportSocialPostAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await exportSocialPostDraft(socialPostId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * social post의 manual export(Phase 3-5)를 생성한다. quality_status='ready'
 * 이고 approval_status='approved'인 경우에만 성공하며, 실제 외부 플랫폼
 * 게시 API는 호출하지 않는다.
 */
export async function generateManualExportAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;
  let socialPost: SocialPost | undefined;

  try {
    const result = await generateManualExport(socialPostId, APPROVED_BY);
    message = result.message;
    isError = !result.success;
    socialPost = result.socialPost;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  redirectToSafeTarget(formData, socialPostFallbackUrl(articleId, socialPost), message, isError);
}

/**
 * social post의 export 결과가 복사되었음을 기록한다 (export_copy_count
 * 증가). 복사한 텍스트 전문은 저장하지 않는다.
 */
export async function recordSocialPostCopiedAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const copyTarget = String(formData.get("copyTarget") ?? "all");

  let message: string;
  let isError: boolean;

  try {
    const result = await recordSocialPostCopied(socialPostId, APPROVED_BY, copyTarget);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * social post의 플랫폼별 게시 가능 조건(publishing guard)을 검사한다
 * (Phase 3-6). 실제 외부 플랫폼 게시 API는 호출하지 않으며, 통과해도
 * publish_status는 바뀌지 않는다.
 */
export async function runPlatformPublishingGuardAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await runPlatformPublishingGuard(socialPostId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  // Phase 3-17: 이 action은 /social 페이지에서만 사용되므로 social 페이지의 해당 카드로 돌아간다.
  redirectToSafeTarget(formData, buildArticleSocialUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

/**
 * social post의 플랫폼별 게시 직전 dry-run payload를 생성한다 (Phase 3-7).
 * platform_publish_ready=true이고 platform_publish_guard_status='ready'인
 * 경우에만 성공하며, 실제 외부 플랫폼 게시 API는 호출하지 않는다.
 */
export async function createPlatformPublishDryRunAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await createPlatformPublishDryRun(socialPostId, APPROVED_BY);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  // Phase 3-17: 이 action은 /social 페이지에서만 사용되므로 social 페이지의 해당 카드로 돌아간다.
  redirectToSafeTarget(formData, buildArticleSocialUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

/**
 * social post의 export handoff를 완료 처리한다 (Phase 3-7). 사람이
 * dry-run 결과를 최종 확인하고 수동 게시할 준비를 마쳤다는 뜻일 뿐,
 * 실제 외부 게시 완료가 아니며 publish_status를 바꾸지 않는다.
 */
export async function completePlatformExportHandoffAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    const result = await completePlatformExportHandoff(socialPostId, APPROVED_BY, notes.length > 0 ? notes : undefined);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  // Phase 3-17: 이 action은 /social 페이지에서만 사용되므로 social 페이지의 해당 카드로 돌아간다.
  redirectToSafeTarget(formData, buildArticleSocialUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

/** social post의 수동 게시 체크리스트를 준비한다 (Phase 3-8). handoff_status='completed'가 아니면 차단된다. */
export async function prepareManualPostingRecordAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;
  let socialPost: SocialPost | undefined;

  try {
    const result = await prepareManualPostingRecord(socialPostId);
    message = result.message;
    isError = !result.success;
    socialPost = result.socialPost;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  redirectToSafeTarget(formData, socialPostFallbackUrl(articleId, socialPost), message, isError);
}

/**
 * wordpress_blog 카드 Step 7 체크리스트 중 "사람이 직접 확인해야 하는"
 * 항목(needs_review) 하나를 "확인 완료"로 표시한다 (Phase 3-19). 실제
 * 게시나 quality/approval/handoff 등 DB 상태는 전혀 바꾸지 않으며,
 * social_posts.platformMetadata.manualChecklistConfirmations(JSON)에만
 * 기록한다 — DB schema 변경 없음.
 */
export async function markManualChecklistItemConfirmedAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const checklistItemKey = String(formData.get("checklistItemKey") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await markManualChecklistItemConfirmed(articleId, socialPostId, checklistItemKey, APPROVED_BY);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleBlogUrl(articleId, { socialPostId, highlight: socialPostId }), message, isError);
}

/**
 * 사람이 실제로 플랫폼에 게시한 결과를 기록한다 (Phase 3-8). 실제 외부
 * 플랫폼 게시 API는 호출하지 않으며, 이 액션은 수동 게시 결과를 기록할
 * 뿐이다. 성공 시 publish_status='published'로 전환된다.
 */
export async function recordManualPostingResultAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const manualPostUrl = String(formData.get("manualPostUrl") ?? "").trim();
  const manualPostedAtRaw = String(formData.get("manualPostedAt") ?? "").trim();
  const manualPostedBy = String(formData.get("manualPostedBy") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  let message: string;
  let isError: boolean;
  let socialPost: SocialPost | undefined;

  try {
    const manualPostedAt = manualPostedAtRaw.length > 0 ? new Date(manualPostedAtRaw).toISOString() : undefined;
    const result = await recordManualPostingResult(socialPostId, {
      manualPostUrl,
      manualPostedAt,
      manualPostedBy: manualPostedBy.length > 0 ? manualPostedBy : APPROVED_BY,
      notes: notes.length > 0 ? notes : undefined,
    });
    message = result.message;
    isError = !result.success;
    socialPost = result.socialPost;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  redirectToSafeTarget(formData, socialPostFallbackUrl(articleId, socialPost), message, isError);
}

/** 사람이 게시를 시도했지만 실패한 경우를 기록한다 (Phase 3-8). publish_status는 바뀌지 않는다. */
export async function markManualPostingFailedAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    const result = await markManualPostingFailed(socialPostId, { reason: reason.length > 0 ? reason : undefined, recordedBy: APPROVED_BY });
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/** 사람이 게시를 시도하지 않기로 했거나 보류한 경우를 기록한다 (Phase 3-8). publish_status는 바뀌지 않는다. */
export async function markManualPostingSkippedAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    const result = await markManualPostingSkipped(socialPostId, { reason: reason.length > 0 ? reason : undefined, recordedBy: APPROVED_BY });
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * social post의 성과 지표(조회수/좋아요/댓글/공유/저장/클릭 등)를 수동으로
 * 입력한다 (Phase 3-9). 실제 외부 플랫폼 Analytics/Insights API는
 * 호출하지 않으며, 사람이 플랫폼에서 확인한 수치를 그대로 저장한다.
 */
export async function recordSocialPostMetricsAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const toNumber = (name: string): number | undefined => {
      const raw = String(formData.get(name) ?? "").trim();
      if (raw.length === 0) return undefined;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const measuredAtRaw = String(formData.get("measuredAt") ?? "").trim();
    const recordedBy = String(formData.get("recordedBy") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    const result = await recordSocialPostMetrics(socialPostId, {
      measuredAt: measuredAtRaw.length > 0 ? new Date(measuredAtRaw).toISOString() : undefined,
      recordedBy: recordedBy.length > 0 ? recordedBy : APPROVED_BY,
      views: toNumber("views"),
      impressions: toNumber("impressions"),
      reach: toNumber("reach"),
      likes: toNumber("likes"),
      comments: toNumber("comments"),
      shares: toNumber("shares"),
      saves: toNumber("saves"),
      clicks: toNumber("clicks"),
      profileVisits: toNumber("profileVisits"),
      follows: toNumber("follows"),
      conversionCount: toNumber("conversionCount"),
      notes: notes.length > 0 ? notes : undefined,
    });
    message = result.warnings && result.warnings.length > 0 ? `${result.message} (경고: ${result.warnings.join(" / ")})` : result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  // Phase 3-17: metrics를 입력한 뒤에는 결과를 바로 확인할 수 있도록 성과 페이지로 이동한다
  // (returnTo가 있으면 그 값이 우선한다).
  redirectToSafeTarget(formData, buildMetricsDeepLink(articleId, socialPostId), message, isError);
}

/** 최신 Metrics/성과 요약을 새로고침한다 (별도 API 호출 없이 페이지만 다시 렌더링). */
export async function refreshSocialPostMetricsAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  revalidatePath(`/articles/${articleId}`);
  redirect(`/articles/${articleId}`);
}

/**
 * social post의 성과를 진단하고 rule-based 개선 제안을 생성한다
 * (Phase 3-10). 기존 social_posts 본문은 절대 수정하지 않으며, 실제
 * 재게시도 수행하지 않는다.
 */
export async function generatePerformanceRewriteSuggestionAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;
  let suggestionId: string | undefined;

  try {
    const result = await generatePerformanceRewriteSuggestion(socialPostId);
    message = result.message;
    isError = !result.success;
    suggestionId = result.suggestion?.id;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  // Phase 3-17: 생성된 제안이 있으면 그 제안을 강조한 rewrite 페이지로, 없으면 rewrite 페이지 기본으로 이동한다.
  const fallback = suggestionId ? buildRewriteSuggestionDeepLink(articleId, suggestionId) : `/articles/${articleId}/rewrite`;
  redirectToSafeTarget(formData, fallback, message, isError);
}

/** rewrite suggestion을 승인한다 (Phase 3-10). blocked 상태는 승인할 수 없다. */
export async function approveRewriteSuggestionAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const suggestionId = String(formData.get("suggestionId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await approveRewriteSuggestion(suggestionId, APPROVED_BY);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  redirectToSafeTarget(formData, buildRewriteSuggestionDeepLink(articleId, suggestionId), message, isError);
}

/** rewrite suggestion을 반려한다 (Phase 3-10). */
export async function rejectRewriteSuggestionAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const suggestionId = String(formData.get("suggestionId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    const result = await rejectRewriteSuggestion(suggestionId, APPROVED_BY, reason.length > 0 ? reason : undefined);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  redirectToSafeTarget(formData, buildRewriteSuggestionDeepLink(articleId, suggestionId), message, isError);
}

/**
 * 승인된 rewrite suggestion을 적용해 새 social_posts 버전을 생성한다
 * (Phase 3-11). 기존 social_post는 절대 수정/삭제하지 않으며, 새
 * 버전은 quality/approval/export/guard/handoff/manual posting을 모두
 * 처음부터 다시 거쳐야 한다. 실제 외부 게시는 수행하지 않는다.
 */
export async function applyRewriteSuggestionAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const suggestionId = String(formData.get("suggestionId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  let message: string;
  let isError: boolean;
  let newVersionId: string | undefined;

  try {
    const result = await applyRewriteSuggestion(suggestionId, APPROVED_BY, notes.length > 0 ? notes : undefined);
    message = result.message;
    isError = !result.success;
    newVersionId = result.newSocialPost?.id;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  // Phase 3-17: 새로 만들어진 rewrite version이 있으면 그 버전을 강조한 rewrite 페이지로 이동한다.
  const fallback = newVersionId ? buildRewriteVersionDeepLink(articleId, newVersionId) : buildRewriteSuggestionDeepLink(articleId, suggestionId);
  redirectToSafeTarget(formData, fallback, message, isError);
}

/** rewrite version의 quality gate를 다시 실행한다 (Phase 3-12). 실제 게시는 수행하지 않는다. */
export async function recheckRewriteVersionQualityAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await recheckRewriteVersionQuality(socialPostId, APPROVED_BY);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  redirectToSafeTarget(formData, buildRewriteVersionDeepLink(articleId, socialPostId), message, isError);
}

/**
 * rewrite version을 원본과 비교한다 (Phase 3-12). 비교 결과는 사람이
 * 판단하기 위한 보조 지표일 뿐이며, 실제 게시나 원본 교체는 하지 않는다.
 */
export async function compareRewriteVersionAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;
  let comparisonId: string | undefined;

  try {
    const result = await compareRewriteVersion(socialPostId, APPROVED_BY);
    message = result.message;
    isError = !result.success;
    comparisonId = result.comparison?.id;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  // Phase 3-17: 비교 결과가 있으면 rewrite 페이지에서 comparisonId로 강조, 없으면 해당 version으로 이동한다.
  const fallback = comparisonId
    ? `/articles/${articleId}/rewrite?comparisonId=${encodeURIComponent(comparisonId)}&highlight=${encodeURIComponent(comparisonId)}`
    : buildRewriteVersionDeepLink(articleId, socialPostId);
  redirectToSafeTarget(formData, fallback, message, isError);
}

/** rewrite version의 재승인을 요청한다 (Phase 3-13). recommended_for_repost=true여도 자동 승인되지 않는다. */
export async function requestRewriteReapprovalAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    const result = await requestRewriteReapproval(socialPostId, APPROVED_BY, notes.length > 0 ? notes : undefined);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  redirectToSafeTarget(formData, buildRewriteVersionDeepLink(articleId, socialPostId), message, isError);
}

/** rewrite version의 재승인을 승인한다 (Phase 3-13). */
export async function approveRewriteReapprovalAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    const result = await approveRewriteReapproval(socialPostId, APPROVED_BY, notes.length > 0 ? notes : undefined);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  redirectToSafeTarget(formData, buildRewriteVersionDeepLink(articleId, socialPostId), message, isError);
}

/** rewrite version의 재승인을 반려한다 (Phase 3-13). */
export async function rejectRewriteReapprovalAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    const result = await rejectRewriteReapproval(socialPostId, APPROVED_BY, reason.length > 0 ? reason : undefined);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/** rewrite version의 재승인을 취소한다 (Phase 3-13). */
export async function revokeRewriteReapprovalAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    const result = await revokeRewriteReapproval(socialPostId, APPROVED_BY, reason.length > 0 ? reason : undefined);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/** rewrite version의 재export를 준비 상태로 표시한다 (Phase 3-13). */
export async function prepareRewriteReexportAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await prepareRewriteReexport(socialPostId, APPROVED_BY);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  redirectToSafeTarget(formData, buildRewriteVersionDeepLink(articleId, socialPostId), message, isError);
}

/** rewrite version의 재export payload를 생성한다 (Phase 3-13). 원본의 export_payload는 수정하지 않는다. */
export async function generateRewriteReexportPayloadAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await generateRewriteReexportPayload(socialPostId, APPROVED_BY);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  redirectToSafeTarget(formData, buildRewriteVersionDeepLink(articleId, socialPostId), message, isError);
}

/** rewrite version의 재게시 workflow 상태를 다시 계산해 새로고침한다 (Phase 3-13). */
export async function refreshRewriteRepublishWorkflowStatusAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await refreshRewriteRepublishWorkflowStatus(socialPostId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * 원본 social_post와 rewrite version의 수동 입력 metrics를 비교한다
 * (Phase 3-14). metrics가 부족하면 blocked가 아니라 needs_more_data로
 * 저장되며, 어떤 경우에도 자동 재게시/자동 원본 수정으로 이어지지 않는다.
 */
export async function compareRewritePerformanceAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;
  let comparisonId: string | undefined;

  try {
    const result = await compareRewritePerformance(socialPostId, APPROVED_BY);
    message = result.message;
    isError = !result.success;
    comparisonId = result.comparison?.id;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  // Phase 3-17: 비교 결과가 있으면 성과 페이지에서 comparisonId로 강조, 없으면 성과 페이지 기본으로 이동한다.
  const fallback = comparisonId ? buildComparisonDeepLink(articleId, comparisonId) : `/articles/${articleId}/performance`;
  redirectToSafeTarget(formData, fallback, message, isError);
}

// ---------------------------------------------------------------------
// Phase 3-20: A/B Testing Draft Structure
// 이 섹션의 어떤 action도 실제 플랫폼에 자동 게시하지 않는다 — variant로
// 추가된 social_post는 여전히 이 파일의 기존 승인/export/handoff/manual
// posting action을 통해서만 게시할 수 있다. winner를 결정해도 자동
// 재게시는 수행하지 않는다.
// ---------------------------------------------------------------------

/** A/B test draft를 생성한다 (article 존재/platform/test_name/primary_metric 검증만 수행, 실제 게시 없음). */
export async function createAbTestDraftAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const platformRaw = String(formData.get("platform") ?? "");
  const testName = String(formData.get("testName") ?? "");
  const testDescription = String(formData.get("testDescription") ?? "").trim();
  const hypothesis = String(formData.get("hypothesis") ?? "").trim();
  const testGoal = String(formData.get("testGoal") ?? "").trim();
  const primaryMetricRaw = String(formData.get("primaryMetric") ?? "");

  let message: string;
  let isError: boolean;
  let abTestId: string | undefined;

  try {
    if (!isSocialPlatform(platformRaw)) {
      throw new Error(`지원하지 않는 platform입니다: ${platformRaw}`);
    }
    if (primaryMetricRaw && !isAbTestPrimaryMetric(primaryMetricRaw)) {
      throw new Error(`지원하지 않는 primary_metric입니다: ${primaryMetricRaw}`);
    }

    const result = await createAbTestDraft({
      articleId,
      platform: platformRaw,
      testName,
      testDescription: testDescription.length > 0 ? testDescription : undefined,
      hypothesis: hypothesis.length > 0 ? hypothesis : undefined,
      testGoal: testGoal.length > 0 ? testGoal : undefined,
      primaryMetric: primaryMetricRaw ? (primaryMetricRaw as Parameters<typeof createAbTestDraft>[0]["primaryMetric"]) : undefined,
    });
    message = result.message;
    isError = !result.success;
    abTestId = result.abTest?.id;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  const fallback = abTestId ? buildArticleAbTestsUrl(articleId, { abTestId, highlight: abTestId }) : buildArticleAbTestsUrl(articleId);
  redirectToSafeTarget(formData, fallback, message, isError);
}

/** 원본 social_post와 rewrite social_post를 곧바로 control/variant_a로 묶는 A/B test draft를 생성한다. */
export async function createOriginalVsRewriteAbTestAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const originalSocialPostId = String(formData.get("originalSocialPostId") ?? "");
  const rewriteSocialPostId = String(formData.get("rewriteSocialPostId") ?? "");
  const testName = String(formData.get("testName") ?? "").trim();

  let message: string;
  let isError: boolean;
  let abTestId: string | undefined;

  try {
    const result = await createOriginalVsRewriteAbTest(originalSocialPostId, rewriteSocialPostId, testName.length > 0 ? { testName } : undefined);
    message = result.warnings && result.warnings.length > 0 ? `${result.message} (경고: ${result.warnings.join(" / ")})` : result.message;
    isError = !result.success;
    abTestId = result.abTest?.id;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);

  const fallback = abTestId ? buildArticleAbTestsUrl(articleId, { abTestId, highlight: abTestId }) : buildArticleAbTestsUrl(articleId);
  redirectToSafeTarget(formData, fallback, message, isError);
}

/** 기존 social_post 하나를 A/B test에 variant로 추가한다. */
export async function addAbTestVariantAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const abTestId = String(formData.get("abTestId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");
  const variantLabel = String(formData.get("variantLabel") ?? "");
  const variantRoleRaw = String(formData.get("variantRole") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await addVariantToAbTest(abTestId, socialPostId, {
      variantLabel,
      variantRole: variantRoleRaw ? (variantRoleRaw as Parameters<typeof addVariantToAbTest>[2]["variantRole"]) : undefined,
    });
    message = result.warnings && result.warnings.length > 0 ? `${result.message} (경고: ${result.warnings.join(" / ")})` : result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleAbTestsUrl(articleId, { abTestId, highlight: abTestId }), message, isError);
}

/** A/B test를 draft → ready로 전환한다 (variant 최소 2개 필요). */
export async function markAbTestReadyAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const abTestId = String(formData.get("abTestId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await markAbTestReady(abTestId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleAbTestsUrl(articleId, { abTestId, highlight: abTestId }), message, isError);
}

/** A/B test를 ready/paused → running으로 전환한다. 실제 자동 게시는 수행하지 않는다. */
export async function startAbTestAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const abTestId = String(formData.get("abTestId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await startAbTest(abTestId, APPROVED_BY);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleAbTestsUrl(articleId, { abTestId, highlight: abTestId }), message, isError);
}

/** A/B test를 running → paused로 전환한다. */
export async function pauseAbTestAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const abTestId = String(formData.get("abTestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    const result = await pauseAbTest(abTestId, reason.length > 0 ? reason : undefined);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleAbTestsUrl(articleId, { abTestId, highlight: abTestId }), message, isError);
}

/** A/B test를 완료 처리한다. 결과는 참고 지표이며 자동 재게시는 수행하지 않는다. */
export async function completeAbTestAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const abTestId = String(formData.get("abTestId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await completeAbTest(abTestId, APPROVED_BY);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleAbTestsUrl(articleId, { abTestId, highlight: abTestId }), message, isError);
}

/** A/B test를 취소한다 (완료/이미 취소된 테스트는 취소할 수 없음). */
export async function cancelAbTestAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const abTestId = String(formData.get("abTestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  let message: string;
  let isError: boolean;

  try {
    const result = await cancelAbTest(abTestId, reason.length > 0 ? reason : undefined);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleAbTestsUrl(articleId, { abTestId, highlight: abTestId }), message, isError);
}

/** variant들의 social_post 최신 metrics를 다시 읽어 A/B test variant row에 반영한다 (외부 API 호출 없음). */
export async function refreshAbTestMetricsAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const abTestId = String(formData.get("abTestId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await refreshAbTestVariantMetrics(abTestId);
    message = result.warnings && result.warnings.length > 0 ? `${result.message} (경고: ${result.warnings.join(" / ")})` : result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleAbTestsUrl(articleId, { abTestId, highlight: abTestId }), message, isError);
}

/** primary_metric 기준으로 variant를 비교해 winner를 결정한다 (결정되어도 자동 게시/재게시는 수행하지 않음). */
export async function compareAbTestVariantsAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const abTestId = String(formData.get("abTestId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await decideAbTestWinner(abTestId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidateArticleWorkflowPaths(articleId);
  redirectToSafeTarget(formData, buildArticleAbTestsUrl(articleId, { abTestId, highlight: abTestId }), message, isError);
}
