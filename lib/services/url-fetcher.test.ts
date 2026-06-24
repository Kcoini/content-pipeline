import { describe, expect, it, vi, afterEach } from "vitest";
import {
  isBlockedHost,
  isValidUrl,
  normalizeUrl,
  extractTitle,
  extractText,
  fetchUrlContent,
  detectCharset,
  decodeBytes,
} from "./url-fetcher";

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── 보안 검사 ────────────────────────────────────────────────────────────────

describe("isBlockedHost", () => {
  it.each([
    "localhost",
    "::1",
    "0.0.0.0",
    "127.0.0.1",
    "127.0.0.2",
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.0.1",
    "192.168.255.255",
    "169.254.0.1",
    "169.254.169.254",
    "fc00::1",
    "fd12:3456:789a::1",
  ])("%s 는 차단된다", (host) => {
    expect(isBlockedHost(host)).toBe(true);
  });

  it.each([
    "example.com",
    "8.8.8.8",
    "172.15.0.1",
    "172.32.0.1",
    "203.0.113.1",
  ])("%s 는 허용된다", (host) => {
    expect(isBlockedHost(host)).toBe(false);
  });
});

describe("isValidUrl", () => {
  it("https URL은 유효하다", () => {
    expect(isValidUrl("https://example.com/article")).toBe(true);
  });

  it("http URL은 유효하다", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
  });

  it("ftp URL은 유효하지 않다", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
  });

  it("빈 문자열은 유효하지 않다", () => {
    expect(isValidUrl("")).toBe(false);
  });

  it("잘못된 형식은 유효하지 않다", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
  });
});

// ─── URL 정규화 ───────────────────────────────────────────────────────────────

describe("normalizeUrl", () => {
  it("네이버 블로그 desktop URL을 mobile URL로 변환한다", () => {
    expect(normalizeUrl("https://blog.naver.com/the60habit/224272836350")).toBe(
      "https://m.blog.naver.com/the60habit/224272836350"
    );
  });

  it("이미 mobile URL이면 그대로 반환한다", () => {
    expect(normalizeUrl("https://m.blog.naver.com/the60habit/224272836350")).toBe(
      "https://m.blog.naver.com/the60habit/224272836350"
    );
  });

  it("다른 도메인은 변환하지 않는다", () => {
    expect(normalizeUrl("https://example.com/article")).toBe("https://example.com/article");
  });

  it("잘못된 URL이면 그대로 반환한다", () => {
    expect(normalizeUrl("not-a-url")).toBe("not-a-url");
  });
});

// ─── HTML 파싱 ────────────────────────────────────────────────────────────────

describe("extractTitle", () => {
  it("<title> 태그 텍스트를 반환한다", () => {
    expect(extractTitle("<html><head><title>테스트 제목</title></head></html>")).toBe("테스트 제목");
  });

  it("title이 없으면 null을 반환한다", () => {
    expect(extractTitle("<html><body>내용</body></html>")).toBeNull();
  });

  it("빈 title이면 null을 반환한다", () => {
    expect(extractTitle("<title></title>")).toBeNull();
  });
});

describe("extractText", () => {
  it("script / style 태그를 제거한다", () => {
    const html = `<html><head><script>var x=1;</script><style>.a{color:red}</style></head><body>본문 텍스트</body></html>`;
    const text = extractText(html);
    expect(text).not.toContain("var x=1");
    expect(text).not.toContain(".a{color:red}");
    expect(text).toContain("본문 텍스트");
  });

  it("nav / footer / header / aside 태그를 제거한다", () => {
    const html = `<nav>메뉴</nav><main>본문</main><footer>푸터</footer><header>헤더</header><aside>사이드바</aside>`;
    const text = extractText(html);
    expect(text).not.toContain("메뉴");
    expect(text).not.toContain("푸터");
    expect(text).not.toContain("헤더");
    expect(text).not.toContain("사이드바");
    expect(text).toContain("본문");
  });

  it("HTML 엔티티를 디코딩한다", () => {
    const html = `<p>AT&amp;T &lt;공지&gt; &quot;hello&quot; &#39;world&#39;</p>`;
    const text = extractText(html);
    expect(text).toContain("AT&T");
    expect(text).toContain("<공지>");
    expect(text).toContain('"hello"');
    expect(text).toContain("'world'");
  });

  it("연속 공백을 하나로 줄인다", () => {
    const html = `<p>  공백   테스트  </p>`;
    const text = extractText(html);
    expect(text).toBe("공백 테스트");
  });
});

// ─── fetchUrlContent ──────────────────────────────────────────────────────────

function makeResponse(
  body: string,
  opts: { status?: number; contentType?: string } = {}
): Response {
  const { status = 200, contentType = "text/html; charset=utf-8" } = opts;
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

describe("fetchUrlContent", () => {
  it("유효하지 않은 URL이면 failed를 반환한다", async () => {
    const result = await fetchUrlContent("not-a-url");
    expect(result.status).toBe("failed");
    expect(result.fetchError).toContain("유효하지 않은 URL");
  });

  it("private IP이면 failed를 반환한다", async () => {
    const result = await fetchUrlContent("http://192.168.1.1/secret");
    expect(result.status).toBe("failed");
    expect(result.fetchError).toContain("차단");
  });

  it("localhost이면 failed를 반환한다", async () => {
    const result = await fetchUrlContent("http://localhost:3000/api");
    expect(result.status).toBe("failed");
    expect(result.fetchError).toContain("차단");
  });

  it("정상 HTML 응답이면 success를 반환한다", async () => {
    const html = `<html><head><title>테스트</title></head><body><p>본문 내용입니다.</p></body></html>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(html)));

    const result = await fetchUrlContent("https://example.com/article");
    expect(result.status).toBe("success");
    expect(result.extractedTitle).toBe("테스트");
    expect(result.rawContent).toContain("본문 내용입니다.");
    expect(result.fetchError).toBeNull();
    expect(result.fetchedAt).toBeTruthy();
  });

  it("HTTP 4xx 응답이면 failed를 반환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse("Not Found", { status: 404 })));

    const result = await fetchUrlContent("https://example.com/missing");
    expect(result.status).toBe("failed");
    expect(result.fetchError).toContain("404");
  });

  it("지원하지 않는 content-type이면 failed를 반환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeResponse("binary", { contentType: "application/pdf" }))
    );

    const result = await fetchUrlContent("https://example.com/file.pdf");
    expect(result.status).toBe("failed");
    expect(result.fetchError).toContain("지원하지 않는 콘텐츠 타입");
  });

  it("네트워크 오류이면 failed를 반환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const result = await fetchUrlContent("https://example.com");
    expect(result.status).toBe("failed");
    expect(result.fetchError).toContain("network error");
  });

  it("타임아웃이면 failed를 반환한다", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    const result = await fetchUrlContent("https://example.com");
    expect(result.status).toBe("failed");
    expect(result.fetchError).toContain("시간이 초과");
  });

  it("script/style이 제거된 텍스트를 rawContent에 담는다", async () => {
    const html = `<html><head><script>alert(1)</script></head><body><p>깨끗한 본문</p></body></html>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(html)));

    const result = await fetchUrlContent("https://example.com");
    expect(result.status).toBe("success");
    expect(result.rawContent).not.toContain("alert");
    expect(result.rawContent).toContain("깨끗한 본문");
  });
});

// ─── 인코딩 감지 ─────────────────────────────────────────────────────────────

describe("detectCharset", () => {
  const emptyBytes = new Uint8Array(0);

  it("Content-Type 헤더에 charset이 있으면 반환한다", () => {
    expect(detectCharset("text/html; charset=euc-kr", emptyBytes)).toBe("euc-kr");
    expect(detectCharset("text/html; charset=UTF-8", emptyBytes)).toBe("utf-8");
  });

  it("헤더가 없으면 meta charset 태그에서 감지한다", () => {
    const html = '<html><head><meta charset="euc-kr"></head></html>';
    const bytes = new TextDecoder("latin1").decode(new Uint8Array([]));
    void bytes;
    const htmlBytes = new Uint8Array(Buffer.from(html, "ascii"));
    expect(detectCharset("text/html", htmlBytes)).toBe("euc-kr");
  });

  it("감지 실패 시 utf-8을 반환한다", () => {
    expect(detectCharset("text/html", emptyBytes)).toBe("utf-8");
  });
});

describe("decodeBytes", () => {
  it("utf-8 바이트를 올바르게 디코딩한다", () => {
    const bytes = new TextEncoder().encode("안녕하세요");
    expect(decodeBytes(bytes, "utf-8")).toBe("안녕하세요");
  });

  it("ks_c_5601-1987을 euc-kr로 정규화해 디코딩한다", () => {
    const bytes = new TextEncoder().encode("test");
    const result = decodeBytes(bytes, "ks_c_5601-1987");
    expect(typeof result).toBe("string");
  });

  it("지원하지 않는 charset이면 utf-8로 fallback한다", () => {
    const bytes = new TextEncoder().encode("fallback");
    expect(decodeBytes(bytes, "unknown-charset-xyz")).toBe("fallback");
  });

  it("EUC-KR 바이트를 올바르게 디코딩한다", () => {
    // "한국" in EUC-KR: 0xC7D1 0xB1B9
    const eucKrBytes = new Uint8Array([0xC7, 0xD1, 0xB1, 0xB9]);
    const result = decodeBytes(eucKrBytes, "euc-kr");
    expect(result).toBe("한국");
  });
});
