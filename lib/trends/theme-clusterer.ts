// Phase 1-12: mock 트렌드 후보에서 공통 키워드 그룹을 찾아 ThemeCluster 후보를 생성한다.
// 키워드 빈도 기반 단순 클러스터링 - 실제 API 연결 전에도 흐름 전체를 검증할 수 있다.

import type { RawTrendItem } from "./mock-trend-provider";
import type { ThemeCluster } from "@/lib/types/domain";

interface KeywordGroup {
  id: string;
  title: string;
  description: string;
  keywords: string[];
}

const KEYWORD_GROUPS: KeywordGroup[] = [
  {
    id: "ai",
    title: "AI 산업 동향",
    description: "인공지능 기술, 서비스, 규제, 스타트업 등 AI 분야 전반의 최신 동향",
    keywords: ["AI", "인공지능", "에이전트", "LLM", "AI 규제", "AI 윤리", "AI 서비스", "AI 스타트업", "AI 산업"],
  },
  {
    id: "semiconductor",
    title: "반도체 시장 및 수출",
    description: "반도체 수출 실적, 투자, 경기 회복 등 한국 반도체 산업 현황",
    keywords: ["반도체", "칩", "파운드리", "팹리스", "D램", "HBM", "NAND"],
  },
  {
    id: "ev",
    title: "전기차·배터리 산업",
    description: "전기차 보조금, 충전 인프라, 배터리 기술 경쟁 등 친환경 모빌리티 동향",
    keywords: ["전기차", "배터리", "충전", "보조금", "EV", "내연기관", "이차전지"],
  },
  {
    id: "realestate",
    title: "부동산·대출 정책",
    description: "부동산 시장 안정화, 대출 규제, 주택 공급 관련 정책 동향",
    keywords: ["부동산", "대출", "주택", "분양", "전세", "청약", "LTV", "DSR"],
  },
  {
    id: "finance",
    title: "금리·경제 성장률",
    description: "한국은행 금리 결정, GDP 성장률, 무역수지, 경기 전망",
    keywords: ["금리", "경제", "성장률", "물가", "인플레이션", "무역수지", "GDP", "한국은행"],
  },
  {
    id: "bigtech",
    title: "빅테크·스마트폰",
    description: "삼성, LG 등 국내 빅테크 기업 신제품 및 경쟁 동향",
    keywords: ["삼성", "갤럭시", "LG", "스마트폰", "반도체 투자", "애플", "구글"],
  },
];

function matchesGroup(item: RawTrendItem, group: KeywordGroup): boolean {
  const text = `${item.keyword} ${item.title} ${item.snippet}`.toLowerCase();
  return group.keywords.some((kw) => text.includes(kw.toLowerCase()));
}

export interface ClusterCandidate {
  group: KeywordGroup;
  naverCount: number;
  daumCount: number;
  score: number;
  matchedKeywords: string[];
}

export function clusterTrendItems(items: RawTrendItem[]): ClusterCandidate[] {
  const naverItems = items.filter((it) => it.platform === "naver");
  const daumItems = items.filter((it) => it.platform === "daum");

  const candidates: ClusterCandidate[] = [];

  for (const group of KEYWORD_GROUPS) {
    const naverCount = naverItems.filter((it) => matchesGroup(it, group)).length;
    const daumCount = daumItems.filter((it) => matchesGroup(it, group)).length;

    if (naverCount === 0 && daumCount === 0) continue;

    const crossBonus = naverCount > 0 && daumCount > 0 ? 3 : 0;
    const score = naverCount + daumCount + crossBonus;

    const matchedKeywords = group.keywords.filter((kw) =>
      items.some((it) =>
        `${it.keyword} ${it.title} ${it.snippet}`.toLowerCase().includes(kw.toLowerCase())
      )
    );

    candidates.push({ group, naverCount, daumCount, score, matchedKeywords });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

export function candidateToThemeCluster(candidate: ClusterCandidate, now: string): Omit<ThemeCluster, "id"> {
  return {
    title: candidate.group.title,
    description: candidate.group.description,
    keywords: candidate.matchedKeywords.slice(0, 5),
    naverCount: candidate.naverCount,
    daumCount: candidate.daumCount,
    score: candidate.score,
    status: "candidate",
    createdAt: now,
    updatedAt: now,
  };
}
