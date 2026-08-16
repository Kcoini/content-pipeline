import { describe, expect, it } from "vitest";
import { getArticleWorkflowTabs } from "./article-workflow-navigation";

describe("getArticleWorkflowTabs", () => {
  it("articleId 기준으로 5개 하위 페이지 URL을 올바르게 생성한다", () => {
    const tabs = getArticleWorkflowTabs("article-1");

    expect(tabs).toEqual([
      { key: "overview", label: "기사 개요", href: "/articles/article-1" },
      { key: "blog", label: "블로그 글쓰기", href: "/articles/article-1/blog" },
      { key: "social", label: "SNS/커뮤니티 글쓰기", href: "/articles/article-1/social" },
      { key: "rewrite", label: "Rewrite 관리", href: "/articles/article-1/rewrite" },
      { key: "performance", label: "성과 보기", href: "/articles/article-1/performance" },
    ]);
  });
});
