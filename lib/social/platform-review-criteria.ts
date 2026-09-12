// Phase 4-5: 글 유형별 생성·검토 기준 분리 — 자동 검토 리포트에 "이 글이
// 어떤 유형으로, 어떤 기준으로 검토되었는지"를 항상 먼저 보여주기 위한
// 순수 표시 함수. social-quality-gate.ts의 실제 검사 로직과 별개로,
// 화면에 보여줄 요약 문구만 담당한다(raw checklist key를 그대로 보여주지
// 않는다).
//
// 목적: "기사 본문인데 FAQ/체크리스트/광고 배치가 없어서 낮게 평가"
// 같은 오류를 막으려면, 검토 결과 자체를 고치는 것만큼이나 "왜 이런
// 기준으로 평가됐는지"를 사용자에게 분명히 보여주는 것이 중요하다.

import type { SocialPlatform } from "./social-platform-types";

export interface PlatformReviewCriteriaInfo {
  /** 이 플랫폼의 목적(한 문장). */
  purpose: string;
  /** 자동 검토가 중심으로 보는 기준(쉼표로 구분된 한 문장). */
  criteriaSummary: string;
  /** 이 플랫폼에는 강제하지 않는 기준(다른 플랫폼과 혼동 방지용 안내). */
  notEnforced: string | null;
}

const PLATFORM_REVIEW_CRITERIA: Record<SocialPlatform, PlatformReviewCriteriaInfo> = {
  news_article: {
    purpose: "사실 전달과 중립적 설명",
    criteriaSummary: "리드문, 육하원칙, 출처 근거, 중립성, 사실과 해석 구분",
    notEnforced: "FAQ나 체크리스트가 없다는 이유로 감점하지 않았습니다.",
  },
  opinion_column: {
    purpose: "관점 전달과 근거 있는 해석",
    criteriaSummary: "관점(중심 주장), 사실과 의견 구분, 반론/한계, 근거",
    notEnforced: "중립적 사실 전달(리드문/육하원칙)만을 기준으로 감점하지 않았습니다 — 이 글은 의견형 글입니다.",
  },
  wordpress_blog: {
    purpose: "검색 유입과 장문 설명(SEO/AEO/GEO)",
    criteriaSummary: "검색 의도 대응, 요약 박스, H2/H3 구조, FAQ/체크리스트, 출처·기준일",
    notEnforced: null,
  },
  naver_blog: {
    purpose: "모바일 가독성과 자연스러운 설명",
    criteriaSummary: "모바일 가독성, 문단 길이, 자연스러운 말투, 출처/주의사항",
    notEnforced: "WordPress 블로그 수준의 SEO 구조(FAQ/체크리스트 등)를 강제하지 않았습니다.",
  },
  naver_cafe: {
    purpose: "커뮤니티 반응과 댓글 유도",
    criteriaSummary: "plain text 여부, 질문/댓글 유도, 광고성 표현 없음",
    notEnforced: "Markdown 구조나 SEO 기준을 적용하지 않았습니다.",
  },
  x: {
    purpose: "짧고 명확한 확산형 글",
    criteriaSummary: "길이 제한, hook 존재, 과장/낚시성 표현 없음",
    notEnforced: null,
  },
  threads: {
    purpose: "대화형/공감형 짧은 글",
    criteriaSummary: "자연스러운 대화체, 길이, 과장 표현 없음",
    notEnforced: null,
  },
  instagram: {
    purpose: "caption과 카드뉴스형 문구",
    criteriaSummary: "caption/해시태그/카드 텍스트 구성, 이미지 요구사항",
    notEnforced: null,
  },
};

export function getPlatformReviewCriteria(platform: SocialPlatform): PlatformReviewCriteriaInfo {
  return PLATFORM_REVIEW_CRITERIA[platform];
}
