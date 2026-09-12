// Phase 3-21: "테마 → 출처 → 플랫폼별 글 생성" 흐름을 사용자 경험상
// 명확하게 되살리기 위한 순수 추천/메타데이터 함수 모음. 실제 AI 생성이나
// DB 접근은 하지 않는다 — platform/tone_style 선택 UI가 참고하는
// "권장값 계산기"다. 새 enum이나 DB 컬럼을 추가하지 않고, 기존
// SocialPlatform/ToneStyle 값만 사용한다.

import type { SocialPlatform, ToneStyle } from "./social-platform-types";

/** 플랫폼별 예상 API 사용량(비용) 수준 — 실제 토큰 사용량 측정이 아니라, 본문 길이/구조 복잡도 기준의 상대적 안내다. */
export type PlatformCostLevel = "low" | "medium" | "high";

export const PLATFORM_COST_LEVELS: Record<SocialPlatform, PlatformCostLevel> = {
  news_article: "medium",
  opinion_column: "medium",
  wordpress_blog: "high",
  naver_blog: "medium",
  naver_cafe: "low",
  x: "low",
  threads: "low",
  instagram: "medium",
};

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  news_article: "언론 기사",
  opinion_column: "칼럼",
  wordpress_blog: "WordPress 블로그",
  naver_blog: "네이버 블로그",
  naver_cafe: "네이버 카페",
  x: "X",
  threads: "Threads",
  instagram: "Instagram",
};

export const PLATFORM_SHORT_DESCRIPTIONS: Record<SocialPlatform, string> = {
  news_article: "스트레이트 기사·보도 기사 형식 (사실 전달, 중립적 설명, 육하원칙, 수동 export)",
  opinion_column: "관점과 해석이 중심인 의견형 글 (근거, 반론/한계, 사실-의견 구분, 수동 export)",
  wordpress_blog: "WordPress 게시용 긴 SEO 블로그 글 (HTML 변환, SEO metadata, 대표 이미지)",
  naver_blog: "네이버 블로그용 모바일 친화 글 (자연스러운 블로그 말투, 수동 export)",
  naver_cafe: "네이버 카페용 커뮤니티 글 (plain text, 질문형/공감형, 수동 복사)",
  x: "짧은 글 또는 스레드 (후킹, 요약, 반응 유도)",
  threads: "대화형/공감형 짧은 글",
  instagram: "캡션 + 해시태그 + 카드뉴스용 문구",
};

/** "테마/출처 준비 후 특별한 근거가 없을 때"의 기본 추천 플랫폼. news_article은 언론사 모드 설정이 없으면 기본 선택하지 않는다(선택은 가능). */
export const DEFAULT_RECOMMENDED_PLATFORMS: readonly SocialPlatform[] = ["wordpress_blog", "naver_blog", "naver_cafe"];

/**
 * article/topic의 성격(topicType)을 알 수 있으면 추천 플랫폼을 조정한다.
 * topicType은 현재 article 자체에 저장되는 값이 아니라(예: wordpress_blog
 * social post의 platformMetadata.topicType에만 존재), 알 수 없는 경우가
 * 대부분이다 — 이때는 항상 DEFAULT_RECOMMENDED_PLATFORMS로 안전하게
 * fallback한다.
 */
export type PlatformRecommendationTopicType =
  | "economic_daily_life"
  | "policy_support"
  | "breaking_news"
  | "visual_checklist_tip";

export function getRecommendedPlatforms(topicType?: PlatformRecommendationTopicType | null): SocialPlatform[] {
  switch (topicType) {
    case "economic_daily_life":
      return ["wordpress_blog", "naver_blog", "naver_cafe", "x"];
    case "policy_support":
      return ["wordpress_blog", "naver_blog", "naver_cafe"];
    case "breaking_news":
      // Phase 4-3: 언론사 모드 설정이 아직 없어 news_article을 기본
      // 추천에 자동으로 넣지 않는다("13. 대시보드 반영" 참고 — 선택은
      // 가능하되 기본 선택은 하지 않는다). 기존 추천 순서/구성은 그대로 둔다.
      return ["x", "threads", "naver_cafe", "wordpress_blog"];
    case "visual_checklist_tip":
      return ["wordpress_blog", "naver_blog", "naver_cafe", "instagram"];
    default:
      return [...DEFAULT_RECOMMENDED_PLATFORMS];
  }
}

/**
 * 플랫폼별 "추천 문체 자동 적용" 기본값. 기존 tone_style enum만 사용하며,
 * naver_cafe/threads처럼 실제로는 공감형/질문형/대화형으로 다르게 해석되어야
 * 하는 플랫폼은 프롬프트 단에서 그 해석을 담당한다(별도 enum을 추가하지
 * 않는다) — 여기서는 "어떤 tone_style 값을 넘길지"만 결정한다.
 */
export function getRecommendedToneForPlatform(platform: SocialPlatform): ToneStyle {
  switch (platform) {
    case "news_article":
      // 사실 전달/중립적 설명 — 언론 기사는 항상 explanatory·informational 계열이다.
      return "informational";
    case "opinion_column":
      // 관점을 설득력 있게 전달하는 것이 핵심 — persuasive를 기본값으로 쓴다.
      return "persuasive";
    case "wordpress_blog":
      return "explanatory";
    case "naver_blog":
      return "explanatory";
    case "naver_cafe":
      // naver_cafe 프롬프트가 story/warning류 tone_style을 "공감형/질문형"으로
      // 순화해서 해석한다(prompts/social/naver-cafe.md 참고) — 강한 설득형은
      // 기본값으로 쓰지 않는다.
      return "story";
    case "x":
      return "curiosity";
    case "threads":
      // threads 프롬프트가 story/curiosity를 "대화형"으로 순화해서 해석한다.
      return "story";
    case "instagram":
      return "comparison";
    default: {
      const exhaustiveCheck: never = platform;
      throw new Error(`지원하지 않는 platform입니다: ${String(exhaustiveCheck)}`);
    }
  }
}

/** 플랫폼별 권장 tone_style 목록(문체 수동 선택 UI에서 안내용으로 사용). */
export const RECOMMENDED_TONE_STYLES_BY_PLATFORM: Record<SocialPlatform, ToneStyle[]> = {
  news_article: ["informational", "explanatory"],
  opinion_column: ["persuasive", "explanatory", "comparison"],
  wordpress_blog: ["explanatory", "informational", "comparison", "warning", "loss_aversion"],
  naver_blog: ["explanatory", "informational", "comparison", "story", "persuasive"],
  naver_cafe: ["story", "curiosity", "warning"],
  x: ["curiosity", "warning", "comparison", "explanatory"],
  threads: ["story", "curiosity", "informational"],
  instagram: ["curiosity", "informational", "warning", "story"],
};

/**
 * naver_cafe에서는 강한 설득형/손실 회피형을 기본값으로 쓰지 않는다 —
 * 광고글처럼 보이는 것을 피하기 위해서다. 사용자가 명시적으로 이런
 * tone_style을 수동 선택해도, 실제 생성은 prompts/social/naver-cafe.md의
 * "금지 표현"/"구조 원칙"이 광고성 문구를 걸러낸다(강제 차단이 아니라
 * 순화된 해석으로 유도한다).
 */
export const NAVER_CAFE_DISCOURAGED_TONE_STYLES: readonly ToneStyle[] = ["persuasive", "loss_aversion"];
