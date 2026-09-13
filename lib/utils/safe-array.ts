// Phase 4-9: "undefined/null(때로는 객체·문자열)인데 바로 .filter()/.map()을
// 호출해서 터지는" 버그를 막기 위한 공용 helper. `value || []`만으로는
// 객체나 문자열처럼 falsy가 아닌 잘못된 값이 들어왔을 때 여전히 안전하지
// 않다 — 항상 Array.isArray로 실제 배열인지 확인한다.

/**
 * value가 배열이면 그대로, 아니면(undefined/null/객체/문자열 등) 빈
 * 배열을 반환한다. AI 응답이나 예전 버전 마스터 원고처럼 일부 필드가
 * 빠져 있을 수 있는 값을 안전하게 다룰 때 사용한다.
 */
export function asArray<T>(value: readonly T[] | null | undefined): T[] {
  return Array.isArray(value) ? [...value] : [];
}
