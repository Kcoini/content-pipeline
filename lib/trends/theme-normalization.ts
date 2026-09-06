// Phase 1-16: 공통 테마 후보 중복 방지 — 제목을 비교 가능한 형태로 정규화한다.
//
// 네이버/다음에서 같은 이슈가 공백/특수문자/연도/조사 표현만 다르게
// 수집되면(예: "제주 신혼부부·청년 주거 지원 2026" vs "제주 청년 신혼부부
// 주거지원 조건") 서로 다른 후보로 저장되는 문제를 막기 위한 유틸리티다.
//
// 완벽한 한국어 형태소 분석기가 아니다 — 조사 제거는 안전하다고 판단되는
// 규칙(2글자 이상 조사 접미사, 3글자 이상 토큰에서만 1글자 조사 제거)만
// 적용하고, 애매하면 원본 토큰을 그대로 둔다. "완전히 같은 키를 만드는
// 것"이 목표가 아니라 "유사 후보를 하나로 묶을 수 있을 만큼" 정규화하는
// 것이 목표다 — 그래서 이 파일은 두 단계를 제공한다:
//   1) normalizeThemeKey(): 완전/거의 동일한 제목을 잡아내는 정확 비교 키
//   2) themeTitleSimilarity(): 표현이 달라도 핵심 토큰이 겹치는 유사 후보를
//      잡아내는 퍼지(fuzzy) 유사도

const SPECIAL_CHAR_TO_SPACE_PATTERN = /[·・/\\\-–—_,:;|()[\]{}"'`~!?@#$%^&*+=<>.]/g;
const WHITESPACE_PATTERN = /\s+/g;
/** "2026", "2026년"처럼 단독 연도 토큰만 잡는다 — 연도가 포함된 복합어(예: "2026시행")는 건드리지 않는다. */
const YEAR_TOKEN_PATTERN = /^(19|20)\d{2}(년)?$/;

/**
 * 최종 공통 테마 제목에서 반복적으로 등장하지만 주제 구분에 큰 의미가
 * 없는 일반어. 정규화 키(비교용)에서만 제거하고, 화면에 표시하는 원본
 * 제목에는 영향을 주지 않는다.
 */
const GENERIC_WEAK_WORDS = new Set([
  "지원금", "지원", "정리", "방법", "조건", "최신", "안내", "가이드",
  "총정리", "확인", "완벽정리", "총망라", "관련",
]);

/** 2글자 이상이라 명사 끝 글자와 헷갈릴 위험이 낮은 조사 접미사. */
const JOSA_SUFFIXES = [
  "으로부터", "에서부터", "이라면", "이라도", "까지는", "부터는",
  "에서는", "으로는", "와의", "과의", "에게서", "한테서",
  "이나마", "처럼", "보다", "까지", "부터", "마다", "에게", "한테",
  "에서", "으로", "이랑", "께서",
];
/** 1글자 조사 — 3글자 이상 토큰에서만 제거해 짧은 명사(2글자 단어)가 훼손되지 않게 한다. */
const SHORT_JOSA_SUFFIXES = ["은", "는", "이", "가", "을", "를", "의", "에", "와", "과", "도", "만", "로"];

function stripJosa(token: string): string {
  for (const suffix of JOSA_SUFFIXES) {
    if (token.length > suffix.length + 1 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  for (const suffix of SHORT_JOSA_SUFFIXES) {
    if (token.length >= 3 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  return token;
}

/** 제목에서 연도로 보이는 토큰(1900~2099, "2026년" 포함)을 찾아 반환한다. 없으면 null. */
export function extractYearToken(title: string): string | null {
  const tokens = title.split(WHITESPACE_PATTERN);
  for (const token of tokens) {
    const match = token.match(/(19|20)\d{2}/);
    if (match) return match[0];
  }
  return null;
}

/** 비교/클러스터링에 쓸 유의미한 토큰 목록을 만든다(조사/일반어/연도 제거). */
export function tokenizeThemeTitle(title: string): string[] {
  const cleaned = title
    .trim()
    .toLowerCase()
    .replace(SPECIAL_CHAR_TO_SPACE_PATTERN, " ")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();

  if (!cleaned) return [];

  return cleaned
    .split(" ")
    .filter(Boolean)
    .filter((token) => !YEAR_TOKEN_PATTERN.test(token))
    .map(stripJosa)
    .filter((token) => token.length > 0 && !GENERIC_WEAK_WORDS.has(token));
}

/**
 * 제목을 정규화된 비교 키로 만든다. 공백/특수문자/연도/조사/일반어 차이를
 * 흡수하고, 토큰 순서(예: "신혼부부 청년" vs "청년 신혼부부")가 달라도 같은
 * 키가 나오도록 정렬한다. 완전히 동일하거나 거의 동일한 제목을 잡아내는
 * 용도다 — 표현 자체가 다른 유사 후보는 themeTitleSimilarity()로 잡는다.
 */
export function normalizeThemeKey(title: string): string {
  const tokens = tokenizeThemeTitle(title);
  return Array.from(new Set(tokens)).sort().join(" ");
}

/** 두 제목의 토큰 집합 기준 Jaccard 유사도(0~1)를 계산한다. */
export function themeTitleSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenizeThemeTitle(a));
  const tokensB = new Set(tokenizeThemeTitle(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 유사 후보로 판단해 병합할 최소 유사도 임계값. 지역/대상/핵심 제도명이
 * 같고 조사/연도/일반어 차이만 있는 경우를 잡아내도록 실측 예시 기준으로
 * 정했다(예: "제주 신혼부부·청년 주거 지원 2026" vs "제주 청년 신혼부부
 * 주거지원 조건" ≈ 0.6).
 */
export const THEME_SIMILARITY_MERGE_THRESHOLD = 0.55;
