// Phase 3-1: 문체(tone style)별 설정.
// "협박형(threat)" 문체는 이 시스템에 존재하지 않는다 — 위험/손실을 알릴
// 때는 warning/loss_aversion처럼 사실 기반으로 위험을 인지시키되 공포를
// 조장하거나 협박하지 않는 risk-aware 방식만 사용한다.

import type { ToneStyle, ToneStyleConfig } from "./social-platform-types";
import { BASE_PROHIBITED_PATTERNS } from "./platform-writing-config";

/** 이 시스템에서 절대 사용하지 않는 문체 (참고용 — ToneStyle 타입에도 포함되지 않는다). */
export const PROHIBITED_TONE_STYLES: readonly string[] = [
  "threat",
  "fearmongering",
  "harassment",
  "scam-like persuasion",
  "guaranteed income claim",
];

export const TONE_STYLE_CONFIGS: Record<ToneStyle, ToneStyleConfig> = {
  explanatory: {
    toneStyle: "explanatory",
    label: "설명형",
    description: "배경과 구조를 차분하게 설명한다.",
    guidance: ["차분한 어조를 유지한다.", "과도한 자극적 표현을 피한다.", "논리적인 순서로 설명한다."],
    prohibitedPatterns: [...BASE_PROHIBITED_PATTERNS],
  },
  informational: {
    toneStyle: "informational",
    label: "정보형",
    description: "핵심 정보, 숫자, 기준, 체크리스트 중심으로 정리한다.",
    guidance: ["수치와 기준을 명확히 제시한다.", "체크리스트/목록 형태를 적극 활용한다.", "불필요한 수식어를 줄인다."],
    prohibitedPatterns: [...BASE_PROHIBITED_PATTERNS],
  },
  persuasive: {
    toneStyle: "persuasive",
    label: "설득형",
    description: "독자가 행동하도록 부드럽게 유도한다.",
    guidance: ["강압적이거나 재촉하는 표현을 쓰지 않는다.", "근거를 먼저 제시하고 행동을 권유한다."],
    prohibitedPatterns: [...BASE_PROHIBITED_PATTERNS, "당장 결정하지 않으면", "마지막 기회"],
  },
  warning: {
    toneStyle: "warning",
    label: "주의환기형",
    description: "놓치기 쉬운 위험이나 주의점을 사실 기반으로 알려준다.",
    guidance: [
      "실제로 확인된 위험/주의사항만 다룬다.",
      "협박, 공포 조장, 과장된 표현을 쓰지 않는다.",
      "대안이나 대응 방법을 함께 제시한다.",
    ],
    prohibitedPatterns: [...BASE_PROHIBITED_PATTERNS, "큰일 납니다", "당장 안 하면 큰 손해"],
  },
  loss_aversion: {
    toneStyle: "loss_aversion",
    label: "손실회피형",
    description: "모르면 손해 볼 수 있는 포인트를 사실 기반으로 강조한다.",
    guidance: [
      "실제로 확인된 손실 가능성만 다룬다.",
      "허위 손실, 과장된 손실, 공포 조장 표현을 쓰지 않는다.",
      "손실을 피하는 구체적인 방법을 함께 제시한다.",
    ],
    prohibitedPatterns: [...BASE_PROHIBITED_PATTERNS, "모르면 큰일", "지금 안 하면 후회"],
  },
  curiosity: {
    toneStyle: "curiosity",
    label: "호기심형",
    description: "질문, 반전, 비교를 통해 궁금증을 만든다.",
    guidance: ["질문이나 반전 요소로 흥미를 유발한다.", "낚시성(내용과 무관한 자극적 제목) 표현을 쓰지 않는다."],
    prohibitedPatterns: [...BASE_PROHIBITED_PATTERNS, "충격", "경악"],
  },
  comparison: {
    toneStyle: "comparison",
    label: "비교형",
    description: "A와 B를 비교해서 독자의 선택을 돕는다.",
    guidance: ["비교 기준을 명확히 제시한다.", "공정하게 장단점을 함께 설명한다."],
    prohibitedPatterns: [...BASE_PROHIBITED_PATTERNS],
  },
  story: {
    toneStyle: "story",
    label: "스토리형",
    description: "사례나 상황으로 시작해서 자연스럽게 설명으로 이어간다.",
    guidance: ["구체적인 사례나 상황 묘사로 시작한다.", "사례에서 자연스럽게 핵심 설명으로 연결한다."],
    prohibitedPatterns: [...BASE_PROHIBITED_PATTERNS],
  },
};

export function getToneStyleConfig(toneStyle: ToneStyle): ToneStyleConfig {
  return TONE_STYLE_CONFIGS[toneStyle];
}

/** toneStyle → `prompts/tones/*.md` 파일명 매핑 (Phase 3-2, loss_aversion만 하이픈 표기). */
export const TONE_PROMPT_FILENAMES: Record<ToneStyle, string> = {
  explanatory: "explanatory.md",
  informational: "informational.md",
  persuasive: "persuasive.md",
  warning: "warning.md",
  loss_aversion: "loss-aversion.md",
  curiosity: "curiosity.md",
  comparison: "comparison.md",
  story: "story.md",
};

export function getToneStylePromptFilename(toneStyle: ToneStyle): string {
  return TONE_PROMPT_FILENAMES[toneStyle];
}
