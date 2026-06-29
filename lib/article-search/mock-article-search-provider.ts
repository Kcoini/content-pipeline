// Phase 1-13: ARTICLE_SEARCH_ENABLED=false일 때 사용하는 mock 기사 URL 후보 제공자.
// theme.title / keywords를 반영한 mock 후보를 생성해 외부 API 없이 전체 흐름을 테스트할 수 있다.

import type { ArticleUrlCandidate } from "@/lib/types/domain";

const MOCK_PUBLISHERS = [
  "한국경제",
  "매일경제",
  "조선일보",
  "중앙일보",
  "연합뉴스",
  "뉴시스",
  "헤럴드경제",
  "이데일리",
];

const MOCK_TEMPLATES = [
  "{kw} 시장 성장세 이어져…올해 역대 최고 기록 전망",
  "{kw} 관련 기업 투자 급증…업계 재편 가속화",
  "{title} 최신 동향…전문가들 엇갈린 전망",
  "{kw} 정책 변화 본격화…산업계 대응 분주",
  "{kw} 기술 혁신 가속…새로운 패러다임 등장",
  "{title} 현황과 과제…심층 분석",
  "{kw} 글로벌 경쟁 치열…한국 위상은",
  "{kw} 수요 급증…공급망 재정비 나서",
];

const MOCK_SNIPPETS = [
  "관련 시장이 빠르게 성장하며 국내외 기업들의 경쟁이 치열해지고 있다. 전문가들은 당분간 이 추세가 이어질 것으로 내다보고 있다.",
  "최근 발표된 통계에 따르면 관련 투자가 전년 대비 30% 이상 증가했다. 업계는 이번 흐름을 구조적 변화의 시작으로 보고 있다.",
  "정부가 관련 정책을 정비하기 시작하면서 산업계의 대응도 빨라지고 있다. 규제 완화와 지원 확대가 동시에 논의되고 있다.",
  "주요 기업들이 연구개발 투자를 확대하며 새로운 시장 선점에 나섰다. 기술 격차가 경쟁 우위를 결정짓는 핵심 요인으로 부상했다.",
  "국내 시장의 빠른 성장에도 불구하고 글로벌 경쟁자들과의 격차는 여전히 존재한다는 분석이 나왔다.",
  "전문가들은 당면 과제를 해결하지 않으면 중장기 경쟁력이 약화될 수 있다고 경고하고 있다.",
];

function pickRandom<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

export interface MockArticleSearchInput {
  themeId: string;
  themeTitle: string;
  keywords: string[];
  query: string;
  platform: "naver" | "daum";
  count: number;
  baseRank: number;
}

/** mock 기사 URL 후보를 생성한다 (최소 count건). */
export function generateMockArticleCandidates(
  input: MockArticleSearchInput,
  now: string
): Omit<ArticleUrlCandidate, "id">[] {
  const { themeId, themeTitle, keywords, query, platform, count, baseRank } = input;
  const kw = keywords[0] ?? themeTitle;

  const results: Omit<ArticleUrlCandidate, "id">[] = [];

  for (let i = 0; i < count; i++) {
    const seed = i + baseRank + themeTitle.length;
    const template = pickRandom(MOCK_TEMPLATES, seed + i);
    const snippet = pickRandom(MOCK_SNIPPETS, seed + i + 3);
    const publisher = pickRandom(MOCK_PUBLISHERS, seed + i + 5);

    const title = template
      .replace("{kw}", kw)
      .replace("{title}", themeTitle);

    results.push({
      themeId,
      themeClusterId: null,
      platform,
      query,
      title,
      snippet,
      url: `https://mock.example.com/${platform}/${themeId.slice(0, 8)}-${i + baseRank}`,
      publisher,
      publishedAt: null,
      rankPosition: i + baseRank + 1,
      status: "candidate",
      metadata: { source: "mock", keyword: kw },
      collectedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return results;
}
