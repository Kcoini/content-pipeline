# Phase 4-24: "플랫폼별 문체 직접 선택" 완성 + 결과 표시 정리

## 문제

Phase 4-23에서 문체 설정 UI(추천 자동 적용/전체 동일/플랫폼별 직접
선택)를 추가했지만, 사용자가 보기에 "전체 플랫폼에 같은 문체
적용"만 확실히 동작하고 "플랫폼별 문체 직접 선택"은 완성도가
부족해 보인다는 보고가 있었다.

## 조사 결과

코드를 다시 정독한 결과 `PlatformSelectionCheckboxes`의 per_platform
모드 자체(체크된 플랫폼만 드롭다운 표시, 체크 해제 시 해당 플랫폼
`toneStyle_*` hidden input 미생성, `parseToneSelectionInputs`/
`resolveToneStyleForPlatform`의 처리 순서)는 **정적 리뷰로는 로직
오류를 찾지 못했다**. 다만 다음 두 가지는 실제로 확인된, 사용자가
"제대로 동작하지 않는 것처럼 보인다"고 느낄 만한 근거 있는 문제였다:

1. **생성 결과 메시지가 raw enum을 그대로 보여주고, 적용된 문체를
   전혀 보여주지 않았다.** `formatPlatformGenerationSummary()`가
   `${r.platform}: 생성 완료`처럼 `wordpress_blog` raw 값만 보여주고
   실제로 어떤 tone_style이 적용됐는지는 어디에도 나타나지 않아서,
   "플랫폼별로 다른 문체를 정말 적용한 게 맞나"를 사용자가 결과
   화면에서 확인할 방법이 없었다 — 실제로 정상 동작해도 "동작하는지
   확인이 안 되니 안 되는 것처럼 보인다."
2. **per_platform 로직이 React state 클로저 안에만 있어 직접
   테스트된 적이 없었다.** 이 프로젝트는 jsdom/상호작용 테스트
   인프라가 없어(정적 렌더링 검사만 가능), "체크 해제하면 hidden
   input이 사라지는가" 같은 상태 전이는 이전까지 실제로 검증되지
   않은 채 코드 리뷰에만 의존하고 있었다.

## 해결

### 1) 결과 메시지에 적용된 문체 표시 (실제 확인된 gap 수정)

`lib/social/multi-platform-generation-service.ts`: `PlatformGenerationOutcome`
에 `toneStyle` 필드를 추가하고, 생성/실패 각각에 실제 적용된
tone_style을 담아 반환한다(기존에도 로그에는 `platform_generation_tone_*`
이벤트로 남기고 있었지만, 반환값 요약에는 없었다).

`app/articles/[id]/actions.ts`의 `formatPlatformGenerationSummary()`:
- `PLATFORM_LABELS[r.platform]`(한국어 플랫폼명)과
  `TONE_STYLE_CONFIGS[r.toneStyle].label`(한국어 문체명)을 사용한다 —
  raw enum을 더 이상 그대로 보여주지 않는다.
- 생성 완료된 플랫폼에는 `WordPress 블로그: 생성 완료 (설명형)`처럼
  실제 적용 문체를 함께 보여준다.

### 2) per_platform 로직을 순수 함수로 분리해 직접 테스트

`lib/social/platform-tone-selection-ui-state.ts`(신규)의
`computeToneFormFields()`가 "화면 상태(라디오/드롭다운/체크된
플랫폼) → 실제 제출할 hidden input 값"을 계산하는 로직을 React
state 밖으로 뺐다:

- `auto_recommended`: 추가 필드 없음.
- `same_for_all`: `uniformToneStyle` 하나만.
- `manual_per_platform`: **지금 체크된 플랫폼만**, 값이 있는 것만
  `{platform, toneStyle}` 목록으로 반환한다 — 체크 해제된 플랫폼의
  이전 선택값이 남아 있어도 절대 포함하지 않는다.

`components/articles/platform-selection-checkboxes.tsx`는 이제 이
함수의 결과를 그대로 hidden input으로 렌더링만 한다. jsdom 없이도
"체크 해제 시 문체 값이 제출되지 않는가"/"빈 값은 제외되는가" 같은
핵심 시나리오를 7개 테스트로 직접 검증할 수 있게 됐다.

### 3) `resolveToneStyleForPlatform` export + 직접 단위 테스트

기존에 `multi-platform-generation-service.ts` 안에 비공개
함수였던 `resolveToneStyle`을 `resolveToneStyleForPlatform`으로
이름을 바꿔 export했다(스펙이 요청한 helper 이름과 일치). 기존
`generatePlatformPosts()`를 통한 간접 테스트 외에, 이 함수 자체를
직접 호출하는 단위 테스트 5개를 추가해 우선순위(수동 지정 → 전체
동일 문체 → 추천 문체) 하나하나를 확인했다.

### 4) "추천 문체 자동 적용" 미리보기

`auto_recommended` 모드에서도 결과를 예측할 수 있도록, 체크된
플랫폼마다 "WordPress 블로그: 설명형"처럼 적용 예정 문체를
미리보기로 보여준다(스펙 7번 요구사항).

### 5) 네이버 카페 prompt에 문체 완화 규칙 명시 (실제 확인된 gap 수정)

`prompts/social/naver-cafe.md`의 "tone_style 반영 방식" 절이
"`prompts/tones/*.md`를 따르되 커뮤니티 문체로 조정한다"는 일반
안내만 있고, **persuasive/loss_aversion을 구체적으로 어떻게
완화하는지는 명시돼 있지 않았다** — 이번에 명시적으로 추가했다:
persuasive → "의견을 묻는 질문형", loss_aversion → "경험 공유 +
부드러운 안내". 다른 tone_style(story/curiosity/explanatory 등)은
이미 이 문서의 "구조 원칙"과 자연스럽게 맞아 추가 완화 규칙이
필요하지 않았다.

## 안전 원칙

- 자동 public publish는 이 변경과 무관하다.
- 문체가 무엇으로 지정되든 각 플랫폼 prompt의 안전 규칙(광고성 표현
  금지, 출처 없는 단정 금지 등)은 그대로 유지된다 — 이번 변경은
  "표현 강도"만 완화하는 지침을 보강했을 뿐이다.
- 기존 `generateSelectedPlatformPostsAction`/
  `generateAllPlatformPostsAction`의 폼 필드 계약(`toneMode`/
  `uniformToneStyle`/`toneStyle_${platform}`)은 전혀 바꾸지 않았다.

## 이번 작업에서 하지 않은 것 (범위)

- "이미 생성된 플랫폼 재생성" 전용 UI 개선(스펙 12번)은 하지 않았다
  — 기존 "이미 생성됨 — 건너뜀" 안내와 블로그/SNS 관리 화면의 개별
  재생성 흐름이 이미 있어, 문체 선택 기능 자체와는 별개 작업으로
  판단했다.
- "전체 플랫폼 글 생성"(고급 옵션) 폼에 문체 설정 UI 연결(스펙
  13번)은 여전히 하지 않았다 — Phase 4-23에서와 같은 이유(비용
  경고가 핵심, UI 복잡도 최소화)로 유지했다. 다만 `resolveToneStyleForPlatform`
  가 export되어 있어, 나중에 이 폼에도 UI를 붙이면 바로 재사용할 수
  있다.
- Job Progress 연동(스펙 15번)은 하지 않았다 — Phase 4-17/4-22와
  같은 이유로, 이 생성 흐름은 이미 `platform_generation_*` 이벤트로
  단계별 로그를 남기고 있어 별도 진행 상황 UI 없이도 사후 확인이
  가능하다고 판단했다.

## 테스트

- `lib/social/platform-tone-selection-ui-state.test.ts`(신규, 7개):
  모드별 필드 계산, 체크 해제된 플랫폼 값 미제출, 빈 값 제외.
- `lib/social/multi-platform-generation-service.test.ts`: 새 describe
  1개(5개 테스트, `resolveToneStyleForPlatform` 직접 호출) 추가.
  12 → 17개 통과.
- `components/articles/platform-selection-checkboxes.test.tsx`: 새
  테스트 1개(추천 문체 미리보기) 추가. 6 → 7개 통과.
- `app/articles/[id]/actions.test.ts`: 새 describe 1개(2개 테스트,
  `formatPlatformGenerationSummary`의 한국어 라벨/적용 문체 표시)
  추가. 74 → 76개 통과.
- `lib/social/social-prompt-files.test.ts`: 새 테스트 1개(네이버
  카페 persuasive/loss_aversion 완화 규칙) 추가. 45 → 46개 통과.
- 전체 `npx vitest run`: 251 files / 3231 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류. `npm run build`: 성공.

## 관련 문서

- [`phase-4-23-platform-tone-selection-ui.md`](./phase-4-23-platform-tone-selection-ui.md) — 문체 설정 UI의 원출처
- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)
