import { describe, expect, it } from "vitest";
import { assembleSocialWritingPrompt } from "./social-prompt-assembler";
import { getPlatformWritingConfig } from "./platform-writing-config";
import { getToneStyleConfig } from "./tone-style-config";
import type { SocialWritingContext } from "./social-writing-context-builder";

function makeContext(overrides: Partial<SocialWritingContext> = {}): SocialWritingContext {
  return {
    articleId: "article-1",
    title: "장기요양보험 신청 방법",
    articleMode: "monetized_blog",
    targetKeyword: "장기요양보험",
    secondaryKeywords: ["등급판정"],
    seoTitle: "장기요양보험 총정리",
    metaDescription: "장기요양보험 신청 방법을 정리했습니다.",
    excerpt: "장기요양보험 신청 절차를 정리했습니다.",
    keyPoints: ["신청은 국민건강보험공단에서 접수", "등급판정까지 약 30일 소요"],
    sourceCount: 3,
    sourceSummaries: [{ title: "출처1", publisher: "출처사", summary: "출처 요약" }],
    platform: "naver_blog",
    toneStyle: "informational",
    platformConfig: getPlatformWritingConfig("naver_blog"),
    toneStyleConfig: getToneStyleConfig("informational"),
    safetyRules: ["협박형 문장 금지"],
    outputContractName: "naver-blog.schema.json",
    ...overrides,
  };
}

describe("assembleSocialWritingPrompt", () => {
  it("platform/tone/safety 프롬프트와 출력 계약 이름을 포함한다", () => {
    const result = assembleSocialWritingPrompt(makeContext());

    expect(result.systemPrompt).toContain("검색 친화적인 한국어 블로그"); // naver-blog.md 핵심 문구
    expect(result.systemPrompt).toContain("정보형"); // informational.md 라벨(문체 config 아님, prompt 파일 내용 확인용 아래에서 재확인)
    expect(result.systemPrompt).toContain("협박형 문장"); // no-threat.md
    expect(result.systemPrompt).toContain("naver-blog.schema.json");
    expect(result.contractName).toBe("naver-blog.schema.json");
  });

  it("모든 platform에 대해 정상적으로 조립된다", () => {
    const platforms = ["wordpress_blog", "naver_blog", "naver_cafe", "x", "threads", "instagram"] as const;
    for (const platform of platforms) {
      const context = makeContext({ platform, platformConfig: getPlatformWritingConfig(platform) });
      const result = assembleSocialWritingPrompt(context);
      expect(result.systemPrompt.length).toBeGreaterThan(0);
      expect(result.userPrompt.length).toBeGreaterThan(0);
    }
  });

  it("contextSummary에는 article 원문이 포함되지 않는다", () => {
    const result = assembleSocialWritingPrompt(makeContext());

    const serialized = JSON.stringify(result.contextSummary);
    expect(serialized).not.toContain("장기요양보험 신청 절차를 정리했습니다."); // excerpt 원문 텍스트
    expect(result.contextSummary).not.toHaveProperty("excerpt");
    expect(result.contextSummary).not.toHaveProperty("sourceSummaries");
  });

  it("userPrompt에는 API key/인증 정보가 없다", () => {
    const result = assembleSocialWritingPrompt(makeContext());

    const serialized = (result.systemPrompt + result.userPrompt).toLowerCase();
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("app_password");
  });
});
