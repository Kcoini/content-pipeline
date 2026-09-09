// Phase 3-26: /social-posts/[id]를 "게시용 미리보기 중심" 화면으로 만들기
// 위한 플랫폼별 표시 방식 계산 유틸. 본문 텍스트 자체를 어느 필드에서
// 가져올지는 이미 `lib/social/social-post-display.ts`의
// `getSocialPostDisplayBody`가 결정한다 — 이 파일은 그 텍스트를 "어떤
// 형태로 렌더링할지"(HTML/모바일 문단형/plain text/글자수 표시/caption+
// hashtag+card 분리)와 "무엇을 경고로 보여줄지"만 담당한다. DB나 도메인
// 타입은 건드리지 않는다.

import type { SocialPlatform, SocialPost } from "./social-platform-types";
import { getSocialPostDisplayBody } from "./social-post-display";

export type PlatformPreviewMode =
  | "wordpress_html" // wordpress_blog: HTML 렌더링
  | "mobile_blog" // naver_blog: 모바일 친화 문단형(markdown 원문 유지 — 실제 export가 markdown_copy이기 때문)
  | "plain_text" // naver_cafe: plain text(질문형/댓글 유도 문장 확인)
  | "short_text" // x/threads: 글자 수 표시가 중요한 짧은 글
  | "caption_stack"; // instagram: caption/hashtags/card text 분리

const PREVIEW_MODE_BY_PLATFORM: Record<SocialPlatform, PlatformPreviewMode> = {
  // news_article은 HTML 변환 대상이 아니다(manual export markdown 전제) — naver_blog와 같은 문단형 렌더링을 재사용한다.
  news_article: "mobile_blog",
  wordpress_blog: "wordpress_html",
  naver_blog: "mobile_blog",
  naver_cafe: "plain_text",
  x: "short_text",
  threads: "short_text",
  instagram: "caption_stack",
};

export function getPlatformPreviewMode(platform: SocialPlatform): PlatformPreviewMode {
  return PREVIEW_MODE_BY_PLATFORM[platform];
}

const BODY_LABEL_BY_PLATFORM: Record<SocialPlatform, string> = {
  news_article: "본문",
  wordpress_blog: "본문",
  naver_blog: "본문",
  naver_cafe: "본문",
  x: "글",
  threads: "글",
  instagram: "캡션",
};

/** 이 플랫폼에서 "본문"이라는 말 대신 어떤 단어를 쓰는지(글/캡션 등). */
export function getPlatformBodyLabel(platform: SocialPlatform): string {
  return BODY_LABEL_BY_PLATFORM[platform];
}

/** 플랫폼별 글자 수 권장 상한(짧은 글 계열 — short_text 모드에서만 사용). x는 스레드 항목 하나 기준. */
const SHORT_TEXT_MAX_LENGTH: Partial<Record<SocialPlatform, number>> = {
  x: 280,
};

/** 문단이 너무 길다고 보는 기준(모바일 가독성 — naver_blog 대상). */
const LONG_PARAGRAPH_LENGTH = 200;

/**
 * 게시용 미리보기 화면에 보여줄 경고 문구를 계산한다(차단이 아니라
 * "읽기 좋게 만들려면 이렇게 하는 게 좋다" 수준의 안내 — 실제 승인
 * 가능 여부는 자동 검토 리포트가 별도로 판단한다).
 */
export function getPlatformBodyWarnings(
  post: Pick<SocialPost, "platform" | "postBody" | "caption" | "threadItems" | "cardItems">
): string[] {
  const warnings: string[] = [];
  const displayText = getSocialPostDisplayBody(post);
  const mode = getPlatformPreviewMode(post.platform);

  if (mode === "mobile_blog") {
    const longestParagraph = Math.max(0, ...displayText.split(/\n{2,}/).map((p) => p.trim().length));
    if (longestParagraph > LONG_PARAGRAPH_LENGTH) {
      warnings.push("문단이 다소 깁니다. 모바일에서 읽기 쉽도록 짧게 나누는 것을 권장합니다.");
    }
  }

  if (mode === "short_text") {
    const maxLength = SHORT_TEXT_MAX_LENGTH[post.platform];
    if (maxLength && displayText.length > maxLength) {
      warnings.push(`글자 수가 ${displayText.length}자로 권장 길이(${maxLength}자)를 넘었습니다.`);
    }
  }

  if (mode === "plain_text") {
    const questionMarks = (displayText.match(/\?/g) ?? []).length;
    if (questionMarks === 0) {
      warnings.push("댓글을 유도하는 질문형 문장이 없습니다. 질문을 하나 추가하면 반응을 얻기 좋습니다.");
    }
  }

  return warnings;
}

/**
 * 게시용 본문이 실제로 존재하는지(플랫폼별 우선순위를 반영해서) 확인한다.
 * getSocialPostDisplayBody가 빈 문자열을 반환하면 "본문 없음" 안내를 보여줄 때 쓴다.
 */
export function hasDisplayableBody(post: Pick<SocialPost, "platform" | "postBody" | "caption" | "threadItems" | "cardItems">): boolean {
  return getSocialPostDisplayBody(post).trim().length > 0;
}
