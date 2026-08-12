// Phase 3-4: Social Post Review & Editing Workflow — 플랫폼별 미리보기 포맷.
// UI에서 social post를 사람이 읽기 좋은 형태로 미리보기할 때 사용하는 순수
// 함수만 모아둔다. 실제 게시나 외부 API 호출은 하지 않는다.

import type { SocialPost } from "./social-platform-types";

export interface PreviewLine {
  label: string;
  value: string;
}

export interface SocialPostPreview {
  platform: SocialPost["platform"];
  heading: string;
  lines: PreviewLine[];
  highlights: string[];
}

const DISCUSSION_CUE_PATTERN = /[?？]|어떻게 생각|계신가요|공유해|추천해/;

/** wordpress_blog: 제목 + 본문 미리보기, excerpt 표시. */
function formatWordpressBlog(post: SocialPost): SocialPostPreview {
  return {
    platform: post.platform,
    heading: post.postTitle ?? "(제목 없음)",
    lines: [
      { label: "본문", value: post.postBody ?? "" },
      { label: "excerpt", value: post.excerpt ?? "(없음)" },
    ],
    highlights: [],
  };
}

/** naver_blog: 제목 + 본문 + 해시태그. */
function formatNaverBlog(post: SocialPost): SocialPostPreview {
  return {
    platform: post.platform,
    heading: post.postTitle ?? "(제목 없음)",
    lines: [
      { label: "본문", value: post.postBody ?? "" },
      { label: "해시태그", value: post.hashtags.map((tag) => `#${tag}`).join(" ") || "(없음)" },
    ],
    highlights: [],
  };
}

/** naver_cafe: 제목 + 본문, 질문형/토론형 문장이 있으면 강조 표시한다. */
function formatNaverCafe(post: SocialPost): SocialPostPreview {
  const body = post.postBody ?? "";
  const highlights = body
    .split(/(?<=[.!?？다])\s+/)
    .filter((sentence) => DISCUSSION_CUE_PATTERN.test(sentence))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  return {
    platform: post.platform,
    heading: post.postTitle ?? "(제목 없음)",
    lines: [{ label: "본문", value: body }],
    highlights,
  };
}

/** x: thread_items를 번호별로, 각 item의 글자 수와 함께 표시한다. */
function formatX(post: SocialPost): SocialPostPreview {
  const lines = post.threadItems.map((item) => ({
    label: `#${item.order} (${item.text.length}자)`,
    value: item.text,
  }));

  return {
    platform: post.platform,
    heading: `thread ${post.threadItems.length}개`,
    lines,
    highlights: [],
  };
}

/** threads: post_body 미리보기, 해시태그 표시. */
function formatThreads(post: SocialPost): SocialPostPreview {
  return {
    platform: post.platform,
    heading: "본문",
    lines: [
      { label: "본문", value: post.postBody ?? "" },
      { label: "해시태그", value: post.hashtags.map((tag) => `#${tag}`).join(" ") || "(없음)" },
    ],
    highlights: [],
  };
}

/** instagram: caption 미리보기, 해시태그, card_items를 slide 형태(순서대로)로 표시한다. */
function formatInstagram(post: SocialPost): SocialPostPreview {
  const cardLines = post.cardItems.map((item) => ({
    label: `slide ${item.order}: ${item.heading}`,
    value: item.body,
  }));

  return {
    platform: post.platform,
    heading: "caption",
    lines: [
      { label: "caption", value: post.caption ?? "" },
      { label: "해시태그", value: post.hashtags.map((tag) => `#${tag}`).join(" ") || "(없음)" },
      ...cardLines,
    ],
    highlights: [],
  };
}

/** social post를 플랫폼에 맞는 미리보기 구조로 변환한다 (사람이 확인하기 쉬운 형태). */
export function formatSocialPostPreview(post: SocialPost): SocialPostPreview {
  switch (post.platform) {
    case "wordpress_blog":
      return formatWordpressBlog(post);
    case "naver_blog":
      return formatNaverBlog(post);
    case "naver_cafe":
      return formatNaverCafe(post);
    case "x":
      return formatX(post);
    case "threads":
      return formatThreads(post);
    case "instagram":
      return formatInstagram(post);
    default: {
      const exhaustiveCheck: never = post.platform;
      throw new Error(`지원하지 않는 platform입니다: ${String(exhaustiveCheck)}`);
    }
  }
}
