// Phase 3-10: 플랫폼별 rewrite(개선) 전략.
// 실제 게시 API 호출이나 자동 재작성은 하지 않는다 — 어떤 부분을
// 어떻게 개선하면 좋을지에 대한 가이드 문자열만 제공한다.

import type { SocialPlatform } from "./social-platform-types";

export interface PlatformRewriteStrategy {
  platform: SocialPlatform;
  improvementAreas: string[];
}

const PLATFORM_REWRITE_STRATEGIES: Record<SocialPlatform, string[]> = {
  wordpress_blog: [
    "title 개선",
    "excerpt 개선",
    "첫 문단 개선",
    "SEO keyword 자연스럽게 반영",
    "CTA 개선",
    "내부링크/출처 안내 개선",
  ],
  naver_blog: [
    "검색형 제목 개선",
    "첫 문단 자연스럽게 개선",
    "소제목 구조 개선",
    "키워드 반복 줄이기",
    "너무 AI스러운 문장 완화",
    "태그 개선",
  ],
  naver_cafe: ["광고성 문구 줄이기", "질문형 마무리 강화", "공감 문장 추가", "토론 유도 문장 추가", "링크 의존도 줄이기"],
  x: ["첫 트윗 hook 강화", "thread 순서 재구성", "각 item 짧게 정리", "마지막 CTA 개선", "해시태그 축소", "클릭 유도 과장 금지"],
  threads: ["자연스러운 대화형 문장 강화", "첫 문장 짧게 개선", "질문형 마무리", "해시태그 과다 줄이기"],
  instagram: ["caption 첫 줄 개선", "카드뉴스 슬라이드 문구 개선", "저장/공유 유도는 부드럽게 표현", "해시태그 정리", "이미지 필요성 명확화"],
};

/** 플랫폼별 개선 가이드(문자열 목록)를 반환한다. 실제 재작성/게시는 수행하지 않는다. */
export function getPlatformRewriteStrategy(platform: SocialPlatform): PlatformRewriteStrategy {
  return { platform, improvementAreas: PLATFORM_REWRITE_STRATEGIES[platform] };
}
