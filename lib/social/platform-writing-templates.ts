// Phase 3-3: 플랫폼별 writing template 고도화.
// prompts/social/*.md가 AI에게 줄 프롬프트 원문이라면, 이 파일은 그 구조를
// 코드에서 참조할 수 있는 형태(구조 가이드, thread/card 개수 기준, mock
// 생성에 쓰는 힌트)로 정리한 것이다. 실제 이미지 생성이나 실제 게시는
// 다루지 않는다.

import type { SocialPlatform } from "./social-platform-types";

export interface PlatformWritingTemplate {
  platform: SocialPlatform;
  /** 사람이 읽는 구조 가이드 (prompts/social/*.md 요약) */
  structureGuidance: string[];
  /** x처럼 thread_items를 쓰는 플랫폼의 권장 개수 범위 */
  minThreadItems?: number;
  maxThreadItems?: number;
  /** instagram처럼 card_items를 쓰는 플랫폼의 권장 개수 범위 */
  minCardItems?: number;
  maxCardItems?: number;
  /** mock 생성기가 참고하는 필드별 힌트 문구 */
  mockFieldHints: string[];
}

export const PLATFORM_WRITING_TEMPLATES: Record<SocialPlatform, PlatformWritingTemplate> = {
  wordpress_blog: {
    platform: "wordpress_blog",
    structureGuidance: [
      "긴 SEO형 글로 작성한다.",
      "h2/h3 소제목으로 섹션을 구분한다.",
      "제목(post_title), 본문(post_body), excerpt를 모두 생성한다.",
      "기존 article의 seo_title/meta_description과 충돌하지 않게 작성한다.",
      "AD_SLOT marker가 필요한 경우 article content에 이미 있는 기준을 그대로 존중한다.",
      "너무 짧은 글은 금지한다 (최소 길이 기준은 platform-writing-config.ts 참고).",
    ],
    mockFieldHints: ["post_title", "post_body", "excerpt"],
  },
  naver_blog: {
    platform: "naver_blog",
    structureGuidance: [
      "한국어 검색형 블로그 글로 작성한다.",
      "자연스러운 설명형 문체를 사용한다.",
      "소제목을 포함한다.",
      "과도한 키워드 반복을 금지한다.",
      "광고성 문구를 금지한다.",
      "manual export를 전제로 한다 (자동 게시 없음).",
    ],
    mockFieldHints: ["post_title", "post_body", "hashtags"],
  },
  naver_cafe: {
    platform: "naver_cafe",
    structureGuidance: [
      "커뮤니티형 글로 작성한다.",
      "질문형/공감형/토론 유도형 중 하나의 톤으로 연다.",
      "링크 남발을 금지한다.",
      "광고성·도배성 문구를 금지한다.",
      "너무 완성된 광고글처럼 보이지 않게 자연스럽게 작성한다.",
      "manual export를 전제로 한다.",
    ],
    mockFieldHints: ["post_title", "post_body"],
  },
  x: {
    platform: "x",
    structureGuidance: [
      "thread_items 중심으로 작성한다.",
      "3~7개의 스레드를 권장한다.",
      "각 item은 짧고 명확하게 작성한다.",
      "첫 item은 hook 역할을 한다.",
      "마지막 item은 질문 또는 부드러운 행동 유도로 마무리할 수 있다.",
      "낚시성/공포 조장 표현을 금지한다.",
    ],
    minThreadItems: 3,
    maxThreadItems: 7,
    mockFieldHints: ["thread_items", "hashtags"],
  },
  threads: {
    platform: "threads",
    structureGuidance: [
      "짧은 대화형 인사이트로 작성한다.",
      "자연스럽고 말하듯이 작성한다.",
      "마지막에 질문으로 마무리할 수 있다.",
      "과도한 해시태그를 금지한다.",
    ],
    mockFieldHints: ["post_body", "hashtags"],
  },
  instagram: {
    platform: "instagram",
    structureGuidance: [
      "caption을 생성한다.",
      "hashtags를 생성한다.",
      "card_items(카드뉴스 슬라이드별 짧은 문구)를 생성한다.",
      "이미지가 필요한 플랫폼임을 media_requirements에 표시한다.",
      "실제 이미지 생성은 하지 않는다.",
    ],
    minCardItems: 3,
    maxCardItems: 5,
    mockFieldHints: ["caption", "hashtags", "card_items"],
  },
};

export function getPlatformWritingTemplate(platform: SocialPlatform): PlatformWritingTemplate {
  return PLATFORM_WRITING_TEMPLATES[platform];
}
