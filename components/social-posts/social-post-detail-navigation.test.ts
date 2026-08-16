import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Phase 3-18: SocialPostDetailNavigation은 서버 컴포넌트(JSX)라 렌더링
// 인프라 없이 단위 테스트하기 어려우므로, article-workflow-navigation과
// 같은 정적 소스 검사 방식으로 규칙을 검증한다.
const componentSource = readFileSync(path.join(__dirname, "social-post-detail-navigation.tsx"), "utf8");

describe("SocialPostDetailNavigation (정적 소스 검사, Phase 3-18)", () => {
  it("getSafeReturnTo로 returnTo를 검증한다", () => {
    expect(componentSource).toContain("getSafeReturnTo(returnTo");
  });

  it("platform이 blog면 blog 링크를 강조하는 조건을 포함한다", () => {
    expect(componentSource).toContain('platformGroup === "blog"');
  });

  it("platform이 social/community면 social 링크를 강조하는 조건을 포함한다", () => {
    expect(componentSource).toMatch(/platformGroup === "social" \|\| platformGroup === "community"|platformGroup === "community" \|\| platformGroup === "social"/);
  });

  it("isRewriteVersion이면 rewrite 링크를 강조한다", () => {
    expect(componentSource).toContain("isRewriteVersion ? ACTIVE_TAB_CLASS");
  });

  it("성과 링크는 항상 표시한다 (조건부 렌더링 없음)", () => {
    expect(componentSource).toContain("성과 페이지");
  });

  it("parent/root version 링크를 조건부로 표시한다", () => {
    expect(componentSource).toContain("parentSocialPostDetail");
    expect(componentSource).toContain("rootSocialPostDetail");
  });

  it("이전 위치로 돌아가기 링크를 포함한다", () => {
    expect(componentSource).toContain("이전 위치로 돌아가기");
  });
});
