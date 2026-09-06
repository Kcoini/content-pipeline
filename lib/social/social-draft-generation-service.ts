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
import {
  classifyWordPressBlogSourceMode,
  NO_SOURCE_BLOCKED_MESSAGE,
  SINGLE_SOURCE_LIMIT_WARNING,
} from "./wordpress-blog-source-mode";
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
 * wordpress_blog 전용 mock 본문. SOCIAL_AI_GENERATION_ENABLED=false일
 * 때도 실제 AI 프롬프트(prompts/social/wordpress-blog.md)가 요구하는
 * "markdown h2/h3 구조" + "key points를 목록/FAQ/확인 필요 사항 섹션으로
 * 재구성"이라는 최소 형태를 그대로 지켜서 만든다 — 예전에는 "주요
 * 포인트: A / B / C"처럼 한 문단에 이어 붙여서, 실제 AI 생성 여부와
 * 무관하게 quality gate의 구조 검사(heading/slash-joined-points)를
 * 통과할 수 없는 형태였다. mock은 실제 콘텐츠를 새로 만들지 않고
 * context에 이미 있는 값(excerpt/keyPoints/sourceCount)만 재배치하므로,
 * 출처에 없는 사실을 지어내지는 않는다 — 다만 실제 AI 생성이 아니므로
 * 길이(목표 2,500~4,000자)까지 채우지는 못할 수 있고, 그 경우 quality
 * gate가 정직하게 needs_revision으로 표시한다(길이 미달을 숨기지
 * 않는다).
 */
function buildMockWordpressBlogBody(context: SocialWritingContext): string {
  const { title, excerpt, keyPoints, usableSourceCount } = context;
  const sourceMode = classifyWordPressBlogSourceMode(usableSourceCount);
  const heroSummary = excerpt.length > 0 ? excerpt : `${title}에 대한 핵심 정보를 정리했습니다.`;
  const pointsList =
    keyPoints.length > 0
      ? keyPoints.map((point) => `- ${point}`).join("\n")
      : "- 핵심 포인트는 출처를 확인해 보완이 필요합니다.";

  // no_source는 generateSocialDraft()가 이 함수를 호출하기 전에 이미
  // 차단하므로, 여기서는 single_source/multi_source만 실제로 등장한다.
  const needsSourceSection =
    sourceMode === "single_source"
      ? ["## 확인 필요 사항", SINGLE_SOURCE_LIMIT_WARNING].join("\n")
      : sourceMode === "no_source"
        ? [
            "## 확인 필요 사항",
            "출처가 충분하지 않아 신청 기간/금액/조건/기관명/절차 등 구체적인 내용은 이 mock 단계에서 확정하지 않습니다. 실제 생성 시에는 공식 안내를 통해 추가로 확인해야 합니다.",
          ].join("\n")
        : ["## 주의사항", "위 핵심 포인트 외의 세부 조건/예외는 출처 원문에서 다시 한 번 확인하는 것을 권장합니다."].join(
            "\n"
          );

  const faqSection = [
    "## 자주 묻는 질문(FAQ)",
    `**Q. ${title}의 핵심은 무엇인가요?**`,
    `A. ${heroSummary}`,
    "",
    "**Q. 더 확인해야 할 내용이 있나요?**",
    "A. 위 확인 필요 사항/주의사항과 출처 원문을 함께 확인하는 것을 권장합니다.",
  ].join("\n");

  return [
    "## 먼저 결론부터 보면",
    heroSummary,
    "## 핵심 포인트",
    pointsList,
    needsSourceSection,
    faqSection,
  ].join("\n\n");
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
      // wordpress_blog는 다른 플랫폼용 bodyText("주요 포인트: A / B / C"
      // 한 문단 형식)를 그대로 쓰지 않는다 — markdown h2/h3 구조 +
      // 목록/FAQ/확인 필요 사항 섹션으로 재구성한 전용 mock 본문을 쓴다
      // (buildMockWordpressBlogBody 참고).
      const wordpressBodyText = applyToneTransform(toneStyle, buildMockWordpressBlogBody(context));
      // article에 없을 수 있는 WordPress 게시용 metadata(seoTitle/
      // metaDescription/targetKeyword/answerSummary/eeatNotes/geoSummary 등)를
      // wordpress_blog 글 자신의 title/body/excerpt로부터 만든다 — article이
      // 이미 값을 갖고 있으면(주로 monetized_blog 모드) 참고용으로 재사용한다.
      const generatedMetadata = generateWordPressBlogMetadata({
        title: postTitle,
        body: wordpressBodyText,
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
        post_body: wordpressBodyText,
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

/**
 * wordpress_blog 전용: usable source 개수로부터 저장할 authoritative
 * platform_metadata 조각을 만든다. single_source_mode가 아니면
 * sourceLimitWarning은 포함하지 않는다.
 */
function buildWordPressBlogSourceModeMetadata(usableSourceCount: number): Record<string, unknown> {
  const sourceMode = classifyWordPressBlogSourceMode(usableSourceCount);
  return {
    sourceMode,
    usableSourceCount,
    singleSourceMode: sourceMode === "single_source",
    ...(sourceMode === "single_source" ? { sourceLimitWarning: SINGLE_SOURCE_LIMIT_WARNING } : {}),
  };
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
      { platform, toneStyle, sourceCount: context.sourceCount, usableSourceCount: context.usableSourceCount }
    );

    // wordpress_blog는 usable source가 0건이면 생성 자체를 차단한다(1건은
    // single_source_mode로 허용). 다른 플랫폼은 이 제한을 받지 않는다
    // (naver_blog 등 기존 동작 그대로).
    if (platform === "wordpress_blog" && classifyWordPressBlogSourceMode(context.usableSourceCount) === "no_source") {
      await logSocialEvent(
        "social_draft_generation_blocked_no_source",
        "failed",
        `기사(${articleId})는 usable source가 없어 wordpress_blog 생성을 차단했습니다.`,
        articleId,
        { platform, toneStyle, usableSourceCount: context.usableSourceCount }
      );
      return { success: false, message: NO_SOURCE_BLOCKED_MESSAGE };
    }

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
      // 실제로 post_body가 얼마나 만들어졌는지(짧은 mock인지) 로그로 남긴다 —
      // "생성 결과가 너무 짧다"는 문제를 화면 캡처가 아니라 로그로도 바로
      // 확인할 수 있게 한다.
      const mockPostBodyLength = typeof output.post_body === "string" ? output.post_body.length : 0;
      await logSocialEvent(
        "social_mock_generation_completed",
        "success",
        `기사(${articleId})의 mock post_body 길이: ${mockPostBodyLength}자.`,
        articleId,
        { platform, toneStyle, postBodyLength: mockPostBodyLength }
      );
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

      // "생성 결과가 너무 짧다" 문제를 화면 캡처가 아니라 로그로도 바로
      // 확인할 수 있도록, 실제 AI가 만든 output.post_body 길이를 남긴다.
      const aiPostBodyLength = typeof aiResult.output.post_body === "string" ? aiResult.output.post_body.length : 0;
      await logSocialEvent(
        "social_ai_generation_completed",
        "success",
        `기사(${articleId})의 실제 AI social draft 생성을 완료했습니다 (post_body: ${aiPostBodyLength}자).`,
        articleId,
        {
          platform,
          toneStyle,
          inputTokens: aiResult.usage?.inputTokens,
          outputTokens: aiResult.usage?.outputTokens,
          postBodyLength: aiPostBodyLength,
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
        // wordpress_blog의 sourceMode/usableSourceCount/singleSourceMode/
        // sourceLimitWarning은 AI 자기보고를 신뢰하지 않고 서버에서 직접
        // 계산해 덮어쓴다 — AI가 platform_metadata를 누락하거나 잘못
        // 채워도 항상 정확한 값이 저장되도록 하기 위함이다.
        ...(platform === "wordpress_blog" ? buildWordPressBlogSourceModeMetadata(context.usableSourceCount) : {}),
      },
      generationContext: {
        contractName: assembled.contractName,
        sourceCount: context.sourceCount,
        usableSourceCount: context.usableSourceCount,
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
        usableSourceCount: context.usableSourceCount,
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
      postBodyLength: socialPost.postBody?.length ?? 0,
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
