// Phase 4-5: 글 유형 자동 추정 + 설정된 platform과의 불일치 감지.
//
// 완벽한 의미 분석이 아니라, 각 글 유형이 실제로 요구하는 최소한의
// 형식적 신호(관점/반론 마커, 리드문 길이 등 — social-quality-gate.ts가
// 이미 쓰는 것과 같은 패턴)만으로 "본문이 어떤 형태에 가까운지" 추정한다.
// 목적은 완벽한 판정이 아니라, news_article ↔ opinion_column처럼 서로
// 정반대 기준을 요구하는 플랫폼을 사람이 잘못 선택했을 때 "확인 필요"로
// 안내하는 것이다 — 불확실하면(unclear) 굳이 불일치로 표시하지 않는다.

import type { SocialPlatform } from "./social-platform-types";

export type InferredContentShape = "opinion_column_like" | "news_or_explainer_like" | "unclear";

const VIEWPOINT_MARKERS = ["필자는", "나는", "생각한다", "본다", "봐야 한다", "주장한다", "판단된다", "결론적으로"];
const COUNTERARGUMENT_MARKERS = ["반론", "한계", "다른 시각", "다만", "물론", "비판적 시각", "다른 의견"];
const MIN_LEAD_LENGTH = 30;

/** 본문 텍스트만 보고 "칼럼형(의견형)에 가까운지, 기사/해설형에 가까운지"를 추정한다. */
export function inferContentShape(postBody: string | null | undefined): InferredContentShape {
  const text = postBody ?? "";
  if (!text.trim()) return "unclear";

  const hasViewpoint = VIEWPOINT_MARKERS.some((pattern) => text.includes(pattern));
  const hasCounterargument = COUNTERARGUMENT_MARKERS.some((pattern) => text.includes(pattern));

  if (hasViewpoint && hasCounterargument) return "opinion_column_like";

  const firstParagraph = text.split(/\n{2,}/)[0]?.trim() ?? "";
  if (!hasViewpoint && firstParagraph.length >= MIN_LEAD_LENGTH) return "news_or_explainer_like";

  return "unclear";
}

export interface ContentTypeMismatchResult {
  mismatched: boolean;
  inferredShape: InferredContentShape;
  /** 화면에 보여줄 안내 문구. mismatched=false면 null. */
  message: string | null;
  /** "글 유형 확인 필요" 배너에서 안내할 대체 플랫폼(있으면). */
  suggestedPlatform: SocialPlatform | null;
}

/**
 * 설정된 platform과 본문에서 추정한 글 형태가 정반대 기준을 요구하는
 * 조합인지 확인한다. news_article ↔ opinion_column처럼 사실 전달 vs
 * 관점 전달로 검토 기준이 완전히 다른 플랫폼 조합만 다룬다 — 불확실한
 * 경우(unclear)는 mismatch로 보지 않는다(false positive를 만들지 않기
 * 위해서다).
 */
export function detectContentTypeMismatch(
  platform: SocialPlatform,
  postBody: string | null | undefined
): ContentTypeMismatchResult {
  const inferredShape = inferContentShape(postBody);

  if (platform === "news_article" && inferredShape === "opinion_column_like") {
    return {
      mismatched: true,
      inferredShape,
      message:
        "본문은 칼럼형 해설문(관점 + 반론/한계)에 가깝지만 현재 설정은 언론 기사(news_article)입니다. 기사로 유지하려면 관점 표현을 사실 전달형으로 바꾸고 출처 근거를 보강하세요. 칼럼으로 바꾸려면 의견형 글임을 명확히 표시하세요.",
      suggestedPlatform: "opinion_column",
    };
  }

  if (platform === "opinion_column" && inferredShape === "news_or_explainer_like") {
    return {
      mismatched: true,
      inferredShape,
      message:
        "본문에 관점(중심 주장)이나 반론/한계가 뚜렷하게 드러나지 않아 언론 기사·해설 기사에 가까워 보입니다. 칼럼으로 유지하려면 관점과 반론/한계를 추가하세요.",
      suggestedPlatform: "news_article",
    };
  }

  return { mismatched: false, inferredShape, message: null, suggestedPlatform: null };
}
