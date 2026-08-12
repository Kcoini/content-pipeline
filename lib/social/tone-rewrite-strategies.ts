// Phase 3-10: 문체별 rewrite(개선) 전략.
// 협박형 문체는 존재하지 않으며, warning/loss_aversion도 위협이 아닌
// 경고형/손실회피형 개선 방향만 제공한다.

import type { ToneStyle } from "./social-platform-types";

export interface ToneRewriteStrategy {
  toneStyle: ToneStyle;
  improvementDirections: string[];
}

const TONE_REWRITE_STRATEGIES: Record<ToneStyle, string[]> = {
  explanatory: ["더 쉽게 풀어쓰기", "배경-원인-결과 구조 명확화"],
  informational: ["핵심 정보와 체크리스트 강화", "숫자/기준/요약 강화"],
  persuasive: ["부드러운 권유 강화", "강압적 표현 제거"],
  warning: ["위험을 설명하되 위협하지 않기", "근거 없는 공포 표현 제거"],
  loss_aversion: ["놓치면 손해 볼 수 있는 기준 제시", "과장 손실 표현 제거"],
  curiosity: ["첫 문장 질문 강화", "낚시성 표현 제거"],
  comparison: ["비교 기준 명확화", "장단점 균형 유지"],
  story: ["사례 도입 강화", "정보 전달로 자연스럽게 연결"],
};

/** 문체별 개선 방향(문자열 목록)을 반환한다. 협박형은 존재하지 않는다. */
export function getToneRewriteStrategy(toneStyle: ToneStyle): ToneRewriteStrategy {
  return { toneStyle, improvementDirections: TONE_REWRITE_STRATEGIES[toneStyle] };
}
