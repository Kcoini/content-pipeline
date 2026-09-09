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
    searchIntent: null,
    readerPersona: null,
    adSlots: [],
    monetizationScore: null,
    policyRiskScore: null,
    citedSourceIds: [],
    excerpt: "장기요양보험 신청 절차를 정리했습니다.",
    keyPoints: ["신청은 국민건강보험공단에서 접수", "등급판정까지 약 30일 소요"],
    sourceCount: 3,
    usableSourceCount: 3,
    sourceSummaries: [{ title: "출처1", publisher: "출처사", summary: "출처 요약" }],
    platform: "naver_blog",
    toneStyle: "informational",
    platformConfig: getPlatformWritingConfig("naver_blog"),
    toneStyleConfig: getToneStyleConfig("informational"),
    safetyRules: ["협박형 문장 금지"],
    outputContractName: "naver-blog.schema.json",
    platformBrief: null,
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

  it("platformBrief가 있으면 userPrompt에 그 플랫폼 brief만 포함되고, contextSummary에는 hasPlatformBrief만 기록된다 (Phase 4-2)", () => {
    const brief = { seoKeywords: ["AI 투자"], searchIntent: null, faqCandidates: [], tableCandidates: [], checklistCandidates: [], longFormPoints: ["핵심 포인트 A"] };
    const result = assembleSocialWritingPrompt(makeContext({ platformBrief: brief }));

    expect(result.userPrompt).toContain("platform_brief");
    expect(result.userPrompt).toContain("핵심 포인트 A");
    expect(result.contextSummary.hasPlatformBrief).toBe(true);
    expect(result.contextSummary).not.toHaveProperty("platformBrief");
  });

  it("platformBrief가 없으면(마스터 원고 없는 기존 article) userPrompt에 platform_brief 블록이 없다 — 하위 호환", () => {
    const result = assembleSocialWritingPrompt(makeContext({ platformBrief: null }));

    expect(result.userPrompt).not.toContain("platform_brief");
    expect(result.contextSummary.hasPlatformBrief).toBe(false);
  });

  it("비정상적으로 큰 platformBrief가 들어와도 userPrompt에 그대로 반영되지 않고 길이 상한선에서 잘린다 (Phase 4-4: 비용 최적화 방어선)", () => {
    // master-manuscript-builder.ts가 정상적으로 만든 platformBrief는
    // 이미 작지만, 이 테스트는 "만약 계산 로직이 바뀌어 커지더라도
    // 프롬프트 크기가 무한정 커지지 않는다"는 방어선 자체를 검증한다.
    const oversizedBrief = {
      seoKeywords: [],
      searchIntent: null,
      faqCandidates: [],
      tableCandidates: [],
      checklistCandidates: [],
      longFormPoints: Array.from({ length: 500 }, (_, i) => `포인트 ${i} `.repeat(20)),
    };
    const result = assembleSocialWritingPrompt(makeContext({ platformBrief: oversizedBrief }));

    const briefBlockStart = result.userPrompt.indexOf("platform_brief");
    const briefBlock = result.userPrompt.slice(briefBlockStart);
    expect(briefBlock.length).toBeLessThan(4200);
    expect(briefBlock).toContain("길이 제한으로 생략됨");
  });
});
