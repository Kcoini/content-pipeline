// Anthropic API 오류를 사용자 친화적인 한국어 메시지로 변환한다.
// 모든 AI 호출 catch 블록에서 이 함수를 통해 오류 메시지를 생성한다.
// Next.js Runtime Error 화면 대신 pipeline_logs / UI 배너에 표시된다.

/**
 * Anthropic SDK APIStatusError 계열(status 프로퍼티 보유) 및 네트워크 오류를
 * 한국어 사용자 메시지로 변환한다.
 *
 * 상태 코드별 의미:
 * - 529: Anthropic API 과부하 (Overloaded) — 잠시 후 재시도 안내
 * - 429: 요청 한도 초과 (Rate Limit) — 잠시 후 재시도 안내
 * - 401: 인증 실패 — ANTHROPIC_API_KEY 확인 안내
 * - 403: 접근 거부 — API key 권한 확인 안내
 * - 5xx: 서버 오류 — 잠시 후 재시도 안내
 * - 네트워크/타임아웃: 연결 오류 안내
 */
export function toAiErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  // Anthropic SDK의 APIStatusError 계열은 status 프로퍼티를 가진다
  const status =
    "status" in error && typeof (error as { status: unknown }).status === "number"
      ? (error as { status: number }).status
      : undefined;

  if (status !== undefined) {
    if (status === 529) {
      return `AI 서비스가 일시적으로 과부하 상태입니다(529 Overloaded). 잠시 후 다시 시도해주세요. mock 생성으로 대체합니다.`;
    }
    if (status === 429) {
      return `AI API 요청 한도를 초과했습니다(429 Rate Limit). 잠시 후 다시 시도해주세요. mock 생성으로 대체합니다.`;
    }
    if (status === 401) {
      return `AI API 인증에 실패했습니다(401). ANTHROPIC_API_KEY가 올바르게 설정되어 있는지 확인해주세요. mock 생성으로 대체합니다.`;
    }
    if (status === 403) {
      return `AI API 접근이 거부되었습니다(403). API key의 권한을 확인해주세요. mock 생성으로 대체합니다.`;
    }
    if (status >= 500) {
      return `AI API 서버에서 오류가 발생했습니다(${status}). 잠시 후 다시 시도해주세요. mock 생성으로 대체합니다.`;
    }
  }

  // 네트워크 / 타임아웃 오류 (Anthropic SDK의 APIConnectionError 계열)
  const lowerMsg = error.message.toLowerCase();
  if (
    lowerMsg.includes("timeout") ||
    lowerMsg.includes("econnreset") ||
    lowerMsg.includes("econnrefused") ||
    lowerMsg.includes("network") ||
    lowerMsg.includes("connection")
  ) {
    return `AI API 연결 오류(네트워크/타임아웃). mock 생성으로 대체합니다. 상세: ${error.message}`;
  }

  return error.message;
}
