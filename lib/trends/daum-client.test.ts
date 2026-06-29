import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { searchDaumNews, stripDaumHtml } from "./daum-client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function makeDaumResponse(documents: object[] = []): Response {
  return new Response(
    JSON.stringify({
      meta: { total_count: documents.length, pageable_count: documents.length, is_end: true },
      documents,
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

const SAMPLE_DOCS = [
  {
    title: "AI 산업 성장 가속화",
    contents: "미국·중국·한국이 AI 산업 주도권을 놓고 경쟁하고 있다.",
    url: "https://news.daum.net/article-1",
    datetime: "2026-06-29T10:00:00.000+09:00",
    sitename: "매일경제",
  },
  {
    title: "반도체 수출 호조",
    contents: "반도체 수출이 증가세를 이어가고 있다.",
    url: "https://news.daum.net/article-2",
    datetime: "2026-06-29T09:00:00.000+09:00",
    sitename: "한국경제",
  },
];

describe("stripDaumHtml", () => {
  it("<b> 태그를 제거한다", () => {
    expect(stripDaumHtml("<b>AI</b> 뉴스")).toBe("AI 뉴스");
  });

  it("HTML 엔티티를 디코딩한다", () => {
    expect(stripDaumHtml("AT&amp;T &lt;공지&gt; &quot;hello&quot;")).toBe('AT&T <공지> "hello"');
  });

  it("앞뒤 공백을 제거한다", () => {
    expect(stripDaumHtml("  텍스트  ")).toBe("텍스트");
  });
});

describe("searchDaumNews", () => {
  beforeEach(() => {
    vi.stubEnv("KAKAO_REST_API_KEY", "test-kakao-key");
  });

  it("응답 documents를 TrendSearchResult로 변환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDaumResponse(SAMPLE_DOCS)));

    const results = await searchDaumNews("AI");

    expect(results).toHaveLength(2);
    expect(results[0].platform).toBe("daum");
    expect(results[0].keyword).toBe("AI");
    expect(results[0].title).toBe("AI 산업 성장 가속화");
    expect(results[0].snippet).toBe("미국·중국·한국이 AI 산업 주도권을 놓고 경쟁하고 있다.");
    expect(results[0].url).toBe("https://news.daum.net/article-1");
    expect(results[0].rankPosition).toBe(1);
  });

  it("KAKAO_REST_API_KEY가 없으면 오류를 던진다", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "");

    await expect(searchDaumNews("AI")).rejects.toThrow("KAKAO_REST_API_KEY");
  });

  it("401 응답이면 인증 오류를 던진다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 }))
    );

    await expect(searchDaumNews("AI")).rejects.toThrow("인증 실패");
  });

  it("429 응답이면 rate limit 오류를 던진다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Too Many Requests", { status: 429 }))
    );

    await expect(searchDaumNews("AI")).rejects.toThrow("rate limit");
  });

  it("네트워크 오류이면 안전하게 오류를 던진다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    await expect(searchDaumNews("AI")).rejects.toThrow("카카오 API 네트워크 오류");
  });

  it("빈 documents이면 빈 배열을 반환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDaumResponse([])));

    const results = await searchDaumNews("AI");
    expect(results).toEqual([]);
  });

  it("title과 contents의 HTML 태그를 제거한다", async () => {
    const htmlDocs = [
      {
        title: "<b>AI</b> 산업 전망",
        contents: "글로벌 <b>AI</b> 시장이 &amp; 빠르게 성장하고 있다.",
        url: "https://news.daum.net/article-html",
        datetime: "2026-06-29T10:00:00.000+09:00",
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDaumResponse(htmlDocs)));

    const results = await searchDaumNews("AI");
    expect(results[0].title).toBe("AI 산업 전망");
    expect(results[0].snippet).toBe("글로벌 AI 시장이 & 빠르게 성장하고 있다.");
  });

  it("/v2/search/web 엔드포인트를 사용한다", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeDaumResponse([]));
    vi.stubGlobal("fetch", mockFetch);

    await searchDaumNews("AI");

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("dapi.kakao.com/v2/search/web");
  });

  it("요청 헤더에 KakaoAK Authorization이 포함된다", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeDaumResponse([]));
    vi.stubGlobal("fetch", mockFetch);

    await searchDaumNews("AI");

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("KakaoAK test-kakao-key");
  });
});
