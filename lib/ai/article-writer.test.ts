import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  generateAiArticleDraft,
  generateMockArticleDraft,
  checkSourceBasedExplainerReadiness,
  InsufficientSourceMaterialError,
  MIN_USABLE_SOURCES_FOR_EXPLAINER,
} from "./article-writer";
import { runContractForCollection } from "@/lib/harness/contract-runner";
import { loadContract } from "@/lib/harness/load-contract";
import { AD_SLOT_MARKERS, adSlotMarkerComment } from "@/lib/articles/article-modes";
import type { Source, Theme } from "@/lib/types/domain";
import type { SourceSummary } from "./source-summarizer";

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

const usableSourceSummaries: SourceSummary[] = sources.map((source, index) => ({
  sourceId: source.id,
  title: source.title ?? "",
  url: source.url,
  publisher: source.publisher ?? "",
  publishedAt: source.publishedAt ?? "",
  summary: "",
  keyPoints: [`핵심 포인트 ${index + 1}`],
  sourceAngle: "",
}));

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
  it("ANTHROPIC_API_KEY가 없으면 명확한 오류를 던진다 (출처 개수와 무관하게 API key 오류가 우선)", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    await expect(generateAiArticleDraft(theme, [])).rejects.toThrow(/ANTHROPIC_API_KEY/);

    if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  });
});

describe("checkSourceBasedExplainerReadiness", () => {
  it("사용 가능한 출처(key_points 또는 summary가 있는 출처)가 3개 이상이면 ready=true를 반환한다", () => {
    const result = checkSourceBasedExplainerReadiness(usableSourceSummaries);
    expect(result.ready).toBe(true);
    expect(result.usableCount).toBe(MIN_USABLE_SOURCES_FOR_EXPLAINER);
  });

  it("사용 가능한 출처가 3개 미만이면 ready=false와 안내 메시지를 반환한다", () => {
    const result = checkSourceBasedExplainerReadiness(usableSourceSummaries.slice(0, 2));
    expect(result.ready).toBe(false);
    expect(result.usableCount).toBe(2);
    expect(result.message).toContain("최소 3개");
  });

  it("key_points와 summary가 모두 비어 있는 출처는 usable로 세지 않는다", () => {
    const emptySummaries: SourceSummary[] = usableSourceSummaries.map((s) => ({ ...s, keyPoints: [], summary: "" }));
    const result = checkSourceBasedExplainerReadiness(emptySummaries);
    expect(result.ready).toBe(false);
    expect(result.usableCount).toBe(0);
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
        sourceUsage: sources.map((s) => ({ sourceId: s.id, usedFor: ["background"] })),
      })
    );

    const result = await generateAiArticleDraft(theme, usableSourceSummaries, "source_based_explainer");

    expect(result.title).toBe("설명형 기사 제목");
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.tools[0].name).toBe("write_article");
  });

  it("사용 가능한 출처가 3개 미만이면 InsufficientSourceMaterialError를 던지고 API를 호출하지 않는다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    await expect(
      generateAiArticleDraft(theme, usableSourceSummaries.slice(0, 2), "source_based_explainer")
    ).rejects.toThrow(InsufficientSourceMaterialError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sourceUsage의 sourceId가 citedSourceIds에 있으면 그대로 반환하고, 없으면 걸러낸다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(
      mockToolUseResponse("write_article", {
        synthesis_notes: "메모",
        thesis: "논지",
        title: "설명형 기사 제목",
        content: "설명형 기사 본문입니다.".repeat(50),
        citedSourceIds: [sources[0].id, sources[1].id],
        sourceUsage: [
          { sourceId: sources[0].id, usedFor: ["background", "data"] },
          { sourceId: "not-cited-source", usedFor: ["analysis"] }, // citedSourceIds에 없음 → 제외
          { sourceId: sources[1].id, usedFor: ["invalid-role"] }, // 허용되지 않은 값 → 제외
        ],
      })
    );

    const result = await generateAiArticleDraft(theme, usableSourceSummaries, "source_based_explainer");

    expect(result.sourceUsage).toEqual([{ sourceId: sources[0].id, usedFor: ["background", "data"] }]);
  });

  function baseMonetizedBlogInput(overrides: Record<string, unknown> = {}) {
    return {
      seoTitle: "SEO 제목",
      metaDescription: "메타 설명",
      targetKeyword: "타깃 키워드",
      secondaryKeywords: ["보조1", "보조2"],
      searchIntent: "informational",
      readerPersona: "일반 독자",
      title: "본문 제목",
      answerSummary: "이 주제의 핵심 결론은 다음과 같다. 조건에 따라 예외가 있을 수 있다.",
      content: "## 문제 설명\n\n수익형 블로그 본문입니다.".repeat(80),
      citedSourceIds: sources.map((s) => s.id),
      adSlots: [],
      internalLinkSuggestions: [{ title: "관련 글", reason: "관련성 높음" }],
      monetizationScore: 72,
      policyRiskScore: 15,
      eeatNotes: { trustworthiness: "출처 3건을 직접 대조해 확인함" },
      geoSummary: { directAnswer: "핵심 결론 요약", keyFacts: ["사실 1", "사실 2"], caveats: ["예외 상황 1"] },
      ...overrides,
    };
  }

  it("monetized_blog 모드는 write_monetized_blog_article 도구를 호출하고 SEO/점수 필드를 반환한다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockToolUseResponse("write_monetized_blog_article", baseMonetizedBlogInput()));

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

  it("AI가 targetKeyword를 누락해도 theme 키워드로 채운다 (빈 문자열로 남기지 않는다)", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const input = baseMonetizedBlogInput({ secondaryKeywords: [], internalLinkSuggestions: [], monetizationScore: 50, policyRiskScore: 10 });
    delete (input as Record<string, unknown>).targetKeyword; // AI가 빠뜨린 경우를 재현한다.
    fetchMock.mockResolvedValueOnce(mockToolUseResponse("write_monetized_blog_article", input));

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    expect(result.targetKeyword).toBeTruthy();
    expect(result.targetKeyword).toBe(theme.keywords[0]);
  });

  // ─── E-E-A-T / AEO / GEO 필드 ────────────────────────────────────────

  it("answerSummary가 없으면 명확한 오류로 실패한다 (조용히 빈 값으로 저장하지 않는다)", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const input = baseMonetizedBlogInput();
    delete (input as Record<string, unknown>).answerSummary;
    fetchMock.mockResolvedValueOnce(mockToolUseResponse("write_monetized_blog_article", input));

    await expect(generateAiArticleDraft(theme, [], "monetized_blog")).rejects.toThrow(/answerSummary/);
  });

  it("answerSummary 필드는 여전히 존재하고, content는 그 값으로 바로 시작하지 않는다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockToolUseResponse("write_monetized_blog_article", baseMonetizedBlogInput()));

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    expect(result.answerSummary).toBeTruthy();
    // 독자 친화성을 위해 answerSummary로 본문을 갑작스럽게 시작하지 않는다.
    expect(result.content.trim().startsWith(result.answerSummary!)).toBe(false);
  });

  it("도입부 heading이 있으면 content는 도입부로 시작하고, 짧은 핵심 답변 섹션은 그 뒤에 온다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const content =
      `## 도입부\n\n요즘 이 문제로 고민하는 분들이 많다. 이 글에서 핵심을 정리한다.\n\n` +
      `## 문제 설명\n\n본문 내용입니다.`.repeat(30);
    fetchMock.mockResolvedValueOnce(mockToolUseResponse("write_monetized_blog_article", baseMonetizedBlogInput({ content })));

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    expect(result.content.trim().startsWith("## 도입부")).toBe(true);
    const introIndex = result.content.indexOf("## 도입부");
    const coreAnswerIndex = result.content.indexOf("## 핵심만 정리하면");
    expect(coreAnswerIndex).toBeGreaterThan(introIndex);
  });

  it("모델이 이미 허용된 heading으로 핵심 답변을 반영했으면 fallback을 중복 삽입하지 않는다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const summary = "이미 본문에 자연스럽게 반영된 핵심 답변입니다.";
    const content =
      `## 도입부\n\n요즘 이 문제로 고민하는 분들이 많다.\n\n` +
      `## 결론부터 말하면\n\n${summary}\n\n` +
      `## 문제 설명\n\n나머지 본문.`.repeat(30);
    fetchMock.mockResolvedValueOnce(
      mockToolUseResponse("write_monetized_blog_article", baseMonetizedBlogInput({ answerSummary: summary, content }))
    );

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    // 허용 heading(## 결론부터 말하면)이 이미 있으므로 fallback 섹션("## 핵심만 정리하면")을 추가하지 않는다.
    expect(result.content).not.toContain("## 핵심만 정리하면");
    expect(result.content.split(summary).length - 1).toBe(1);
  });

  it("eeatNotes를 파싱하고, 값이 없는 항목은 지어내지 않는다(undefined로 남긴다)", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(
      mockToolUseResponse(
        "write_monetized_blog_article",
        baseMonetizedBlogInput({ eeatNotes: { trustworthiness: "출처 대조 확인함", experience: "" } })
      )
    );

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    expect(result.eeatNotes?.trustworthiness).toBe("출처 대조 확인함");
    expect(result.eeatNotes?.experience).toBeUndefined();
  });

  it("geoSummary.keyFacts/caveats를 배열로 반환한다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockToolUseResponse("write_monetized_blog_article", baseMonetizedBlogInput()));

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    expect(Array.isArray(result.geoSummary?.keyFacts)).toBe(true);
    expect(result.geoSummary?.keyFacts.length).toBeGreaterThan(0);
    expect(Array.isArray(result.geoSummary?.caveats)).toBe(true);
  });

  it("geoSummary가 응답에 없으면 빈 값으로 안전하게 처리한다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const input = baseMonetizedBlogInput();
    delete (input as Record<string, unknown>).geoSummary;
    fetchMock.mockResolvedValueOnce(mockToolUseResponse("write_monetized_blog_article", input));

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    expect(result.geoSummary).toEqual({ directAnswer: "", keyFacts: [], caveats: [] });
  });

  it("readerQuestions는 question/shortAnswer가 모두 있는 항목만 유지한다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(
      mockToolUseResponse(
        "write_monetized_blog_article",
        baseMonetizedBlogInput({
          readerQuestions: [
            { question: "이건 무엇인가요?", shortAnswer: "이런 것입니다." },
            { question: "답이 없는 질문" }, // shortAnswer 누락 → 제외
          ],
        })
      )
    );

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    expect(result.readerQuestions).toEqual([{ question: "이건 무엇인가요?", shortAnswer: "이런 것입니다." }]);
  });

  it("structuredDataSuggestions는 허용된 type만 유지한다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(
      mockToolUseResponse(
        "write_monetized_blog_article",
        baseMonetizedBlogInput({
          structuredDataSuggestions: [
            { type: "FAQPage", reason: "본문에 실제 FAQ가 있음" },
            { type: "NotAllowedType", reason: "허용되지 않은 타입" },
          ],
        })
      )
    );

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    expect(result.structuredDataSuggestions).toEqual([{ type: "FAQPage", reason: "본문에 실제 FAQ가 있음" }]);
  });

  // ─── AD_SLOT marker 삽입/정책 위험 ────────────────────────────────────

  it("AD_SLOT marker는 각 위치마다 정확히 1회만 등장한다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockToolUseResponse("write_monetized_blog_article", baseMonetizedBlogInput()));

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    for (const position of AD_SLOT_MARKERS) {
      const marker = adSlotMarkerComment(position);
      const occurrences = result.content.split(marker).length - 1;
      expect(occurrences).toBe(1);
    }
  });

  it("AI가 marker를 이미 heading 근처에 넣었으면 중복 삽입하지 않는다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const marker = adSlotMarkerComment("before_faq");
    fetchMock.mockResolvedValueOnce(
      mockToolUseResponse(
        "write_monetized_blog_article",
        baseMonetizedBlogInput({ content: `## 문제 설명\n\n본문입니다.\n\n${marker}\n\n## FAQ\n\n질문과 답변.`.repeat(20) })
      )
    );

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    expect(result.content.split(marker).length - 1).toBe(1);
  });

  it("실제 AdSense 스크립트/iframe이 섞여 있으면 코드가 제거한다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const poisoned =
      "본문입니다. <script>(adsbygoogle = window.adsbygoogle || []).push({});</script> 이어지는 내용.".repeat(20);
    fetchMock.mockResolvedValueOnce(
      mockToolUseResponse("write_monetized_blog_article", baseMonetizedBlogInput({ content: poisoned }))
    );

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    expect(result.content).not.toMatch(/adsbygoogle|<script/i);
  });

  it("policyRiskScore가 높으면 qualityWarnings에 검토 필요 신호를 남긴다(자동 차단하지 않는다)", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(
      mockToolUseResponse("write_monetized_blog_article", baseMonetizedBlogInput({ policyRiskScore: 85 }))
    );

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    expect(result.policyRiskScore).toBe(85);
    expect(result.qualityWarnings?.some((w) => w.code === "policy_risk_high")).toBe(true);
  });

  it("targetKeyword가 본문에 과도하게 반복되면 keyword_stuffing_suspected 경고를 남긴다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const stuffedContent = "타깃 키워드 ".repeat(50) + "나머지 본문 내용.".repeat(30);
    fetchMock.mockResolvedValueOnce(
      mockToolUseResponse(
        "write_monetized_blog_article",
        baseMonetizedBlogInput({ targetKeyword: "타깃 키워드", content: stuffedContent })
      )
    );

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    expect(result.qualityWarnings?.some((w) => w.code === "keyword_stuffing_suspected")).toBe(true);
  });

  it("answerSummary가 지나치게 길면 answer_summary_too_long 경고를 남긴다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const longSummary = "이 문장은 매우 길게 반복됩니다. ".repeat(30);
    fetchMock.mockResolvedValueOnce(
      mockToolUseResponse("write_monetized_blog_article", baseMonetizedBlogInput({ answerSummary: longSummary }))
    );

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    expect(result.qualityWarnings?.some((w) => w.code === "answer_summary_too_long")).toBe(true);
  });

  it("문제 없는 응답은 qualityWarnings가 비어 있다", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockToolUseResponse("write_monetized_blog_article", baseMonetizedBlogInput()));

    const result = await generateAiArticleDraft(theme, [], "monetized_blog");

    expect(result.qualityWarnings).toEqual([]);
  });
});
