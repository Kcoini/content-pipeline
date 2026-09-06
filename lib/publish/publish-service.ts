// Phase 2-2: WordPress Draft Publish 서비스.
// reviewed 상태이고 사람이 승인한(approval_logs 존재) article만 WordPress에
// status="draft"인 post로 생성한다. 자동 공개(publish)는 절대 수행하지 않는다.
// WORDPRESS_PUBLISH_ENABLED=false이면 실제 API를 호출하지 않고 dry-run으로 처리한다.

import {
  getArticleById,
  updateSeoPluginWriteStatus,
  saveWordPressCategoryTagIds,
} from "@/lib/repositories/article-repository";
import { getApprovalLogsByArticleId } from "@/lib/repositories/approval-repository";
import {
  savePublishLog,
  getSuccessfulWordPressDraft,
} from "@/lib/repositories/publish-repository";
import {
  createDraftPost,
  findOrCreateCategory,
  findOrCreateTag,
  testWordPressConnection,
  updateDraftPostContent,
  type WordPressConnectionTestResult,
} from "./wordpress-client";
import { resolveExistingFeaturedMediaId } from "@/lib/images/featured-image-uploader";
import { ensureWordPressHtmlContent } from "@/lib/wordpress/markdown-to-wordpress-html";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { Article } from "@/lib/types/domain";

/** logEvent를 articleId/themeId/targetType/targetId 반복 없이 호출하기 위한 헬퍼. */
async function logMediaEvent(
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

/**
 * WordPress에 게시할 featured_media id를 결정한다 (Phase 2-9: draft 생성 안정화에
 * 집중하기 위해 실제 이미지 업로드는 이번 단계에서 시도하지 않는다 — 다음 단계로
 * 미룬다. `WORDPRESS_MEDIA_UPLOAD_ENABLED` 값과 무관하게 항상 defer한다).
 *
 * 1. article에 이미 WordPress media id가 저장되어 있으면(Phase 2-6에서 별도로
 *    준비된 값) 그대로 사용한다 — 이는 새로운 업로드가 아니라 기존 id를
 *    참조하는 것이므로 이번 단계의 defer 대상이 아니다.
 * 2. media id가 없으면 실제 업로드를 시도하지 않고 항상 skipped_deferred로
 *    기록한다.
 */
async function resolveFeaturedMediaForPublish(articleId: string, article: Article): Promise<number | undefined> {
  const existingMediaId = resolveExistingFeaturedMediaId(article);
  if (existingMediaId !== undefined) {
    await logMediaEvent(
      "wordpress_featured_media_prepared",
      "info",
      `기사(${articleId})의 featured_media(${existingMediaId})를 WordPress post에 연결합니다.`,
      articleId,
      article
    );
    return existingMediaId;
  }

  await logMediaEvent(
    "wordpress_media_upload_skipped_deferred",
    "info",
    `기사(${articleId})의 이미지 업로드는 이번 단계(Phase 2-9)에서 보류합니다 (다음 단계에서 실제 테스트 예정).`,
    articleId,
    article
  );
  await logMediaEvent(
    "featured_image_upload_skipped_not_implemented",
    "info",
    `기사(${articleId})의 대표 이미지 업로드는 아직 구현되지 않아 건너뜁니다.`,
    articleId,
    article
  );
  await logMediaEvent(
    "wordpress_featured_image_skipped_no_media",
    "info",
    `기사(${articleId})에 WordPress media id가 없어 featured_media를 설정하지 않습니다.`,
    articleId,
    article
  );
  await logMediaEvent(
    "wordpress_featured_media_skipped_no_media_id",
    "info",
    `기사(${articleId})에 WordPress media id가 없어 featured_media 연결을 건너뜁니다.`,
    articleId,
    article
  );
  return undefined;
}

/**
 * WordPress draft post 생성 성공 후 SEO plugin metadata write 상태를 기록한다.
 * Phase 2-9: draft 생성 안정화에 집중하기 위해 실제 SEO plugin write는 이번
 * 단계에서 시도하지 않는다 — `SEO_PLUGIN_WRITE_ENABLED` 값과 무관하게 항상
 * defer한다 (다음 단계로 미룸). provider=none이면 애초에 write 대상이 없으므로
 * skipped_provider_none으로 구분해 기록한다.
 */
async function handleSeoPluginWrite(articleId: string, article: Article): Promise<void> {
  const provider = article.seoPluginProvider;

  if (provider === "none") {
    await updateSeoPluginWriteStatus(articleId, "skipped_provider_none");
    await logEvent({
      type: "seo_plugin_write_skipped_provider_none",
      status: "info",
      message: `기사(${articleId})는 SEO plugin provider가 none이어서 metadata write를 건너뜁니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
    return;
  }

  await updateSeoPluginWriteStatus(articleId, "skipped_dry_run");
  await logEvent({
    type: "seo_plugin_write_skipped_deferred",
    status: "info",
    message: `기사(${articleId})의 SEO plugin(${provider}) metadata write는 이번 단계(Phase 2-9)에서 보류합니다 (다음 단계에서 실제 테스트 예정).`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });
}

interface ResolvedWordPressTerms {
  categoryIds: number[];
  tagIds: number[];
}

/**
 * 카테고리 또는 태그 하나를 동기화한다(이름 목록 → id 목록). 실패해도 예외를
 * 던지지 않고 빈 배열을 반환한다 — WordPress 권한 부족 등으로 category/tag
 * 생성이 실패해도 draft 생성 자체는 막지 않고 warning으로만 처리한다.
 */
async function syncTermIds(
  kind: "category" | "tag",
  names: string[],
  articleId: string,
  article: Article
): Promise<number[]> {
  const startedEvent = kind === "category" ? "wordpress_category_sync_started" : "wordpress_tag_sync_started";
  const completedEvent = kind === "category" ? "wordpress_category_sync_completed" : "wordpress_tag_sync_completed";
  const failedEvent = kind === "category" ? "wordpress_category_sync_failed" : "wordpress_tag_sync_failed";
  const label = kind === "category" ? "카테고리" : "태그";
  const finder = kind === "category" ? findOrCreateCategory : findOrCreateTag;

  await logMediaEvent(startedEvent, "info", `기사(${articleId})의 WordPress ${label} 동기화를 시작합니다.`, articleId, article);

  try {
    const results = await Promise.all(names.map((name) => finder(name)));
    const ids = results.filter((r) => r.success).map((r) => r.id);
    const failedNames = results
      .map((r, i) => (r.success ? null : names[i]))
      .filter((name): name is string => name !== null);

    await logMediaEvent(
      completedEvent,
      "success",
      failedNames.length > 0
        ? `기사(${articleId})의 WordPress ${label} 동기화를 완료했습니다 (일부 실패: ${failedNames.join(", ")}).`
        : `기사(${articleId})의 WordPress ${label} 동기화를 완료했습니다.`,
      articleId,
      article,
      { ids, failedNames }
    );

    return ids;
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logMediaEvent(
      failedEvent,
      "failed",
      `WordPress ${label} 동기화 실패: ${message}. ${label} 없이 게시를 계속합니다 (warning).`,
      articleId,
      article,
      { error: message }
    );
    // 동기화 실패는 게시 자체를 막지 않는다 — 해당 term 없이 draft를 생성한다.
    return [];
  }
}

/**
 * article의 wp_category_ids/wp_tag_ids가 이미 있으면 그대로 사용하고,
 * 없고 이름(wp_category_names/wp_tag_names)만 있으면 WordPress에서 이름으로
 * 찾거나 새로 생성해 id를 얻는다 (Phase 2-3/2-8). 새로 동기화된 id는
 * articles.wp_category_ids/wp_tag_ids에 저장해 다음 게시부터는 이름 검색을
 * 건너뛸 수 있게 한다. WORDPRESS_PUBLISH_ENABLED=true일 때만 호출된다 —
 * dry-run에서는 이 함수 자체가 호출되지 않는다.
 */
async function resolveWordPressTerms(articleId: string, article: Article): Promise<ResolvedWordPressTerms> {
  const needsCategorySync = article.wpCategoryIds.length === 0 && article.wpCategoryNames.length > 0;
  const needsTagSync = article.wpTagIds.length === 0 && article.wpTagNames.length > 0;

  if (!needsCategorySync && !needsTagSync) {
    return { categoryIds: article.wpCategoryIds, tagIds: article.wpTagIds };
  }

  const categoryIds = needsCategorySync
    ? await syncTermIds("category", article.wpCategoryNames, articleId, article)
    : article.wpCategoryIds;
  const tagIds = needsTagSync ? await syncTermIds("tag", article.wpTagNames, articleId, article) : article.wpTagIds;

  if (needsCategorySync || needsTagSync) {
    try {
      await saveWordPressCategoryTagIds(articleId, categoryIds, tagIds);
    } catch {
      // id 영속 실패는 이번 게시를 막지 않는다 (다음 게시 때 다시 동기화를 시도한다).
    }
  }

  return { categoryIds, tagIds };
}

const WORDPRESS_CONNECTION_TEST_ENDPOINT_TYPE = "wp/v2/users/me";

type WordPressConnectionTestLogType = Extract<
  LogEventType,
  "wordpress_connection_test_started" | "wordpress_connection_test_completed" | "wordpress_connection_test_failed"
>;

/** base URL에서 호스트만 추출한다 (경로/쿼리 등은 details_json에 남기지 않는다). */
function extractBaseUrlHost(baseUrl: string | undefined): string | null {
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).host;
  } catch {
    return null;
  }
}

/**
 * 연결 테스트 이벤트를 pipeline_logs(event 컬럼 우선, stage는 사용하지 않음)에
 * 기록한다. 로그 저장 자체가 실패해도(DB 오류 등) 연결 테스트 결과를 사용자에게
 * 보여주는 흐름을 막지 않도록 여기서 예외를 흡수하고 console.error로만 남긴다.
 */
async function logConnectionTestEvent(
  type: WordPressConnectionTestLogType,
  status: LogStatus,
  message: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await logEvent({ type, status, message, details });
  } catch (error) {
    console.error(
      `[pipeline:${type}] pipeline_logs 저장에 실패했습니다.`,
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * WordPress 실제 연결 테스트를 실행하고 pipeline_logs에 결과를 기록한다 (Phase 2-8).
 * 이 테스트는 특정 기사와 무관한 사이트 단위 점검이므로 articleId/themeId 없이
 * 기록한다. details_json에는 baseUrlHost/connected/statusCode/endpointType/
 * safeMessage만 저장하며, Application Password/Authorization header/Basic Auth
 * 문자열/API key는 어떤 경우에도 로그에 남기지 않는다.
 */
export async function runWordPressConnectionTest(): Promise<WordPressConnectionTestResult> {
  await logConnectionTestEvent(
    "wordpress_connection_test_started",
    "info",
    "WordPress 연결 테스트를 시작합니다.",
    { endpointType: WORDPRESS_CONNECTION_TEST_ENDPOINT_TYPE }
  );

  const result = await testWordPressConnection();
  const baseUrlHost = extractBaseUrlHost(result.baseUrl);

  if (result.connected) {
    const safeMessage = `WordPress 연결 테스트 성공${baseUrlHost ? ` (${baseUrlHost})` : ""}.`;
    await logConnectionTestEvent("wordpress_connection_test_completed", "success", safeMessage, {
      baseUrlHost,
      connected: true,
      statusCode: result.statusCode ?? 200,
      endpointType: WORDPRESS_CONNECTION_TEST_ENDPOINT_TYPE,
      safeMessage,
    });
  } else {
    const safeMessage = result.errorMessage ?? "WordPress 연결에 실패했습니다.";
    await logConnectionTestEvent(
      "wordpress_connection_test_failed",
      "failed",
      `WordPress 연결 테스트 실패: ${safeMessage}`,
      {
        baseUrlHost,
        connected: false,
        statusCode: result.statusCode ?? null,
        endpointType: WORDPRESS_CONNECTION_TEST_ENDPOINT_TYPE,
        safeMessage,
      }
    );
  }

  return result;
}

export const WORDPRESS_TARGET = "wordpress";

export interface PublishResult {
  success: boolean;
  dryRun: boolean;
  message: string;
  postUrl?: string;
  externalPostId?: string;
}

/** WORDPRESS_PUBLISH_ENABLED=true일 때만 실제 WordPress API를 호출한다. */
export function isWordPressPublishEnabled(): boolean {
  return process.env.WORDPRESS_PUBLISH_ENABLED === "true";
}

/**
 * article_mode별 WordPress 전송 제목을 결정한다.
 * monetized_blog: seo_title이 있으면 우선 사용, 없으면 article.title.
 * 그 외 모드: article.title.
 */
export function resolveWordPressTitle(article: Article): string {
  if (article.articleMode === "monetized_blog" && article.seoTitle) {
    return article.seoTitle;
  }
  return article.title;
}

const EXCERPT_MAX_LENGTH = 160;

/**
 * meta_description이 있으면 그대로 사용하고, 없으면 본문(AD_SLOT marker
 * 제외) 앞부분에서 안전하게 excerpt를 생성한다. resolveWordPressExcerpt와
 * contentOverride(아래) 양쪽에서 공통으로 사용하는 순수 헬퍼다.
 */
function resolveExcerptFromContent(content: string, metaDescription: string | null | undefined): string | undefined {
  if (metaDescription) return metaDescription;

  const plainText = content
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/[#*_>`|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plainText) return undefined;

  return plainText.length > EXCERPT_MAX_LENGTH
    ? `${plainText.slice(0, EXCERPT_MAX_LENGTH)}…`
    : plainText;
}

/**
 * WordPress excerpt를 결정한다. meta_description이 있으면 그대로 사용하고,
 * 없으면 본문(AD_SLOT marker 제외) 앞부분에서 안전하게 생성한다.
 */
export function resolveWordPressExcerpt(article: Article): string | undefined {
  return resolveExcerptFromContent(article.content, article.metaDescription);
}

/**
 * reviewed 상태의 article을 WordPress에 draft post로 생성한다.
 *
 * 순서: article 조회 → status=reviewed 확인 → content 비어있지 않은지 확인 →
 * approval_logs 존재 확인 → 기존 success publish_logs 존재 확인(중복 방지) →
 * dry-run 또는 실제 WordPress API 호출 → publish_logs 저장 → pipeline_logs 기록.
 */
export interface PublishArticleOptions {
  /**
   * true면 이미 성공한 WordPress draft 기록이 있어도 강제로 재생성한다.
   * Phase 2-9 기준 UI에는 강제 재생성 버튼이 없으며, 나중에 추가할 수 있도록
   * 함수 구조만 준비해 둔다 (기본값 false — 항상 중복 방지가 우선한다).
   */
  force?: boolean;
  /**
   * wordpress_blog social_post 기준으로 실제 WordPress에 전송할
   * title/content/excerpt를 지정한다. 넘기지 않으면(undefined) 기존
   * 동작 그대로 article.title/article.content/article.metaDescription을
   * 사용한다 — article 페이지 "고급 기능"(원본 article 전송)은 이
   * 옵션을 넘기지 않아 동작이 전혀 바뀌지 않는다. wordpress_blog 카드
   * 기준 Draft 생성/업데이트만 이 옵션을 넘겨 실제 payload를
   * wordpress_blog 글의 title/body로 대체한다.
   */
  contentOverride?: {
    title?: string;
    content?: string;
    excerpt?: string;
  };
}

/** 승인/reviewed 관련 게시 skip을 기존 이벤트(wordpress_publish_skipped_not_reviewed)와
 * Phase 2-9 이벤트(wordpress_actual_publish_skipped_not_reviewed)로 함께 기록한다. */
async function logSkippedNotReviewed(articleId: string, article: Article, message: string): Promise<void> {
  await logEvent({
    type: "wordpress_publish_skipped_not_reviewed",
    status: "failed",
    message,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });
  await logEvent({
    type: "wordpress_actual_publish_skipped_not_reviewed",
    status: "failed",
    message,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });
}

/** WordPress 실제 API 호출 실패의 status code별 원인 후보를 안내한다 (연결 테스트와 동일한 어휘). */
function getPublishFailureReasonCandidates(statusCode: number | undefined, errorMessage: string): string[] {
  if (statusCode === 401) {
    return [
      "username 또는 Application Password 오류",
      "Application Password 복사 오류",
      "보안 플러그인에서 REST API 인증 차단 가능성",
    ];
  }
  if (statusCode === 403) {
    return ["사용자 권한 부족", "REST API 쓰기 권한 제한", "보안 플러그인 차단 가능성"];
  }
  if (statusCode === 404) {
    return ["WORDPRESS_BASE_URL 오류", "/wp-json 경로 접근 불가", "REST API 차단 가능성"];
  }
  if (statusCode !== undefined && statusCode >= 500) {
    return ["WordPress 서버 오류", "플러그인 충돌 가능성"];
  }
  if (statusCode === undefined && errorMessage.includes("네트워크 오류")) {
    return ["사이트 접근 불가", "SSL 문제", "방화벽 또는 보안 플러그인 문제"];
  }
  return ["원인을 특정할 수 없는 오류입니다."];
}

const WORDPRESS_POSTS_ENDPOINT_TYPE = "wp/v2/posts";

export async function publishArticleToWordPressDraft(
  articleId: string,
  options: PublishArticleOptions = {}
): Promise<PublishResult> {
  const article = await getArticleById(articleId);

  if (!article) {
    return { success: false, dryRun: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  if (article.status !== "reviewed") {
    // Phase 2-23: 이 프로젝트에는 article.status(draft/reviewed/published) 외에
    // 별도의 approval_status 필드가 없다 — "승인하기" 버튼(approveArticleAction)이
    // status를 draft→reviewed로 바꾸는 것과 동시에 승인을 완료하는 단일 게이트다.
    // 다만 WordPress Metadata/SEO Plugin Metadata/대표 이미지 등 여러 하위
    // 상태도 우연히 같은 "reviewed" 값과 "검토 완료" 문구를 쓰기 때문에, 이
    // 메시지가 그 하위 상태들과 혼동되지 않도록 "원본 기사(article) 자체의
    // 승인"임을 명시하고, 다음 행동(기사 개요 페이지에서 승인하기)까지 안내한다.
    // wordpress_blog 카드에서 이 함수를 호출할 때도(contentOverride 유무와
    // 무관) 동일하게 적용되는 공통 게이트다.
    await logSkippedNotReviewed(
      articleId,
      article,
      `기사(${articleId})는 reviewed 상태가 아니어서 WordPress 게시를 건너뜁니다 (status=${article.status}).`
    );
    return {
      success: false,
      dryRun: false,
      message: `WordPress Draft에 반영하려면 먼저 원본 기사가 승인되어야 합니다 (현재 상태: ${article.status}). 기사 개요 페이지에서 "승인하기"를 눌러 기사를 승인한 뒤 다시 시도하세요.`,
    };
  }

  const effectiveContent = options.contentOverride?.content ?? article.content;
  if (!effectiveContent.trim()) {
    return { success: false, dryRun: false, message: "기사 본문이 비어 있어 게시할 수 없습니다." };
  }

  const approvalLogs = await getApprovalLogsByArticleId(articleId, 1);
  if (approvalLogs.length === 0) {
    await logSkippedNotReviewed(
      articleId,
      article,
      `기사(${articleId})의 승인 기록(approval_logs)이 없어 WordPress 게시를 건너뜁니다.`
    );
    return { success: false, dryRun: false, message: "승인 기록이 없어 게시할 수 없습니다." };
  }

  // Phase 2-9: 중복 게시 방지. target=wordpress, status=success, external_post_id가
  // 있는 기록이 이미 있으면 새 draft를 만들지 않는다 (force=true면 재생성 가능하도록
  // 구조만 준비 — 현재 UI에는 강제 재생성 버튼이 없다).
  const existingDraft = await getSuccessfulWordPressDraft(articleId);
  if (existingDraft && !options.force) {
    await logEvent({
      type: "wordpress_publish_skipped_duplicate",
      status: "info",
      message: `기사(${articleId})는 이미 WordPress에 초안이 생성되어 있어 중복 생성을 건너뜁니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
    await logMediaEvent(
      "wordpress_actual_publish_skipped_duplicate",
      "info",
      `기사(${articleId})는 이미 WordPress draft(post id: ${existingDraft.externalPostId})가 생성되어 있어 재생성을 건너뜁니다.`,
      articleId,
      article,
      { externalPostId: existingDraft.externalPostId, postUrl: existingDraft.postUrl }
    );
    return {
      success: true,
      dryRun: false,
      message: "이미 WordPress 초안이 생성되어 있습니다.",
      postUrl: existingDraft.postUrl ?? undefined,
      externalPostId: existingDraft.externalPostId,
    };
  }

  const title = options.contentOverride?.title ?? resolveWordPressTitle(article);
  const excerpt = options.contentOverride?.excerpt ?? resolveExcerptFromContent(effectiveContent, article.metaDescription);

  await logEvent({
    type: "wordpress_publish_started",
    status: "info",
    message: `기사(${articleId}) WordPress 초안 생성을 시작합니다.`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  if (!isWordPressPublishEnabled()) {
    await logEvent({
      type: "wordpress_category_tag_sync_skipped_dry_run",
      status: "info",
      message: `dry-run 모드이므로 기사(${articleId})의 WordPress 카테고리/태그 동기화를 건너뜁니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });

    await savePublishLog({
      articleId,
      target: WORDPRESS_TARGET,
      status: "dry_run",
      details: {
        actual: false,
        dryRun: true,
        reason: "WORDPRESS_PUBLISH_ENABLED=false",
        title,
        articleId,
        articleMode: article.articleMode,
        wouldPublishTo: "wordpress",
        categoryNames: article.wpCategoryNames,
        tagNames: article.wpTagNames,
        seoPlugin: {
          provider: article.seoPluginProvider,
          metadataStatus: article.seoPluginMetadataStatus,
          seoTitle: (article.seoPluginPayload as { seoTitle?: string })?.seoTitle ?? null,
          focusKeyword: (article.seoPluginPayload as { focusKeyword?: string })?.focusKeyword ?? null,
        },
        featuredImage: {
          status: article.featuredImageStatus,
          altText: article.featuredImageAltText,
          caption: article.featuredImageCaption,
          style: article.featuredImageStyle,
          aspectRatio: article.featuredImageAspectRatio,
        },
        featuredImageUpload: {
          uploadStatus: article.featuredImageUploadStatus,
          sourceType: article.featuredImageSourceType,
          filename: article.featuredImageFilename,
          mimeType: article.featuredImageMimeType,
          altText: article.featuredImageAltText,
          caption: article.featuredImageCaption,
          shouldSetAsFeatured:
            (article.featuredImageUploadPayload as { shouldSetAsFeatured?: boolean })?.shouldSetAsFeatured ?? null,
          wordpressMediaId: article.featuredImageWordpressMediaId,
          wouldAttachAsFeatured: article.featuredImageWordpressMediaId != null,
        },
        generatedImage: {
          status: article.generatedImageStatus,
          provider: article.generatedImageProvider,
          model: article.generatedImageModel,
          imageUrl: article.generatedImageUrl,
          width: article.generatedImageWidth,
          height: article.generatedImageHeight,
          format: article.generatedImageFormat,
        },
      },
    });

    await logEvent({
      type: "wordpress_publish_dry_run",
      status: "success",
      message: `dry-run 완료: 실제 WordPress에는 생성되지 않았습니다 (기사 ${articleId}).`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
    await logMediaEvent(
      "wordpress_actual_publish_dry_run",
      "success",
      `dry-run 완료: 실제 WordPress에는 생성되지 않았습니다 (기사 ${articleId}).`,
      articleId,
      article
    );

    return {
      success: true,
      dryRun: true,
      message: "dry-run 완료: 실제 WordPress에는 생성되지 않음",
    };
  }

  await logMediaEvent(
    "wordpress_actual_publish_started",
    "info",
    `기사(${articleId})의 실제 WordPress draft post 생성을 시작합니다.`,
    articleId,
    article
  );

  const { categoryIds, tagIds } = await resolveWordPressTerms(articleId, article);
  const featuredMedia = await resolveFeaturedMediaForPublish(articleId, article);

  // Phase 2-21: WordPress 전송용 content는 항상 HTML이어야 한다.
  // - contentOverride가 있는 경우(wordpress_blog): 이미
  //   wordpress-blog-content-override-builder.ts에서 markdown→HTML 변환과
  //   표 스타일링까지 끝난 값이므로, 여기서 다시 변환/재-sanitize하면
  //   applyWordPressTableStyling()이 만든 <div style="..."> 래퍼가
  //   sanitize에 의해 벗겨질 수 있다 — 절대 다시 건드리지 않는다.
  // - contentOverride가 없는 경우(원본 article 고급 기능 전송): article.content는
  //   항상 markdown으로 생성되므로, ensureWordPressHtmlContent()로 변환한다
  //   (이미 HTML이면 내부적으로 재변환 없이 sanitize만 적용한다).
  const wordPressContent = options.contentOverride ? effectiveContent : ensureWordPressHtmlContent(effectiveContent);

  const result = await createDraftPost({
    title,
    content: wordPressContent,
    excerpt,
    slug: article.slug ?? undefined,
    categories: categoryIds.length > 0 ? categoryIds : undefined,
    tags: tagIds.length > 0 ? tagIds : undefined,
    featuredMedia,
  });

  if (!result.success) {
    await savePublishLog({
      articleId,
      target: WORDPRESS_TARGET,
      status: "failed",
      errorMessage: result.errorMessage,
      details: {
        actual: true,
        dryRun: false,
        statusCode: result.statusCode ?? null,
        endpointType: WORDPRESS_POSTS_ENDPOINT_TYPE,
        reasonCandidate: getPublishFailureReasonCandidates(result.statusCode, result.errorMessage),
      },
    });

    await logEvent({
      type: "wordpress_publish_failed",
      status: "failed",
      message: `WordPress 초안 생성 실패: ${result.errorMessage}`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
    await logMediaEvent(
      "wordpress_actual_publish_failed",
      "failed",
      `실제 WordPress draft post 생성 실패: ${result.errorMessage}`,
      articleId,
      article,
      { statusCode: result.statusCode ?? null, endpointType: WORDPRESS_POSTS_ENDPOINT_TYPE }
    );

    return { success: false, dryRun: false, message: result.errorMessage };
  }

  await savePublishLog({
    articleId,
    target: WORDPRESS_TARGET,
    status: "success",
    externalPostId: String(result.externalPostId),
    postUrl: result.postUrl,
    details: {
      actual: true,
      dryRun: false,
      wordpressPostId: result.externalPostId,
      wordpressStatus: "draft",
      title,
      slug: article.slug ?? null,
      categoryCount: categoryIds.length,
      tagCount: tagIds.length,
      mediaUpload: { status: "skipped_deferred" },
      seoPluginWrite: { status: "skipped_deferred" },
      featuredMedia: {
        included: featuredMedia !== undefined,
        mediaId: featuredMedia ?? null,
        mediaUrl: featuredMedia !== undefined ? (article.featuredImageWordpressUrl ?? null) : null,
        mode: "create_draft",
      },
    },
  });

  await logEvent({
    type: "wordpress_publish_completed",
    status: "success",
    message: `WordPress 초안 생성 완료: ${result.postUrl}`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });
  await logMediaEvent(
    "wordpress_actual_publish_completed",
    "success",
    `실제 WordPress draft post 생성 완료: ${result.postUrl}`,
    articleId,
    article,
    { externalPostId: result.externalPostId, wordpressStatus: "draft" }
  );

  await handleSeoPluginWrite(articleId, article);

  return {
    success: true,
    dryRun: false,
    message: "WordPress 초안이 생성되었습니다.",
    postUrl: result.postUrl,
    externalPostId: String(result.externalPostId),
  };
}

/**
 * Phase 2-21: 이미 WordPress에 성공적으로 전송된(publish_logs에 성공 기록이
 * 있는) 원본 article draft/post의 content를 현재 article.content 기준으로
 * 다시 HTML 변환해서 갱신한다.
 *
 * - markdown 원문이 그대로 전송되어 있던 기존 post를 HTML 변환본으로
 *   교체하는 용도다 (source_based_explainer 등 이번 수정 이전에 전송된 글).
 * - 새 post를 만들지 않는다 — updateDraftPostContent()로 기존 post만 갱신한다.
 * - status는 항상 "draft"로 고정 전송한다 — 이 post가 이미 공개(publish)
 *   상태였더라도 이 호출로는 공개 상태가 바뀌지 않는다. 공개 상태를 바꾸는
 *   것은 이 함수의 책임이 아니며, 사용자가 WordPress 관리자 화면에서
 *   직접 확인/결정해야 한다.
 * - wordpress_blog(contentOverride 경로)에는 영향이 없다 — 이 함수는 원본
 *   article 전송 기록(publish_logs, target=wordpress)만 대상으로 한다.
 */
export async function updateArticleWordPressDraftContent(articleId: string): Promise<PublishResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, dryRun: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  const existingDraft = await getSuccessfulWordPressDraft(articleId);
  if (!existingDraft) {
    return {
      success: false,
      dryRun: false,
      message: "이미 생성된 WordPress 초안이 없어 내용을 갱신할 수 없습니다. 먼저 WordPress 초안을 생성하세요.",
    };
  }

  const postId = Number(existingDraft.externalPostId);
  if (!postId || Number.isNaN(postId)) {
    return { success: false, dryRun: false, message: "기존 WordPress post id를 확인할 수 없습니다." };
  }

  if (!article.content.trim()) {
    return { success: false, dryRun: false, message: "기사 본문이 비어 있어 갱신할 수 없습니다." };
  }

  if (!isWordPressPublishEnabled()) {
    await logEvent({
      type: "wordpress_publish_dry_run",
      status: "success",
      message: `dry-run 모드이므로 기사(${articleId})의 WordPress draft content 갱신을 건너뜁니다 (post id: ${postId}).`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
    return {
      success: true,
      dryRun: true,
      message: "dry-run 완료: 실제 WordPress content는 갱신되지 않음",
      postUrl: existingDraft.postUrl ?? undefined,
      externalPostId: existingDraft.externalPostId,
    };
  }

  const title = resolveWordPressTitle(article);
  const wordPressContent = ensureWordPressHtmlContent(article.content);
  const excerpt = resolveExcerptFromContent(article.content, article.metaDescription);

  const result = await updateDraftPostContent(postId, { title, content: wordPressContent, excerpt });

  if (!result.success) {
    await savePublishLog({
      articleId,
      target: WORDPRESS_TARGET,
      status: "failed",
      errorMessage: result.errorMessage,
      details: {
        actual: true,
        dryRun: false,
        mode: "update_draft_content",
        statusCode: result.statusCode ?? null,
        externalPostId: postId,
        reasonCandidate: result.reasonCandidate,
      },
    });
    await logEvent({
      type: "wordpress_publish_failed",
      status: "failed",
      message: `WordPress draft content 갱신 실패(post id: ${postId}): ${result.errorMessage}`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
    return { success: false, dryRun: false, message: result.errorMessage };
  }

  await savePublishLog({
    articleId,
    target: WORDPRESS_TARGET,
    status: "success",
    externalPostId: String(result.postId),
    postUrl: result.link,
    details: {
      actual: true,
      dryRun: false,
      mode: "update_draft_content",
      wordpressPostId: result.postId,
      wordpressStatus: result.status,
      title,
    },
  });

  await logEvent({
    type: "wordpress_publish_completed",
    status: "success",
    message: `WordPress draft content 갱신 완료(Markdown→HTML 재변환): ${result.link}`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  return {
    success: true,
    dryRun: false,
    message: "WordPress 초안 content를 Markdown→HTML 변환본으로 갱신했습니다. 공개 상태는 변경되지 않았으며, 실제 공개 여부는 WordPress 관리자 화면에서 직접 확인하세요.",
    postUrl: result.link,
    externalPostId: String(result.postId),
  };
}
