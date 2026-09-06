// Phase 1-17: Daum/Kakao 전용 검색어 확장.
//
// 네이버에서 추출한 원 키워드(seed-queries.ts)를 그대로 다음에 넣으면,
// "AI"/"경제"/"정치"처럼 포괄적인 단어라 sort=recency 기준 최신 web 문서가
// 여러 seed query에 걸쳐 겹치기 쉽다(예: 오늘자 포털 메인 기사가 "경제"와
// "정치" 양쪽 검색에 똑같이 잡히는 식). 같은 이슈를 조금 더 구체적인
// 표현으로도 검색해 raw 후보 pool을 넓힌다.
//
// 과도한 API 호출을 막기 위해 seed query 하나당 확장어는 최대 2개로
// 제한한다(원 키워드 자신 포함 최대 3개 검색).

const DAUM_QUERY_EXPANSIONS: Record<string, string[]> = {
  "AI": ["AI 산업 동향", "AI 스타트업 투자"],
  "반도체": ["반도체 수출 동향", "반도체 파운드리 투자"],
  "전기차": ["전기차 보조금 정책", "전기차 배터리 기술"],
  "부동산": ["부동산 대출 규제", "주택 청약 정책"],
  "경제": ["경제 성장률 전망", "물가 인플레이션 동향"],
  "의료": ["의료 정책 변화", "의료비 지원 제도"],
  "돌봄": ["돌봄 서비스 지원", "노인 돌봄 정책"],
  "고령화": ["고령화 대책", "노인 인구 정책"],
  "교육": ["교육 정책 변화", "대입 제도 개편"],
  "정치": ["정치 이슈 동향", "국회 입법 동향"],
};

/** 주어진 seed query에 대한 확장 검색어 목록을 반환한다(seed 자신 포함). 정의되지 않은 seed query는 자기 자신만 반환한다. */
export function expandDaumQuery(seedQuery: string): string[] {
  const expansions = DAUM_QUERY_EXPANSIONS[seedQuery] ?? [];
  return [seedQuery, ...expansions];
}

/** 여러 seed query를 한 번에 확장하고, 중복 검색어는 제거한다. */
export function expandDaumQueries(seedQueries: readonly string[]): string[] {
  const expanded = seedQueries.flatMap((q) => expandDaumQuery(q));
  return Array.from(new Set(expanded));
}
