// Phase 4-9: "Cannot read properties of undefined (reading 'filter')" 같은
// raw JavaScript 런타임 에러 메시지가 사용자에게 그대로 보이는 문제를
// 막는다. 서비스 계층은 이미 실패를 throw하지 않고 `{ success: false,
// message }` 형태로 반환하지만(무반응/화면 전체 크래시 방지), 그 `message`
// 자체가 `error.message`를 그대로 옮긴 것이라 raw error 텍스트가 새어
// 나갈 수 있었다 — 이 함수가 그 마지막 지점을 막는다.

/** 사람이 쓴 도메인 에러 메시지가 아니라 JS 런타임이 만든 raw 에러로 보이는 패턴. */
const RAW_RUNTIME_ERROR_PATTERNS: readonly RegExp[] = [
  /cannot read propert/i,
  /is not a function/i,
  /is not defined/i,
  /undefined is not an object/i,
  /null is not an object/i,
  /is not iterable/i,
  /is not a constructor/i,
  /unexpected token/i,
  /maximum call stack/i,
];

/**
 * 에러 메시지가 raw runtime 에러처럼 보이면 사용자 친화적인 fallback
 * 문구로 바꾸고, 그렇지 않으면(이미 사람이 쓴 한국어 안내 메시지라면)
 * 그대로 둔다. raw 메시지 자체를 완전히 버리지는 않는다 — caller가
 * 필요하면 `rawMessage`로 접힘 영역에 보여줄 수 있다.
 */
export function describeUnexpectedError(
  message: string,
  fallback: string
): { userMessage: string; rawMessage: string; wasRawRuntimeError: boolean } {
  const wasRawRuntimeError = RAW_RUNTIME_ERROR_PATTERNS.some((pattern) => pattern.test(message));
  return {
    userMessage: wasRawRuntimeError ? fallback : message,
    rawMessage: message,
    wasRawRuntimeError,
  };
}
