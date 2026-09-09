import { describe, expect, it } from "vitest";
import { buildMasterManuscript, getPlatformBrief } from "./master-manuscript-builder";
import type { Article, Source } from "@/lib/types/domain";

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    themeId: "theme-1",
    title: "AI 산업 투자 확대",
    content: "# AI 산업 투자 확대\n\n본문...",
    status: "draft",
    citedSourceIds: ["source-1", "source-2"],
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
    reviewedAt: null,
    reviewedBy: null,
    articleMode: "source_based_explainer",
    seoTitle: null,
    metaDescription: null,
    slug: null,
    targetKeyword: "AI 투자",
    secondaryKeywords: ["반도체"],
    searchIntent: null,
    readerPersona: null,
    adSlots: [],
    internalLinkSuggestions: [],
    monetizationScore: null,
    policyRiskScore: null,
    formatMetadata: {},
    wpCategoryNames: [],
    wpTagNames: [],
    wpCategoryIds: [],
    wpTagIds: [],
    wpMetadataStatus: "not_generated",
    wpMetadataGeneratedAt: null,
    seoPluginProvider: "none",
    seoPluginPayload: {},
    seoPluginMetadataStatus: "not_generated",
    ...overrides,
  } as Article;
}

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: "source-1",
    themeId: "theme-1",
    url: "https://example.com/article",
    title: "AI 투자 관련 기사",
    publisher: "경제신문",
    publishedAt: "2026-01-10",
    summary: "AI 산업에 대한 투자가 확대되고 있다.",
    createdAt: "2026-01-10T00:00:00.000Z",
    fetchStatus: "success",
    fetchError: null,
    rawContent: "raw...",
    summaryStatus: "success",
    summaryError: null,
    summarizedAt: "2026-01-10T00:00:00.000Z",
    keyPoints: ["AI 투자 규모가 전년 대비 증가했다"],
    ...overrides,
  };
}

describe("buildMasterManuscript (Phase 4-2)", () => {
  it("출처별 요약을 만든다(summary/keyPoints가 있는 출처만)", () => {
    const article = makeArticle();
    const sources = [
      makeSource({ id: "source-1" }),
      makeSource({ id: "source-2", summary: "", keyPoints: [] }),
    ];
    const master = buildMasterManuscript(article, sources);

    expect(master.sourceSummaries).toHaveLength(1);
    expect(master.sourceSummaries[0].sourceId).toBe("source-1");
  });

  it("같은 keyPoint가 2개 이상의 출처에 등장하면 confidence가 high다", () => {
    const article = makeArticle();
    const sources = [
      makeSource({ id: "source-1", keyPoints: ["기준금리가 3%로 인상되었다"] }),
      makeSource({ id: "source-2", keyPoints: ["기준금리가 3%로 인상되었다"] }),
    ];
    const master = buildMasterManuscript(article, sources);

    const fact = master.verifiedFacts.find((f) => f.fact === "기준금리가 3%로 인상되었다");
    expect(fact?.confidence).toBe("high");
    expect(fact?.sourceIds.sort()).toEqual(["source-1", "source-2"]);
  });

  it("1개 출처에서만 확인된 사실은 confidence가 medium이고 확인 필요 사항에 들어간다", () => {
    const article = makeArticle();
    const sources = [makeSource({ id: "source-1", keyPoints: ["단독 보도된 수치"] })];
    const master = buildMasterManuscript(article, sources);

    const fact = master.verifiedFacts.find((f) => f.fact === "단독 보도된 수치");
    expect(fact?.confidence).toBe("medium");
    expect(master.verificationNeeded.some((v) => v.includes("단독 보도된 수치"))).toBe(true);
  });

  it("출처가 3개 미만이면 확인 필요 사항에 출처 부족 안내가 추가된다", () => {
    const article = makeArticle();
    const master = buildMasterManuscript(article, [makeSource()]);
    expect(master.verificationNeeded.some((v) => v.includes("추가 출처 확인을 권장"))).toBe(true);
  });

  it("금지 표현은 BASE_PROHIBITED_PATTERNS를 재사용한다(새로 정의하지 않는다)", () => {
    const master = buildMasterManuscript(makeArticle(), [makeSource()]);
    expect(master.prohibitedOrCarefulExpressions.prohibited).toContain("협박");
    expect(master.prohibitedOrCarefulExpressions.prohibited).toContain("수익 보장");
  });

  it("6개 플랫폼 그룹 brief를 모두 만든다", () => {
    const master = buildMasterManuscript(makeArticle(), [makeSource()]);
    expect(master.platformBriefs.newsArticle).toBeDefined();
    expect(master.platformBriefs.wordpressBlog).toBeDefined();
    expect(master.platformBriefs.naverBlog).toBeDefined();
    expect(master.platformBriefs.naverCafe).toBeDefined();
    expect(master.platformBriefs.shortSocial).toBeDefined();
    expect(master.platformBriefs.instagram).toBeDefined();
  });

  it("wordpressBlog brief는 targetKeyword/secondaryKeywords를 seoKeywords로 포함한다", () => {
    const article = makeArticle({ targetKeyword: "AI 투자", secondaryKeywords: ["반도체", "데이터센터"] });
    const master = buildMasterManuscript(article, [makeSource()]);
    expect(master.platformBriefs.wordpressBlog.seoKeywords).toEqual(["AI 투자", "반도체", "데이터센터"]);
  });

  it("생성 방향(articleMode)과 생성 시각을 기록한다", () => {
    const article = makeArticle({ articleMode: "monetized_blog" });
    const master = buildMasterManuscript(article, [makeSource()]);
    expect(master.generatedFromMode).toBe("monetized_blog");
    expect(typeof master.builtAt).toBe("string");
  });

  it("동일한 입력에 대해 결정적이다(AI를 호출하지 않는 순수 함수 — builtAt 제외 나머지는 항상 같다)", () => {
    const article = makeArticle();
    const sources = [makeSource()];
    const a = buildMasterManuscript(article, sources);
    const b = buildMasterManuscript(article, sources);
    const { builtAt: builtAtA, ...restA } = a;
    const { builtAt: builtAtB, ...restB } = b;
    expect(restA).toEqual(restB);
    expect(typeof builtAtA).toBe("string");
    expect(typeof builtAtB).toBe("string");
  });

  it("출처가 아주 많아도 sourceSummaries/verifiedFacts에 상한이 있다 (Phase 4-4: 비용 최적화)", () => {
    const manySources = Array.from({ length: 30 }, (_, i) =>
      makeSource({ id: `source-${i}`, summary: `요약 ${i}`, keyPoints: [`핵심 사실 ${i}`] })
    );
    const master = buildMasterManuscript(makeArticle(), manySources);

    expect(master.sourceSummaries.length).toBeLessThanOrEqual(10);
    expect(master.verifiedFacts.length).toBeLessThanOrEqual(20);
  });
});

describe("getPlatformBrief (Phase 4-2)", () => {
  const master = buildMasterManuscript(
    { ...makeArticle(), targetKeyword: "AI 투자" },
    [makeSource(), makeSource({ id: "source-2" })]
  );

  it("플랫폼마다 올바른 brief 그룹을 반환한다", () => {
    expect(getPlatformBrief(master, "wordpress_blog")).toBe(master.platformBriefs.wordpressBlog);
    expect(getPlatformBrief(master, "naver_blog")).toBe(master.platformBriefs.naverBlog);
    expect(getPlatformBrief(master, "naver_cafe")).toBe(master.platformBriefs.naverCafe);
    expect(getPlatformBrief(master, "instagram")).toBe(master.platformBriefs.instagram);
  });

  it("x/threads는 둘 다 shortSocial brief를 공유한다", () => {
    expect(getPlatformBrief(master, "x")).toBe(master.platformBriefs.shortSocial);
    expect(getPlatformBrief(master, "threads")).toBe(master.platformBriefs.shortSocial);
  });

  it("특정 플랫폼 brief에는 다른 플랫폼 brief가 섞여 있지 않다(플랫폼별 분리)", () => {
    const wpBrief = getPlatformBrief(master, "wordpress_blog");
    expect(wpBrief).not.toHaveProperty("hashtags");
    expect(wpBrief).not.toHaveProperty("cardTexts");
  });
});
