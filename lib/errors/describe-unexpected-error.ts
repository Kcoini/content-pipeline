// Phase 4-9: "Cannot read properties of undefined (reading 'filter')" 같은
// raw JavaScript 런타임 에러 메시지가 사용자에게 그대로 보이는 문제를
// 막는다. 서비스 계층은 이미 실패를 throw하지 않고 `{ success: false,
// message }` 형태로 반환하지만(무반응/화면 전체 크래시 방지), 그 `message`
// 자체가 `error.message`를 그대로 옮긴 것이라 raw error 텍스트가 새어
// 나갈 수 있었다 — 이 함수가 그 마지막 지점을 막는다.

/**
 * 사람이 쓴 도메인 에러 메시지가 아니라 JS 런타임/HTTP/provider/스키마
 * 파싱이 만든 raw 에러로 보이는 패턴. PRODUCT-01G 섹션 30 정적
 * 회귀 목록(ANTHROPIC/SUPABASE/HTTP 500/JSON.parse/schema
 * validation/stack trace/process.env 등)을 그대로 반영한다 — 새
 * 판단 로직이 아니라 이 목록에 패턴만 추가한 것이다.
 */
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
  // HTTP/네트워크 raw 응답
  /HTTP \d{3}/,
  /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|fetch failed|failed to fetch/i,
  // JS 내장 Error 이름 접두사(예: "TypeError: Failed to fetch")
  /^(Type|Range|Reference|Syntax|Eval|URI)Error:/,
  // JSON/스키마 파싱 raw 메시지 — "JSON"이라는 단어 자체를 일반
  // 사용자에게 보여주지 않는다(섹션 6, 금지어 목록에 명시).
  /\bjson\b/i,
  /schema validation|zod|invalid_type|parse error|max_tokens/i,
  // provider/인프라 이름이 그대로 섞인 raw 메시지
  /anthropic|claude|supabase|vercel/i,
  // 환경변수/스택트레이스/내부 경로가 섞인 raw 메시지
  /process\.env|env(ironment)? variable/i,
  // ALL_CAPS_WITH_UNDERSCORES 형태(예: SOCIAL_AI_MAX_TOKENS,
  // WORDPRESS_PUBLISH_ENABLED) — 실제 env var 이름이 메시지에 섞여
  // 들어온 경우를 잡는다(오탐 방지를 위해 언더스코어로 이어진
  // 대문자 세그먼트 2개 이상만 매칭).
  /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){1,}\b/,
  /at \S+ \(.*:\d+:\d+\)/, // stack trace 한 줄("at functionName (file:line:col)")
  /\.(ts|tsx|js):\d+:\d+/, // 파일:줄:칼럼 형태의 raw 위치 정보
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
