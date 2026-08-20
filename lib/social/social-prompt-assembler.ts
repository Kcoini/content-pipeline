// Phase 3-2: prompt/context/contract 구조 — platform/tone/safety 프롬프트
// 파일(`prompts/social`, `prompts/tones`, `prompts/safety`)을 읽어 compact
// context와 함께 최종 prompt를 조립한다. 이 파일 자체는 실제 AI API를
// 호출하지 않으며, prompt 전문/article 원문은 반환값의 contextSummary에
// 포함하지 않는다(로그에 안전하게 남기기 위함).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SOCIAL_PLATFORM_PROMPT_FILENAMES } from "./platform-writing-config";
import { getToneStylePromptFilename } from "./tone-style-config";
import type { SocialWritingContext } from "./social-writing-context-builder";

const PROMPTS_DIR = join(process.cwd(), "prompts");

const SAFETY_PROMPT_FILENAMES: readonly string[] = [
  "no-threat.md",
  "no-fearmongering.md",
  "no-ad-click-inducement.md",
  "no-false-claim.md",
  "no-copyright-copy.md",
  "no-sensitive-personal-data.md",
];

const promptFileCache = new Map<string, string>();

function loadPromptFile(relativePath: string): string {
  const cached = promptFileCache.get(relativePath);
  if (cached !== undefined) return cached;

  const raw = readFileSync(join(PROMPTS_DIR, relativePath), "utf-8");
  promptFileCache.set(relativePath, raw);
  return raw;
}

export interface AssembledSocialPrompt {
  systemPrompt: string;
  userPrompt: string;
  contractName: string;
  /** 안전하게 로그에 남길 수 있는 요약 (prompt 전문/article 원문 미포함). */
  contextSummary: Record<string, unknown>;
}

function buildUserPrompt(context: SocialWritingContext): string {
  const lines: string[] = [
    `article 제목: ${context.title}`,
    `article_mode: ${context.articleMode}`,
    context.targetKeyword ? `target_keyword: ${context.targetKeyword}` : null,
    context.secondaryKeywords.length > 0 ? `secondary_keywords: ${context.secondaryKeywords.join(", ")}` : null,
    context.seoTitle ? `seo_title: ${context.seoTitle}` : null,
    context.metaDescription ? `meta_description: ${context.metaDescription}` : null,
    context.searchIntent ? `search_intent: ${context.searchIntent}` : null,
    context.readerPersona ? `reader_persona: ${context.readerPersona}` : null,
    context.monetizationScore != null ? `monetization_score: ${context.monetizationScore}` : null,
    context.policyRiskScore != null ? `policy_risk_score: ${context.policyRiskScore}` : null,
    `요약: ${context.excerpt}`,
    context.keyPoints.length > 0 ? `핵심 포인트:\n${context.keyPoints.map((p) => `- ${p}`).join("\n")}` : null,
    context.sourceSummaries.length > 0
      ? `출처 요약(${context.sourceCount}건 중 ${context.sourceSummaries.length}건):\n${context.sourceSummaries
          .map((s) => `- [${s.publisher}] ${s.title}: ${s.summary}`)
          .join("\n")}`
      : `출처: ${context.sourceCount}건`,
    `platform: ${context.platform} (${context.platformConfig.purpose})`,
    `tone_style: ${context.toneStyle} (${context.toneStyleConfig.label})`,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n\n");
}

/**
 * platform/tone/safety 프롬프트 파일과 compact context를 조합해 최종
 * system/user prompt를 만든다. article 원문이나 API key는 어디에도
 * 포함하지 않는다.
 */
export function assembleSocialWritingPrompt(context: SocialWritingContext): AssembledSocialPrompt {
  const platformPrompt = loadPromptFile(`social/${SOCIAL_PLATFORM_PROMPT_FILENAMES[context.platform]}`);
  const tonePrompt = loadPromptFile(`tones/${getToneStylePromptFilename(context.toneStyle)}`);
  const safetyPrompt = SAFETY_PROMPT_FILENAMES.map((name) => loadPromptFile(`safety/${name}`)).join("\n\n---\n\n");

  const systemPrompt = [
    "당신은 멀티 플랫폼 콘텐츠 에디터입니다.",
    "아래 platform/tone/safety 규칙을 반드시 지켜 JSON만 출력하세요.",
    "markdown code fence(```)를 사용하지 말고, JSON 객체 하나만 출력하세요. 그 외 설명 텍스트는 절대 출력하지 마세요.",
    "출처에 없는 사실을 단정하지 마세요. 원문을 그대로 복사하지 마세요.",
    "사람이 승인하기 전에는 어떤 경우에도 실제 게시가 이루어지지 않습니다.",
    "",
    "## Platform 규칙",
    platformPrompt,
    "## Tone 규칙",
    tonePrompt,
    "## Safety 규칙",
    safetyPrompt,
    `## 출력 계약: ${context.outputContractName}`,
    "위 platform 프롬프트의 '출력 JSON 형식'을 그대로 따르세요. 공통 필드 예시:",
    JSON.stringify(
      {
        platform: context.platform,
        tone_style: context.toneStyle,
        post_title: "...",
        post_body: "...",
        caption: null,
        excerpt: "...",
        hashtags: ["..."],
        thread_items: [],
        card_items: [],
        media_requirements: {},
        platform_metadata: {},
        safety_notes: [],
      },
      null,
      2
    ),
  ].join("\n\n");

  const userPrompt = buildUserPrompt(context);

  const contextSummary: Record<string, unknown> = {
    articleId: context.articleId,
    platform: context.platform,
    toneStyle: context.toneStyle,
    contractName: context.outputContractName,
    sourceCount: context.sourceCount,
    hasTargetKeyword: Boolean(context.targetKeyword),
    keyPointCount: context.keyPoints.length,
    excerptLength: context.excerpt.length,
  };

  return {
    systemPrompt,
    userPrompt,
    contractName: context.outputContractName,
    contextSummary,
  };
}
