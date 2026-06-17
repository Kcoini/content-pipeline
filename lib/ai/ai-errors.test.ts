import { describe, expect, it } from "vitest";
import { toAiErrorMessage } from "./ai-errors";

function makeStatusError(status: number, message: string): Error {
  const err = new Error(message);
  (err as Error & { status: number }).status = status;
  return err;
}

describe("toAiErrorMessage", () => {
  it("529 과부하는 재시도 안내 메시지를 반환한다", () => {
    const msg = toAiErrorMessage(makeStatusError(529, "overloaded"));

    expect(msg).toContain("529");
    expect(msg).toContain("mock 생성으로 대체합니다");
  });

  it("429 레이트 리밋은 요청 한도 초과 메시지를 반환한다", () => {
    const msg = toAiErrorMessage(makeStatusError(429, "rate limit exceeded"));

    expect(msg).toContain("429");
    expect(msg).toContain("mock 생성으로 대체합니다");
  });

  it("401 인증 실패는 API key 확인 안내 메시지를 반환한다", () => {
    const msg = toAiErrorMessage(makeStatusError(401, "invalid api key"));

    expect(msg).toContain("401");
    expect(msg).toContain("ANTHROPIC_API_KEY");
  });

  it("403 접근 거부는 권한 확인 안내 메시지를 반환한다", () => {
    const msg = toAiErrorMessage(makeStatusError(403, "forbidden"));

    expect(msg).toContain("403");
    expect(msg).toContain("mock 생성으로 대체합니다");
  });

  it("500 이상 서버 오류는 재시도 안내 메시지를 반환한다", () => {
    const msg = toAiErrorMessage(makeStatusError(500, "internal server error"));

    expect(msg).toContain("500");
    expect(msg).toContain("mock 생성으로 대체합니다");
  });

  it("타임아웃 오류는 연결 오류 메시지를 반환한다", () => {
    const msg = toAiErrorMessage(new Error("Request timeout after 30s"));

    expect(msg).toContain("타임아웃");
    expect(msg).toContain("mock 생성으로 대체합니다");
  });

  it("ECONNRESET 오류는 연결 오류 메시지를 반환한다", () => {
    const msg = toAiErrorMessage(new Error("ECONNRESET socket hang up"));

    expect(msg).toContain("연결 오류");
  });

  it("JSON parse 오류 등 일반 오류는 error.message를 그대로 반환한다", () => {
    const msg = toAiErrorMessage(new Error("JSON parse failed: unexpected token"));

    expect(msg).toBe("JSON parse failed: unexpected token");
  });

  it("Error가 아닌 값은 String()으로 변환한다", () => {
    expect(toAiErrorMessage("string error")).toBe("string error");
    expect(toAiErrorMessage(42)).toBe("42");
    expect(toAiErrorMessage(null)).toBe("null");
  });
});
