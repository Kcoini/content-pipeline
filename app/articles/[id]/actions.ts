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
import { publishArticleToWordPressDraft, runWordPressConnectionTest } from "@/lib/publish/publish-service";
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
import { isSocialPlatform, isToneStyle, type ThreadItem, type CardItem, type SocialPost } from "@/lib/social/social-platform-types";
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

/** Multi-platform Writing 목록을 새로고침한다 (별도 API 호출 없이 페이지만 다시 렌더링). */
export async function refreshSocialPostsAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  revalidatePath(`/articles/${articleId}`);
  redirect(`/articles/${articleId}`);
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

/** social post의 콘텐츠(제목/본문/캡션/해시태그/thread/card 등)를 수정한다 (Phase 3-4). */
export async function editSocialPostAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

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
