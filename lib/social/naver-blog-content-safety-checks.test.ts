import { describe, expect, it } from "vitest";
import { checkNaverBlogContentSafety } from "./naver-blog-content-safety-checks";

describe("checkNaverBlogContentSafety", () => {
  it("문제 없는 본문은 아무 findings도 반환하지 않는다", () => {
    const result = checkNaverBlogContentSafety("평범한 네이버 블로그 본문입니다.");
    expect(result.hasAnchorArtifact).toBe(false);
    expect(result.hasSignatureArtifact).toBe(false);
    expect(result.findings).toEqual([]);
  });

  it("{#...} anchor 아티팩트를 탐지한다", () => {
    const result = checkNaverBlogContentSafety("마무리 인사 {#하영드림}");
    expect(result.hasAnchorArtifact).toBe(true);
    expect(result.findings.some((f) => f.includes("anchor"))).toBe(true);
  });

  it("가상 작성자 서명(OOO 드림)을 탐지한다", () => {
    const result = checkNaverBlogContentSafety("오늘도 좋은 하루 되세요. 하영 드림");
    expect(result.hasSignatureArtifact).toBe(true);
    expect(result.findings.some((f) => f.includes("서명"))).toBe(true);
  });

  it("가상 작성자 서명(OOO 올림)을 탐지한다", () => {
    const result = checkNaverBlogContentSafety("건강하세요. 민수 올림");
    expect(result.hasSignatureArtifact).toBe(true);
  });

  it("두 아티팩트가 동시에 있으면 둘 다 탐지한다", () => {
    const result = checkNaverBlogContentSafety("마무리 {#지민드림} 지민 드림");
    expect(result.hasAnchorArtifact).toBe(true);
    expect(result.hasSignatureArtifact).toBe(true);
    expect(result.findings.length).toBe(2);
  });
});
