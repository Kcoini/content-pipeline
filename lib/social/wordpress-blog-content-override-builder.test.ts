import { describe, expect, it } from "vitest";
import { buildWordPressBlogContentOverride } from "./wordpress-blog-content-override-builder";
import type { SocialPost } from "./social-platform-types";

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    postTitle: "블로그 글 제목",
    postBody: "## 먼저 결론부터 보면\n\n본문입니다.",
    excerpt: "요약입니다.",
    ...overrides,
  } as SocialPost;
}

describe("buildWordPressBlogContentOverride", () => {
  it("post_title은 그대로 title로 사용한다", () => {
    const override = buildWordPressBlogContentOverride(makePost());
    expect(override?.title).toBe("블로그 글 제목");
  });

  it("post_body(markdown)를 HTML로 변환해 content로 사용한다", () => {
    const override = buildWordPressBlogContentOverride(makePost());
    expect(override?.content).toContain("<h2>먼저 결론부터 보면</h2>");
    expect(override?.content).not.toContain("## 먼저 결론부터 보면");
  });

  it("excerpt는 그대로 사용한다(HTML 변환하지 않음)", () => {
    const override = buildWordPressBlogContentOverride(makePost());
    expect(override?.excerpt).toBe("요약입니다.");
  });

  it("post_body가 비어 있으면 content는 undefined다", () => {
    const override = buildWordPressBlogContentOverride(makePost({ postBody: "" }));
    expect(override?.content).toBeUndefined();
  });

  it("article 원문 필드는 전혀 참조하지 않는다(소스 검사)", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./wordpress-blog-content-override-builder.ts", import.meta.url), "utf-8")
    );
    expect(source).not.toMatch(/article\.(title|content)/);
  });

});
