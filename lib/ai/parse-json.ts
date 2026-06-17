/**
 * AI 응답 텍스트에서 JSON을 추출한다.
 * 모델이 ```json ... ``` 마크다운 코드블록으로 감싸서 반환하는 경우를 처리한다.
 */
export function extractJson(text: string): string {
  const trimmed = text.trim();

  // ```json ... ``` 또는 ``` ... ``` 코드블록 제거
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // { 또는 [ 로 시작하는 JSON만 추출 (앞뒤 잡음 제거)
  const jsonStart = trimmed.search(/[{[]/);
  const jsonEnd = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    return trimmed.substring(jsonStart, jsonEnd + 1);
  }

  return trimmed;
}
