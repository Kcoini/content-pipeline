import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getArticleById = vi.fn();
const listSocialPostsByArticle = vi.fn();
const listRewriteSuggestionsBySocialPost = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("@/lib/repositories/social-posts-repository", () => ({
  listSocialPostsByArticle: (...args: unknown[]) => listSocialPostsByArticle(...args),
}));
vi.mock("@/lib/repositories/social-rewrite-suggestions-repository", () => ({
  listRewriteSuggestionsBySocialPost: (...args: unknown[]) => listRewriteSuggestionsBySocialPost(...args),
}));

const { buildArticleRewritePageData } = await import("./article-rewrite-page-service");

function makePost(overrides: Partial<SocialPost> = {}): Partial<SocialPost> & Pick<SocialPost, "id" | "isRewriteVersion"> {
  return { id: "p1", platform: "naver_blog", isRewriteVersion: false, ...overrides } as SocialPost;
}

beforeEach(() => {
  getArticleById.mockReset();
  listSocialPostsByArticle.mockReset();
  listRewriteSuggestionsBySocialPost.mockReset();
  getArticleById.mockResolvedValue({ id: "article-1", title: "테스트" });
  listRewriteSuggestionsBySocialPost.mockResolvedValue([]);
});

describe("buildArticleRewritePageData", () => {
  it("rewrite version만 rewriteVersions에 포함하고, 원본은 originalPosts에 포함한다", async () => {
    listSocialPostsByArticle.mockResolvedValue([
      makePost({ id: "p1", isRewriteVersion: false }),
      makePost({ id: "p2", isRewriteVersion: true }),
      makePost({ id: "p3", isRewriteVersion: true }),
    ]);

    const { originalPosts, rewriteVersions } = await buildArticleRewritePageData("article-1");

    expect(originalPosts.map((p) => p.id)).toEqual(["p1"]);
    expect(rewriteVersions.map((p) => p.id).sort()).toEqual(["p2", "p3"]);
  });

  it("모든 social_post의 rewrite suggestion을 모아 반환한다", async () => {
    listSocialPostsByArticle.mockResolvedValue([makePost({ id: "p1" })]);
    listRewriteSuggestionsBySocialPost.mockResolvedValue([{ id: "s1", socialPostId: "p1" }]);

    const { suggestions } = await buildArticleRewritePageData("article-1");

    expect(suggestions).toEqual([{ id: "s1", socialPostId: "p1" }]);
  });
});
