import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { searchNaverNews, stripNaverHtml } from "./naver-client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// 네이버 API 응답 샘플
function makeNaverResponse(items: object[] = []): Response {
  return new Response(
    JSON.stringify({
      lastBuildDate: "Sun, 29 Jun 2026 17:00:00 +0900",
      total: items.length,
      start: 1,
      display: items.length,
      items,
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

const SAMPLE_ITEMS = [
  {
    title: "<b>AI</b> 에이전트 시장 급성장",
    originallink: "https://news.example.com/article-1",
    link: "https://naver.me/article-1",
    description: "글로벌 <b>AI</b> 에이전트 시장이 &amp; 빠르게 성장하고 있다.",
    pubDate: "Sun, 29 Jun 2026 10:00:00 +0900",
  },
  {
    title: "반도체 수출 호조",
    originallink: "https://news.example.com/article-2",
    link: "https://naver.me/article-2",
    description: "반도체 수출이 증가세를 이어가고 있다.",
    pubDate: "Sun, 29 Jun 2026 09:00:00 +0900",
  },
];

describe("stripNaverHtml", () => {
  it("<b> 태그를 제거한다", () => {
    expect(stripNaverHtml("<b>AI</b> 에이전트")).toBe("AI 에이전트");
  });

  it("HTML 엔티티를 디코딩한다", () => {
    expect(stripNaverHtml("AT&amp;T &lt;공지&gt; &quot;hello&quot;")).toBe('AT&T <공지> "hello"');
  });

  it("앞뒤 공백을 제거한다", () => {
    expect(stripNaverHtml("  텍스트  ")).toBe("텍스트");
  });
});

describe("searchNaverNews", () => {
  beforeEach(() => {
    vi.stubEnv("NAVER_CLIENT_ID", "test-client-id");
    vi.stubEnv("NAVER_CLIENT_SECRET", "test-client-secret");
  });

  it("응답 items를 TrendSearchResult로 변환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeNaverResponse(SAMPLE_ITEMS)));

    const results = await searchNaverNews("AI");

    expect(results).toHaveLength(2);
    expect(results[0].platform).toBe("naver");
    expect(results[0].keyword).toBe("AI");
    // HTML 태그가 제거됨
    expect(results[0].title).toBe("AI 에이전트 시장 급성장");
    expect(results[0].snippet).toBe("글로벌 AI 에이전트 시장이 & 빠르게 성장하고 있다.");
    expect(results[0].url).toBe("https://news.example.com/article-1");
    expect(results[0].rankPosition).toBe(1);
  });

  it("originallink가 없으면 link를 사용한다", async () => {
    const items = [{ ...SAMPLE_ITEMS[0], originallink: "" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeNaverResponse(items)));

    const results = await searchNaverNews("AI");
    expect(results[0].url).toBe("https://naver.me/article-1");
  });

  it("NAVER_CLIENT_ID가 없으면 오류를 던진다", async () => {
    vi.stubEnv("NAVER_CLIENT_ID", "");

    await expect(searchNaverNews("AI")).rejects.toThrow("NAVER_CLIENT_ID");
  });

  it("NAVER_CLIENT_SECRET이 없으면 오류를 던진다", async () => {
    vi.stubEnv("NAVER_CLIENT_SECRET", "");

    await expect(searchNaverNews("AI")).rejects.toThrow("NAVER_CLIENT_SECRET");
  });

  it("401 응답이면 인증 오류를 던진다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 }))
    );

    await expect(searchNaverNews("AI")).rejects.toThrow("인증 실패");
  });

  it("429 응답이면 rate limit 오류를 던진다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Too Many Requests", { status: 429 }))
    );

    await expect(searchNaverNews("AI")).rejects.toThrow("rate limit");
  });

  it("네트워크 오류이면 안전하게 오류를 던진다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    await expect(searchNaverNews("AI")).rejects.toThrow("네이버 API 네트워크 오류");
  });

  it("빈 items이면 빈 배열을 반환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeNaverResponse([])));

    const results = await searchNaverNews("AI");
    expect(results).toEqual([]);
  });

  it("요청 헤더에 X-Naver-Client-Id가 포함된다", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeNaverResponse([]));
    vi.stubGlobal("fetch", mockFetch);

    await searchNaverNews("AI");

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["X-Naver-Client-Id"]).toBe("test-client-id");
    expect(headers["X-Naver-Client-Secret"]).toBe("test-client-secret");
  });
});
