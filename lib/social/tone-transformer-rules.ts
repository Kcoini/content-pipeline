// Phase 3-3: tone_style별 변환 규칙을 코드로 정의한다.
// 실제 AI 생성 시에는 prompts/tones/*.md가 문체를 지시하지만, mock 생성
// 모드에서도 문체 차이가 실제로 드러나도록 이 파일의 규칙을 결정론적으로
// 적용한다 ("협박형"은 애초에 ToneStyle에 존재하지 않으므로 다룰 필요가 없다).

import type { ToneStyle } from "./social-platform-types";

export interface ToneTransformerRule {
  toneStyle: ToneStyle;
  /** 사람이 읽는 작성 가이드 (prompts/tones/*.md 요약) */
  guidance: string[];
  /** 이 문체에서 특히 금지되는 표현 (공통 금지 표현 외 추가분) */
  bannedPhrases: string[];
  /** mock 생성 시 본문 앞에 붙이는 문체별 도입 문구 */
  opening: string;
  /** mock 생성 시 본문 뒤에 붙이는 문체별 마무리 문구 */
  closing: string;
}

export const TONE_TRANSFORMER_RULES: Record<ToneStyle, ToneTransformerRule> = {
  explanatory: {
    toneStyle: "explanatory",
    guidance: ["배경, 원인, 구조를 차분히 설명한다.", "자극적 표현을 금지한다."],
    bannedPhrases: [],
    opening: "차근차근 설명하면,",
    closing: "이렇게 정리할 수 있습니다.",
  },
  informational: {
    toneStyle: "informational",
    guidance: ["핵심 정보, 숫자, 기준, 체크리스트 중심으로 정리한다.", "감정적 표현을 최소화한다."],
    bannedPhrases: [],
    opening: "핵심 정보를 정리하면,",
    closing: "이상이 확인된 기준입니다.",
  },
  persuasive: {
    toneStyle: "persuasive",
    guidance: ["부드럽게 행동을 권유한다.", "강압적 표현을 금지한다."],
    bannedPhrases: ["당장 결정하지 않으면", "마지막 기회"],
    opening: "이런 이유로 살펴볼 가치가 있습니다:",
    closing: "한 번 검토해 보시길 권합니다.",
  },
  warning: {
    toneStyle: "warning",
    guidance: [
      "주의할 점, 놓치기 쉬운 위험을 강조한다.",
      "협박/공포 조장을 금지한다.",
      "\"반드시 안 하면 큰일\" 식 표현을 금지한다.",
    ],
    bannedPhrases: ["큰일 납니다", "당장 하지 않으면"],
    opening: "다음은 놓치기 쉬운 주의사항입니다:",
    closing: "미리 확인해 두면 도움이 됩니다.",
  },
  loss_aversion: {
    toneStyle: "loss_aversion",
    guidance: [
      "놓치면 손해 볼 수 있는 포인트를 강조한다.",
      "허위 손실/과장 손실을 금지한다.",
      "합리적인 근거가 있는 손실만 표현한다.",
    ],
    bannedPhrases: ["모르면 큰일", "지금 안 하면 후회"],
    opening: "모르면 놓칠 수 있는 부분이 있습니다:",
    closing: "확인해 두면 손해를 피할 수 있습니다.",
  },
  curiosity: {
    toneStyle: "curiosity",
    guidance: ["질문, 반전, 비교를 활용한다.", "낚시성 제목을 금지한다."],
    bannedPhrases: ["충격", "경악"],
    opening: "혹시 이런 점 알고 계셨나요?",
    closing: "생각보다 흥미로운 부분이었습니다.",
  },
  comparison: {
    toneStyle: "comparison",
    guidance: ["A/B를 비교한다.", "장단점, 선택 기준 중심으로 서술한다."],
    bannedPhrases: [],
    opening: "두 가지를 비교해 보면,",
    closing: "선택 기준을 참고해 결정해 보세요.",
  },
  story: {
    toneStyle: "story",
    guidance: ["사례나 상황으로 시작한다.", "자연스럽게 정보 제공으로 연결한다."],
    bannedPhrases: [],
    opening: "예를 들어 이런 상황이라면,",
    closing: "이런 흐름으로 이해하면 도움이 됩니다.",
  },
};

export function getToneTransformerRule(toneStyle: ToneStyle): ToneTransformerRule {
  return TONE_TRANSFORMER_RULES[toneStyle];
}

/**
 * mock 생성 시 문체 차이를 실제로 반영하기 위해 본문에 문체별 도입/마무리
 * 문구를 결정론적으로 적용한다. 실제 AI 생성 시에는 prompts/tones/*.md가
 * 이 역할을 대신하므로 이 함수를 사용하지 않는다.
 */
export function applyToneTransform(toneStyle: ToneStyle, body: string): string {
  const rule = getToneTransformerRule(toneStyle);
  return `${rule.opening} ${body} ${rule.closing}`.trim();
}
