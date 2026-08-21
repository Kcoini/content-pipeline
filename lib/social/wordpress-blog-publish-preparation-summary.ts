// /articles/[id]/blog의 wordpress_blog 카드 안에서 "WordPress 게시 준비"
// 상태를 한 번에 보여주기 위한 read-only 요약 빌더. 어떤 데이터도
// 변경하지 않는다.
//
// 알려진 한계: WordPress draft/SEO metadata/featured image 상태는
// social_posts가 아니라 articles 테이블에 저장된다(WordPress 문서 하나당
// article 하나라는 기존 Phase 2 설계를 그대로 따른다 — DB schema를
// 바꾸지 않기 위한 절충이다). publish guard 상태만 social_post 자체의
// 필드다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { getSuccessfulWordPressDraft } from "@/lib/repositories/publish-repository";
import { checkWordPressBlogPublishReadiness, type WordPressBlogPublishReadiness } from "./wordpress-blog-publish-readiness";
import type { SocialPost } from "./social-platform-types";

export interface WordPressBlogDraftSummary {
  exists: boolean;
  postId: string | null;
  postUrl: string | null;
  /** 마지막으로 draft가 성공적으로 생성/업데이트된 시각(없으면 null). */
  lastUpdatedAt: string | null;
}

export interface WordPressBlogSeoMetadataSummary {
  status: string;
  seoTitle: string | null;
  metaDescription: string | null;
  targetKeyword: string | null;
}

export interface WordPressBlogFeaturedImageSummary {
  status: string;
  wordpressMediaId: number | null;
  wordpressUrl: string | null;
  /** WordPress post에 실제로 featured_media를 연결한 결과(attachFeaturedMediaToDraft). */
  attachStatus: string;
  attachError: string | null;
  /** 마지막으로 연결(attach)이 성공/시도된 시각(없으면 null). */
  attachedAt: string | null;
  /** 로컬 이미지 → WordPress Media Library 업로드 진행 상태(not_ready/prepared/uploaded/failed/skipped 등). */
  uploadStatus: string;
  uploadError: string | null;
  /**
   * 사용자가 "대표 이미지 없이 진행"을 명시적으로 선택했는지 여부.
   * social_posts.platformMetadata.featuredImage에서만 읽는다(article
   * DB 컬럼에는 'waived' 값을 저장할 수 없어 — CHECK 제약 — social_post
   * 쪽에만 상태를 둔다).
   */
  waived: boolean;
  waivedReasonCode: string | null;
  waivedMemo: string | null;
}

/**
 * wordpress_blog 글 자신이 생성한 WordPress 게시용 metadata — article에는
 * 없을 수 있는 정보다(source_based_explainer/general_news article에는
 * 애초에 없고, answerSummary/eeatNotes/geoSummary/structuredDataSuggestions는
 * article_mode와 무관하게 article 테이블에 전혀 저장되지 않는다).
 * 오직 post.platformMetadata에서만 읽는다 — article 값으로 대체하지 않는다
 * (lib/social/wordpress-blog-metadata-generator.ts가 생성한 값).
 */
export interface WordPressBlogOwnMetadataSummary {
  seoTitle: string | null;
  metaDescription: string | null;
  targetKeyword: string | null;
  secondaryKeywords: string[];
  searchIntent: string | null;
  readerPersona: string | null;
  answerSummary: string | null;
  eeatNotes: Record<string, unknown> | null;
  geoSummary: Record<string, unknown> | null;
  structuredDataSuggestions: unknown[];
  adSlots: unknown[];
  monetizationScore: number | null;
  policyRiskScore: number | null;
}

export interface WordPressBlogPublishPreparationSummary {
  readiness: WordPressBlogPublishReadiness;
  draft: WordPressBlogDraftSummary;
  seo: WordPressBlogSeoMetadataSummary;
  featuredImage: WordPressBlogFeaturedImageSummary;
  guardStatus: string;
  /**
   * wordpress_blog 자신의 platformMetadata.policyRiskScore를 우선 사용하고,
   * 없으면 article.policyRiskScore(monetized_blog 원본 article 기준)로
   * 대체한다. 둘 다 없으면 null.
   */
  policyRiskScore: number | null;
  /** wordpress_blog 글 자신이 생성한 게시용 metadata 전체(표시 전용). */
  blogMetadata: WordPressBlogOwnMetadataSummary;
}

/**
 * wordpress_blog social_post 하나에 대해 "WordPress 게시 준비" 화면에
 * 표시할 요약을 만든다. article의 WordPress 관련 컬럼(초안/SEO/대표
 * 이미지 상태)과 post 자체의 값(guard 상태, readiness)을 합친다.
 */
export async function buildWordPressBlogPublishPreparationSummary(
  articleId: string,
  post: SocialPost
): Promise<WordPressBlogPublishPreparationSummary> {
  const [article, draft] = await Promise.all([getArticleById(articleId), getSuccessfulWordPressDraft(articleId)]);

  const platformMetadata = post.platformMetadata ?? {};
  const platformSeoTitle = typeof platformMetadata.seoTitle === "string" ? platformMetadata.seoTitle : null;
  const platformMetaDescription = typeof platformMetadata.metaDescription === "string" ? platformMetadata.metaDescription : null;
  const featuredImageMeta =
    typeof platformMetadata.featuredImage === "object" && platformMetadata.featuredImage !== null
      ? (platformMetadata.featuredImage as Record<string, unknown>)
      : {};
  const waived = featuredImageMeta.waived === true;
  const waivedReasonCode = typeof featuredImageMeta.waivedReasonCode === "string" ? featuredImageMeta.waivedReasonCode : null;
  const waivedMemo = typeof featuredImageMeta.waivedMemo === "string" ? featuredImageMeta.waivedMemo : null;

  const readString = (key: string): string | null =>
    typeof platformMetadata[key] === "string" ? (platformMetadata[key] as string) : null;
  const readStringArray = (key: string): string[] =>
    Array.isArray(platformMetadata[key]) ? (platformMetadata[key] as unknown[]).filter((v): v is string => typeof v === "string") : [];
  const readObject = (key: string): Record<string, unknown> | null =>
    typeof platformMetadata[key] === "object" && platformMetadata[key] !== null
      ? (platformMetadata[key] as Record<string, unknown>)
      : null;
  const readArray = (key: string): unknown[] => (Array.isArray(platformMetadata[key]) ? (platformMetadata[key] as unknown[]) : []);
  const readNumber = (key: string): number | null => (typeof platformMetadata[key] === "number" ? (platformMetadata[key] as number) : null);

  const blogMetadata: WordPressBlogOwnMetadataSummary = {
    seoTitle: readString("seoTitle"),
    metaDescription: readString("metaDescription"),
    targetKeyword: readString("targetKeyword"),
    secondaryKeywords: readStringArray("secondaryKeywords"),
    searchIntent: readString("searchIntent"),
    readerPersona: readString("readerPersona"),
    answerSummary: readString("answerSummary"),
    eeatNotes: readObject("eeatNotes"),
    geoSummary: readObject("geoSummary"),
    structuredDataSuggestions: readArray("structuredDataSuggestions"),
    adSlots: readArray("adSlots"),
    monetizationScore: readNumber("monetizationScore"),
    policyRiskScore: readNumber("policyRiskScore"),
  };

  const effectivePolicyRiskScore = blogMetadata.policyRiskScore ?? article?.policyRiskScore ?? null;

  return {
    readiness: checkWordPressBlogPublishReadiness(post, { policyRiskScore: effectivePolicyRiskScore }),
    draft: {
      exists: draft !== null,
      postId: draft?.externalPostId ?? null,
      postUrl: draft?.postUrl ?? null,
      lastUpdatedAt: draft?.createdAt ?? null,
    },
    seo: {
      status: article?.wpMetadataStatus ?? "not_ready",
      seoTitle: article?.seoTitle ?? platformSeoTitle,
      metaDescription: article?.metaDescription ?? platformMetaDescription,
      targetKeyword: article?.targetKeyword ?? null,
    },
    featuredImage: {
      status: article?.featuredImageStatus ?? "not_ready",
      wordpressMediaId: article?.featuredImageWordpressMediaId ?? null,
      wordpressUrl: article?.featuredImageWordpressUrl ?? null,
      attachStatus: article?.wordpressFeaturedMediaAttachStatus ?? "not_attached",
      attachError: article?.wordpressFeaturedMediaAttachError ?? null,
      attachedAt: article?.wordpressFeaturedMediaAttachedAt ?? null,
      uploadStatus: article?.featuredImageUploadStatus ?? "not_ready",
      uploadError: article?.featuredImageUploadError ?? null,
      waived,
      waivedReasonCode,
      waivedMemo,
    },
    guardStatus: post.platformPublishGuardStatus,
    policyRiskScore: effectivePolicyRiskScore,
    blogMetadata,
  };
}

export interface FeaturedImageAttachEligibility {
  eligible: boolean;
  /** 버튼을 비활성화해야 하는 이유(있는 것만). eligible=true면 항상 빈 배열. */
  reasons: string[];
}

/**
 * "대표 이미지 연결" 버튼을 눌러도 되는지 판단한다. WordPress Draft(post
 * id)와 WordPress media ID가 모두 있어야 하고, quality_status=ready +
 * approval_status=approved여야 한다 — 이 중 하나라도 없으면 버튼을
 * 비활성화하고 구체적인 이유를 보여준다.
 */
export function checkFeaturedImageAttachEligibility(
  summary: WordPressBlogPublishPreparationSummary
): FeaturedImageAttachEligibility {
  const reasons: string[] = [];

  if (summary.readiness.blockers.some((b) => b.includes("quality_status"))) {
    reasons.push("품질검사를 통과해야 합니다.");
  }
  if (summary.readiness.blockers.some((b) => b.includes("approval_status"))) {
    reasons.push("승인 후 연결할 수 있습니다.");
  }
  if (!summary.draft.exists) {
    reasons.push("WordPress Draft가 먼저 필요합니다.");
  }
  if (!summary.featuredImage.wordpressMediaId) {
    reasons.push("대표 이미지 media ID를 먼저 입력하세요.");
  }

  return { eligible: reasons.length === 0, reasons };
}
