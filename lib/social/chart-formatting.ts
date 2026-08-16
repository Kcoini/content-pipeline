// Phase 3-19: Dashboard Charts & Trend Visualization.
// 차트/표에서 숫자를 사람이 읽기 좋은 문자열로 바꾸는 순수 formatting
// helper 모음이다. 이 파일의 어떤 함수도 데이터를 조회하거나
// 변경하지 않는다 — 입력값을 받아 문자열/숫자만 반환한다.

/** null/undefined는 '-'로, 그 외 숫자는 천 단위 구분 기호를 붙여 표시한다. */
export function formatChartNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toLocaleString("ko-KR");
}

/**
 * 0~1 사이 비율(engagement rate 등)을 백분율 문자열로 바꾼다.
 * null/undefined는 '-', 그 외에는 소수점 1자리 %로 표시한다.
 */
export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

/** performance_score(내부 비교용 참고 지표)를 소수점 1자리로 표시한다. null/undefined는 '-'. */
export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toFixed(1);
}

/** "2026-01" 또는 ISO 날짜 문자열을 "2026년 1월" 형태로 표시한다. */
export function formatMonthLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(period);
  if (!match) return period;
  const [, year, month] = match;
  return `${year}년 ${Number.parseInt(month, 10)}월`;
}

/**
 * 차트 bar 길이(0~100)를 계산하기 위해 값을 max 기준 비율로 정규화한다.
 * max가 0 이하이거나 value가 유효하지 않으면 0을 반환한다(빈 bar).
 */
export function normalizeChartValue(value: number | null | undefined, max: number): number {
  if (value === null || value === undefined || Number.isNaN(value) || max <= 0) return 0;
  const ratio = (value / max) * 100;
  return Math.max(0, Math.min(100, ratio));
}

/** 숫자 배열의 평균을 계산한다. 빈 배열이거나 유효한 값이 없으면 null을 반환한다. */
export function safeAverage(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}
