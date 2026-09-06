// wordpress_blog social_post를 실제 WordPress Draft 생성/업데이트 payload로
// 변환하는 공용 빌더. `createWordPressDraftFromBlogPostAction`/
// `updateWordPressDraftFromBlogPostAction`(app/articles/[id]/actions.ts)과
// `prepareWordPressBlogPostForPublishing`(오케스트레이터)이 각자 따로
// contentOverride를 만들던 것을 이 파일 하나로 합쳐, 두 곳이 서로 다르게
// 동작하는 일(예: 한쪽만 markdown→HTML 변환을 잊는 것)을 막는다.
//
// 중요: article 원문의 title/content는 여기서 전혀 읽지 않는다 —
// publishArticleToWordPressDraft의 contentOverride 옵션(기본값 undefined)을
// 통해서만 article 고급 기능의 기존 동작(override 없음, markdown 변환 없음)과
// 분리된다.

import { convertMarkdownToWordPressHtml } from "@/lib/wordpress/markdown-to-wordpress-html";
import type { PublishArticleOptions } from "@/lib/publish/publish-service";
import type { SocialPost } from "./social-platform-types";

/**
 * wordpress_blog social_post의 title/body/excerpt를 실제 WordPress 전송
 * payload로 만든다. post_body(markdown)는 WordPress REST API content로
 * 보내기 전에 반드시 HTML로 변환한다(AD_SLOT marker/표/목록/h2·h3 구조는
 * 보존하고 sanitize한다) — 그렇지 않으면 WordPress 공개 화면에
 * `## 소제목`, `| 표 |` 같은 markdown 문법이 그대로 노출된다.
 */
export function buildWordPressBlogContentOverride(post: SocialPost): PublishArticleOptions["contentOverride"] {
  const rawBody = post.postBody?.trim();
  return {
    title: post.postTitle?.trim() || undefined,
    content: rawBody ? convertMarkdownToWordPressHtml(rawBody) : undefined,
    excerpt: post.excerpt?.trim() || undefined,
  };
}
