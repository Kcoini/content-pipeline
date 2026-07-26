// Phase 2-12: SEO Plugin Actual Metadata Test.
// Phase 2-4에서 준비한 SEO plugin metadata(seo_title/meta_description/
// target_keyword)를 실제 WordPress draft post에 반영하는 테스트를 한다.
// 공개 publish는 하지 않으며, WordPress post status는 항상 draft로 유지된다.
// provider는 SEO_PLUGIN_PROVIDER 환경변수로 지정된 것 하나만 사용한다
// (여러 plugin 동시 write는 하지 않는다).

import {
  getArticleById,
  saveSeoPluginActualWriteResult,
  saveSeoPluginCustomEndpointResult,
} from "@/lib/repositories/article-repository";
import { savePublishLog, getSuccessfulWordPressDraft } from "@/lib/repositories/publish-repository";
import {
  updateSeoPluginMetadata,
  verifySeoPluginMetadata,
  type SeoPluginWriteProvider,
} from "@/lib/publish/wordpress-client";
import {
  updateRankMathSeoViaCustomEndpoint,
  isSeoCustomEndpointEnabled,
} from "./wordpress-seo-custom-endpoint-client";
import { getSeoPluginProvider, isSeoPluginWriteEnabled } from "./seo-plugin-config";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { Article } from "@/lib/types/domain";

export const WORDPRESS_SEO_PLUGIN_TARGET = "wordpress_seo_plugin";
export const WORDPRESS_SEO_CUSTOM_ENDPOINT_TARGET = "wordpress_seo_custom_endpoint";

export interface WriteSeoPluginMetadataResult {
  success: boolean;
  message: string;
  verified?: boolean;
  warning?: string;
}

async function logSeoWriteEvent(
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

function isWritableProvider(provider: string): provider is SeoPluginWriteProvider {
  return provider === "rank_math" || provider === "yoast" || provider === "aioseo";
}

const MISSING_TARGET_KEYWORD_MESSAGE =
  "Focus keyword가 없어 Rank Math에 반영할 수 없습니다. SEO metadata를 다시 생성하거나 target_keyword를 입력하세요.";

function hasFocusKeyword(article: Article): boolean {
  return Boolean(article.targetKeyword && article.targetKeyword.trim());
}

/** target_keyword가 어떻게 결정되었는지(explicit/theme/title_fallback/none)를 format_metadata에서 읽는다. */
function getTargetKeywordSource(article: Article): string {
  const wordpress = (article.formatMetadata as { wordpress?: { target_keyword_source?: string } } | undefined)
    ?.wordpress;
  return wordpress?.target_keyword_source ?? (article.targetKeyword ? "explicit" : "unknown");
}

/** publish_logs.details_json에 공통으로 포함할 키워드 요약(focusKeywordPresent/targetKeywordSource/secondaryKeywordsCount). */
function buildKeywordSummary(article: Article): {
  focusKeywordPresent: boolean;
  targetKeywordSource: string;
  secondaryKeywordsCount: number;
} {
  return {
    focusKeywordPresent: hasFocusKeyword(article),
    targetKeywordSource: getTargetKeywordSource(article),
    secondaryKeywordsCount: article.secondaryKeywords.length,
  };
}

/**
 * article의 SEO plugin metadata(Phase 2-4)를 실제 WordPress draft post에
 * 반영한다. provider=none이거나 SEO_PLUGIN_WRITE_ENABLED=false이면 실제 API를
 * 호출하지 않고 안전하게 skip한다. WordPress draft post가 아직 없으면(먼저
 * 'WordPress 초안 생성'이 필요) 연결을 시도하지 않는다. 실패해도 예외를
 * 던지지 않는다.
 */
export async function writeSeoPluginMetadataToWordPress(articleId: string): Promise<WriteSeoPluginMetadataResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  const provider = getSeoPluginProvider();

  if (provider === "none" || !isWritableProvider(provider)) {
    const message = "SEO_PLUGIN_PROVIDER=none이어서 실제 SEO plugin metadata write를 건너뜁니다.";
    await saveSeoPluginActualWriteResult(articleId, { status: "skipped_provider_none", provider: null });
    await logSeoWriteEvent("seo_plugin_actual_write_skipped_provider_none", "info", message, articleId, article);
    await savePublishLog({
      articleId,
      target: WORDPRESS_SEO_PLUGIN_TARGET,
      status: "skipped",
      details: { actual: false, reason: "provider_none" },
    });
    return { success: false, message };
  }

  if (!isSeoPluginWriteEnabled()) {
    const message = `SEO_PLUGIN_WRITE_ENABLED=false이어서 실제 SEO plugin(${provider}) write를 건너뜁니다 (dry-run).`;
    await saveSeoPluginActualWriteResult(articleId, { status: "skipped_disabled", provider });
    await logSeoWriteEvent("seo_plugin_actual_write_skipped_disabled", "info", message, articleId, article, { provider });
    await savePublishLog({
      articleId,
      target: WORDPRESS_SEO_PLUGIN_TARGET,
      status: "skipped",
      details: { actual: false, reason: "write_disabled", provider },
    });
    return { success: false, message };
  }

  if (!hasFocusKeyword(article)) {
    await saveSeoPluginActualWriteResult(articleId, { status: "skipped_missing_target_keyword", provider });
    await logSeoWriteEvent(
      "seo_plugin_actual_write_skipped_missing_target_keyword",
      "info",
      MISSING_TARGET_KEYWORD_MESSAGE,
      articleId,
      article,
      { provider }
    );
    await savePublishLog({
      articleId,
      target: WORDPRESS_SEO_PLUGIN_TARGET,
      status: "skipped",
      details: { actual: false, reason: "missing_target_keyword", provider, ...buildKeywordSummary(article) },
    });
    return { success: false, message: MISSING_TARGET_KEYWORD_MESSAGE };
  }

  const existingDraft = await getSuccessfulWordPressDraft(articleId);
  if (!existingDraft) {
    const message = `기사(${articleId})에 대해 생성된 WordPress draft post가 없습니다. 먼저 'WordPress 초안 생성'을 실행하세요.`;
    await saveSeoPluginActualWriteResult(articleId, { status: "skipped_no_wordpress_post", provider });
    await logSeoWriteEvent("seo_plugin_actual_write_skipped_no_wordpress_post", "info", message, articleId, article, { provider });
    await savePublishLog({
      articleId,
      target: WORDPRESS_SEO_PLUGIN_TARGET,
      status: "skipped",
      details: { actual: false, reason: "no_wordpress_post", provider },
    });
    return { success: false, message };
  }

  const postId = Number(existingDraft.externalPostId);
  if (!Number.isInteger(postId) || postId <= 0) {
    const message = "기존 WordPress draft의 post id가 유효하지 않습니다.";
    await saveSeoPluginActualWriteResult(articleId, { status: "failed", provider, errorMessage: message });
    await logSeoWriteEvent("seo_plugin_actual_write_failed", "failed", message, articleId, article, { provider });
    await savePublishLog({
      articleId,
      target: WORDPRESS_SEO_PLUGIN_TARGET,
      status: "failed",
      errorMessage: message,
      details: { actual: true, provider, reasonCandidate: ["원인을 특정할 수 없는 오류입니다."] },
    });
    return { success: false, message };
  }

  // Phase 2-13: provider가 rank_math이고 custom endpoint가 활성화되어 있으면
  // 표준 REST posts meta update 대신 custom endpoint를 우선 사용한다.
  // custom endpoint 호출이 실패하면 표준 REST 방식으로 fallback하지 않는다
  // (어떤 경로가 실제 반영했는지 혼동을 막기 위함) — 실패를 그대로 저장한다.
  if (provider === "rank_math" && isSeoCustomEndpointEnabled()) {
    return runRankMathCustomEndpointWrite(articleId, article, postId, existingDraft.postUrl);
  }

  const fields = {
    seoTitle: article.seoTitle || article.title || undefined,
    metaDescription: article.metaDescription || undefined,
    focusKeyword: article.targetKeyword || undefined,
  };

  await logSeoWriteEvent(
    "seo_plugin_actual_write_started",
    "info",
    `기사(${articleId})의 SEO plugin(${provider}) metadata 실제 write를 시작합니다.`,
    articleId,
    article,
    { provider, postId }
  );

  const result = await updateSeoPluginMetadata(postId, provider, fields);

  if (!result.success) {
    await saveSeoPluginActualWriteResult(articleId, {
      status: "failed",
      provider,
      postId,
      errorMessage: result.errorMessage,
    });
    await logSeoWriteEvent(
      "seo_plugin_actual_write_failed",
      "failed",
      `SEO plugin metadata write 실패: ${result.errorMessage}`,
      articleId,
      article,
      { statusCode: result.statusCode ?? null, provider }
    );
    await savePublishLog({
      articleId,
      target: WORDPRESS_SEO_PLUGIN_TARGET,
      status: "failed",
      errorMessage: result.errorMessage,
      details: {
        actual: true,
        provider,
        statusCode: result.statusCode ?? null,
        reasonCandidate: result.reasonCandidate,
        ...buildKeywordSummary(article),
      },
    });
    return { success: false, message: result.errorMessage };
  }

  const verification = await verifySeoPluginMetadata(postId, result.fieldsAttempted);

  if (verification.verified) {
    await logSeoWriteEvent(
      "seo_plugin_actual_write_verification_completed",
      "success",
      `기사(${articleId})의 SEO plugin(${provider}) metadata 반영을 확인했습니다.`,
      articleId,
      article,
      { provider, postId }
    );
    await saveSeoPluginActualWriteResult(articleId, {
      status: "success",
      provider,
      postId,
      errorMessage: null,
      verified: true,
      warning: null,
    });
  } else {
    await logSeoWriteEvent(
      "seo_plugin_actual_write_verification_warning",
      "info",
      verification.warning ?? "SEO metadata 반영 여부를 확인할 수 없습니다.",
      articleId,
      article,
      { provider, postId }
    );
    await logSeoWriteEvent(
      "seo_plugin_actual_write_needs_custom_endpoint",
      "info",
      `기사(${articleId})의 SEO plugin(${provider}) 반영이 REST 응답에서 확인되지 않아 custom endpoint가 필요할 수 있습니다.`,
      articleId,
      article,
      { provider, postId }
    );
    await saveSeoPluginActualWriteResult(articleId, {
      status: "needs_custom_endpoint",
      provider,
      postId,
      errorMessage: null,
      verified: false,
      warning: verification.warning ?? null,
    });
  }

  await savePublishLog({
    articleId,
    target: WORDPRESS_SEO_PLUGIN_TARGET,
    status: "success",
    externalPostId: String(postId),
    postUrl: existingDraft.postUrl ?? undefined,
    details: {
      actual: true,
      provider,
      postId,
      fieldsAttempted: result.fieldsAttempted,
      verified: verification.verified,
      warning: verification.warning ?? null,
      ...buildKeywordSummary(article),
    },
  });

  return {
    success: true,
    message: verification.verified
      ? "SEO plugin metadata를 실제로 반영했습니다."
      : "SEO plugin metadata write 요청은 성공했지만 반영 여부는 확인되지 않았습니다 (custom endpoint가 필요할 수 있습니다).",
    verified: verification.verified,
    warning: verification.warning,
  };
}

/**
 * article의 Rank Math SEO metadata를 WordPress custom REST endpoint
 * (`ai-pipeline/v1/seo-meta`)를 통해 `update_post_meta`로 직접 저장한다
 * (Phase 2-13). provider가 rank_math가 아니거나 `WORDPRESS_SEO_CUSTOM_
 * ENDPOINT_ENABLED=false`이거나 WordPress draft post가 없으면 실제 API를
 * 호출하지 않고 안전하게 skip한다. 실패해도 표준 REST 방식으로 fallback하지
 * 않는다 — 실패를 그대로 저장한다.
 */
export async function writeRankMathSeoViaCustomEndpoint(articleId: string): Promise<WriteSeoPluginMetadataResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  const provider = getSeoPluginProvider();

  if (provider !== "rank_math") {
    const message = "SEO_PLUGIN_PROVIDER가 rank_math가 아니어서 custom endpoint를 사용할 수 없습니다.";
    await saveSeoPluginCustomEndpointResult(articleId, { status: "skipped_provider_not_supported" });
    await logSeoWriteEvent("seo_plugin_custom_endpoint_skipped_provider_not_supported", "info", message, articleId, article, { provider });
    await savePublishLog({
      articleId,
      target: WORDPRESS_SEO_CUSTOM_ENDPOINT_TARGET,
      status: "skipped",
      details: { actual: false, provider, reason: "provider_not_supported" },
    });
    return { success: false, message };
  }

  if (!isSeoCustomEndpointEnabled()) {
    const message = "WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED=false이어서 custom endpoint write를 건너뜁니다.";
    await saveSeoPluginCustomEndpointResult(articleId, { status: "skipped_disabled" });
    await logSeoWriteEvent("seo_plugin_custom_endpoint_skipped_disabled", "info", message, articleId, article, { provider });
    await savePublishLog({
      articleId,
      target: WORDPRESS_SEO_CUSTOM_ENDPOINT_TARGET,
      status: "skipped",
      details: { actual: false, provider, reason: "custom_endpoint_disabled" },
    });
    return { success: false, message };
  }

  if (!hasFocusKeyword(article)) {
    await saveSeoPluginCustomEndpointResult(articleId, { status: "skipped_missing_target_keyword" });
    await logSeoWriteEvent(
      "seo_plugin_custom_endpoint_skipped_missing_target_keyword",
      "info",
      MISSING_TARGET_KEYWORD_MESSAGE,
      articleId,
      article,
      { provider }
    );
    await savePublishLog({
      articleId,
      target: WORDPRESS_SEO_CUSTOM_ENDPOINT_TARGET,
      status: "skipped",
      details: { actual: false, reason: "missing_target_keyword", provider, ...buildKeywordSummary(article) },
    });
    return { success: false, message: MISSING_TARGET_KEYWORD_MESSAGE };
  }

  const existingDraft = await getSuccessfulWordPressDraft(articleId);
  if (!existingDraft) {
    const message = `기사(${articleId})에 대해 생성된 WordPress draft post가 없습니다. 먼저 'WordPress 초안 생성'을 실행하세요.`;
    await saveSeoPluginCustomEndpointResult(articleId, { status: "skipped_no_wordpress_post" });
    await logSeoWriteEvent("seo_plugin_custom_endpoint_skipped_no_wordpress_post", "info", message, articleId, article, { provider });
    await savePublishLog({
      articleId,
      target: WORDPRESS_SEO_CUSTOM_ENDPOINT_TARGET,
      status: "skipped",
      details: { actual: false, provider, reason: "no_wordpress_post" },
    });
    return { success: false, message };
  }

  const postId = Number(existingDraft.externalPostId);
  if (!Number.isInteger(postId) || postId <= 0) {
    const message = "기존 WordPress draft의 post id가 유효하지 않습니다.";
    await saveSeoPluginCustomEndpointResult(articleId, { status: "failed", errorMessage: message });
    await logSeoWriteEvent("seo_plugin_custom_endpoint_write_failed", "failed", message, articleId, article, { provider });
    await savePublishLog({
      articleId,
      target: WORDPRESS_SEO_CUSTOM_ENDPOINT_TARGET,
      status: "failed",
      errorMessage: message,
      details: { actual: true, provider, reasonCandidate: ["원인을 특정할 수 없는 오류입니다."] },
    });
    return { success: false, message };
  }

  return runRankMathCustomEndpointWrite(articleId, article, postId, existingDraft.postUrl);
}

/**
 * Rank Math SEO metadata를 실제로 custom endpoint에 반영하고 결과를 저장한다.
 * `writeSeoPluginMetadataToWordPress`(자동 라우팅)와
 * `writeRankMathSeoViaCustomEndpoint`(전용 버튼) 양쪽에서 공유한다.
 */
async function runRankMathCustomEndpointWrite(
  articleId: string,
  article: Article,
  postId: number,
  postUrl: string | null
): Promise<WriteSeoPluginMetadataResult> {
  await logSeoWriteEvent(
    "seo_plugin_custom_endpoint_write_started",
    "info",
    `기사(${articleId})의 Rank Math SEO metadata를 custom endpoint로 반영을 시작합니다.`,
    articleId,
    article,
    { provider: "rank_math", postId }
  );

  const result = await updateRankMathSeoViaCustomEndpoint({
    postId,
    seoTitle: article.seoTitle || article.title || undefined,
    metaDescription: article.metaDescription || undefined,
    focusKeyword: article.targetKeyword || undefined,
    secondaryKeywords: article.secondaryKeywords,
  });

  if (!result.success) {
    await saveSeoPluginCustomEndpointResult(articleId, { status: "failed", errorMessage: result.errorMessage });
    await saveSeoPluginActualWriteResult(articleId, {
      status: "failed",
      provider: "rank_math",
      postId,
      errorMessage: result.errorMessage,
    });
    await logSeoWriteEvent(
      "seo_plugin_custom_endpoint_write_failed",
      "failed",
      `custom endpoint write 실패: ${result.errorMessage}`,
      articleId,
      article,
      { statusCode: result.statusCode ?? null, provider: "rank_math" }
    );
    await savePublishLog({
      articleId,
      target: WORDPRESS_SEO_CUSTOM_ENDPOINT_TARGET,
      status: "failed",
      errorMessage: result.errorMessage,
      details: {
        actual: true,
        provider: "rank_math",
        statusCode: result.statusCode ?? null,
        reasonCandidate: result.reasonCandidate,
        verified: false,
        ...buildKeywordSummary(article),
      },
    });
    return { success: false, message: result.errorMessage };
  }

  if (!result.verified) {
    const message = "custom endpoint 응답은 성공했지만 반영이 확인되지 않았습니다 (verified: false).";
    await logSeoWriteEvent(
      "seo_plugin_custom_endpoint_verification_failed",
      "failed",
      message,
      articleId,
      article,
      { postId, provider: "rank_math" }
    );
    await saveSeoPluginCustomEndpointResult(articleId, { status: "failed", verified: false, errorMessage: message });
    await saveSeoPluginActualWriteResult(articleId, {
      status: "failed",
      provider: "rank_math",
      postId,
      errorMessage: message,
      verified: false,
    });
    await savePublishLog({
      articleId,
      target: WORDPRESS_SEO_CUSTOM_ENDPOINT_TARGET,
      status: "failed",
      errorMessage: message,
      details: {
        actual: true,
        provider: "rank_math",
        endpoint: "ai-pipeline/v1/seo-meta",
        updatedKeys: result.updatedKeys,
        verified: false,
        ...buildKeywordSummary(article),
      },
    });
    return { success: false, message };
  }

  await logSeoWriteEvent(
    "seo_plugin_custom_endpoint_write_completed",
    "success",
    `기사(${articleId})의 Rank Math SEO metadata를 custom endpoint로 반영했습니다.`,
    articleId,
    article,
    { postId, provider: "rank_math", updatedKeys: result.updatedKeys }
  );
  await logSeoWriteEvent(
    "seo_plugin_custom_endpoint_verification_completed",
    "success",
    `기사(${articleId})의 Rank Math SEO metadata 반영을 확인했습니다 (custom endpoint).`,
    articleId,
    article,
    { postId }
  );

  await saveSeoPluginCustomEndpointResult(articleId, { status: "success", verified: true, errorMessage: null });
  await saveSeoPluginActualWriteResult(articleId, {
    status: "success",
    provider: "rank_math",
    postId,
    errorMessage: null,
    verified: true,
    warning: null,
  });

  await savePublishLog({
    articleId,
    target: WORDPRESS_SEO_CUSTOM_ENDPOINT_TARGET,
    status: "success",
    externalPostId: String(postId),
    postUrl: postUrl ?? undefined,
    details: {
      actual: true,
      provider: "rank_math",
      endpoint: "ai-pipeline/v1/seo-meta",
      updatedKeys: result.updatedKeys,
      verified: true,
      ...buildKeywordSummary(article),
    },
  });

  return {
    success: true,
    message: "Rank Math SEO metadata를 custom endpoint로 반영했습니다.",
    verified: true,
  };
}
