// Phase 3-2: prompt/context/contract 구조를 실제로 엮어 social post draft를
// 생성하는 서비스. SOCIAL_AI_GENERATION_ENABLED=false(기본값)이면 실제
// Claude API를 호출하지 않고 mock output을 생성한다. true로 설정해도 이
// 단계에서는 실제 AI 호출을 구현하지 않으며, 구조만 준비한다(다음 단계에서
// 실제 연동). 모든 단계는 pipeline_logs(event_name 기준)에 기록되며,
// prompt 전문/article 원문/API key는 로그에 남기지 않는다.

import { createSocialPostDraft } from "@/lib/repositories/social-posts-repository";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import { buildSocialWritingContext, type SocialWritingContext } from "./social-writing-context-builder";
import { assembleSocialWritingPrompt } from "./social-prompt-assembler";
import { validateSocialOutput, type SocialOutputRaw } from "./social-output-contract-validator";
import { isSocialAiGenerationEnabled } from "./social-ai-generation-config";
import type { SocialPlatform, ToneStyle, SocialPost, ThreadItem, CardItem } from "./social-platform-types";

export interface GenerateSocialDraftResult {
  success: boolean;
  message: string;
  socialPost?: SocialPost;
  valid?: boolean;
  errors?: string[];
  warnings?: string[];
}

async function logSocialEvent(
  type: LogEventType,
  status: LogStatus,
  message: string,
  articleId: string,
  details?: Record<string, unknown>
): Promise<void> {
  await logEvent({
    type,
    status,
    message,
    articleId,
    targetType: "article",
    targetId: articleId,
    ...(details ? { details } : {}),
  });
}

/**
 * 실제 AI 호출 없이, context(요약/키워드/핵심 포인트)만으로 platform 구조에
 * 맞는 mock output을 만든다. 이 함수는 실제 글쓰기 품질을 목표로 하지
 * 않으며, prompt/context/contract 흐름이 깨지지 않는지 구조 테스트하는
 * 용도다.
 */
function buildMockSocialOutput(context: SocialWritingContext): SocialOutputRaw {
  const { platform, title, excerpt, keyPoints, targetKeyword } = context;
  const summaryLine = excerpt.length > 0 ? excerpt : `${title}에 대한 핵심 정보를 정리했습니다.`;
  const pointsLine = keyPoints.length > 0 ? keyPoints.join(" / ") : "핵심 포인트는 출처를 확인해 보완이 필요합니다.";
  const bodyText = `[mock] ${summaryLine} 주요 포인트: ${pointsLine}`;
  const tags = targetKeyword ? [targetKeyword] : [];

  switch (platform) {
    case "wordpress_blog":
    case "naver_blog":
    case "naver_cafe":
      return {
        platform,
        tone_style: context.toneStyle,
        post_title: `[mock] ${title}`,
        post_body: bodyText,
        hashtags: platform === "naver_blog" ? tags : [],
      };

    case "x": {
      const threadItems: ThreadItem[] = [
        { order: 1, text: `[mock] ${title}` },
        { order: 2, text: bodyText.slice(0, 260) },
      ];
      return { platform, tone_style: context.toneStyle, thread_items: threadItems, hashtags: tags };
    }

    case "threads":
      return { platform, tone_style: context.toneStyle, post_body: bodyText, hashtags: tags };

    case "instagram": {
      const cardItems: CardItem[] = keyPoints
        .slice(0, 3)
        .map((point, index) => ({ order: index + 1, heading: `포인트 ${index + 1}`, body: point }));
      return {
        platform,
        tone_style: context.toneStyle,
        caption: `[mock] ${summaryLine}`,
        hashtags: tags.length > 0 ? tags : ["정보"],
        card_items: cardItems,
      };
    }

    default:
      return { platform, tone_style: context.toneStyle, post_body: bodyText };
  }
}

/**
 * social post draft를 생성한다: context builder → prompt assembler → mock
 * (또는 향후 실제 AI) 생성 → contract validator → social_posts 저장 순으로
 * 진행한다. 실제 플랫폼 게시는 어떤 경우에도 수행하지 않는다.
 */
export async function generateSocialDraft(
  articleId: string,
  platform: SocialPlatform,
  toneStyle: ToneStyle
): Promise<GenerateSocialDraftResult> {
  await logSocialEvent(
    "social_draft_generation_started",
    "info",
    `기사(${articleId})의 ${platform}/${toneStyle} social draft 생성을 시작합니다.`,
    articleId,
    { platform, toneStyle }
  );

  try {
    const context = await buildSocialWritingContext(articleId, { platform, toneStyle });

    await logSocialEvent(
      "social_prompt_assembly_started",
      "info",
      `기사(${articleId})의 prompt 조립을 시작합니다.`,
      articleId,
      { platform, toneStyle }
    );
    const assembled = assembleSocialWritingPrompt(context);
    await logSocialEvent(
      "social_prompt_assembly_completed",
      "success",
      `기사(${articleId})의 prompt 조립을 완료했습니다.`,
      articleId,
      assembled.contextSummary
    );

    // SOCIAL_AI_GENERATION_ENABLED=true여도 실제 Claude API 호출은 다음
    // 단계에서 구현한다 — 이번 단계는 mock 생성으로 구조를 검증한다.
    const output = buildMockSocialOutput(context);

    await logSocialEvent(
      "social_contract_validation_started",
      "info",
      `기사(${articleId})의 출력 계약(${assembled.contractName}) 검증을 시작합니다.`,
      articleId,
      { platform, contractName: assembled.contractName }
    );
    const validation = validateSocialOutput(platform, output);
    await logSocialEvent(
      "social_contract_validation_completed",
      validation.valid ? "success" : "failed",
      `기사(${articleId})의 출력 계약 검증을 완료했습니다 (valid: ${validation.valid}).`,
      articleId,
      {
        contractName: assembled.contractName,
        valid: validation.valid,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
      }
    );

    if (!validation.valid) {
      const message = `출력 계약을 통과하지 못했습니다: ${validation.errors.join(" / ")}`;
      await logSocialEvent("social_draft_generation_failed", "failed", message, articleId, {
        platform,
        toneStyle,
        errorCount: validation.errors.length,
      });
      return { success: false, message, valid: false, errors: validation.errors, warnings: validation.warnings };
    }

    const sanitized = validation.sanitizedOutput;
    const socialPost = await createSocialPostDraft({
      articleId,
      platform,
      toneStyle,
      postTitle: sanitized.post_title as string | null,
      postBody: sanitized.post_body as string | null,
      caption: sanitized.caption as string | null,
      hashtags: (sanitized.hashtags as string[]) ?? [],
      threadItems: (sanitized.thread_items as ThreadItem[]) ?? [],
      cardItems: (sanitized.card_items as CardItem[]) ?? [],
      mediaRequirements: (sanitized.media_requirements as Record<string, unknown>) ?? {},
      platformMetadata: { purpose: context.platformConfig.purpose, mock: !isSocialAiGenerationEnabled() },
      generationContext: {
        contractName: assembled.contractName,
        sourceCount: context.sourceCount,
        mock: true,
      },
      generatedAt: new Date().toISOString(),
    });

    const details = {
      articleId,
      platform,
      toneStyle,
      contractName: assembled.contractName,
      valid: validation.valid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      hasPostTitle: Boolean(socialPost.postTitle),
      hasPostBody: Boolean(socialPost.postBody),
      hasCaption: Boolean(socialPost.caption),
      threadItemCount: socialPost.threadItems.length,
      hashtagCount: socialPost.hashtags.length,
      cardItemCount: socialPost.cardItems.length,
    };

    await logSocialEvent(
      "social_draft_generation_completed",
      "success",
      `기사(${articleId})의 ${platform}/${toneStyle} social draft 생성을 완료했습니다.`,
      articleId,
      details
    );

    return {
      success: true,
      message: "social draft를 생성했습니다.",
      socialPost,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logSocialEvent("social_draft_generation_failed", "failed", `social draft 생성 실패: ${message}`, articleId, {
      platform,
      toneStyle,
    });
    return { success: false, message };
  }
}
