// Phase 1-12: TREND_COLLECTION_ENABLED=false일 때 사용하는 mock 트렌드 데이터 제공자.
// 실제 네이버/다음 API 연결 전에도 흐름 전체를 테스트할 수 있다.

import type { TrendCandidate } from "@/lib/types/domain";

export interface RawTrendItem {
  platform: "naver" | "daum" | "mock";
  keyword: string;
  title: string;
  snippet: string;
  url: string;
  rankPosition: number;
}

const MOCK_NAVER: RawTrendItem[] = [
  { platform: "naver", keyword: "AI 에이전트", title: "AI 에이전트 시장 급성장…기업 도입 가속", snippet: "글로벌 AI 에이전트 시장이 급성장하며 국내 기업들도 도입을 서두르고 있다.", url: "https://example.com/naver/1", rankPosition: 1 },
  { platform: "naver", keyword: "반도체 수출", title: "반도체 수출 증가세 이어져…무역수지 흑자 전환", snippet: "반도체 수출이 3개월 연속 증가해 무역수지가 흑자로 돌아섰다.", url: "https://example.com/naver/2", rankPosition: 2 },
  { platform: "naver", keyword: "전기차 충전", title: "전기차 충전 인프라 확대 속도…정부 예산 투입", snippet: "정부가 전기차 충전소 확충에 수천억 원을 투자하기로 했다.", url: "https://example.com/naver/3", rankPosition: 3 },
  { platform: "naver", keyword: "AI 규제", title: "AI 규제 입법 논의 본격화…국회 소위 착수", snippet: "국회가 AI 규제 관련 입법 논의를 본격 시작했다.", url: "https://example.com/naver/4", rankPosition: 4 },
  { platform: "naver", keyword: "부동산 정책", title: "부동산 시장 안정화 방안 발표…대출 규제 완화", snippet: "정부가 부동산 안정화를 위한 대출 규제 완화 방안을 발표했다.", url: "https://example.com/naver/5", rankPosition: 5 },
  { platform: "naver", keyword: "삼성전자", title: "삼성전자 신형 갤럭시 공개…AI 기능 탑재", snippet: "삼성전자가 AI 기능을 대폭 강화한 신형 갤럭시를 공개했다.", url: "https://example.com/naver/6", rankPosition: 6 },
  { platform: "naver", keyword: "AI 스타트업", title: "국내 AI 스타트업 투자 유치 이어져…올해만 1조 돌파", snippet: "국내 AI 스타트업들이 올해 투자 유치 1조 원을 돌파했다.", url: "https://example.com/naver/7", rankPosition: 7 },
  { platform: "naver", keyword: "전기차 배터리", title: "국내 배터리 3사 기술 경쟁…에너지 밀도 신기록", snippet: "LG·삼성·SK 등 배터리 3사가 에너지 밀도 신기록 경쟁에 뛰어들었다.", url: "https://example.com/naver/8", rankPosition: 8 },
  { platform: "naver", keyword: "반도체 경기", title: "반도체 경기 회복 전망 밝아…내년 초 정점 예상", snippet: "반도체 경기 회복세가 뚜렷해지며 내년 초 정점에 달할 것으로 전망된다.", url: "https://example.com/naver/9", rankPosition: 9 },
  { platform: "naver", keyword: "금리 인하", title: "한국은행 금리 인하 기대감 상승…물가 안정 효과", snippet: "물가가 안정되며 한국은행의 금리 인하 기대감이 높아지고 있다.", url: "https://example.com/naver/10", rankPosition: 10 },
];

const MOCK_DAUM: RawTrendItem[] = [
  { platform: "daum", keyword: "AI 산업", title: "AI 산업 성장 가속화…세계 1위 경쟁 본격화", snippet: "미국·중국·한국이 AI 산업 주도권을 놓고 치열하게 경쟁하고 있다.", url: "https://example.com/daum/1", rankPosition: 1 },
  { platform: "daum", keyword: "반도체 수출", title: "반도체 수출 호조…국가 경제 견인", snippet: "반도체 수출이 증가세를 이어가며 국가 경제의 버팀목이 되고 있다.", url: "https://example.com/daum/2", rankPosition: 2 },
  { platform: "daum", keyword: "전기차 보조금", title: "전기차 보조금 정책 변화…구매 수요 영향은", snippet: "전기차 보조금 정책 변화가 구매 수요에 미칠 영향에 관심이 쏠린다.", url: "https://example.com/daum/3", rankPosition: 3 },
  { platform: "daum", keyword: "AI 윤리", title: "AI 윤리 규제 필요성 대두…업계도 자정 움직임", snippet: "AI 윤리 문제가 부각되며 정부와 업계 모두 규제 논의에 나섰다.", url: "https://example.com/daum/4", rankPosition: 4 },
  { platform: "daum", keyword: "부동산 대출", title: "부동산 대출 규제 완화 검토…시장 반응 엇갈려", snippet: "부동산 대출 규제 완화 방침에 시장 반응이 엇갈리고 있다.", url: "https://example.com/daum/5", rankPosition: 5 },
  { platform: "daum", keyword: "삼성 갤럭시", title: "삼성 갤럭시 S 시리즈 출시 임박…사전 예약 돌풍", snippet: "삼성 갤럭시 S 신제품 사전 예약이 역대 최고를 기록했다.", url: "https://example.com/daum/6", rankPosition: 6 },
  { platform: "daum", keyword: "AI 서비스", title: "AI 서비스 이용자 급증…하루 1000만 명 돌파", snippet: "국내 주요 AI 서비스 이용자가 하루 1000만 명을 돌파했다.", url: "https://example.com/daum/7", rankPosition: 7 },
  { platform: "daum", keyword: "전기차 시장", title: "전기차 시장 성장 지속…내연기관 추월 시점 앞당겨", snippet: "전기차 판매 증가로 내연기관 추월 시점이 예상보다 빨라질 전망이다.", url: "https://example.com/daum/8", rankPosition: 8 },
  { platform: "daum", keyword: "반도체 투자", title: "반도체 투자 증가세…팹리스·파운드리 동반 성장", snippet: "국내 반도체 투자가 증가하며 팹리스와 파운드리 모두 성장세다.", url: "https://example.com/daum/9", rankPosition: 9 },
  { platform: "daum", keyword: "경제 성장률", title: "경제 성장률 상향 전망…수출 회복 덕분", snippet: "수출 회복에 힘입어 올해 경제 성장률 전망이 상향 조정됐다.", url: "https://example.com/daum/10", rankPosition: 10 },
];

/**
 * mock 트렌드 후보를 반환한다.
 * TREND_COLLECTION_ENABLED=false일 때 실제 API 대신 사용한다.
 */
export function getMockTrendItems(): RawTrendItem[] {
  return [...MOCK_NAVER, ...MOCK_DAUM];
}

/** RawTrendItem → TrendCandidate 도메인 타입으로 변환한다. */
export function rawItemToCandidate(item: RawTrendItem, now: string): TrendCandidate {
  return {
    id: crypto.randomUUID(),
    platform: item.platform,
    keyword: item.keyword,
    title: item.title,
    snippet: item.snippet,
    url: item.url,
    rankPosition: item.rankPosition,
    collectedAt: now,
    createdAt: now,
  };
}
