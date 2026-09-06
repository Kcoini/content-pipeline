// /articles/[id] 고급 기능 "원본 article을 WordPress Draft로 전송" 섹션이
// 사용하는 서비스. 사용자가 대표 이미지 없이 원본 article을 그대로
// WordPress Draft로 전송하도록 명시적으로 선택했을 때(waive)의 저장/해제/
// 조회를 담당한다.
//
// 중요: 이 waiver는 article 원본 전송 전용이다.
// - /articles/[id]/blog의 wordpress_blog 글 카드에 있는 "대표 이미지 없이
//   진행"(lib/social/wordpress-blog-featured-image-waiver-service.ts)과는
//   완전히 별개의 상태다 — 저장 위치(social_posts.platformMetadata vs
//   articles.format_metadata)도 다르고, 값도 서로 자동으로 반영되지 않는다.
// - DB 제약 확인 결과: articles.featured_image_upload_status에는 CHECK
//   제약(check (... in ('not_ready','prepared','dry_run','uploaded','failed',
//   'skipped')))이 있어 'waived' 값을 저장할 수 없다(db/migrations/016).
//   이 제약을 완화하는 migration을 추가하지 않고, 대신 이미 자유 형식인
//   format_metadata JSON 컬럼에 targetType='article'을 명시해 저장한다.
//   featured_image_upload_status를 포함한 기존 상태 컬럼은 그대로 둔다 —
//   실제 이미지 업로드 흐름(Featured Image Workflow)의 진짜 상태와 이번
//   waive 개념이 뒤섞이지 않도록 하기 위해서다.

import { getArticleById, saveArticleWordPressFeaturedImageWaiver } from "@/lib/repositories/article-repository";
import { logEvent } from "@/lib/harness/logger";
import type { Article } from "@/lib/types/domain";

export type ArticleFeaturedImageWaiverReasonCode =
  | "internal_review_draft"
  | "manual_later"
  | "text_focused"
  | "no_suitable_image"
  | "other";

export const ARTICLE_FEATURED_IMAGE_WAIVER_REASONS: readonly {
  code: ArticleFeaturedImageWaiverReasonCode;
  label: string;
}[] = [
  { code: "internal_review_draft", label: "내부 검토용 Draft" },
  { code: "manual_later", label: "나중에 WordPress에서 수동 추가 예정" },
  { code: "text_focused", label: "텍스트 중심 기사" },
  { code: "no_suitable_image", label: "적절한 이미지 없음" },
  { code: "other", label: "기타" },
];

function isArticleFeaturedImageWaiverReasonCode(value: unknown): value is ArticleFeaturedImageWaiverReasonCode {
  return (
    value === "internal_review_draft" ||
    value === "manual_later" ||
    value === "text_focused" ||
    value === "no_suitable_image" ||
    value === "other"
  );
}

export interface ArticleWordPressFeaturedImageWaiverState {
  waived: boolean;
  reasonCode: string | null;
  memoPresent: boolean;
}

const DEFAULT_WAIVER_STATE: ArticleWordPressFeaturedImageWaiverState = {
  waived: false,
  reasonCode: null,
  memoPresent: false,
};

/**
 * article.formatMetadata에서 원본 article 전송용 waiver 상태만 읽는다
 * (read-only, 어떤 데이터도 변경하지 않는다). wordpress_blog 쪽
 * platformMetadata.featuredImage.waived와는 전혀 다른 값이다.
 */
export function getArticleWordPressFeaturedImageWaiverState(
  article: Pick<Article, "formatMetadata">
): ArticleWordPressFeaturedImageWaiverState {
  const raw = article.formatMetadata?.article_wordpress_featured_image_waiver;
  if (typeof raw !== "object" || raw === null) {
    return DEFAULT_WAIVER_STATE;
  }
  const record = raw as Record<string, unknown>;
  return {
    waived: record.featuredImageWaived === true,
    reasonCode: typeof record.featuredImageWaiverReason === "string" ? record.featuredImageWaiverReason : null,
    memoPresent: record.featuredImageWaiverMemoPresent === true,
  };
}

export interface WaiveArticleWordPressFeaturedImageResult {
  success: boolean;
  message: string;
}

/**
 * "대표 이미지 없이 원본 article 전송"을 명시적으로 선택했을 때 호출한다.
 * 사유 선택은 필수이며, 사유 없이는 절대 자동으로 waive 처리되지 않는다.
 */
export async function waiveArticleWordPressFeaturedImage(
  articleId: string,
  reasonCode: unknown,
  memo?: string
): Promise<WaiveArticleWordPressFeaturedImageResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }
  if (!isArticleFeaturedImageWaiverReasonCode(reasonCode)) {
    return { success: false, message: "대표 이미지 생략 사유를 선택하세요." };
  }

  const memoPresent = reasonCode === "other" && Boolean(memo?.trim());

  await saveArticleWordPressFeaturedImageWaiver(articleId, {
    waived: true,
    reasonCode,
    memoPresent,
  });

  await logEvent({
    type: "article_wordpress_featured_image_waived",
    status: "info",
    message: `기사(${articleId})가 대표 이미지 없이 원본 article을 WordPress Draft로 전송하도록 선택되었습니다.`,
    details: { targetType: "article", reasonCode, memoPresent, status: "waived" },
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  return { success: true, message: "대표 이미지 없이 원본 article을 전송하도록 설정했습니다." };
}

/**
 * media ID를 새로 저장하거나 로컬 이미지를 업로드하는 등, 실제로 대표
 * 이미지가 다시 준비되면 이 waiver를 자동으로 해제한다. wordpress_blog
 * 쪽 waiver에는 영향을 주지 않는다(완전히 다른 저장 위치).
 */
export async function clearArticleWordPressFeaturedImageWaiver(articleId: string): Promise<void> {
  const article = await getArticleById(articleId);
  if (!article) {
    return;
  }
  const current = getArticleWordPressFeaturedImageWaiverState(article);
  if (!current.waived) {
    return;
  }
  await saveArticleWordPressFeaturedImageWaiver(articleId, {
    waived: false,
    reasonCode: null,
    memoPresent: false,
  });
}
