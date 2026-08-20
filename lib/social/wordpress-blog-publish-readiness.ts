// Article/Blog 페이지 역할 분리 리팩터링: wordpress_blog social_post가 실제로
// "WordPress 게시의 기본 대상"이 될 준비가 됐는지 점검하는 순수 함수.
//
// 이 파일은 어떤 외부 API도 호출하지 않고, 어떤 데이터도 수정하지 않는다
// (read-only 판단만 수행). 실제 WordPress API 호출은 여전히
// lib/publish/publish-service.ts(article 대상)가 담당하며, 이 함수는
// "wordpress_blog 글 자체가 게시할 만한 상태인지"만 판단한다.
//
// 알려진 한계: monetized_blog "article_mode"(articles 테이블, Phase 1/2)가
// 제공하는 answerSummary/eeatNotes/geoSummary/policyRiskScore 같은 필드는
// wordpress_blog "platform"(social_posts 테이블, Phase 3)에는 존재하지
// 않는다 — social_posts.platformMetadata는 타입이 정해지지 않은
// Record<string, unknown>이라 seoTitle/metaDescription이 있으면 그 안에서만
// (있다면) 확인할 수 있다. 이 함수는 실제로 존재하는 필드만 검증하며,
// 존재하지 않는 필드를 검증하는 것처럼 꾸미지 않는다.

import { checkForbiddenPatterns } from "./platform-publishing-rules";
import { AD_SLOT_MARKERS, adSlotMarkerComment } from "@/lib/articles/article-modes";
import type { SocialPost } from "./social-platform-types";

export interface WordPressBlogPublishReadiness {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  /** platformMetadata.seoTitle/metaDescription 등에서 확인한 SEO 관련 신호(있으면). */
  seoSignals: {
    seoTitle: string | null;
    metaDescription: string | null;
  };
  /**
   * 대표 이미지 준비 여부. 대표 이미지가 없어도 절대 blocker가 되지
   * 않는다 — media ID가 없고 waive도 선택하지 않았으면 warning만
   * 남기고, waive를 선택했으면 그 사실을 알리는 warning으로 대체한다.
   */
  featuredImageSignal: {
    hasMediaId: boolean;
    waived: boolean;
  };
}

const DISALLOWED_AD_CODE_PATTERN = /adsbygoogle|googlesyndication|data-ad-client|data-ad-slot|<script\b|<iframe\b/i;
const CLICKBAIT_TITLE_PATTERN = /(충격|경악|소름|역대급|미쳤|헐|실화\?|[!?]{2,})/;
const POLICY_RISK_WARNING_THRESHOLD = 70;
/** keyword가 본문 단어 수 대비 이 비율을 넘으면 keyword stuffing 경고. */
const KEYWORD_STUFFING_RATIO = 0.06;

function readStringField(platformMetadata: Record<string, unknown>, key: string): string | null {
  const value = platformMetadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export interface WordPressBlogPublishReadinessOptions {
  /**
   * article.policyRiskScore(monetized_blog 원본 article 기준)를 함께
   * 넘기면 임계값을 초과할 때 warning을 추가한다. 넘기지 않으면(undefined)
   * 이 검사는 건너뛴다 — social_post 자체에는 정책 위험 점수가 없다.
   */
  policyRiskScore?: number | null;
}

/**
 * wordpress_blog social_post가 "WordPress Draft 생성" 등 게시 관련 동작을
 * 실행할 만한 상태인지 판단한다. platform !== "wordpress_blog"인 post에
 * 대해서도 호출은 가능하지만, 호출하는 쪽(server action)에서 platform을
 * 먼저 확인하는 것을 권장한다.
 */
export function checkWordPressBlogPublishReadiness(
  post: SocialPost,
  options: WordPressBlogPublishReadinessOptions = {}
): WordPressBlogPublishReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (post.platform !== "wordpress_blog") {
    blockers.push(`platform이 wordpress_blog가 아닙니다 (현재: ${post.platform}).`);
  }

  if (post.qualityStatus !== "ready") {
    blockers.push(`quality_status가 ready가 아닙니다 (현재: ${post.qualityStatus}).`);
  }

  if (post.approvalStatus !== "approved") {
    blockers.push(`approval_status가 approved가 아닙니다 (현재: ${post.approvalStatus}).`);
  }

  const title = post.postTitle?.trim() ?? "";
  const body = post.postBody?.trim() ?? "";
  if (!title || !body) {
    blockers.push("post_title 또는 post_body가 비어 있습니다.");
  }

  const seoTitle = readStringField(post.platformMetadata, "seoTitle");
  const metaDescription = readStringField(post.platformMetadata, "metaDescription");
  const targetKeyword = readStringField(post.platformMetadata, "targetKeyword");
  if (!seoTitle) {
    warnings.push("platform_metadata.seoTitle이 없습니다 — SEO 제목 없이 article 제목이 그대로 쓰일 수 있습니다.");
  }
  if (!metaDescription) {
    warnings.push("platform_metadata.metaDescription이 없습니다.");
  }
  if (!targetKeyword) {
    warnings.push("platform_metadata.targetKeyword가 없습니다.");
  }

  const bodyText = `${title} ${body}`;
  const forbidden = checkForbiddenPatterns(bodyText);
  if (forbidden.blocked) {
    blockers.push(`금지 표현이 발견되었습니다: ${forbidden.found.join(", ")}`);
  }

  if (DISALLOWED_AD_CODE_PATTERN.test(body)) {
    blockers.push("본문에 실제 광고 스크립트/코드로 보이는 문자열이 포함되어 있습니다.");
  }

  for (const position of AD_SLOT_MARKERS) {
    const marker = adSlotMarkerComment(position);
    const count = body.split(marker).length - 1;
    if (count > 1) {
      warnings.push(`AD_SLOT marker(${position})가 ${count}회 중복 등장합니다.`);
    }
  }

  if (title && CLICKBAIT_TITLE_PATTERN.test(title)) {
    warnings.push("title에 clickbait(자극적 표현/과다한 느낌표·물음표)로 보이는 패턴이 있습니다.");
  }

  if (targetKeyword && body) {
    const wordCount = body.split(/\s+/).filter(Boolean).length;
    const keywordCount = body.split(targetKeyword).length - 1;
    if (wordCount > 0 && keywordCount / wordCount > KEYWORD_STUFFING_RATIO) {
      warnings.push(`targetKeyword("${targetKeyword}")가 본문에 과도하게 반복되어 keyword stuffing으로 보일 수 있습니다.`);
    }
  }

  if (typeof options.policyRiskScore === "number" && options.policyRiskScore > POLICY_RISK_WARNING_THRESHOLD) {
    warnings.push(`정책 위험도(policyRiskScore: ${options.policyRiskScore})가 기준(${POLICY_RISK_WARNING_THRESHOLD})을 초과했습니다.`);
  }

  // 대표 이미지: media ID가 없어도 hard blocker로 취급하지 않는다.
  // - media ID도 없고 waive도 선택하지 않았으면: 아직 결정이 안 됐다는 warning.
  // - waive를 선택했으면: "사용자가 이미지 없이 진행하도록 선택했다"는 warning으로 대체한다(에러 아님).
  const featuredImageMeta =
    typeof post.platformMetadata.featuredImage === "object" && post.platformMetadata.featuredImage !== null
      ? (post.platformMetadata.featuredImage as Record<string, unknown>)
      : {};
  const hasFeaturedImageMediaId =
    typeof featuredImageMeta.wordpressMediaId === "number" && featuredImageMeta.wordpressMediaId > 0;
  const featuredImageWaived = featuredImageMeta.waived === true;

  if (!hasFeaturedImageMediaId && featuredImageWaived) {
    warnings.push("대표 이미지가 없습니다. 사용자가 이미지 없이 진행하도록 선택했습니다.");
  } else if (!hasFeaturedImageMediaId) {
    warnings.push(
      "대표 이미지가 준비되지 않았습니다. media ID를 입력하거나 이미지를 업로드하거나, '대표 이미지 없이 진행'을 선택하세요."
    );
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    seoSignals: { seoTitle, metaDescription },
    featuredImageSignal: { hasMediaId: hasFeaturedImageMediaId, waived: featuredImageWaived },
  };
}
