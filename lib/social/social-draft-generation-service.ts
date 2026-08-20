// Phase 3-2/3-3: prompt/context/contract 구조를 실제로 엮어 social post
// draft를 생성하는 서비스. SOCIAL_AI_GENERATION_ENABLED=false(기본값)이면
// mock output을 생성하고, true이면 실제 Claude API(social-ai-client)를
// 호출한다. 모든 단계는 pipeline_logs(event_name 기준)에 기록되며,
// prompt 전문/article 원문/생성된 본문 전체/API key는 로그에 남기지
// 않는다. 실제 플랫폼 게시는 어떤 경우에도 수행하지 않는다 — 이 단계에서
// publish_status는 not_published 또는 blocked까지만 사용한다.

import {
  createSocialPostDraft,
  updateSocialPostQuality,
  updateSocialPostPublishStatus,
} from "@/lib/repositories/social-posts-repository";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import { buildSocialWritingContext, type SocialWritingContext } from "./social-writing-context-builder";
import { assembleSocialWritingPrompt } from "./social-prompt-assembler";
import { validateSocialOutput, type SocialOutputRaw } from "./social-output-contract-validator";
import { runSocialPostQualityGate } from "./social-quality-gate";
import { applyToneTransform } from "./tone-transformer-rules";
import { getPlatformWritingTemplate } from "./platform-writing-templates";
import { generateWordPressBlogMetadata } from "./wordpress-blog-metadata-generator";
import {
  isSocialAiGenerationEnabled,
  getSocialAiMaxTokens,
  getSocialAiTemperature,
} from "./social-ai-generation-config";
import { generateSocialPostWithAI } from "./social-ai-client";
import type {
  SocialPlatform,
  ToneStyle,
  SocialPost,
  SocialPostQualityResult,
  ThreadItem,
  CardItem,
} from "./social-platform-types";

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
 * 실제 AI 호출 없이, context(요약/키워드/핵심 포인트)와 문체 변환 규칙
 * (tone-transformer-rules)만으로 platform 구조에 맞는 mock output을
 * 만든다. mock output도 반드시 contract validator를 통과해야 한다.
 */
function buildMockSocialOutput(context: SocialWritingContext): SocialOutputRaw {
  const { platform, toneStyle, title, excerpt, keyPoints, targetKeyword } = context;
  const template = getPlatformWritingTemplate(platform);
  const summaryLine = excerpt.length > 0 ? excerpt : `${title}에 대한 핵심 정보를 정리했습니다.`;
  const pointsLine = keyPoints.length > 0 ? keyPoints.join(" / ") : "핵심 포인트는 출처를 확인해 보완이 필요합니다.";
  const rawBody = `[mock] ${summaryLine} 주요 포인트: ${pointsLine}`;
  const bodyText = applyToneTransform(toneStyle, rawBody);
  const tags = targetKeyword ? [targetKeyword] : [];

  switch (platform) {
    case "wordpress_blog": {
      const postTitle = `[mock] ${title}`;
      // article에 없을 수 있는 WordPress 게시용 metadata(seoTitle/
      // metaDescription/targetKeyword/answerSummary/eeatNotes/geoSummary 등)를
      // wordpress_blog 글 자신의 title/body/excerpt로부터 만든다 — article이
      // 이미 값을 갖고 있으면(주로 monetized_blog 모드) 참고용으로 재사용한다.
      const generatedMetadata = generateWordPressBlogMetadata({
        title: postTitle,
        body: bodyText,
        excerpt: summaryLine,
        citedSourceCount: context.citedSourceIds.length,
        articleSeoTitle: context.seoTitle,
        articleMetaDescription: context.metaDescription,
        articleTargetKeyword: context.targetKeyword,
        articleSecondaryKeywords: context.secondaryKeywords,
        articleSearchIntent: context.searchIntent,
        articleReaderPersona: context.readerPersona,
        articleAdSlots: context.adSlots,
        articleMonetizationScore: context.monetizationScore,
        articlePolicyRiskScore: context.policyRiskScore,
      });

      return {
        platform,
        tone_style: toneStyle,
        post_title: postTitle,
        post_body: bodyText,
        excerpt: summaryLine,
        hashtags: [],
        platform_metadata: generatedMetadata as unknown as Record<string, unknown>,
      };
    }

    case "naver_blog":
    case "naver_cafe":
      return {
        platform,
        tone_style: toneStyle,
        post_title: `[mock] ${title}`,
        post_body: bodyText,
        hashtags: platform === "naver_blog" ? tags : [],
      };

    case "x": {
      const minItems = template.minThreadItems ?? 3;
      const points = keyPoints.length > 0 ? keyPoints : [summaryLine];
      const middleItems: ThreadItem[] = points
        .slice(0, Math.max(0, minItems - 2))
        .map((point, index) => ({ order: index + 2, text: applyToneTransform(toneStyle, point).slice(0, 260) }));
      const threadItems: ThreadItem[] = [
        { order: 1, text: `[mock] ${title}` },
        ...middleItems,
        { order: middleItems.length + 2, text: bodyText.slice(0, 260) },
      ];
      return { platform, tone_style: toneStyle, thread_items: threadItems, hashtags: tags };
    }

    case "threads":
      return { platform, tone_style: toneStyle, post_body: bodyText, hashtags: tags };

    case "instagram": {
      const minCards = template.minCardItems ?? 3;
      const points = keyPoints.length > 0 ? keyPoints : [summaryLine, pointsLine];
      const cardItems: CardItem[] = Array.from({ length: Math.max(minCards, points.length) }, (_, index) => ({
        order: index + 1,
        heading: `포인트 ${index + 1}`,
        body: points[index % points.length],
      })).slice(0, template.maxCardItems ?? 5);
      return {
        platform,
        tone_style: toneStyle,
        caption: `[mock] ${applyToneTransform(toneStyle, summaryLine)}`,
        hashtags: tags.length > 0 ? tags : ["정보"],
        card_items: cardItems,
        media_requirements: { requiresImage: true, recommendedCount: 1 },
      };
    }

    default:
      return { platform, tone_style: toneStyle, post_body: bodyText };
  }
}

/** sanitizedOutput에 실질적인 콘텐츠가 전혀 없는지 확인한다 (critical 실패 판단용). */
function isEffectivelyEmpty(sanitized: Record<string, unknown>): boolean {
  const hasTitle = typeof sanitized.post_title === "string" && sanitized.post_title.trim().length > 0;
  const hasBody = typeof sanitized.post_body === "string" && sanitized.post_body.trim().length > 0;
  const hasCaption = typeof sanitized.caption === "string" && sanitized.caption.trim().length > 0;
  const hasThreads = Array.isArray(sanitized.thread_items) && sanitized.thread_items.length > 0;
  const hasCards = Array.isArray(sanitized.card_items) && sanitized.card_items.length > 0;
  return !hasTitle && !hasBody && !hasCaption && !hasThreads && !hasCards;
}

function blockedQualityResultFromValidation(errors: string[], warnings: string[]): SocialPostQualityResult {
  return {
    status: "blocked",
    score: 0,
    checklist: errors.map((message, index) => ({
      key: `contract_error_${index + 1}`,
      label: "출력 계약 위반",
      status: "blocked",
      message,
    })),
    warnings,
    failures: [],
    blockedReasons: errors,
  };
}

/**
 * social post draft를 생성한다: context builder → prompt assembler → mock
 * (또는 SOCIAL_AI_GENERATION_ENABLED=true일 때 실제 Claude API) 생성 →
 * contract validator → social_posts 저장 → quality gate 실행 순으로
 * 진행한다. 실제 플랫폼 게시는 어떤 경우에도 수행하지 않는다.
 */
export async function generateSocialDraft(
  articleId: string,
  platform: SocialPlatform,
  toneStyle: ToneStyle
): Promise<GenerateSocialDraftResult> {
  const aiEnabled = isSocialAiGenerationEnabled();

  await logSocialEvent(
    "social_draft_generation_started",
    "info",
    `기사(${articleId})의 ${platform}/${toneStyle} social draft 생성을 시작합니다.`,
    articleId,
    { platform, toneStyle, aiEnabled }
  );

  try {
    await logSocialEvent(
      "social_context_build_started",
      "info",
      `기사(${articleId})의 context 생성을 시작합니다.`,
      articleId,
      { platform, toneStyle }
    );
    const context = await buildSocialWritingContext(articleId, { platform, toneStyle });
    await logSocialEvent(
      "social_context_build_completed",
      "success",
      `기사(${articleId})의 context 생성을 완료했습니다.`,
      articleId,
      { platform, toneStyle, sourceCount: context.sourceCount }
    );

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

    let output: SocialOutputRaw;
    let usage: { inputTokens?: number; outputTokens?: number } | undefined;

    if (!aiEnabled) {
      await logSocialEvent(
        "social_ai_generation_skipped_mock_mode",
        "info",
        `SOCIAL_AI_GENERATION_ENABLED=false이므로 기사(${articleId})는 mock 생성으로 처리합니다.`,
        articleId,
        { platform, toneStyle }
      );
      output = buildMockSocialOutput(context);
    } else {
      await logSocialEvent(
        "social_ai_generation_started",
        "info",
        `기사(${articleId})의 실제 AI social draft 생성을 시작합니다.`,
        articleId,
        { platform, toneStyle }
      );

      const aiResult = await generateSocialPostWithAI({
        systemPrompt: assembled.systemPrompt,
        userPrompt: assembled.userPrompt,
        platform,
        toneStyle,
        contractName: assembled.contractName,
        maxTokens: getSocialAiMaxTokens(),
        temperature: getSocialAiTemperature(),
      });

      if (!aiResult.ok || !aiResult.output) {
        const message = aiResult.error ?? "AI 생성에 실패했습니다.";
        await logSocialEvent("social_draft_generation_failed", "failed", `AI 생성 실패: ${message}`, articleId, {
          platform,
          toneStyle,
          aiEnabled,
        });
        return { success: false, message };
      }

      await logSocialEvent(
        "social_ai_generation_completed",
        "success",
        `기사(${articleId})의 실제 AI social draft 생성을 완료했습니다.`,
        articleId,
        {
          platform,
          toneStyle,
          inputTokens: aiResult.usage?.inputTokens,
          outputTokens: aiResult.usage?.outputTokens,
        }
      );

      output = { ...aiResult.output, platform, tone_style: toneStyle };
      usage = aiResult.usage;
    }

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

    if (!validation.valid && isEffectivelyEmpty(validation.sanitizedOutput)) {
      const message = `출력 계약을 통과하지 못했고 저장할 콘텐츠도 없습니다: ${validation.errors.join(" / ")}`;
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
      // sanitized.platform_metadata에는 (특히 wordpress_blog의 경우) AI/mock이
      // 생성한 게시용 metadata(seoTitle/metaDescription/targetKeyword/
      // answerSummary/eeatNotes/geoSummary 등)가 들어 있다 — 이전에는 이 값을
      // 버리고 { purpose, mock }만 저장했다(생성은 되지만 저장되지 않던 버그).
      platformMetadata: {
        purpose: context.platformConfig.purpose,
        mock: !aiEnabled,
        ...((sanitized.platform_metadata as Record<string, unknown> | undefined) ?? {}),
      },
      generationContext: {
        contractName: assembled.contractName,
        sourceCount: context.sourceCount,
        mock: !aiEnabled,
      },
      generatedAt: new Date().toISOString(),
    });

    let qualityResult: SocialPostQualityResult;

    if (!validation.valid) {
      // 출력 계약 위반이지만(콘텐츠는 일부 존재) 사람이 확인할 수 있도록 저장한다.
      qualityResult = blockedQualityResultFromValidation(validation.errors, validation.warnings);
      await updateSocialPostQuality(socialPost.id, qualityResult);
      await updateSocialPostPublishStatus(socialPost.id, {
        status: "blocked",
        errorMessage: validation.errors.join(" / "),
      });
    } else {
      await logSocialEvent(
        "social_quality_gate_started",
        "info",
        `social post(${socialPost.id})의 quality gate를 시작합니다.`,
        articleId,
        { socialPostId: socialPost.id, platform }
      );
      qualityResult = runSocialPostQualityGate({
        platform,
        toneStyle,
        postTitle: socialPost.postTitle,
        postBody: socialPost.postBody,
        caption: socialPost.caption,
        excerpt: socialPost.excerpt,
        hashtags: socialPost.hashtags,
        threadItems: socialPost.threadItems,
        cardItems: socialPost.cardItems,
        mediaRequirements: socialPost.mediaRequirements,
      });
      await updateSocialPostQuality(socialPost.id, qualityResult);
      await logSocialEvent(
        "social_quality_gate_completed",
        qualityResult.status === "blocked" ? "failed" : "success",
        `social post(${socialPost.id})의 quality gate가 완료되었습니다 (status: ${qualityResult.status}, score: ${qualityResult.score}).`,
        articleId,
        { socialPostId: socialPost.id, platform, qualityStatus: qualityResult.status, qualityScore: qualityResult.score }
      );
    }

    const details = {
      articleId,
      platform,
      toneStyle,
      contractName: assembled.contractName,
      aiEnabled,
      valid: validation.valid,
      qualityStatus: qualityResult.status,
      qualityScore: qualityResult.score,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      hasPostTitle: Boolean(socialPost.postTitle),
      hasPostBody: Boolean(socialPost.postBody),
      hasCaption: Boolean(socialPost.caption),
      threadItemCount: socialPost.threadItems.length,
      hashtagCount: socialPost.hashtags.length,
      cardItemCount: socialPost.cardItems.length,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
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
      message: `social draft를 생성했습니다 (quality: ${qualityResult.status}).`,
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
      aiEnabled,
    });
    return { success: false, message };
  }
}
