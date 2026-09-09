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

describe("사실과 해석 분리 — factInterpretationSplit (Phase 3-27)", () => {
  it("verifiedFacts 각각에 대응하는 해석 항목을 만든다", () => {
    const article = makeArticle();
    const sources = [
      makeSource({ id: "source-1", keyPoints: ["기준금리가 3%로 인상되었다"] }),
      makeSource({ id: "source-2", keyPoints: ["기준금리가 3%로 인상되었다"] }),
    ];
    const master = buildMasterManuscript(article, sources);

    expect(master.factInterpretationSplit).toHaveLength(master.verifiedFacts.length);
    const entry = master.factInterpretationSplit.find((f) => f.fact === "기준금리가 3%로 인상되었다");
    expect(entry).toBeDefined();
    expect(entry?.sourceIds.sort()).toEqual(["source-1", "source-2"]);
    expect(typeof entry?.interpretation).toBe("string");
  });

  it("1개 출처에서만 확인된 사실은 caution이 채워진다", () => {
    const master = buildMasterManuscript(makeArticle(), [makeSource({ keyPoints: ["단독 사실"] })]);
    const entry = master.factInterpretationSplit.find((f) => f.fact === "단독 사실");
    expect(entry?.caution).not.toBe("");
  });

  it("해석이 사실을 그대로 복제한 단정문이 아니다(사실과 구분되는 안내 문구다)", () => {
    const master = buildMasterManuscript(makeArticle(), [makeSource({ keyPoints: ["핵심 사실 A"] })]);
    const entry = master.factInterpretationSplit.find((f) => f.fact === "핵심 사실 A");
    expect(entry?.interpretation).not.toBe("핵심 사실 A");
  });
});

describe("장문 대응 — longFormSupport (Phase 3-27)", () => {
  const master = buildMasterManuscript(makeArticle(), [makeSource(), makeSource({ id: "source-2" })]);

  it("sectionPlan/evidenceMap/faqBank/tablesAndLists를 포함한다", () => {
    expect(master.longFormSupport.sectionPlan.length).toBeGreaterThan(0);
    expect(Array.isArray(master.longFormSupport.evidenceMap)).toBe(true);
    expect(Array.isArray(master.longFormSupport.faqBank)).toBe(true);
    expect(Array.isArray(master.longFormSupport.tablesAndLists)).toBe(true);
  });

  it("evidenceMap은 verifiedFacts와 동일한 claim/sourceIds 매핑을 담는다", () => {
    expect(master.longFormSupport.evidenceMap).toHaveLength(master.verifiedFacts.length);
    if (master.verifiedFacts.length > 0) {
      expect(master.longFormSupport.evidenceMap[0].claim).toBe(master.verifiedFacts[0].fact);
    }
  });

  it("newsArticleExpansion과 monetizedBlogExpansion을 모두 포함한다", () => {
    expect(master.longFormSupport.newsArticleExpansion).toBeDefined();
    expect(master.longFormSupport.newsArticleExpansion.fiveWOneH).toBeDefined();
    expect(master.longFormSupport.monetizedBlogExpansion).toBeDefined();
    expect(Array.isArray(master.longFormSupport.monetizedBlogExpansion.headingPlan)).toBe(true);
  });

  it("출처가 적으면 sourceSufficiency가 '부족'을 포함한다", () => {
    const sparse = buildMasterManuscript(makeArticle(), [makeSource()]);
    expect(sparse.longFormSupport.sourceSufficiency).toContain("부족");
  });

  it("출처가 5건 이상이면 recommendedLength가 장문을 권장한다", () => {
    const many = Array.from({ length: 5 }, (_, i) => makeSource({ id: `s${i}`, keyPoints: [`사실 ${i}`] }));
    const rich = buildMasterManuscript(makeArticle(), many);
    expect(rich.longFormSupport.recommendedLength).toContain("장문");
  });

  it("examplesAndAnalogies는 근거 없는 예시를 지어내지 않고 빈 배열을 유지한다", () => {
    expect(master.longFormSupport.examplesAndAnalogies).toEqual([]);
  });
});

describe("EEAT/SEO/AEO/GEO/AGENT 대응 — optimizationSupport (Phase 3-27)", () => {
  const master = buildMasterManuscript(
    { ...makeArticle(), targetKeyword: "AI 투자", secondaryKeywords: ["반도체"] },
    [makeSource({ publisher: "경제신문" }), makeSource({ id: "source-2", publisher: "경제신문" })]
  );

  it("eeatNotes/seoSupport/aeoSupport/geoSupport/agentReadiness를 모두 포함한다", () => {
    expect(master.optimizationSupport.eeatNotes).toBeDefined();
    expect(master.optimizationSupport.seoSupport).toBeDefined();
    expect(master.optimizationSupport.aeoSupport).toBeDefined();
    expect(master.optimizationSupport.geoSupport).toBeDefined();
    expect(master.optimizationSupport.agentReadiness).toBeDefined();
  });

  it("seoSupport는 article의 targetKeyword/secondaryKeywords를 그대로 재사용한다", () => {
    expect(master.optimizationSupport.seoSupport.primaryKeyword).toBe("AI 투자");
    expect(master.optimizationSupport.seoSupport.secondaryKeywords).toEqual(["반도체"]);
  });

  it("geoSupport.keyFacts는 verifiedFacts와 같은 사실 목록이다", () => {
    expect(master.optimizationSupport.geoSupport.keyFacts).toEqual(master.verifiedFacts.map((f) => f.fact));
  });

  it("agentReadiness.sourceMap은 sourceSummaries의 id/title/url만 담는다(원문 요약 텍스트는 포함하지 않는다)", () => {
    for (const entry of master.optimizationSupport.agentReadiness.sourceMap) {
      expect(entry).not.toHaveProperty("summary");
      expect(entry).toHaveProperty("sourceId");
      expect(entry).toHaveProperty("url");
    }
  });

  it("eeatNotes.hasOfficialSource는 발행처 이름에 공식기관 키워드가 있을 때만 true다", () => {
    const official = buildMasterManuscript(makeArticle(), [makeSource({ publisher: "기획재정부" })]);
    const notOfficial = buildMasterManuscript(makeArticle(), [makeSource({ publisher: "블로거 A" })]);
    expect(official.optimizationSupport.eeatNotes.hasOfficialSource).toBe(true);
    expect(notOfficial.optimizationSupport.eeatNotes.hasOfficialSource).toBe(false);
  });
});

describe("theme/titleCandidates 확장 필드 (Phase 3-27)", () => {
  it("theme에 region/topicType이 포함된다", () => {
    const master = buildMasterManuscript(makeArticle(), [makeSource()]);
    expect(master.theme.region).toBeDefined();
    expect(master.theme.topicType).toBeDefined();
  });

  it("titleCandidates에 newsArticle 후보가 포함된다", () => {
    const master = buildMasterManuscript(makeArticle(), [makeSource()]);
    expect(typeof master.titleCandidates.newsArticle).toBe("string");
    expect(master.titleCandidates.newsArticle.length).toBeGreaterThan(0);
  });

  it("autoReviewCriteria에 확장된 검토 기준(evidenceMap, optimizationSupport 등)이 포함된다", () => {
    const master = buildMasterManuscript(makeArticle(), [makeSource()]);
    expect(master.autoReviewCriteria.some((c) => c.includes("evidenceMap"))).toBe(true);
    expect(master.autoReviewCriteria.some((c) => c.includes("optimizationSupport") || c.includes("SEO/AEO/GEO/AGENT"))).toBe(true);
  });
});

describe("안전 원칙 — 확인 필요 사항과 확인된 사실의 분리 (Phase 3-27)", () => {
  it("verificationNeeded는 verifiedFacts와 별도 배열이다(확인 필요 사항이 확인된 사실로 잘못 들어가지 않는다)", () => {
    const master = buildMasterManuscript(makeArticle(), [makeSource({ keyPoints: ["단독 출처 사실"] })]);
    expect(master.verifiedFacts.map((f) => f.fact)).toContain("단독 출처 사실");
    // verificationNeeded는 "확인 필요" 안내 문장이지, verifiedFacts의 fact 원문 그대로가 아니다.
    expect(master.verificationNeeded).not.toContain("단독 출처 사실");
    expect(master.verificationNeeded.some((v) => v.includes("단독 출처 사실"))).toBe(true);
  });

  it("prohibitedOrCarefulExpressions는 항상 포함되고 BASE_PROHIBITED_PATTERNS를 그대로 재사용한다", () => {
    const master = buildMasterManuscript(makeArticle(), [makeSource()]);
    expect(master.prohibitedOrCarefulExpressions.prohibited.length).toBeGreaterThan(0);
    expect(master.prohibitedOrCarefulExpressions.careful.length).toBeGreaterThan(0);
  });
});
