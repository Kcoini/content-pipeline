import { describe, expect, it } from "vitest";
import { describeUnexpectedError } from "./describe-unexpected-error";

describe("describeUnexpectedError", () => {
  it("raw JS 런타임 에러 메시지는 fallback으로 바꾼다", () => {
    const result = describeUnexpectedError(
      "Cannot read properties of undefined (reading 'filter')",
      "글 생성 중 문제가 발생했습니다."
    );
    expect(result.userMessage).toBe("글 생성 중 문제가 발생했습니다.");
    expect(result.wasRawRuntimeError).toBe(true);
    expect(result.rawMessage).toBe("Cannot read properties of undefined (reading 'filter')");
  });

  it("사람이 쓴 한국어 도메인 에러 메시지는 그대로 둔다", () => {
    const result = describeUnexpectedError("이미 존재하는 플랫폼입니다.", "fallback");
    expect(result.userMessage).toBe("이미 존재하는 플랫폼입니다.");
    expect(result.wasRawRuntimeError).toBe(false);
  });

  it("'is not a function' 같은 다른 raw 런타임 패턴도 잡아낸다", () => {
    expect(describeUnexpectedError("x.map is not a function", "fallback").wasRawRuntimeError).toBe(true);
    expect(describeUnexpectedError("foo is not defined", "fallback").wasRawRuntimeError).toBe(true);
  });

  it("PRODUCT-01G: HTTP/provider/JSON/schema/env/stack trace raw 패턴도 잡아낸다(섹션 30)", () => {
    expect(describeUnexpectedError("Request failed with HTTP 500", "fallback").wasRawRuntimeError).toBe(true);
    expect(describeUnexpectedError("fetch failed", "fallback").wasRawRuntimeError).toBe(true);
    expect(describeUnexpectedError("Unexpected end of JSON input", "fallback").wasRawRuntimeError).toBe(true);
    expect(describeUnexpectedError("ZodError: schema validation failed", "fallback").wasRawRuntimeError).toBe(true);
    expect(describeUnexpectedError("Anthropic API request failed", "fallback").wasRawRuntimeError).toBe(true);
    expect(describeUnexpectedError("SUPABASE_SECRET_KEY is missing", "fallback").wasRawRuntimeError).toBe(true);
    expect(describeUnexpectedError("process.env.WORDPRESS_BASE_URL is undefined", "fallback").wasRawRuntimeError).toBe(true);
    expect(describeUnexpectedError("Error\n    at generateDraft (lib/ai/generate.ts:42:11)", "fallback").wasRawRuntimeError).toBe(
      true
    );
  });

  it("PRODUCT-01G: structured-output(JSON 파싱 실패) raw 메시지를 사용자에게 'JSON'이라는 단어째로 보여주지 않는다(섹션 9)", () => {
    const result = describeUnexpectedError("AI 응답을 JSON으로 파싱하지 못했습니다.", "콘텐츠 생성 결과를 정상적으로 처리하지 못했습니다.");
    expect(result.wasRawRuntimeError).toBe(true);
    expect(result.userMessage).not.toMatch(/json/i);
  });

  it("PRODUCT-01G: ALL_CAPS_ENV_VAR_NAME이 섞인 메시지도 잡아낸다(실제 발견된 leak: SOCIAL_AI_MAX_TOKENS)", () => {
    const result = describeUnexpectedError(
      "AI 응답이 max_tokens(4000) 제한에 도달해 중간에 잘렸습니다 — SOCIAL_AI_MAX_TOKENS를 늘려야 합니다.",
      "콘텐츠를 만드는 중 문제가 발생했습니다."
    );
    expect(result.wasRawRuntimeError).toBe(true);
    expect(result.userMessage).not.toContain("SOCIAL_AI_MAX_TOKENS");
  });

  it("사람이 쓴 도메인 메시지에 'API'/'서버' 같은 일반 단어가 있어도 오탐하지 않는다", () => {
    const result = describeUnexpectedError("API 연동이 설정되어 있지 않아 본문을 복사해 수동으로 게시하세요.", "fallback");
    expect(result.wasRawRuntimeError).toBe(false);
  });
});
