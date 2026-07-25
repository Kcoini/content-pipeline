// Phase 2-3: WordPress Category, Tag, SEO Metadata 생성 서비스.
// 실제 WordPress API 없이 article_mode/키워드/제목/본문 헤딩 기반 규칙으로
// category/tag/SEO metadata를 생성한다 (이름 기반 추천, AI 호출 없음).
// WORDPRESS_PUBLISH_ENABLED=false에서도 항상 동작해야 한다.

import {
  getArticleById,
  saveWordPressMetadata,
  markWordPressMetadataReviewed as markReviewedInRepository,
} from "@/lib/repositories/article-repository";
import { getThemeById } from "@/lib/repositories/theme-repository";
import { logEvent } from "@/lib/harness/logger";
import { slugify, articleIdSlugFallback } from "@/lib/seo/slugify";
import type { Article, ArticleMode, Theme } from "@/lib/types/domain";
import type { WordPressMetadata } from "./wordpress-metadata";

export interface GenerateMetadataResult {
  success: boolean;
  message: string;
  metadata?: WordPressMetadata;
}

// ─────────────────────────────────────────────────────────────
// category/tag 이름 기반 추천 규칙
// ─────────────────────────────────────────────────────────────

const CATEGORY_KEYWORD_MAP: Array<{ category: string; keywords: string[] }> = [
  { category: "복지", keywords: ["복지", "돌봄", "요양", "장기요양", "노인", "고령", "장애인", "기초생활"] },
  { category: "의료", keywords: ["의료", "병원", "건강", "질병", "치료", "간호", "진료", "약"] },
  { category: "정책", keywords: ["정책", "제도", "법", "규제", "정부", "국회", "지원금"] },
  { category: "IT", keywords: ["ai", "인공지능", "소프트웨어", "앱", "it", "테크", "개발", "프로그래밍"] },
  { category: "금융", keywords: ["금융", "대출", "투자", "재테크", "예금", "적금", "펀드", "주식"] },
  { category: "부동산", keywords: ["부동산", "전세", "월세", "아파트", "매매", "청약"] },
  { category: "교육", keywords: ["교육", "학교", "입시", "학원", "자격증", "유학"] },
  { category: "생활정보", keywords: ["생활", "정보", "꿀팁", "가이드", "방법"] },
  { category: "블로그 운영", keywords: ["애드센스", "adsense", "워드프레스", "wordpress", "블로그", "수익형", "seo"] },
];

const CATEGORY_LIMIT: Record<ArticleMode, number> = {
  general_news: 2,
  source_based_explainer: 2,
  monetized_blog: 2,
};

const TAG_COUNT_RANGE: Record<ArticleMode, [number, number]> = {
  general_news: [3, 5],
  source_based_explainer: [5, 8],
  monetized_blog: [6, 10],
};

const TAG_PAD_POOL: Record<ArticleMode, string[]> = {
  general_news: ["이슈", "뉴스 요약", "최신 소식"],
  source_based_explainer: ["가이드", "정리", "해설"],
  monetized_blog: ["수익형 블로그", "블로그 운영", "정보 정리"],
};

const DEFAULT_CATEGORY: Record<ArticleMode, string> = {
  general_news: "생활정보",
  source_based_explainer: "생활정보",
  monetized_blog: "블로그 운영",
};

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/** 본문에서 ##/### 헤딩만 추출한다 (태그 후보로 사용). */
function extractHeadings(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => /^#{2,3}\s+/.test(line))
    .map((line) => line.replace(/^#{2,3}\s+/, "").trim())
    .filter(Boolean);
}

function collectKeywordPool(article: Article, theme: Theme | undefined): string[] {
  const raw = [
    theme?.title,
    ...(theme?.keywords ?? []),
    article.targetKeyword ?? undefined,
    ...article.secondaryKeywords,
    ...extractHeadings(article.content),
  ].filter((v): v is string => Boolean(v && v.trim()));

  return dedupe(raw);
}

function recommendCategories(pool: string[], mode: ArticleMode): string[] {
  const lowerPool = pool.map((p) => p.toLowerCase());
  const matched: string[] = [];

  for (const { category, keywords } of CATEGORY_KEYWORD_MAP) {
    if (keywords.some((kw) => lowerPool.some((p) => p.includes(kw)))) {
      matched.push(category);
    }
  }

  const limit = CATEGORY_LIMIT[mode];
  const result = dedupe(matched).slice(0, limit);

  if (result.length === 0) {
    result.push(DEFAULT_CATEGORY[mode]);
  }

  return result;
}

/** 태그로 쓰기에 너무 긴 문장(헤딩 등)은 제외한다. */
const MAX_TAG_LENGTH = 20;

function recommendTags(pool: string[], mode: ArticleMode): string[] {
  const [min, max] = TAG_COUNT_RANGE[mode];
  const candidates = dedupe(pool.filter((p) => p.length <= MAX_TAG_LENGTH));

  const tags = candidates.slice(0, max);

  if (tags.length < min) {
    for (const padTag of TAG_PAD_POOL[mode]) {
      if (tags.length >= min) break;
      if (!tags.includes(padTag)) tags.push(padTag);
    }
  }

  return tags;
}

// ─────────────────────────────────────────────────────────────
// SEO title / meta description / slug / target keyword 결정
// ─────────────────────────────────────────────────────────────

const META_DESCRIPTION_MAX_LENGTH = 160;

/** 본문에서 AD_SLOT marker/markdown 기호를 제거하고 순수 텍스트 앞부분을 추출한다. */
function extractPlainExcerpt(content: string, maxLength: number): string {
  const plain = content
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/^#{1,6}\s+.*$/gm, " ")
    .replace(/[*_>`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return "";
  return plain.length > maxLength ? `${plain.slice(0, maxLength)}…` : plain;
}

function resolveSeoTitle(article: Article): string {
  return article.seoTitle || article.title;
}

function resolveMetaDescription(article: Article): string {
  if (article.metaDescription) return article.metaDescription;
  return extractPlainExcerpt(article.content, META_DESCRIPTION_MAX_LENGTH);
}

function resolveSlugSource(article: Article, theme: Theme | undefined): string {
  return article.targetKeyword || article.title || theme?.keywords[0] || theme?.title || "";
}

function resolveSlug(article: Article, theme: Theme | undefined): string {
  const source = resolveSlugSource(article, theme);
  return slugify(source, { fallback: articleIdSlugFallback(article.id) });
}

function resolveTargetKeyword(article: Article, theme: Theme | undefined): string | undefined {
  return article.targetKeyword || theme?.keywords[0] || undefined;
}

const SECONDARY_KEYWORD_LIMIT = 8;

function resolveSecondaryKeywords(article: Article, theme: Theme | undefined, targetKeyword?: string): string[] {
  const pool = dedupe([...article.secondaryKeywords, ...(theme?.keywords ?? [])]);
  return pool.filter((kw) => kw !== targetKeyword).slice(0, SECONDARY_KEYWORD_LIMIT);
}

// ─────────────────────────────────────────────────────────────
// metadata 생성
// ─────────────────────────────────────────────────────────────

function buildMetadata(article: Article, theme: Theme | undefined): WordPressMetadata {
  const pool = collectKeywordPool(article, theme);
  const categoryNames = recommendCategories(pool, article.articleMode);
  const tagNames = recommendTags(pool, article.articleMode);

  const seoTitle = resolveSeoTitle(article);
  const metaDescription = resolveMetaDescription(article);
  const slug = resolveSlug(article, theme);
  const targetKeyword = resolveTargetKeyword(article, theme);
  const secondaryKeywords = resolveSecondaryKeywords(article, theme, targetKeyword);

  return {
    categoryNames,
    tagNames,
    // 실제 WordPress API 연결 전이므로 ID는 비워둔다 (Phase 2-3 범위 밖).
    categoryIds: [],
    tagIds: [],
    seoTitle,
    metaDescription,
    slug,
    targetKeyword,
    secondaryKeywords,
    internalLinkSuggestions: article.internalLinkSuggestions,
    adSlots: article.adSlots,
    status: "generated",
  };
}

/**
 * article_mode/키워드/제목/본문 헤딩 기반 규칙으로 WordPress metadata를 생성하고 저장한다.
 * 실제 WordPress API를 호출하지 않으므로 WORDPRESS_PUBLISH_ENABLED 값과 무관하게 항상 동작한다.
 */
export async function generateWordPressMetadata(articleId: string): Promise<GenerateMetadataResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  await logEvent({
    type: "wordpress_metadata_generation_started",
    status: "info",
    message: `기사(${articleId}) WordPress metadata 생성을 시작합니다.`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  try {
    const theme = await getThemeById(article.themeId);
    const metadata = buildMetadata(article, theme);

    await saveWordPressMetadata({
      articleId,
      seoTitle: metadata.seoTitle,
      metaDescription: metadata.metaDescription,
      slug: metadata.slug,
      targetKeyword: metadata.targetKeyword,
      secondaryKeywords: metadata.secondaryKeywords,
      internalLinkSuggestions: metadata.internalLinkSuggestions,
      categoryNames: metadata.categoryNames,
      tagNames: metadata.tagNames,
      categoryIds: metadata.categoryIds,
      tagIds: metadata.tagIds,
      status: "generated",
    });

    await logEvent({
      type: "wordpress_metadata_generation_completed",
      status: "success",
      message: `기사(${articleId}) WordPress metadata 생성을 완료했습니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
      details: {
        categoryNames: metadata.categoryNames,
        tagNames: metadata.tagNames,
        slug: metadata.slug,
      },
    });

    return { success: true, message: "WordPress metadata를 생성했습니다.", metadata };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

    try {
      await saveWordPressMetadata({
        articleId,
        seoTitle: article.seoTitle || article.title,
        metaDescription: article.metaDescription || "",
        slug: article.slug || articleIdSlugFallback(articleId),
        categoryNames: [],
        tagNames: [],
        status: "failed",
      });
    } catch {
      // metadata 저장 실패는 무시하고 원래 오류를 그대로 알린다.
    }

    await logEvent({
      type: "wordpress_metadata_generation_failed",
      status: "failed",
      message: `WordPress metadata 생성 실패: ${message}`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
      details: { error: message },
    });

    return { success: false, message };
  }
}

/** WordPress metadata를 사람이 검토 완료했음을 표시한다. */
export async function reviewWordPressMetadata(articleId: string): Promise<GenerateMetadataResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  await markReviewedInRepository(articleId);

  await logEvent({
    type: "wordpress_metadata_reviewed",
    status: "success",
    message: `기사(${articleId})의 WordPress metadata 검토를 완료했습니다.`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  return { success: true, message: "WordPress metadata 검토를 완료했습니다." };
}
