// Phase 3-1: Multi-platform Writing을 위한 compact context builder.
// article 전체(본문 원문)를 그대로 AI prompt에 넣지 않고, 플랫폼 글쓰기에
// 실제로 필요한 최소한의 정보만 모아 반환한다. API key/인증 정보/원문
// source HTML은 이 context에 절대 포함하지 않는다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { getSourcesByArticleId } from "@/lib/repositories/source-repository";
import { getPlatformWritingConfig } from "./platform-writing-config";
import { getToneStyleConfig } from "./tone-style-config";
import type {
  SocialPlatform,
  ToneStyle,
  PlatformWritingConfig,
  ToneStyleConfig,
} from "./social-platform-types";

const EXCERPT_MAX_LENGTH = 600;
const MAX_SOURCE_SUMMARIES = 5;
const MAX_KEY_POINTS = 8;

export interface SocialWritingContextOptions {
  platform: SocialPlatform;
  toneStyle: ToneStyle;
  /** 포함할 출처 요약 최대 개수 (기본 5개) */
  maxSourceSummaries?: number;
}

export interface SocialWritingSourceSummary {
  title: string;
  publisher: string;
  summary: string;
}

export interface SocialWritingContext {
  articleId: string;
  title: string;
  articleMode: string;
  targetKeyword: string | null;
  secondaryKeywords: string[];
  seoTitle: string | null;
  metaDescription: string | null;
  /** 본문에서 뽑아낸 짧은 요약(원문 전체가 아님, 최대 600자) */
  excerpt: string;
  /** 출처들의 keyPoints를 합쳐 중복 제거한 핵심 포인트 (최대 8개) */
  keyPoints: string[];
  sourceCount: number;
  /** 출처 요약(summary)만 포함 — 원문 raw HTML은 포함하지 않는다 */
  sourceSummaries: SocialWritingSourceSummary[];
  platform: SocialPlatform;
  toneStyle: ToneStyle;
  platformConfig: PlatformWritingConfig;
  toneStyleConfig: ToneStyleConfig;
}

/** article.content(마크다운/HTML 섞인 원문)에서 태그/기호를 제거한 순수 텍스트로 짧게 요약한다. */
function buildExcerpt(content: string, metaDescription: string | null): string {
  if (metaDescription && metaDescription.trim().length > 0) {
    return metaDescription.trim();
  }

  const plainText = content
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_>`|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (plainText.length <= EXCERPT_MAX_LENGTH) return plainText;
  return `${plainText.slice(0, EXCERPT_MAX_LENGTH)}…`;
}

/**
 * article과 등록된 출처를 바탕으로, 특정 플랫폼/문체 글쓰기에 필요한 compact
 * context를 만든다. article 본문 전체나 출처 원문 HTML은 포함하지 않으며,
 * API key/인증 정보 등은 애초에 이 함수가 다루는 데이터에 존재하지 않는다.
 */
export async function buildSocialWritingContext(
  articleId: string,
  options: SocialWritingContextOptions
): Promise<SocialWritingContext> {
  const article = await getArticleById(articleId);
  if (!article) {
    throw new Error(`기사를 찾을 수 없습니다: ${articleId}`);
  }

  const sources = await getSourcesByArticleId(articleId);
  const maxSummaries = options.maxSourceSummaries ?? MAX_SOURCE_SUMMARIES;

  const sourceSummaries: SocialWritingSourceSummary[] = sources.slice(0, maxSummaries).map((source) => ({
    title: source.title,
    publisher: source.publisher,
    summary: source.summary,
  }));

  const keyPoints = Array.from(new Set(sources.flatMap((source) => source.keyPoints))).slice(0, MAX_KEY_POINTS);

  return {
    articleId: article.id,
    title: article.title,
    articleMode: article.articleMode,
    targetKeyword: article.targetKeyword,
    secondaryKeywords: article.secondaryKeywords,
    seoTitle: article.seoTitle,
    metaDescription: article.metaDescription,
    excerpt: buildExcerpt(article.content, article.metaDescription),
    keyPoints,
    sourceCount: sources.length,
    sourceSummaries,
    platform: options.platform,
    toneStyle: options.toneStyle,
    platformConfig: getPlatformWritingConfig(options.platform),
    toneStyleConfig: getToneStyleConfig(options.toneStyle),
  };
}
