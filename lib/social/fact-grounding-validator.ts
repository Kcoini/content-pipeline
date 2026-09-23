// OPS-02A: 게시용 본문/캡션에 등장하는 "검증 가능한 외부 사실 주장"이
// 마스터 원고의 verifiedFacts로 뒷받침되는지 확인하는 순수 함수.
//
// 새로운 사실 DB/키워드 차단기를 만들지 않는다 — 이미 있는
// verifiedFacts(lib/articles/master-manuscript-builder.ts, source의
// keyPoints를 기계적으로 모은 것)를 "근거 텍스트"로 재사용해 claim과
// evidence를 연결하기만 한다. 트리거 단어(비교/최상급 표현)는 "이
// 문장이 검증이 필요한 성격인지" 판단하는 신호일 뿐, 그 단어 자체를
// 금지하지 않는다 — 실제로 evidence 텍스트에 같은 비교가 있으면
// 통과한다.
//
// OPS-01 Pilot C에서 실제로 재현된 Miss: instagram caption이 등록된
// source(배터리 전기차 관련) 어디에도 없는 "수소 연료전지차" 비교
// 수치(주행거리/충전소 비용/차량가격)를 포함했는데 review가 잡지
// 못했다 — quality gate에 애초에 이런 검사가 없었다(플랫폼 불문,
// news_article의 키워드 기반 unsourced-claim 검사 하나만 있었고 그마저
// evidence 대조가 아니라 "단정적 전망 표현" 문자열 목록이었다).

import type { MasterManuscriptVerifiedFact } from "@/lib/articles/master-manuscript-types";

export type GroundingIssueReason = "unsupported_number" | "unsupported_comparison";

export interface GroundingIssue {
  /** 문제가 된 문장(원문 그대로 — 로그에는 이 값을 그대로 남기지 않는다, 호출부 참고). */
  sentence: string;
  reason: GroundingIssueReason;
}

/** 섹션 4의 예시를 그대로 따르되, "검증이 필요한 문장인지"를 판단하는 트리거일 뿐 금지어가 아니다. */
const COMPARATIVE_MARKERS: readonly string[] = [
  "가장 많이",
  "가장 큰",
  "가장 빠른",
  "가장 긴",
  "가장 길게",
  "더 오래",
  "더 길다",
  "더 큽니다",
  "더 높다",
  "더 낮다",
  "더 짧다",
  "두 배",
  "세 배",
  "절반",
  "세계 최대",
  "세계 최고",
  "업계 1위",
  "업계 최고",
  "평균보다",
  "수명이 더",
  "효율이",
  "% 향상",
  "% 개선",
];
const RATIO_PATTERN = /약\s*\d+(\.\d+)?\s*배/;

/** 숫자만 추출한다(단위는 무시 — "300km"와 "약 300킬로미터"가 같은 근거로 매칭되도록, 섹션 21의 "같은 사실, 다른 표현" 요구사항). */
const NUMBER_PATTERN = /\d+(\.\d+)?/g;

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?다요])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractNumbers(text: string): string[] {
  return text.match(NUMBER_PATTERN) ?? [];
}

/** verifiedFacts(+선택적으로 원래 postTitle/excerpt 등)를 근거 텍스트 하나로 합친다. */
export function buildEvidenceText(verifiedFacts: readonly Pick<MasterManuscriptVerifiedFact, "fact">[]): string {
  return verifiedFacts.map((f) => f.fact).join(" \n ");
}

/**
 * postText(본문+캡션+thread/card 텍스트를 합친 것) 안에서 evidenceText로
 * 뒷받침되지 않는 숫자 주장/비교 주장을 찾는다.
 *
 * - 숫자가 포함된 문장은 그 숫자가 evidenceText 어딘가에 그대로
 *   등장해야 한다(단위 무시 — 표현 차이는 오탐으로 취급하지 않는다).
 *   숫자가 하나라도 근거에 없으면 unsupported_number.
 * - 비교/최상급 표현이 포함된 문장은(숫자가 없어도) 같은 비교 표현이
 *   evidenceText에 등장해야 한다 — 없으면 unsupported_comparison. 이미
 *   unsupported_number로 잡힌 문장은 중복 보고하지 않는다.
 */
export function findUngroundedClaims(postText: string, evidenceText: string): GroundingIssue[] {
  if (!postText.trim()) return [];
  const sentences = splitSentences(postText);
  const issues: GroundingIssue[] = [];

  for (const sentence of sentences) {
    const numbers = extractNumbers(sentence);
    const hasComparative = COMPARATIVE_MARKERS.some((m) => sentence.includes(m)) || RATIO_PATTERN.test(sentence);

    if (numbers.length > 0) {
      const allGrounded = numbers.every((n) => evidenceText.includes(n));
      if (!allGrounded) {
        issues.push({ sentence, reason: "unsupported_number" });
        continue;
      }
    }

    if (hasComparative) {
      const markerGrounded = COMPARATIVE_MARKERS.some((m) => sentence.includes(m) && evidenceText.includes(m));
      if (!markerGrounded && !(numbers.length > 0 && numbers.every((n) => evidenceText.includes(n)))) {
        issues.push({ sentence, reason: "unsupported_comparison" });
      }
    }
  }

  return issues;
}

export interface ConflictingFactIssue {
  factA: string;
  factB: string;
  numbersA: string[];
  numbersB: string[];
}

/** 2글자 이상 한글/영문 토큰만 남기고 조사/숫자를 제거한다(대략적인 "주제어" 비교용). */
function significantTokens(text: string): Set<string> {
  const withoutNumbers = text.replace(NUMBER_PATTERN, " ");
  const tokens = withoutNumbers.match(/[가-힣a-zA-Z]{2,}/g) ?? [];
  return new Set(tokens);
}

function jaccardOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

const CONFLICT_TOKEN_OVERLAP_THRESHOLD = 0.6;

/**
 * verifiedFacts 중 "같은 주제를 말하는 것으로 보이는데(주제어가 많이
 * 겹침) 숫자가 서로 다른" 쌍을 찾는다. source 간 날짜/수치가 실제로
 * 다를 수 있으므로(발표 시점/정의 차이 — 섹션 21) 자동으로 "오류"라고
 * 단정하지 않고, 사람이 확인할 항목으로만 올린다. 단순 문구 차이(같은
 * 숫자, 다른 단위 표현)는 숫자 자체가 같으므로 여기서 걸리지 않는다.
 */
export function detectConflictingVerifiedFacts(
  verifiedFacts: readonly MasterManuscriptVerifiedFact[]
): ConflictingFactIssue[] {
  const numericFacts = verifiedFacts
    .filter((f) => extractNumbers(f.fact).length > 0)
    .map((f) => ({ fact: f.fact, numbers: extractNumbers(f.fact), tokens: significantTokens(f.fact) }));

  const issues: ConflictingFactIssue[] = [];
  for (let i = 0; i < numericFacts.length; i += 1) {
    for (let j = i + 1; j < numericFacts.length; j += 1) {
      const a = numericFacts[i];
      const b = numericFacts[j];
      const overlap = jaccardOverlap(a.tokens, b.tokens);
      if (overlap < CONFLICT_TOKEN_OVERLAP_THRESHOLD) continue;

      const sameNumbers = a.numbers.length === b.numbers.length && a.numbers.every((n) => b.numbers.includes(n));
      if (sameNumbers) continue; // 같은 숫자면 표현만 다른 것 — 충돌 아님.

      issues.push({ factA: a.fact, factB: b.fact, numbersA: a.numbers, numbersB: b.numbers });
    }
  }
  return issues;
}
