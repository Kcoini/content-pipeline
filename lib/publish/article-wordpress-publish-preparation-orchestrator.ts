// Phase 2-20: 기사 개요 "고급 기능: 원본 article WordPress 전송"의 게시 준비를
// 자동화하는 오케스트레이터. 기존에 각각 버튼으로 나뉘어 있던 WordPress
// Metadata 생성/SEO Plugin Metadata 생성(Rank Math 기본)/대표 이미지 준비·
// 생성(또는 waiver)/Quality Gate 실행을 한 번에 순서대로 실행한다.
//
// 이 파일은 새로운 외부 API 호출 로직을 추가하지 않는다 — 이미 존재하는
// 서비스 함수(generateWordPressMetadata/generateSeoPluginPayload/
// prepareFeaturedImage/generateFeaturedImage/waiveArticleWordPressFeaturedImage/
// runPublishQualityGate)를 그대로 순서대로 호출할 뿐이다.
//
// 절대 하지 않는 것: 실제 WordPress 공개(public) 게시. 이 오케스트레이터는
// WordPress Draft 반영 "이전" 준비 단계까지만 다룬다 — Draft 생성/업데이트는
// 별도의 publishArticleToWordPressDraft(기존 publishToWordPressDraftAction)를
// 사용자가 직접 눌러야 실행된다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { logEvent } from "@/lib/harness/logger";
import { generateWordPressMetadata } from "./wordpress-metadata-service";
import { generateSeoPluginPayload } from "@/lib/seo/seo-plugin-metadata-service";
import { prepareFeaturedImage } from "@/lib/images/featured-image-preparation-service";
import { generateFeaturedImage } from "@/lib/images/image-generation-service";
import { isImageGenerationEnabled } from "@/lib/images/image-generation-config";
import {
  waiveArticleWordPressFeaturedImage,
  getArticleWordPressFeaturedImageWaiverState,
} from "./article-wordpress-featured-image-waiver-service";
import { runPublishQualityGate } from "./publish-quality-gate-service";
import type { SeoPluginProvider } from "@/lib/types/domain";

export type ArticleWordPressPreparationStep =
  | "wordpress_metadata"
  | "seo_metadata"
  | "featured_image_prompt"
  | "image_generation"
  | "quality_gate";

export interface ArticleWordPressPreparationStepResult {
  step: ArticleWordPressPreparationStep;
  status: "success" | "skipped" | "warning" | "failed";
  message: string;
}

export interface PrepareArticleWordPressPublishingOptions {
  /**
   * true면 이미 생성된 WordPress Metadata/SEO Plugin Metadata/대표 이미지
   * 정보도 다시 생성한다. 기본값 false — 이미 값이 있으면 자동 실행 시
   * 덮어쓰지 않고 그대로 유지한다("재생성"은 사용자가 개별 secondary
   * 버튼으로 명시적으로 선택해야 한다).
   */
  overwrite?: boolean;
}

export interface PrepareArticleWordPressPublishingResult {
  success: boolean;
  steps: ArticleWordPressPreparationStepResult[];
  message: string;
}

const STEP_LABELS: Record<ArticleWordPressPreparationStep, string> = {
  wordpress_metadata: "WordPress Metadata",
  seo_metadata: "SEO Plugin Metadata",
  featured_image_prompt: "대표 이미지 준비",
  image_generation: "이미지 생성",
  quality_gate: "Quality Gate",
};

export function getArticleWordPressPreparationStepLabel(step: ArticleWordPressPreparationStep): string {
  return STEP_LABELS[step] ?? step;
}

/**
 * 기사 하나를 대상으로 WordPress 게시 준비 전체 단계를 자동으로 실행한다:
 * WordPress Metadata 생성(없으면) → SEO Plugin Metadata 생성(없으면, 기본
 * Rank Math) → 대표 이미지 prompt 준비(없으면) → 이미지 생성 시도 또는
 * (비활성화/실패 시) 자동 waiver 적용 → Quality Gate 실행. 각 단계 실패는
 * 다음 단계를 막지 않는다(quality/approval과 달리, 준비 단계 자체는 부분
 * 실패해도 사람이 검토할 수 있도록 끝까지 진행한다) — 단, WordPress
 * Metadata 생성처럼 이후 단계가 의미 없어지는 치명적 실패는 그 자리에서
 * 멈춘다.
 */
export async function prepareArticleWordPressPublishing(
  articleId: string,
  options: PrepareArticleWordPressPublishingOptions = {}
): Promise<PrepareArticleWordPressPublishingResult> {
  const steps: ArticleWordPressPreparationStepResult[] = [];

  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, steps, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  await logEvent({
    type: "article_wordpress_prepare_started",
    status: "info",
    message: `기사(${articleId})의 WordPress 게시 준비 자동 실행을 시작합니다.`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
    details: { overwrite: Boolean(options.overwrite) },
  });

  // 1) WordPress Metadata — 없으면(또는 overwrite) 자동 생성. 사용자는 검토만 한다.
  if (article.wpMetadataStatus === "not_ready" || options.overwrite) {
    const result = await generateWordPressMetadata(articleId);
    if (!result.success) {
      steps.push({ step: "wordpress_metadata", status: "failed", message: result.message });
      await logEvent({
        type: "article_wordpress_prepare_failed",
        status: "failed",
        message: `기사(${articleId})의 WordPress 게시 준비가 WordPress Metadata 생성 단계에서 실패했습니다: ${result.message}`,
        articleId,
        themeId: article.themeId,
        targetType: "article",
        targetId: articleId,
        details: { failedStep: "wordpress_metadata" },
      });
      return { success: false, steps, message: result.message };
    }
    steps.push({ step: "wordpress_metadata", status: "success", message: "WordPress Metadata를 자동 생성했습니다 — 검토가 필요합니다." });
    await logEvent({
      type: "article_wordpress_metadata_generated",
      status: "success",
      message: `기사(${articleId})의 WordPress Metadata를 자동 생성했습니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
  } else {
    steps.push({
      step: "wordpress_metadata",
      status: "skipped",
      message: "이미 생성된 WordPress Metadata를 유지합니다(다시 만들려면 'WordPress Metadata 재생성'을 사용하세요).",
    });
  }

  // 2) SEO Plugin Metadata — 기본 provider는 Rank Math다. 이미 provider가
  //    none이 아니게 설정되어 있으면(사용자가 다른 provider를 선택했을 수
  //    있음) 그 값을 존중하고, provider가 none이거나 아직 생성된 적이
  //    없으면 Rank Math로 기본 설정한다.
  if (article.seoPluginProvider === "none" || article.seoPluginMetadataStatus === "not_ready" || options.overwrite) {
    const usedRankMathDefault = article.seoPluginProvider === "none" || options.overwrite;
    const provider: SeoPluginProvider = usedRankMathDefault ? "rank_math" : article.seoPluginProvider;

    if (usedRankMathDefault) {
      await logEvent({
        type: "article_wordpress_seo_provider_defaulted_rank_math",
        status: "info",
        message: `기사(${articleId})의 SEO Plugin provider를 기본값(Rank Math)으로 설정합니다.`,
        articleId,
        themeId: article.themeId,
        targetType: "article",
        targetId: articleId,
      });
    }

    const result = await generateSeoPluginPayload(articleId, provider);
    steps.push({
      step: "seo_metadata",
      status: result.success ? "success" : "failed",
      message: result.success
        ? `SEO Plugin Metadata(${provider} 기준)를 자동 생성했습니다 — 검토가 필요합니다.`
        : result.message,
    });
    if (result.success) {
      await logEvent({
        type: "article_wordpress_seo_metadata_generated",
        status: "success",
        message: `기사(${articleId})의 SEO Plugin Metadata(${provider})를 자동 생성했습니다.`,
        articleId,
        themeId: article.themeId,
        targetType: "article",
        targetId: articleId,
        details: { provider },
      });
    }
  } else {
    steps.push({
      step: "seo_metadata",
      status: "skipped",
      message: "이미 생성된 SEO Plugin Metadata를 유지합니다(다시 만들려면 'SEO Metadata 재생성'을 사용하세요).",
    });
  }

  // 3) 대표 이미지 prompt 준비 — 없으면(또는 overwrite) 자동 생성.
  if (article.featuredImageStatus === "not_ready" || options.overwrite) {
    const result = await prepareFeaturedImage(articleId);
    steps.push({
      step: "featured_image_prompt",
      status: result.success ? "success" : "failed",
      message: result.success ? "대표 이미지 prompt를 자동 생성했습니다." : result.message,
    });
    if (result.success) {
      await logEvent({
        type: "article_wordpress_image_prompt_generated",
        status: "success",
        message: `기사(${articleId})의 대표 이미지 prompt를 자동 생성했습니다.`,
        articleId,
        themeId: article.themeId,
        targetType: "article",
        targetId: articleId,
      });
    }
  } else {
    steps.push({ step: "featured_image_prompt", status: "skipped", message: "이미 준비된 대표 이미지 정보를 유지합니다." });
  }

  // 4) 이미지 생성 시도 또는 자동 waiver. 이미지가 없다는 이유만으로
  //    WordPress Draft 반영을 막지 않는다 — 실패/비활성화 시 자동으로
  //    "이미지 없음으로 진행 가능" 상태(waiver)로 둔다.
  const articleAfterPrompt = await getArticleById(articleId);
  const hasMediaId = Boolean(articleAfterPrompt?.featuredImageWordpressMediaId);
  const alreadyWaived = articleAfterPrompt
    ? getArticleWordPressFeaturedImageWaiverState(articleAfterPrompt).waived
    : false;

  if (hasMediaId) {
    steps.push({ step: "image_generation", status: "skipped", message: "이미 대표 이미지 media id가 설정되어 있습니다." });
  } else if (alreadyWaived && !options.overwrite) {
    steps.push({ step: "image_generation", status: "skipped", message: "이미 '이미지 없음으로 진행'이 설정되어 있습니다." });
  } else if (isImageGenerationEnabled()) {
    await logEvent({
      type: "article_wordpress_image_generation_attempted",
      status: "info",
      message: `기사(${articleId})의 대표 이미지 자동 생성을 시도합니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
    const genResult = await generateFeaturedImage(articleId);
    if (genResult.success) {
      steps.push({ step: "image_generation", status: "success", message: "대표 이미지를 자동 생성했습니다 — 검토가 필요합니다." });
    } else {
      const waiveResult = await waiveArticleWordPressFeaturedImage(articleId, "auto_generation_unavailable");
      steps.push({
        step: "image_generation",
        status: "warning",
        message: `대표 이미지 자동 생성에 실패해 이미지 없이 진행 가능하도록 설정했습니다 (${genResult.message}).`,
      });
      if (!waiveResult.success) {
        // waiver 저장 자체가 실패해도 준비 흐름 전체를 중단하지 않는다 —
        // 사람이 Featured Image Preparation 섹션에서 수동으로 다시 확인할 수 있다.
        steps.push({ step: "image_generation", status: "warning", message: `자동 waiver 저장에 실패했습니다: ${waiveResult.message}` });
      }
    }
  } else {
    await logEvent({
      type: "article_wordpress_image_generation_skipped",
      status: "info",
      message: `기사(${articleId})는 이미지 생성 기능이 비활성화되어 있어(IMAGE_GENERATION_ENABLED=false) 자동 생성을 건너뜁니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
    await waiveArticleWordPressFeaturedImage(articleId, "auto_generation_unavailable");
    steps.push({
      step: "image_generation",
      status: "warning",
      message: "이미지 생성 기능이 비활성화되어 있어 이미지 없이 진행 가능하도록 설정했습니다.",
    });
  }

  // 5) Quality Gate — 규칙 기반(결정적) 검사라 매번 다시 실행해도 안전하다.
  const qualityResult = await runPublishQualityGate(articleId);
  steps.push({
    step: "quality_gate",
    status: qualityResult.success ? (qualityResult.status === "blocked" ? "failed" : "success") : "failed",
    message: qualityResult.message,
  });

  await logEvent({
    type: "article_wordpress_prepare_completed",
    status: "success",
    message: `기사(${articleId})의 WordPress 게시 준비 자동 실행을 완료했습니다 (실제 공개 게시는 수행하지 않았습니다).`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
    details: { qualityStatus: qualityResult.status },
  });

  return {
    success: true,
    steps,
    message:
      "WordPress 게시 준비를 자동으로 실행했습니다. 생성된 내용을 검토한 뒤 승인하면 WordPress Draft에 반영할 수 있습니다 (공개 게시는 자동 실행되지 않습니다).",
  };
}
