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
});
