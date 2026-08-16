import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
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

// Phase 3-17: ArticleWorkflowNavigation 자체는 서버 컴포넌트(JSX)라 렌더링
// 테스트 인프라 없이 단위 테스트하기 어려우므로, article/*/page.test.ts와
// 같은 정적 소스 검사 방식으로 returnTo 관련 동작을 검증한다.
const componentSource = readFileSync(path.join(__dirname, "article-workflow-navigation.tsx"), "utf8");

describe("ArticleWorkflowNavigation (정적 소스 검사, Phase 3-17)", () => {
  it("getSafeReturnTo로 returnTo를 검증한다 (외부 URL은 안전하지 않다고 판단)", () => {
    expect(componentSource).toContain("getSafeReturnTo(returnTo");
  });

  it("탭 자체 링크에는 returnTo를 붙이지 않는다", () => {
    const tabsBlock = componentSource.slice(componentSource.indexOf("<nav"), componentSource.indexOf("</nav>"));
    expect(tabsBlock).not.toContain("returnTo");
  });

  it("기사 개요로 돌아가기 버튼을 포함한다", () => {
    expect(componentSource).toContain("기사 개요로 돌아가기");
  });

  it("이전 작업 위치로 돌아가기 버튼을 포함한다", () => {
    expect(componentSource).toContain("이전 작업 위치로 돌아가기");
  });
});
