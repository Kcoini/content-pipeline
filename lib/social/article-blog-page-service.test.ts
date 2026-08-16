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

const { buildArticleBlogPageData } = await import("./article-blog-page-service");

function makePost(overrides: Partial<SocialPost> = {}): Partial<SocialPost> & Pick<SocialPost, "id" | "platform" | "isRewriteVersion"> {
  return { id: "p1", platform: "wordpress_blog", isRewriteVersion: false, ...overrides } as SocialPost;
}

beforeEach(() => {
  getArticleById.mockReset();
  listSocialPostsByArticle.mockReset();
  getArticleById.mockResolvedValue({ id: "article-1", title: "테스트" });
});

describe("buildArticleBlogPageData", () => {
  it("wordpress_blog/naver_blog만 포함한다", async () => {
    listSocialPostsByArticle.mockResolvedValue([
      makePost({ id: "p1", platform: "wordpress_blog" }),
      makePost({ id: "p2", platform: "naver_blog" }),
      makePost({ id: "p3", platform: "naver_cafe" }),
      makePost({ id: "p4", platform: "x" }),
    ]);

    const { posts } = await buildArticleBlogPageData("article-1");

    expect(posts.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });

  it("rewrite version은 기본적으로 제외한다", async () => {
    listSocialPostsByArticle.mockResolvedValue([
      makePost({ id: "p1", platform: "wordpress_blog", isRewriteVersion: false }),
      makePost({ id: "p2", platform: "wordpress_blog", isRewriteVersion: true }),
    ]);

    const { posts } = await buildArticleBlogPageData("article-1");

    expect(posts.map((p) => p.id)).toEqual(["p1"]);
  });

  it("includeRewriteVersions=true이면 blog rewrite version도 포함한다", async () => {
    listSocialPostsByArticle.mockResolvedValue([
      makePost({ id: "p1", platform: "wordpress_blog", isRewriteVersion: false }),
      makePost({ id: "p2", platform: "wordpress_blog", isRewriteVersion: true }),
    ]);

    const { posts } = await buildArticleBlogPageData("article-1", { includeRewriteVersions: true });

    expect(posts.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });
});
