import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { generateAiArticleDraft, generateMockArticleDraft } from "./article-writer";
import { runContractForCollection } from "@/lib/harness/contract-runner";
import { loadContract } from "@/lib/harness/load-contract";
import { AD_SLOT_MARKERS, adSlotMarkerComment } from "@/lib/articles/article-modes";
import type { Source, Theme } from "@/lib/types/domain";

const theme: Theme = {
  id: "theme-1",
  title: "AI 에이전트 동향",
  description: "2026년 AI 에이전트 관련 최신 동향을 정리한다.",
  keywords: ["AI", "에이전트"],
  language: "ko",
  createdAt: new Date().toISOString(),
};

const baseSourceFields = {
  fetchStatus: "pending" as const,
  fetchError: null,
  rawContent: null,
  summaryStatus: "pending" as const,
  summaryError: null,
  summarizedAt: null,
  keyPoints: [],
};

const sources: Source[] = [
  {
    id: "source-1",
    themeId: theme.id,
    url: "https://a.example.com",
    title: "출처 A",
    publisher: "A 매체",
    publishedAt: "2026-01-01",
    summary: "출처 A 요약",
    createdAt: new Date().toISOString(),
    ...baseSourceFields,
  },
  {
    id: "source-2",
    themeId: theme.id,
    url: "https://b.example.com",
    title: "출처 B",
    publisher: "B 매체",
    publishedAt: "2026-02-01",
    summary: "출처 B 요약",
    createdAt: new Date().toISOString(),
    ...baseSourceFields,
  },
  {
    id: "source-3",
    themeId: theme.id,
    url: "https://c.example.com",
    title: "출처 C",
    publisher: "C 매체",
    publishedAt: "2026-03-01",
    summary: "출처 C 요약",
    createdAt: new Date().toISOString(),
    ...baseSourceFields,
  },
];

describe("generateMockArticleDraft", () => {
  it("본문은 500자 이상이고, 등록된 모든 출처를 인용한다", () => {
    const result = generateMockArticleDraft(theme, sources);

    expect(result.content.length).toBeGreaterThanOrEqual(500);
    expect(result.citedSourceIds).toEqual(sources.map((source) => source.id));
  });

  it("mock 본문에 7개 섹션 구조(리드문, 배경, 핵심 쟁점, 출처 간 비교, 독자, 향후 전망)가 포함된다", () => {
    const result = generateMockArticleDraft(theme, sources);
    expect(result.content).toContain("## 리드문");
    expect(result.content).toContain("## 배경");
    expect(result.content).toContain("## 핵심 쟁점");
    expect(result.content).toContain("## 출처 간 비교");
    expect(result.content).toContain("## 독자에게 중요한 의미");
    expect(result.content).toContain("## 향후 전망 또는 과제");
  });

  it("mock 본문은 출처를 단순 나열하지 않고 구조화된 섹션으로 구성한다", () => {
    const result = generateMockArticleDraft(theme, sources);
    // 출처별 순차 나열 패턴("### 1. 출처 A", "### 2. 출처 B")이 없어야 한다
    expect(result.content).not.toMatch(/### \d+\. /);
  });

  it("status=draft으로 구성된 기사 객체는 article.contract.yaml을 통과한다", () => {
    const generated = generateMockArticleDraft(theme, sources);
    const articleContract = loadContract("article.contract.yaml");

    const articleItem: Record<string, unknown> = {
      title: generated.title,
      content: generated.content,
      topicId: theme.id,
      status: "draft",
    };

    const result = runContractForCollection(articleContract, [articleItem], {
      collections: {
        article_sources: sources as unknown as Record<string, unknown>[],
      },
      operation: "create",
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("status가 draft가 아니면 article.contract.yaml(initial-status-draft)에 위반된다", () => {
    const generated = generateMockArticleDraft(theme, sources);
    const articleContract = loadContract("article.contract.yaml");

    const articleItem: Record<string, unknown> = {
      title: generated.title,
      content: generated.content,
      topicId: theme.id,
      status: "reviewed",
    };

    const result = runContractForCollection(articleContract, [articleItem], {
      collections: {
        article_sources: sources as unknown as Record<string, unknown>[],
      },
      operation: "create",
    });

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.ruleId === "initial-status-draft")).toBe(true);
  });

  it("출처가 3개 미만이면 source.contract.yaml(min-source-count)을 통과하지 못해 기사 생성이 막힌다", () => {
    const fewSources = sources.slice(0, 2);
    const sourceContract = loadContract("source.contract.yaml");

    const result = runContractForCollection(
      sourceContract,
      fewSources as unknown as Record<string, unknown>[],
      { collections: { topic_sources: fewSources as unknown as Record<string, unknown>[] } }
    );

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.ruleId === "min-source-count")).toBe(true);
  });
});

describe("generateAiArticleDraft", () => {
  it("ANTHROPIC_API_KEY가 없으면 명확한 오류를 던진다", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    await expect(generateAiArticleDraft(theme, [])).rejects.toThrow(/ANTHROPIC_API_KEY/);

    if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  });
});

// ─────────────────────────────────────────────────────────────
// Phase 2-1: article_mode별 mock 생성 테스트
// ─────────────────────────────────────────────────────────────

describe("generateMockArticleDraft — article_mode", () => {
  it("mode를 생략하면 기본값(source_based_explainer)과 동일하게 동작한다 (기존 흐름 보존)", () => {
    const withoutMode = generateMockArticleDraft(theme, sources);
    const withDefaultMode = generateMockArticleDraft(theme, sources, "source_based_explainer");

    expect(withoutMode.content).toBe(withDefaultMode.content);
    expect(withoutMode.title).toBe(withDefaultMode.title);
  });

  it("general_news 모드는 짧은 기사형 구조(제목/핵심 내용/참고 출처)를 생성한다", () => {
    const result = generateMockArticleDraft(theme, sources, "general_news");

    expect(result.content).toContain("## 리드문");
    expect(result.content).toContain("## 핵심 내용");
    expect(result.content).toContain("## 참고 출처");
    expect(result.content.length).toBeGreaterThanOrEqual(500);
    expect(result.citedSourceIds).toEqual(sources.map((s) => s.id));
    // 수익형 전용 필드는 생성되지 않는다.
    expect(result.seoTitle).toBeUndefined();
    expect(result.monetizationScore).toBeUndefined();
  });

  it("monetized_blog 모드는 SEO/광고 슬롯/수익화 점수를 포함한다", () => {
    const result = generateMockArticleDraft(theme, sources, "monetized_blog");

    expect(result.seoTitle).toBeTruthy();
    expect(result.metaDescription).toBeTruthy();
    expect(result.targetKeyword).toBeTruthy();
    expect(result.monetizationScore).toBeTypeOf("number");
    expect(result.policyRiskScore).toBeTypeOf("number");
    expect(result.adSlots).toBeDefined();
    expect(result.adSlots!.length).toBe(AD_SLOT_MARKERS.length);
    expect(result.internalLinkSuggestions).toBeDefined();
  });

  it("monetized_blog 본문에는 AD_SLOT marker만 삽입되고 실제 광고 코드는 삽입되지 않는다", () => {
    const result = generateMockArticleDraft(theme, sources, "monetized_blog");

    for (const position of AD_SLOT_MARKERS) {
      expect(result.content).toContain(adSlotMarkerComment(position));
    }
    expect(result.content).not.toMatch(/adsbygoogle|googlesyndication|data-ad-client|data-ad-slot/i);
  });
});

// ─────────────────────────────────────────────────────────────
// Phase 2-1: article_mode별 AI 생성 tool 선택 테스트
// ─────────────────────────────────────────────────────────────

function mockToolUseResponse(toolName: string, input: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      content: [{ type: "tool_use", id: "call-1", name: toolName, input }],
      stop_reason: "tool_use",
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

describe("generateAiArticleDraft — article_mode별 prompt 선택", () => {
  // Anthropic client는 모듈 내부에서 캐싱되므로(getAnthropicClient의 cachedClient),
  // fetch stub 자체를 테스트마다 교체하지 않고 하나의 vi.fn()을 재사용하면서
  // mockResolvedValueOnce로 응답만 큐잉한다 (caching된 client가 예전 stub을
  // 참조해 Response body를 재사용하려는 문제를 피한다).
  const fetchMock = vi.fn();

  beforeAll(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it("general_news 모드는 write_general_news_article 도구를 호출한다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(
      mockToolUseResponse("write_general_news_article", {
        title: "일반 기사 제목",
        content: "일반 기사 본문입니다.".repeat(50),
        citedSourceIds: sources.map((s) => s.id),
      })
    );

    const result = await generateAiArticleDraft(theme, [], "general_news");

    expect(result.title).toBe("일반 기사 제목");
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.tools[0].name).toBe("write_general_news_article");
  });

  it("source_based_explainer 모드는 write_article 도구를 호출한다 (기존 동작 유지)", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(
      mockToolUseResponse("write_article", {
        synthesis_notes: "메모",
        thesis: "논지",
        title: "설명형 기사 제목",
        content: "설명형 기사 본문입니다.".repeat(50),
        citedSourceIds: sources.map((s) => s.id),
      })
    );

    const result = await generateAiArticleDraft(theme, [], "source_based_explainer");

    expect(result.title).toBe("설명형 기사 제목");
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.tools[0].name).toBe("write_article");
  });

  it("monetized_blog 모드는 write_monetized_blog_article 도구를 호출하고 SEO/점수 필드를 반환한다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(
      mockToolUseResponse("write_monetized_blog_article", {
        seoTitle: "SEO 제목",
        metaDescription: "메타 설명",
        targetKeyword: "타깃 키워드",
        secondaryKeywords: ["보조1", "보조2"],
        searchIntent: "informational",
        readerPersona: "일반 독자",
        title: "본문 제목",
        content: "수익형 블로그 본문입니다.".repeat(80),
        citedSourceIds: sources.map((s) => s.id),
        adSlots: [],
        internalLinkSuggestions: [{ title: "관련 글", reason: "관련성 높음" }],
        monetizationScore: 72,
        policyRiskScore: 15,
      })
    );

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.tools[0].name).toBe("write_monetized_blog_article");
    expect(result.seoTitle).toBe("SEO 제목");
    expect(result.metaDescription).toBe("메타 설명");
    expect(result.monetizationScore).toBe(72);
    expect(result.policyRiskScore).toBe(15);
    // AI가 marker를 누락해도 코드가 모든 AD_SLOT marker를 보장한다.
    for (const position of AD_SLOT_MARKERS) {
      expect(result.content).toContain(adSlotMarkerComment(position));
    }
    expect(result.content).not.toMatch(/adsbygoogle|googlesyndication|data-ad-client|data-ad-slot/i);
  });
});
