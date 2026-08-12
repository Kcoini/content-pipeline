// Phase 3-12: Rewrite Version Quality Recheck & Comparison — 비교 규칙.
// 원본과 rewrite version을 비교해 어느 쪽이 더 나은지 "보조 지표"만
// 계산한다. 실제 게시/원본 교체는 어떤 함수도 수행하지 않는다.

import { getPlatformWritingConfig } from "./platform-writing-config";
import { getToneTransformerRule } from "./tone-transformer-rules";
import { checkForbiddenPatterns } from "./platform-publishing-rules";
import type { SocialPost, VersionComparisonStatus } from "./social-platform-types";

export interface VersionComparisonChecklistItem {
  key: string;
  label: string;
  status: "pass" | "warning" | "fail" | "blocked";
  message: string;
}

function item(key: string, label: string, status: VersionComparisonChecklistItem["status"], message: string): VersionComparisonChecklistItem {
  return { key, label, status, message };
}

function collectPostText(post: SocialPost): string {
  const threadText = post.threadItems.map((t) => t.text).join(" ");
  const cardText = post.cardItems.map((c) => `${c.heading} ${c.body}`).join(" ");
  return [post.postTitle, post.postBody, post.caption, post.excerpt, threadText, cardText].filter(Boolean).join(" ");
}

/** quality_score/quality_status 변화를 비교한다. */
export function compareVersionQuality(original: SocialPost, rewrite: SocialPost): VersionComparisonChecklistItem[] {
  const checklist: VersionComparisonChecklistItem[] = [];

  if (original.qualityScore !== null && rewrite.qualityScore !== null) {
    const delta = rewrite.qualityScore - original.qualityScore;
    checklist.push(
      item(
        "quality_score_delta",
        "quality_score 변화",
        delta >= 0 ? "pass" : "warning",
        delta >= 0 ? `rewrite quality_score가 원본 대비 ${delta}점 변화했습니다(개선 또는 동일).` : `rewrite quality_score가 원본보다 ${Math.abs(delta)}점 낮습니다.`
      )
    );
  }

  checklist.push(
    item(
      "quality_status_transition",
      "quality_status 변화",
      rewrite.qualityStatus === "blocked" ? "blocked" : "pass",
      `원본: ${original.qualityStatus} → rewrite: ${rewrite.qualityStatus}`
    )
  );

  return checklist;
}

/** platform_publish_guard_status 등 플랫폼 게시 적합성을 비교한다. */
export function comparePlatformFit(original: SocialPost, rewrite: SocialPost): VersionComparisonChecklistItem[] {
  return [
    item(
      "platform_publish_guard_status",
      "Platform Publishing Guard 상태",
      "pass",
      `원본: ${original.platformPublishGuardStatus} → rewrite: ${rewrite.platformPublishGuardStatus}`
    ),
  ];
}

/** 협박/공포조장/광고클릭유도/과장수익 등 금지 표현과 문체 적합성을 비교한다. */
export function compareToneFit(original: SocialPost, rewrite: SocialPost): VersionComparisonChecklistItem[] {
  const checklist: VersionComparisonChecklistItem[] = [];

  const rewriteText = collectPostText(rewrite);
  const forbidden = checkForbiddenPatterns(rewriteText);
  checklist.push(
    item(
      "rewrite_forbidden_patterns",
      "rewrite 금지 표현 없음",
      forbidden.blocked ? "blocked" : "pass",
      forbidden.blocked ? `금지 표현이 발견되었습니다: ${forbidden.found.join(", ")}` : "금지 표현이 발견되지 않았습니다."
    )
  );

  const toneRule = getToneTransformerRule(rewrite.toneStyle);
  const toneBannedFound = toneRule.bannedPhrases.filter((phrase) => rewriteText.includes(phrase));
  checklist.push(
    item(
      "rewrite_tone_alignment",
      "rewrite 문체 정합성",
      toneBannedFound.length > 0 ? "warning" : "pass",
      toneBannedFound.length > 0 ? `선택한 문체(${rewrite.toneStyle})에서 지양할 표현이 있습니다: ${toneBannedFound.join(", ")}` : "문체와 크게 어긋나지 않습니다."
    )
  );

  return checklist;
}

const CAFE_DISCUSSION_PATTERN = /[?？]|어떻게 생각|계신가요|공유해|추천해/;

function findOverRepeatedKeyword(text: string): boolean {
  const words = text.match(/[가-힣a-zA-Z0-9]{2,}/g) ?? [];
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.values()].some((count) => count >= 8);
}

/** 플랫폼별 구조(thread/caption/hashtag/card_items 등)를 비교한다. */
export function compareStructure(original: SocialPost, rewrite: SocialPost): VersionComparisonChecklistItem[] {
  const checklist: VersionComparisonChecklistItem[] = [];
  const config = getPlatformWritingConfig(rewrite.platform);

  switch (rewrite.platform) {
    case "x": {
      const count = rewrite.threadItems.length;
      const inRange = count >= 3 && count <= 7;
      checklist.push(item("x_thread_item_count", "x thread item 개수", inRange ? "pass" : "warning", `rewrite thread item ${count}개 (권장 3~7개).`));
      const overLength = rewrite.threadItems.filter((t) => t.text.length > 280);
      checklist.push(
        item("x_thread_item_length", "x thread item 길이", overLength.length > 0 ? "fail" : "pass", overLength.length > 0 ? `${overLength.length}개 item이 280자를 초과했습니다.` : "모든 item이 길이 제한 이내입니다.")
      );
      break;
    }
    case "instagram": {
      checklist.push(item("instagram_caption_present", "instagram caption 존재", rewrite.caption?.trim() ? "pass" : "warning", rewrite.caption?.trim() ? "caption이 있습니다." : "caption이 비어 있습니다."));
      checklist.push(item("instagram_hashtags_present", "instagram 해시태그 존재", rewrite.hashtags.length > 0 ? "pass" : "warning", `해시태그 ${rewrite.hashtags.length}개.`));
      checklist.push(item("instagram_card_items_present", "instagram card_items 존재", rewrite.cardItems.length > 0 ? "pass" : "warning", `card_items ${rewrite.cardItems.length}개.`));
      checklist.push(
        item("instagram_media_requirements", "instagram media_requirements 명시", rewrite.mediaRequirements?.requiresImage === true ? "pass" : "warning", rewrite.mediaRequirements?.requiresImage === true ? "requiresImage=true로 명시되어 있습니다." : "requiresImage가 명시되어 있지 않습니다.")
      );
      break;
    }
    case "naver_cafe": {
      const hasDiscussionCue = CAFE_DISCUSSION_PATTERN.test(collectPostText(rewrite));
      checklist.push(item("naver_cafe_discussion_cue", "질문형/토론형 문장", hasDiscussionCue ? "pass" : "warning", hasDiscussionCue ? "질문/토론 유도 문장이 있습니다." : "질문/토론 유도 문장이 부족합니다."));
      break;
    }
    case "naver_blog": {
      const titleSearchy = (rewrite.postTitle?.trim().length ?? 0) >= 10;
      checklist.push(item("naver_blog_title_search_friendly", "검색형 제목", titleSearchy ? "pass" : "warning", titleSearchy ? "검색에 유리한 제목입니다." : "제목이 너무 짧습니다."));
      const overRepeated = findOverRepeatedKeyword(rewrite.postBody ?? "");
      checklist.push(item("naver_blog_keyword_repetition", "키워드 과다 반복 없음", overRepeated ? "warning" : "pass", overRepeated ? "특정 단어가 8회 이상 반복됩니다." : "과도한 키워드 반복이 없습니다."));
      break;
    }
    case "wordpress_blog": {
      checklist.push(item("wordpress_title_body_present", "title/body 존재", rewrite.postTitle?.trim() && rewrite.postBody?.trim() ? "pass" : "warning", "title/body 존재 여부를 확인했습니다."));
      checklist.push(item("wordpress_excerpt_present", "excerpt 존재", rewrite.excerpt?.trim() ? "pass" : "warning", rewrite.excerpt?.trim() ? "excerpt가 있습니다." : "excerpt가 없습니다."));
      const bodyLen = rewrite.postBody?.length ?? 0;
      checklist.push(item("wordpress_body_length", "본문 길이 적정성", bodyLen >= config.minLength ? "pass" : "warning", `본문 길이 ${bodyLen}자 (권장 최소 ${config.minLength}자).`));
      break;
    }
    default:
      break;
  }

  if (config.supportsHashtags) {
    const hashtagOk = rewrite.hashtags.length > 0 && rewrite.hashtags.length <= config.recommendedHashtagCount * 2;
    checklist.push(item("hashtag_count_fit", "해시태그 수 적정성", hashtagOk ? "pass" : "warning", `rewrite 해시태그 ${rewrite.hashtags.length}개 (권장 ${config.recommendedHashtagCount}개 내외).`));
  }

  void original;
  return checklist;
}

const POINTS: Record<VersionComparisonChecklistItem["status"], number> = { pass: 1, warning: 0.5, fail: 0, blocked: 0 };

/** 전체 checklist를 0~100 점수로 환산한다 (내부 비교용, 정확한 지표가 아님). */
export function calculateVersionComparisonScore(input: { checklist: VersionComparisonChecklistItem[] }): number {
  if (input.checklist.length === 0) return 0;
  const total = input.checklist.reduce((sum, c) => sum + POINTS[c.status], 0);
  return Math.round((total / input.checklist.length) * 100);
}

export interface DecideRecommendedVersionInput {
  original: SocialPost;
  rewrite: SocialPost;
  checklist: VersionComparisonChecklistItem[];
}

export interface DecideRecommendedVersionResult {
  comparisonStatus: VersionComparisonStatus;
  recommendedSocialPostId: string | null;
  recommendationReason: string;
  recommendedForRepost: boolean;
}

/**
 * 비교 결과를 종합해 comparison_status와 추천 버전을 결정한다. 어떤
 * 경우에도 실제 게시나 원본 교체를 수행하지 않으며, 사람이 최종 판단
 * 해야 한다는 원칙 하에 "보조 지표"만 산출한다.
 */
export function decideRecommendedVersion(input: DecideRecommendedVersionInput): DecideRecommendedVersionResult {
  const { original, rewrite, checklist } = input;

  if (checklist.some((c) => c.status === "blocked")) {
    return {
      comparisonStatus: "blocked",
      recommendedSocialPostId: original.id,
      recommendationReason: "rewrite version에서 금지 표현 또는 심각한 문제가 발견되어 추천할 수 없습니다.",
      recommendedForRepost: false,
    };
  }

  if (original.qualityStatus === "not_checked" || rewrite.qualityStatus === "not_checked") {
    return {
      comparisonStatus: "needs_review",
      recommendedSocialPostId: null,
      recommendationReason: "아직 quality gate를 실행하지 않아 판단 근거가 부족합니다.",
      recommendedForRepost: false,
    };
  }

  if (rewrite.qualityStatus === "blocked") {
    return {
      comparisonStatus: "original_better",
      recommendedSocialPostId: original.id,
      recommendationReason: "rewrite version이 blocked 상태입니다.",
      recommendedForRepost: false,
    };
  }

  if (rewrite.qualityStatus === "ready" && original.qualityStatus !== "ready") {
    return {
      comparisonStatus: "rewrite_better",
      recommendedSocialPostId: rewrite.id,
      recommendationReason: "rewrite version이 ready 상태이고 원본은 그렇지 않습니다.",
      recommendedForRepost: true,
    };
  }

  if (original.qualityStatus === "ready" && rewrite.qualityStatus !== "ready") {
    return {
      comparisonStatus: "original_better",
      recommendedSocialPostId: original.id,
      recommendationReason: "원본이 ready 상태이고 rewrite version은 그렇지 않습니다.",
      recommendedForRepost: false,
    };
  }

  if (original.qualityScore !== null && rewrite.qualityScore !== null) {
    const delta = rewrite.qualityScore - original.qualityScore;
    if (delta >= 10) {
      return {
        comparisonStatus: "rewrite_better",
        recommendedSocialPostId: rewrite.id,
        recommendationReason: `rewrite quality_score가 원본보다 ${delta}점 높습니다.`,
        recommendedForRepost: rewrite.qualityStatus === "ready",
      };
    }
    if (delta <= -10) {
      return {
        comparisonStatus: "original_better",
        recommendedSocialPostId: original.id,
        recommendationReason: `원본 quality_score가 rewrite보다 ${-delta}점 높습니다.`,
        recommendedForRepost: false,
      };
    }
    return {
      comparisonStatus: "similar",
      recommendedSocialPostId: rewrite.qualityScore >= original.qualityScore ? rewrite.id : original.id,
      recommendationReason: "두 버전의 품질 점수 차이가 크지 않습니다.",
      recommendedForRepost: false,
    };
  }

  return {
    comparisonStatus: "needs_review",
    recommendedSocialPostId: null,
    recommendationReason: "판단할 수 있는 점수 데이터가 부족합니다.",
    recommendedForRepost: false,
  };
}
