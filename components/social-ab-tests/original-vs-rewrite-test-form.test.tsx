import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OriginalVsRewriteTestForm } from "./original-vs-rewrite-test-form";
import type { SocialPost } from "@/lib/social/social-platform-types";

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "post-1",
    articleId: "article-1",
    platform: "wordpress_blog",
    isRewriteVersion: false,
    postTitle: "제목",
    caption: null,
    versionNumber: 1,
    ...overrides,
  } as unknown as SocialPost;
}

describe("OriginalVsRewriteTestForm", () => {
  it("rewrite version이 없으면 안내 문구만 렌더링한다", () => {
    const html = renderToStaticMarkup(<OriginalVsRewriteTestForm articleId="article-1" allPosts={[makePost()]} />);
    expect(html).toContain("아직 이 기사에 rewrite version이 없습니다");
  });

  it("원본/rewrite 후보가 있으면 select를 렌더링한다", () => {
    const html = renderToStaticMarkup(
      <OriginalVsRewriteTestForm
        articleId="article-1"
        allPosts={[makePost({ id: "post-1", isRewriteVersion: false }), makePost({ id: "post-2", isRewriteVersion: true, versionNumber: 2 })]}
      />
    );
    expect(html).toContain("원본 vs Rewrite test 생성");
    expect(html).toContain("post-1");
    expect(html).toContain("post-2");
  });
});
