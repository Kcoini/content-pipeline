# Phase 4-23: 플랫폼별 글 생성 화면에 문체 설정 UI 추가

## 문제

`/articles/[id]`의 "플랫폼별 글 생성" 섹션에서 플랫폼(어디에 올릴
글인가)은 체크박스로 고를 수 있었지만, 문체(어떤 말투와 구성으로
쓸 것인가)는 항상 `<input type="hidden" name="toneMode"
value="auto_recommended" />`로 고정되어 있어 사용자가 바꿀 방법이
없었다.

## 조사 결과 — 백엔드는 이미 완성되어 있었다

`toneMode`/문체 관련 요구사항(추천 자동 적용/전체 동일 문체/플랫폼별
직접 선택, 플랫폼별 추천 tone_style 계산, action에 대한 전달)은
**전부 이미 구현되어 있었다**:

- `lib/social/multi-platform-generation-service.ts`: `ToneSelectionMode`
  = `"auto_recommended" | "same_for_all" | "manual_per_platform"`,
  `PlatformGenerationRequest.uniformToneStyle`/`toneStylesByPlatform`,
  `resolveToneStyle()`가 이 스펙이 요구하는 우선순위(수동 지정 →
  없으면 추천 문체로 안전하게 대체)를 그대로 구현하고 있었다.
- `lib/social/platform-generation-recommendations.ts`:
  `getRecommendedToneForPlatform(platform)`(플랫폼별 추천 tone_style
  1개)과 `RECOMMENDED_TONE_STYLES_BY_PLATFORM`(플랫폼별 권장 목록)이
  이미 있었다.
- `app/articles/[id]/actions.ts`: `generateSelectedPlatformPostsAction`/
  `generateAllPlatformPostsAction` 둘 다 이미 `parseToneSelectionInputs()`
  로 `toneMode`/`uniformToneStyle`/`toneStyle_${platform}` 폼 필드를
  읽어 서비스에 그대로 전달하고 있었다 — **폼에 이 필드들을 채워
  보내는 UI만 없었다.**
- 생성된 카드의 문체 라벨 표시(`TONE_STYLE_CONFIGS[post.toneStyle].label`)
  도 이미 이전 phase(4-16/4-18/4-19)에서 한국어로 정리되어 있었다.

즉 이번 작업은 **새 백엔드 로직이 아니라 UI 하나만 만들면 되는
작업**이었다.

## 해결

### `PlatformSelectionCheckboxes`에 `toneSelection` prop 추가

`components/articles/platform-selection-checkboxes.tsx`(기존
컴포넌트)에 선택적 `toneSelection` prop을 추가했다:

```tsx
<PlatformSelectionCheckboxes options={platformSelectionOptions} toneSelection={toneSelectionConfig} />
```

- `toneSelection`을 넘기지 않으면 기존과 완전히 동일하게 체크박스만
  렌더링한다(대시보드의 두 사용처는 그대로 유지 — 아래 "이번 작업에서
  하지 않은 것" 참고).
- 넘기면 체크박스 아래에 "문체 설정" 영역을 함께 렌더링한다: 라디오
  3개(추천 문체 자동 적용/전체 플랫폼에 같은 문체 적용/플랫폼별 문체
  직접 선택), 각각 선택했을 때만 드롭다운이 펼쳐진다.
- "플랫폼별 문체 직접 선택"은 **지금 체크된 플랫폼만** 보여준다 —
  플랫폼 체크 상태와 문체 상태를 같은 컴포넌트가 들고 있어야 이게
  가능해서, 두 기능을 형제 컴포넌트로 분리하지 않고 한 컴포넌트
  안에 두었다(상태를 부모로 끌어올리는 것보다 간단하다).
- 실제로 서버 action이 읽는 값(`toneMode`/`uniformToneStyle`/
  `toneStyle_${platform}`)은 화면에 보이는 라디오/드롭다운 상태를
  그대로 반영하는 `<input type="hidden">`로 렌더링한다 — 기존
  `parseToneSelectionInputs()`를 단 한 줄도 바꾸지 않았다.

### 한국어 라벨 재사용

`TONE_STYLE_CONFIGS[toneStyle].label`(기존, `lib/social/tone-style-config.ts`)
을 그대로 재사용해 드롭다운에 "설명형"/"정보형"/"설득형"/
"주의환기형"/"손실회피형"/"호기심형"/"비교형"/"스토리형"을 보여준다
— 새 라벨 표를 만들지 않았다.

### `app/articles/[id]/page.tsx` 적용

"선택한 플랫폼 글 생성" 폼에서 고정된 `toneMode` hidden input을
지우고, `toneSelectionConfig`(`toneStyleOptions` + 플랫폼별 추천
tone_style)를 만들어 `PlatformSelectionCheckboxes`에 전달했다.

## 안전 원칙

- 자동 public publish는 이 변경과 무관하다.
- 플랫폼에 맞지 않는 문체가 선택되어도 각 플랫폼 prompt
  (`prompts/social/*.md`)가 이미 안전하게 완화해서 해석한다(예:
  naver_cafe + 설득형은 강한 설득이 아니라 질문 유도형으로) — 이번에
  prompt를 새로 바꾸지 않았다(이미 이런 원칙으로 작성되어 있었다).
- 기존 플랫폼 선택/생성 action은 전혀 바꾸지 않았다 — 새 UI가 기존
  폼 필드 계약에 맞춰 값을 채워 보낼 뿐이다.

## 이번 작업에서 하지 않은 것 (범위)

- **`app/dashboard/page.tsx`의 두 "플랫폼별 글 생성" 폼에는 문체
  설정 UI를 추가하지 않았다.** 이 페이지는 이미 "문체를 직접 고르고
  싶다면 기사 상세 페이지의 플랫폼별 글 생성 영역에서 고급 옵션을
  사용하세요"라는 기존 안내 문구로, 대시보드는 단순하게 유지하고
  세부 조정은 기사 상세 페이지로 안내하는 설계가 이미 되어 있었다
  — 이번 스펙의 "화면이 복잡해지지 않도록 기본 화면은 간단하게
  유지한다" 원칙과도 일치해 그대로 따랐다.
- **"전체 플랫폼 글 생성"(`generateAllPlatformPostsAction`, 고급
  옵션) 폼에는 문체 설정 UI를 추가하지 않았다** — 여전히
  `toneMode=auto_recommended` 고정이다. 이 버튼은 비용 경고가
  핵심(스펙 11번도 "여전히 고급 옵션으로 유지"를 강조)이라, 같은
  복잡한 UI를 두 번 반복하기보다 필요하면 "선택한 플랫폼 글
  생성"으로 문체를 먼저 정하고 개별 진행하는 것을 권장하는 기존
  안내를 유지했다.
- **`toneMode`/`toneStyle` 선택 상태의 DB 저장**은 하지 않았다 —
  스펙 12번이 명시한 대로 1차 구현에서는 필수가 아니며, 폼 제출
  시점에만 값이 전달되면 충분하다(제출 후에는 매번 기본값에서
  다시 시작한다).

## 테스트

- `components/articles/platform-selection-checkboxes.test.tsx`(신규,
  6개): `toneSelection` 미전달 시 기존 동작 보존, 기본값(추천 문체
  자동 적용), raw enum 미노출, 기본 화면에서 드롭다운 미노출(선택
  시에만 펼침), 안내 문구 존재.
- `app/articles/[id]/page.test.ts`: 새 describe 1개(4개 테스트,
  정적 소스 검사) 추가 — `toneSelection` 전달 여부, 한국어 라벨
  재사용, 기존 추천 함수 재사용, 고정 hidden input 중복 제거 확인.
  53 → 57개 통과.
- 전체 `npx vitest run`: 250 files / 3215 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류. `npm run build`: 성공.

## 후속: "플랫폼별 문체 직접 선택" 완성 (Phase 4-24)

이 문서가 처음 만든 UI의 per_platform 모드를 순수 함수
(`computeToneFormFields`)로 분리해 직접 테스트했고, 생성 결과
메시지에 raw enum 대신 적용된 문체를 한국어로 보여주도록 정리했다.
자세한 내용은 [`phase-4-24-platform-tone-selection-completion.md`](./phase-4-24-platform-tone-selection-completion.md) 참고.

## 관련 문서

- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)
- [`phase-3-21-platform-generation-flow.md`](./phase-3-21-platform-generation-flow.md) — `ToneSelectionMode`/`getRecommendedToneForPlatform`의 원출처로 추정되는 "테마 → 출처 → 플랫폼별 글 생성" 흐름
- [`phase-4-24-platform-tone-selection-completion.md`](./phase-4-24-platform-tone-selection-completion.md) — per_platform 모드 완성 + 결과 표시 정리
