// Phase 4-24: "플랫폼별 글 생성" 화면의 문체 설정 UI가 실제로 제출할
// hidden input 값을 계산하는 순수 함수. React state(useState)에서 분리해
// 여기 두면 jsdom/상호작용 테스트 없이도(이 프로젝트는 정적 렌더링
// 테스트만 지원한다) "플랫폼별 문체 직접 선택 모드에서 값이 정확히
// 계산되는지"를 직접 검증할 수 있다 — 컴포넌트(platform-selection-checkboxes.tsx)
// 는 이 함수의 결과를 그대로 hidden input으로 렌더링하기만 한다.

export type ToneSelectionUiMode = "auto_recommended" | "same_for_all" | "manual_per_platform";

export interface ComputeToneFormFieldsInput {
  toneMode: ToneSelectionUiMode;
  /** "전체 플랫폼에 같은 문체 적용" 드롭다운의 현재 선택값. */
  uniformToneStyle: string;
  /** platform → 사용자가 고른 tone_style(플랫폼별 직접 선택 모드의 각 드롭다운 상태). */
  perPlatformTone: Record<string, string>;
  /** 지금 체크된 플랫폼 목록(순서 보존) — "플랫폼별 직접 선택"은 이 목록에 있는 플랫폼만 제출한다. */
  checkedPlatforms: string[];
}

export interface ComputedToneFormFields {
  toneMode: ToneSelectionUiMode;
  /** same_for_all일 때만 값이 있다. */
  uniformToneStyle: string | null;
  /** manual_per_platform이고 체크된 플랫폼에 값이 있을 때만 채워진다(순서는 checkedPlatforms 순서). */
  perPlatformEntries: { platform: string; toneStyle: string }[];
}

/**
 * 화면 상태(라디오 선택/드롭다운 값/체크된 플랫폼)로부터 실제 폼에
 * 제출할 필드를 계산한다:
 * - auto_recommended: 아무 추가 필드도 만들지 않는다(서버가 플랫폼별
 *   추천 문체를 계산한다).
 * - same_for_all: uniformToneStyle 하나만 채운다.
 * - manual_per_platform: 지금 체크된 플랫폼에 한해서만, 값이 있는
 *   것만 perPlatformEntries에 담는다 — 선택 해제된 플랫폼의 문체
 *   값은(과거에 골라뒀던 값이 남아 있어도) 절대 제출하지 않는다.
 */
export function computeToneFormFields(input: ComputeToneFormFieldsInput): ComputedToneFormFields {
  if (input.toneMode === "same_for_all") {
    return {
      toneMode: "same_for_all",
      uniformToneStyle: input.uniformToneStyle || null,
      perPlatformEntries: [],
    };
  }

  if (input.toneMode === "manual_per_platform") {
    const perPlatformEntries = input.checkedPlatforms
      .filter((platform) => Boolean(input.perPlatformTone[platform]))
      .map((platform) => ({ platform, toneStyle: input.perPlatformTone[platform] }));
    return { toneMode: "manual_per_platform", uniformToneStyle: null, perPlatformEntries };
  }

  return { toneMode: "auto_recommended", uniformToneStyle: null, perPlatformEntries: [] };
}
