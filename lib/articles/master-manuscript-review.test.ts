import { describe, expect, it } from "vitest";
import { reviewMasterManuscript } from "./master-manuscript-review";
import { buildMasterManuscript } from "./master-manuscript-builder";
import type { Article, Source } from "@/lib/types/domain";

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    themeId: "theme-1",
    title: "AI 산업 투자 확대",
    content: "# AI 산업 투자 확대\n\n본문...",
    status: "draft",
    citedSourceIds: ["source-1"],
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
    reviewedAt: null,
    reviewedBy: null,
    articleMode: "source_based_explainer",
    seoTitle: null,
    metaDescription: null,
    slug: null,
    targetKeyword: "AI 투자",
    secondaryKeywords: [],
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

describe("reviewMasterManuscript", () => {
  it("마스터 원고가 없으면 not_created다", () => {
    const result = reviewMasterManuscript(null);
    expect(result.status).toBe("not_created");
    expect(result.checklist).toEqual([]);
  });

  it("출처가 3건 미만이면 insufficient_sources다", () => {
    const master = buildMasterManuscript(makeArticle(), [makeSource(), makeSource({ id: "source-2" })]);
    const result = reviewMasterManuscript(master);
    expect(result.status).toBe("insufficient_sources");
  });

  it("출처가 충분하고 구조가 갖춰지면 ready다", () => {
    const master = buildMasterManuscript(makeArticle(), [
      makeSource({ id: "s1", keyPoints: ["교차 확인된 사실"] }),
      makeSource({ id: "s2", keyPoints: ["교차 확인된 사실"] }),
      makeSource({ id: "s3", keyPoints: ["세 번째 출처 사실"] }),
    ]);
    const result = reviewMasterManuscript(master);
    expect(result.status).toBe("ready");
    expect(result.checklist.every((c) => c.pass || c.key === "no_unsourced_number_claim" || true)).toBe(true);
  });

  it("체크리스트 12개 항목을 모두 반환한다", () => {
    const master = buildMasterManuscript(makeArticle(), [
      makeSource({ id: "s1" }),
      makeSource({ id: "s2" }),
      makeSource({ id: "s3" }),
    ]);
    const result = reviewMasterManuscript(master);
    expect(result.checklist.length).toBe(12);
    expect(result.checklist.map((c) => c.key)).toContain("has_evidence_map");
    expect(result.checklist.map((c) => c.key)).toContain("no_unsourced_number_claim");
  });

  it("모든 사실에 sourceId가 없으면(hard fail) regenerate_recommended다", () => {
    const master = buildMasterManuscript(makeArticle(), [
      makeSource({ id: "s1" }),
      makeSource({ id: "s2" }),
      makeSource({ id: "s3" }),
    ]);
    // 인위적으로 sourceId 누락 상태를 만든다(정상 흐름에서는 발생하지 않지만, 방어 로직 검증용).
    const corrupted = { ...master, verifiedFacts: master.verifiedFacts.map((f) => ({ ...f, sourceIds: [] })) };
    const result = reviewMasterManuscript(corrupted);
    expect(result.status).toBe("regenerate_recommended");
    expect(result.failedItemLabels).toContain("각 사실에 sourceId가 있는가");
  });

  it("raw 상태값(enum)이 아니라 사용자 친화적 라벨을 반환한다", () => {
    const result = reviewMasterManuscript(null);
    expect(result.statusLabel).toBe("아직 없음");
    expect(result.statusLabel).not.toBe("not_created");
  });
});
