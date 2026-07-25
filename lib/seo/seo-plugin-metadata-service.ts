// Phase 2-4: SEO Plugin Metadata Mapping 서비스.
// Phase 2-3에서 생성한 SEO title/meta description/slug/target keyword/
// secondary keywords 등을 WordPress SEO plugin(none/yoast/rank_math/aioseo)별
// payload로 변환해 저장한다. 실제 plugin write는 하지 않는다(mapping/저장만).

import {
  getArticleById,
  saveSeoPluginMetadata,
  markSeoPluginMetadataReviewed as markReviewedInRepository,
} from "@/lib/repositories/article-repository";
import { logEvent } from "@/lib/harness/logger";
import { validateSeoPluginProvider } from "./seo-plugin-config";
import { mapSeoPluginPayload } from "./plugin-mappers";
import type { Article, ArticleMode, SeoPluginProvider } from "@/lib/types/domain";
import type { SeoPluginMapperInput, SeoPluginPayload } from "./seo-plugin-types";

export interface GenerateSeoPluginResult {
  success: boolean;
  message: string;
  payload?: SeoPluginPayload;
  provider?: SeoPluginProvider;
}

const SCHEMA_TYPE_BY_MODE: Record<ArticleMode, string> = {
  general_news: "NewsArticle",
  source_based_explainer: "Article",
  monetized_blog: "BlogPosting",
};

/** WORDPRESS_BASE_URL(공개 사이트 URL, 인증 정보 아님) + slug로 canonical URL 후보를 만든다. */
function computeCanonicalUrl(article: Article): string | undefined {
  const baseUrl = process.env.WORDPRESS_BASE_URL;
  if (!baseUrl || !article.slug) return undefined;
  return `${baseUrl.replace(/\/+$/, "")}/${article.slug}`;
}

function buildMapperInput(article: Article): SeoPluginMapperInput {
  return {
    articleId: article.id,
    articleMode: article.articleMode,
    title: article.title,
    seoTitle: article.seoTitle || article.title,
    metaDescription: article.metaDescription || "",
    slug: article.slug || "",
    targetKeyword: article.targetKeyword ?? undefined,
    secondaryKeywords: article.secondaryKeywords,
    formatMetadata: article.formatMetadata,
    wpCategoryNames: article.wpCategoryNames,
    wpTagNames: article.wpTagNames,
    canonicalUrl: computeCanonicalUrl(article),
    schemaType: SCHEMA_TYPE_BY_MODE[article.articleMode],
  };
}

/**
 * article_mode/keyword 기반 metadata를 provider별 SEO plugin payload로 변환해 저장한다.
 * provider 결정 우선순위: 인자(providerOverride) > SEO_PLUGIN_PROVIDER 환경변수 > none.
 * 실제 WordPress/plugin API를 호출하지 않으므로 WORDPRESS_PUBLISH_ENABLED/
 * SEO_PLUGIN_WRITE_ENABLED 값과 무관하게 항상 동작한다.
 */
export async function generateSeoPluginPayload(
  articleId: string,
  providerOverride?: SeoPluginProvider
): Promise<GenerateSeoPluginResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  const { provider, warning } = providerOverride
    ? { provider: providerOverride, warning: undefined }
    : validateSeoPluginProvider(process.env.SEO_PLUGIN_PROVIDER);

  await logEvent({
    type: "seo_plugin_metadata_generation_started",
    status: "info",
    message: `기사(${articleId}) SEO plugin(${provider}) metadata 생성을 시작합니다.${warning ? ` ${warning}` : ""}`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  try {
    const payload = mapSeoPluginPayload(provider, buildMapperInput(article));

    await saveSeoPluginMetadata({ articleId, provider, payload, status: "generated" });

    await logEvent({
      type: "seo_plugin_metadata_generation_completed",
      status: "success",
      message: `기사(${articleId}) SEO plugin(${provider}) metadata 생성을 완료했습니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
      details: {
        provider,
        seoTitle: payload.seoTitle,
        focusKeyword: payload.focusKeyword ?? null,
      },
    });

    return { success: true, message: "SEO plugin metadata를 생성했습니다.", payload, provider };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

    try {
      await saveSeoPluginMetadata({
        articleId,
        provider,
        payload: {
          provider,
          seoTitle: article.seoTitle || article.title,
          metaDescription: article.metaDescription || "",
          secondaryKeywords: [],
        },
        status: "failed",
      });
    } catch {
      // metadata 저장 실패는 무시하고 원래 오류를 그대로 알린다.
    }

    await logEvent({
      type: "seo_plugin_metadata_generation_failed",
      status: "failed",
      message: `SEO plugin metadata 생성 실패: ${message}`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
      details: { error: message },
    });

    return { success: false, message };
  }
}

/** SEO plugin metadata를 사람이 검토 완료했음을 표시한다. */
export async function reviewSeoPluginMetadata(articleId: string): Promise<GenerateSeoPluginResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  await markReviewedInRepository(articleId);

  await logEvent({
    type: "seo_plugin_metadata_reviewed",
    status: "success",
    message: `기사(${articleId})의 SEO plugin metadata 검토를 완료했습니다.`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  return { success: true, message: "SEO plugin metadata 검토를 완료했습니다." };
}
