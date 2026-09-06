import { describe, expect, it } from "vitest";
import { generateWordPressBlogMetadata } from "./wordpress-blog-metadata-generator";

describe("generateWordPressBlogMetadata", () => {
  it("article에 seoTitle/metaDescription/targetKeyword가 없으면 wordpress_blog title/body에서 새로 만든다", () => {
    const result = generateWordPressBlogMetadata({
      title: "장기요양보험 신청 방법 완벽 가이드",
      body: "장기요양보험 신청은 국민건강보험공단에서 접수합니다. 장기요양보험 등급판정은 약 30일이 걸립니다.",
      excerpt: "장기요양보험 신청 절차를 정리했습니다.",
    });

    expect(result.seoTitle).toBe("장기요양보험 신청 방법 완벽 가이드");
    expect(result.metaDescription).toBe("장기요양보험 신청 절차를 정리했습니다.");
    expect(result.targetKeyword).toBeTruthy();
  });

  it("article에 이미 seoTitle/metaDescription/targetKeyword가 있으면(monetized_blog 등) 그 값을 우선 재사용한다", () => {
    const result = generateWordPressBlogMetadata({
      title: "장기요양보험 신청 방법",
      body: "본문입니다.",
      articleSeoTitle: "article의 SEO 제목",
      articleMetaDescription: "article의 메타 설명",
      articleTargetKeyword: "article 키워드",
    });

    expect(result.seoTitle).toBe("article의 SEO 제목");
    expect(result.metaDescription).toBe("article의 메타 설명");
    expect(result.targetKeyword).toBe("article 키워드");
  });

  it("seoTitle은 60자를 넘지 않는다", () => {
    const longTitle = "가".repeat(100);
    const result = generateWordPressBlogMetadata({ title: longTitle, body: "본문" });
    expect(result.seoTitle!.length).toBeLessThanOrEqual(60);
  });

  it("metaDescription은 160자를 넘지 않는다", () => {
    const result = generateWordPressBlogMetadata({
      title: "제목",
      body: "나".repeat(500),
      excerpt: "다".repeat(500),
    });
    expect(result.metaDescription!.length).toBeLessThanOrEqual(160);
  });

  it("article에 없는 answerSummary/eeatNotes/geoSummary/structuredDataSuggestions는 항상 wordpress_blog 자체에서 새로 만든다 (article 값을 절대 입력받지 않음)", () => {
    const result = generateWordPressBlogMetadata({
      title: "제목",
      body: "본문",
      excerpt: "요약입니다.",
      citedSourceCount: 3,
    });

    expect(result.answerSummary).toBe("요약입니다.");
    expect(result.eeatNotes).toEqual({ citedSourceCount: 3 });
    expect(result.geoSummary).toEqual({ directAnswer: "요약입니다.", keyFacts: [], caveats: [] });
    expect(result.structuredDataSuggestions).toEqual([]);
  });

  it("geoSummary.keyFacts/caveats는 존재하지 않는 사실을 지어내지 않도록 항상 빈 배열로 시작한다", () => {
    const result = generateWordPressBlogMetadata({ title: "제목", body: "본문" });
    expect(result.geoSummary?.keyFacts).toEqual([]);
    expect(result.geoSummary?.caveats).toEqual([]);
  });

  it("article에 monetizationScore/policyRiskScore가 없으면 기본값을 사용한다", () => {
    const result = generateWordPressBlogMetadata({ title: "제목", body: "본문" });
    expect(result.monetizationScore).toBe(50);
    expect(result.policyRiskScore).toBe(10);
  });

  it("article에 monetizationScore/policyRiskScore가 있으면(monetized_blog) 재사용한다", () => {
    const result = generateWordPressBlogMetadata({
      title: "제목",
      body: "본문",
      articleMonetizationScore: 80,
      articlePolicyRiskScore: 5,
    });
    expect(result.monetizationScore).toBe(80);
    expect(result.policyRiskScore).toBe(5);
  });

  it("article에 secondaryKeywords가 있으면 재사용하고, 없으면 본문에서 반복되는 토큰으로 도출한다", () => {
    const withArticle = generateWordPressBlogMetadata({
      title: "제목",
      body: "본문",
      articleSecondaryKeywords: ["키워드1", "키워드2"],
    });
    expect(withArticle.secondaryKeywords).toEqual(["키워드1", "키워드2"]);

    const withoutArticle = generateWordPressBlogMetadata({
      title: "장기요양보험",
      body: "장기요양보험 등급판정 장기요양보험 등급판정 신청 절차 신청 절차",
    });
    expect(withoutArticle.secondaryKeywords.length).toBeGreaterThan(0);
  });

  it("citedSourceCount가 없으면 eeatNotes는 null이다(없는 사실을 지어내지 않음)", () => {
    const result = generateWordPressBlogMetadata({ title: "제목", body: "본문" });
    expect(result.eeatNotes).toBeNull();
  });
});
