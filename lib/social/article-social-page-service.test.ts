import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getArticleById = vi.fn();
const listSocialPostsByArticle = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("@/lib/repositories/social-posts-repository", () => ({
  listSocialPostsByArticle: (...args: unknown[]) => listSocialPostsByArticle(...args),
}));

const { buildArticleSocialPageData } = await import("./article-social-page-service");

function makePost(overrides: Partial<SocialPost> = {}): Partial<SocialPost> & Pick<SocialPost, "id" | "platform" | "isRewriteVersion"> {
  return { id: "p1", platform: "x", isRewriteVersion: false, ...overrides } as SocialPost;
}

beforeEach(() => {
  getArticleById.mockReset();
  listSocialPostsByArticle.mockReset();
  getArticleById.mockResolvedValue({ id: "article-1", title: "테스트" });
});

describe("buildArticleSocialPageData", () => {
  it("naver_cafe/x/threads/instagram만 포함한다", async () => {
    listSocialPostsByArticle.mockResolvedValue([
      makePost({ id: "p1", platform: "naver_cafe" }),
      makePost({ id: "p2", platform: "x" }),
      makePost({ id: "p3", platform: "threads" }),
      makePost({ id: "p4", platform: "instagram" }),
      makePost({ id: "p5", platform: "wordpress_blog" }),
      makePost({ id: "p6", platform: "naver_blog" }),
    ]);

    const { posts } = await buildArticleSocialPageData("article-1");

    expect(posts.map((p) => p.id).sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("rewrite version은 기본적으로 제외한다", async () => {
    listSocialPostsByArticle.mockResolvedValue([
      makePost({ id: "p1", platform: "x", isRewriteVersion: false }),
      makePost({ id: "p2", platform: "x", isRewriteVersion: true }),
    ]);

    const { posts } = await buildArticleSocialPageData("article-1");

    expect(posts.map((p) => p.id)).toEqual(["p1"]);
  });
});
