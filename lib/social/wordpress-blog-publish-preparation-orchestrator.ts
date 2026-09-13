// wordpress_blog 글 카드의 "WordPress 게시 준비 일괄 실행" 버튼이 사용하는
// 오케스트레이터. 기존에 각각 존재하던 실제 서비스 함수(draft 생성,
// SEO metadata 업데이트, featured image 연결, publish guard)를 순서대로
// 호출할 뿐, 새로운 외부 API 호출 로직은 추가하지 않는다. 실제 공개
// (public) 게시는 어떤 단계에서도 수행하지 않는다 — WordPress에는
// 항상 draft 상태로만 남는다.

import { getSocialPostById, updateSocialPostContent } from "@/lib/repositories/social-posts-repository";
import type { SocialPost } from "./social-platform-types";
import { getSuccessfulWordPressDraft } from "@/lib/repositories/publish-repository";
import { publishArticleToWordPressDraft } from "@/lib/publish/publish-service";
import { buildWordPressBlogContentOverride } from "./wordpress-blog-content-override-builder";
import { attachFeaturedMediaToDraft } from "@/lib/publish/wordpress-featured-media-service";
import { runPlatformPublishingGuard } from "./platform-publishing-guard-service";
import { updateWordPressSeoMetadataFromBlogPost } from "./wordpress-blog-seo-metadata-service";
import { writeSeoPluginMetadataToWordPress } from "@/lib/seo/seo-plugin-actual-write-service";
import { getArticleById } from "@/lib/repositories/article-repository";
import { approveSocialPost } from "./social-post-approval-service";
import { regenerateWordPressBlogMetadata } from "./wordpress-blog-metadata-regeneration-service";

export type WordPressBlogPreparationStep =
  | "quality"
  | "approval"
  | "draft"
  | "seo_auto_generate"
  | "seo_metadata"
  | "seo_plugin"
  | "featured_image"
  | "publish_guard";

export interface WordPressBlogPreparationStepResult {
  step: WordPressBlogPreparationStep;
  status: "success" | "skipped" | "warning" | "failed";
  message: string;
}

export interface PrepareWordPressBlogPostForPublishingResult {
  success: boolean;
  /** 실패해서 멈춘 단계 (성공적으로 끝까지 갔다면 undefined). */
  failedStep?: WordPressBlogPreparationStep;
  /**
   * Phase 4-10: success=true인데 일부 단계(SEO plugin/대표 이미지)가
   * warning으로 끝났으면 true — "Draft는 만들어졌지만 확인할 게 있다"는
   * 뜻이다. success=false면 항상 false(실패는 partialSuccess가 아니다).
   */
  partialSuccess: boolean;
  steps: WordPressBlogPreparationStepResult[];
  message: string;
}

const STEP_LABELS: Record<WordPressBlogPreparationStep, string> = {
  quality: "품질검사",
  approval: "승인",
  draft: "WordPress Draft",
  seo_auto_generate: "SEO 정보 자동 생성",
  seo_metadata: "SEO Metadata",
  seo_plugin: "SEO 정보 반영",
  featured_image: "대표 이미지",
  publish_guard: "게시 가능 상태",
};

/** "최근 WordPress 반영 결과" UI에서 단계 코드를 사용자 친화적인 한국어로 보여줄 때 쓴다. */
export function getWordPressBlogPreparationStepLabel(step: WordPressBlogPreparationStep): string {
  return STEP_LABELS[step] ?? step;
}

const STEP_STATUS_LABELS: Record<WordPressBlogPreparationStepResult["status"], string> = {
  success: "성공",
  skipped: "건너뜀",
  warning: "경고",
  failed: "실패",
};

export function getWordPressBlogPreparationStepStatusLabel(status: WordPressBlogPreparationStepResult["status"]): string {
  return STEP_STATUS_LABELS[status] ?? status;
}

/**
 * 실행 결과를 반환하기 직전에 social_posts.platformMetadata.lastPublishPreparationRun
 * (JSON, DB schema 변경 없음)에 그대로 남긴다 — "WordPress에 반영하기"를
 * 실행한 뒤 페이지를 새로고침해도(redirect 이후 flash message가 사라져도)
 * "최근 WordPress 반영 결과" 섹션에서 마지막 실행 결과를 계속 볼 수 있게
 * 하기 위해서다. 저장 자체가 실패해도 게시 준비 결과(steps)는 그대로
 * 반환한다 — 화면에 최근 결과가 갱신되지 않을 뿐 실행 결과에는 영향 없다.
 */
async function finishAndPersist(
  post: SocialPost,
  result: PrepareWordPressBlogPostForPublishingResult
): Promise<PrepareWordPressBlogPostForPublishingResult> {
  try {
    const existingMetadata = post.platformMetadata ?? {};
    await updateSocialPostContent(post.id, {
      platformMetadata: {
        ...existingMetadata,
        lastPublishPreparationRun: {
          success: result.success,
          failedStep: result.failedStep ?? null,
          steps: result.steps,
          message: result.message,
          ranAt: new Date().toISOString(),
        },
      },
    });
  } catch {
    // 저장 실패는 무시한다 — 아래 주석 참고.
  }
  return result;
}

/**
 * wordpress_blog 글 하나를 대상으로 "게시 준비" 전체 단계를 순서대로
 * 실행한다: quality/approval 확인 → draft 생성 또는 업데이트 →
 * SEO metadata 업데이트 → (media id가 있으면) featured image 연결 →
 * publish guard 실행. 어느 단계든 실패하면 그 단계에서 멈추고, 어떤
 * 단계까지 진행됐는지를 그대로 반환한다. 실제 공개 게시는 절대
 * 수행하지 않는다.
 */
export async function prepareWordPressBlogPostForPublishing(
  articleId: string,
  socialPostId: string
): Promise<PrepareWordPressBlogPostForPublishingResult> {
  const steps: WordPressBlogPreparationStepResult[] = [];

  let post = await getSocialPostById(socialPostId);
  if (!post) {
    return { success: false, partialSuccess: false, steps, message: `블로그 글을 찾을 수 없습니다: ${socialPostId}` };
  }
  if (post.platform !== "wordpress_blog") {
    return {
      success: false,
      partialSuccess: false,
      steps,
      message: `이 기능은 wordpress_blog 글에서만 사용할 수 있습니다 (현재 platform: ${post.platform}).`,
    };
  }

  // 1) quality_status 확인 (실행하지 않고 확인만 — 품질검사는 사람이 별도 버튼으로 실행한다)
  if (post.qualityStatus !== "ready") {
    const message = `quality_status가 ready가 아닙니다 (현재: ${post.qualityStatus}). 먼저 품질검사를 통과하세요.`;
    steps.push({ step: "quality", status: "failed", message });
    return finishAndPersist(post, { success: false, partialSuccess: false, failedStep: "quality", steps, message });
  }
  steps.push({ step: "quality", status: "success", message: "quality_status=ready 확인됨." });

  // 2) approval_status 확인 (실행하지 않고 확인만 — 승인은 사람이 직접 눌러야 한다)
  if (post.approvalStatus !== "approved") {
    const message = `approval_status가 approved가 아닙니다 (현재: ${post.approvalStatus}). 먼저 승인하세요.`;
    steps.push({ step: "approval", status: "failed", message });
    return finishAndPersist(post, { success: false, partialSuccess: false, failedStep: "approval", steps, message });
  }
  steps.push({ step: "approval", status: "success", message: "approval_status=approved 확인됨." });

  // 3) WordPress draft 생성 또는(이미 있으면) 업데이트.
  //    실제 WordPress로 보내는 title/content는 article 원문이 아니라
  //    이 wordpress_blog 글 자체의 post_title/post_body를 사용하며,
  //    post_body(markdown)는 buildWordPressBlogContentOverride 안에서
  //    WordPress 전송용 HTML로 변환된다(그렇지 않으면 공개 화면에
  //    `## 소제목` 같은 markdown 문법이 그대로 노출된다).
  const contentOverride = buildWordPressBlogContentOverride(post);
  const existingDraft = await getSuccessfulWordPressDraft(articleId);
  const draftResult = existingDraft
    ? await publishArticleToWordPressDraft(articleId, { force: true, contentOverride })
    : await publishArticleToWordPressDraft(articleId, { contentOverride });
  if (!draftResult.success) {
    steps.push({ step: "draft", status: "failed", message: draftResult.message });
    return finishAndPersist(post, { success: false, partialSuccess: false, failedStep: "draft", steps, message: draftResult.message });
  }
  steps.push({ step: "draft", status: "success", message: draftResult.message });

  // 3.5) Phase 4-11(3차): SEO 정보 자동 생성/보완 — wordpress_blog 글 자신의
  //      seoTitle/metaDescription/targetKeyword 중 하나라도 없으면, 이미
  //      존재하는 결정론적 생성기(generateWordPressBlogMetadata, "SEO
  //      Metadata 재생성" 버튼과 동일한 함수)로 자동으로 채운다. 이 함수는
  //      새 AI 호출 없이 wordpress_blog 자신의 title/body/excerpt에서만
  //      값을 도출하므로 사실/숫자/날짜/기관명을 지어내지 않는다. 이미
  //      값이 있으면(사람이 직접 채운 값 포함) 아무것도 건드리지 않는다.
  const platformMetadataForSeoCheck = post.platformMetadata ?? {};
  const hasSeoTitle =
    typeof platformMetadataForSeoCheck.seoTitle === "string" && platformMetadataForSeoCheck.seoTitle.trim().length > 0;
  const hasMetaDescription =
    typeof platformMetadataForSeoCheck.metaDescription === "string" &&
    platformMetadataForSeoCheck.metaDescription.trim().length > 0;
  const hasTargetKeyword =
    typeof platformMetadataForSeoCheck.targetKeyword === "string" &&
    platformMetadataForSeoCheck.targetKeyword.trim().length > 0;

  if (hasSeoTitle && hasMetaDescription && hasTargetKeyword) {
    steps.push({
      step: "seo_auto_generate",
      status: "skipped",
      message: "seoTitle/metaDescription/targetKeyword가 이미 있어 자동 생성을 건너뜁니다.",
    });
  } else {
    const regenResult = await regenerateWordPressBlogMetadata(articleId, socialPostId);
    if (regenResult.success) {
      steps.push({ step: "seo_auto_generate", status: "success", message: regenResult.message });
      // platformMetadata가 방금 바뀌었으므로, 아래 SEO metadata 업데이트
      // 단계가 최신 값을 쓸 수 있게 post를 다시 읽는다.
      const refreshedPost = await getSocialPostById(socialPostId);
      if (refreshedPost) post = refreshedPost;
    } else {
      // post_title/post_body가 비어 있는 등 자동 생성 자체가 불가능한
      // 경우 — 실패해도 전체를 막지 않는다(부가 단계). 뒤의 seo_metadata
      // 단계에서 여전히 필드가 없으면 그 단계가 실패로 안내한다.
      steps.push({ step: "seo_auto_generate", status: "warning", message: regenResult.message });
    }
  }

  // 4) SEO metadata 업데이트 (wordpress_blog 글의 seoTitle/metaDescription 우선)
  const seoResult = await updateWordPressSeoMetadataFromBlogPost(articleId, socialPostId);
  if (!seoResult.success) {
    steps.push({ step: "seo_metadata", status: "failed", message: seoResult.message });
    return finishAndPersist(post, {
      success: false,
      partialSuccess: false,
      failedStep: "seo_metadata",
      steps,
      message: seoResult.message,
    });
  }
  steps.push({ step: "seo_metadata", status: "success", message: seoResult.message });

  // 4.5) SEO plugin(Rank Math 등) 실제 반영 — provider가 rank_math이고 custom
  //      endpoint가 켜져 있으면 writeSeoPluginMetadataToWordPress()가 내부에서
  //      custom endpoint를 우선 사용한다(lib/seo/seo-plugin-actual-write-service.ts).
  //      이 단계는 "실패해도 전체를 막지 않는다" — SEO plugin 미설정(provider
  //      없음)이 흔한 정상 상태이기 때문이다. Draft/기본 SEO metadata는 이미
  //      반영됐으므로, 실패해도 Draft 생성 자체는 계속 진행한다(부분 성공).
  const seoPluginResult = await writeSeoPluginMetadataToWordPress(articleId);
  if (seoPluginResult.success) {
    steps.push({ step: "seo_plugin", status: "success", message: seoPluginResult.message });
  } else if (seoPluginResult.message.includes("건너뜁니다")) {
    steps.push({ step: "seo_plugin", status: "skipped", message: seoPluginResult.message });
  } else {
    steps.push({ step: "seo_plugin", status: "warning", message: seoPluginResult.message });
  }

  // 5) featured image 연결 — media id가 없으면 실패가 아니라 건너뛴다. media
  //    id도 없고 "이미지 없이 진행"(waived)도 선택되지 않았으면 경고로
  //    표시한다(중단하지는 않는다 — 게시 가능 상태 확인에서 다시 확인된다).
  //    Phase 4-10: featured image 연결이 실패해도(예: media id는 있지만 API
  //    호출 실패) 더 이상 전체 파이프라인을 막지 않는다 — 본문/SEO는 이미
  //    Draft에 반영된 상태를 유지하고, 대표 이미지만 "확인 필요"로 남긴다
  //    (부분 성공, 섹션 12의 "실패 시 복구 흐름" 예시 1).
  const article = await getArticleById(articleId);
  const featuredImageMeta =
    typeof post.platformMetadata?.featuredImage === "object" && post.platformMetadata.featuredImage !== null
      ? (post.platformMetadata.featuredImage as Record<string, unknown>)
      : {};
  const featuredImageWaived = featuredImageMeta.waived === true;

  if (article?.featuredImageWordpressMediaId) {
    const mediaResult = await attachFeaturedMediaToDraft(articleId);
    steps.push({
      step: "featured_image",
      status: mediaResult.success ? "success" : "warning",
      message: mediaResult.message,
    });
  } else if (featuredImageWaived) {
    steps.push({
      step: "featured_image",
      status: "skipped",
      message: "대표 이미지 없이 진행하도록 선택되어 있습니다 (WordPress media id 없음).",
    });
  } else {
    steps.push({
      step: "featured_image",
      status: "warning",
      message:
        "대표 이미지가 아직 준비되지 않았습니다 (WordPress media id 없음, '이미지 없이 진행'도 선택되지 않음). 대표 이미지를 업로드하거나 '대표 이미지 없이 진행'을 선택하세요.",
    });
  }

  // 6) publish guard 실행 (social_post 기준)
  const guardResult = await runPlatformPublishingGuard(socialPostId);
  steps.push({
    step: "publish_guard",
    status: guardResult.success ? "success" : "failed",
    message: guardResult.message,
  });
  if (!guardResult.success) {
    return finishAndPersist(post, {
      success: false,
      partialSuccess: false,
      failedStep: "publish_guard",
      steps,
      message: guardResult.message,
    });
  }

  const hasWarning = steps.some((step) => step.status === "warning");
  return finishAndPersist(post, {
    success: true,
    partialSuccess: hasWarning,
    steps,
    message: hasWarning
      ? "WordPress 게시 준비를 완료했지만 확인이 필요한 항목이 있습니다 (실제 공개 게시는 수행하지 않았습니다)."
      : "WordPress 게시 준비를 모두 완료했습니다 (실제 공개 게시는 수행하지 않았습니다).",
  });
}

/**
 * Phase 4-10: "승인하고 WordPress Draft 만들기" 통합 버튼이 사용하는 함수.
 * approveSocialPost()로 승인한 뒤 곧바로 prepareWordPressBlogPostForPublishing()을
 * 실행한다 — 사용자가 "승인" → "게시 준비 실행" 두 번 누르지 않고 한 번에
 * 끝내기 위해서다. 승인 자체가 실패하면(예: 이미 다른 사유로 막혀 있음)
 * 게시 준비 단계는 시도하지 않는다.
 */
export async function approveAndPrepareWordPressBlogPostForPublishing(
  articleId: string,
  socialPostId: string,
  approvedBy: string,
  notes?: string
): Promise<PrepareWordPressBlogPostForPublishingResult> {
  const approvalResult = await approveSocialPost(socialPostId, approvedBy, notes);
  if (!approvalResult.success) {
    return {
      success: false,
      partialSuccess: false,
      failedStep: "approval",
      steps: [{ step: "approval", status: "failed", message: approvalResult.message }],
      message: approvalResult.message,
    };
  }
  return prepareWordPressBlogPostForPublishing(articleId, socialPostId);
}
