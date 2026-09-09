# Phase 3-26: 단일 글 상세 검토·수정 UI 개선

## 배경

`/social-posts/[id]`는 Phase 3-17~3-25를 거치며 "읽기 전용 상세 조회
화면"으로 발전해 왔다(returnTo 딥링크, 자동 검토 리포트 표시 등). 이번
작업은 이 페이지의 역할을 근본적으로 바꾼다 — **단일 플랫폼 글 하나를
"게시용 본문 확인 → 자동 검토 확인 → 필요시 수정 → 재검토 → 최종
승인 → export/Draft 준비"까지 한 화면에서 끝낼 수 있는 최종
검토·수정·승인 화면**으로 만든다.

이번 phase는 `/social-posts/[id]` 한 페이지만 대상으로 한다.
`/dashboard`, `/articles/[id]/blog`, `/articles/[id]/social`,
`/articles/[id]/rewrite`에는 적용하지 않았지만, 새로 만든 helper들은
모두 순수 함수라서 그대로 재사용할 수 있다.

## 핵심 설계 결정: 새 저장소/새 검사 엔진을 만들지 않는다

- **본문 표시 우선순위**는 Phase 3-19의 `getSocialPostDisplayBody()`를
  그대로 재사용한다(x→threadItems, naver_cafe→sanitize된 postBody,
  나머지→config 기준 postBody/caption 우선순위). 새로 만들지 않았다.
- **"수정 후 재검토 필요" 상태**는 별도로 저장하지 않는다.
  `editSocialPostContent()`가 수정 시 이미 `quality_status`를
  `not_checked`로 초기화하고 있다(`lib/repositories/social-posts-repository.ts`)
  — 이 화면은 그 사실을 그대로 보여주기만 한다.
- **자동 재검토**는 새 액션을 만들지 않고 기존
  `runSocialPostQualityGateAction`을 재사용한다.
- **수정 저장**은 새 액션을 만들지 않고 기존 `editSocialPostAction`을
  재사용한다 — 이 액션은 이번 phase 전까지 실제로 어떤 화면에서도
  호출되지 않는 미사용 코드였다(grep으로 확인). `returnTo` 미지원이라
  이 화면에서 재사용할 수 없었으므로, `redirectToSafeTarget` 패턴으로
  교체해 이 페이지로 돌아올 수 있게만 고쳤다. 다른 동작은 바꾸지
  않았다.
- **최종 승인**은 새 액션을 만들지 않고 기존 `approveSocialPostAction`을
  재사용한다.

새로 추가한 것은 표시 계층뿐이다.

```
lib/social/social-post-platform-preview.ts   (신규)
  getPlatformPreviewMode(platform)     — 플랫폼별 렌더링 모드
  getPlatformBodyLabel(platform)       — "본문"/"캡션" 등 라벨
  getPlatformBodyWarnings(post)        — 가독성/길이/질문형 문장 경고
  hasDisplayableBody(post)             — 게시용 본문 존재 여부

lib/social/social-post-auto-review.ts  (Phase 3-25에 이어 확장)
  getApprovalGateStatus(input)               — 승인 가능 여부 + 이유
  getSocialPostWorkspacePrimaryAction(...)   — 상단 요약 카드의 주요 버튼 1개

lib/navigation/return-to.ts            — SAFE_RETURN_TO_PATTERN에
                                          `/social-posts/[id]` 추가
```

## 1. 상단 요약 카드 + 상태별 primary action

플랫폼/문체/현재 상태/자동 검토 요약/다음 작업을 한 번에 보여주고,
`getSocialPostWorkspacePrimaryAction()`이 계산한 버튼 **하나만**
강조한다(여러 primary action이 동시에 경쟁하지 않는다).

| 상태 | 버튼 |
|---|---|
| 자동 검토 전 | 자동 검토 실행 |
| 확인 필요 | 본문 확인하기 |
| 수정 필요 | 수정하기 |
| 차단됨 | 문제 수정하기 |
| 승인 가능(통과) | 최종 승인 |
| 승인 완료 | 게시 준비하기 |

## 2. 본문 보기 3탭 — client state 없이 `?tab=` searchParam으로 구현

이 코드베이스는 이미 `returnTo`/`showDryRun`/`highlight` 등을
searchParam으로 표현하는 패턴을 전면적으로 쓰고 있어서, 탭도 같은
방식(`?tab=preview|edit|raw`, 기본값 `preview`)으로 구현했다 — 불필요한
`"use client"`를 추가하지 않는다. 탭은 `role="tab"`/`aria-selected`를
가진 `<Link>`로 구현했다(버튼 역할 + 현재 탭 표시).

- **게시용 미리보기(기본)**: raw markdown/HTML/JSON을 노출하지 않고
  실제 게시 형태에 가깝게 렌더링한다. 자동 검토 리포트도 이 탭에 있다.
- **수정하기**: 플랫폼별로 필요한 필드만 보여주는 편집 폼.
- **내부 원문 보기**: raw post_body/caption/thread_items/card_items +
  기존 "관리 정보 보기"(상태/성과/Rewrite/A-B Test/API/메타데이터)를
  통합했다. 이 탭을 직접 선택해야만 보인다 — 기본 화면(게시용
  미리보기)에는 전혀 노출되지 않는다.

## 3. 플랫폼별 게시용 미리보기

`getPlatformPreviewMode()`가 플랫폼을 5가지 모드로 나눈다.

| 플랫폼 | 모드 | 렌더링 |
|---|---|---|
| wordpress_blog | `wordpress_html` | `ensureWordPressHtmlContent()`로 안전한 HTML 변환 후 렌더링(raw `##`/`**`/markdown table 노출 없음) |
| naver_blog | `mobile_blog` | 모바일 카드형 문단 렌더링(markdown 원문 유지 — 실제 export가 `markdown_copy`라서 HTML 변환하지 않는다), 긴 문단 경고 |
| naver_cafe | `plain_text` | `sanitizeNaverCafePlainText`가 이미 적용된 plain text, 질문형 문장 없으면 경고 |
| x / threads | `short_text` | 글자 수 표시, 권장 길이 초과 경고, x는 threadItems가 있으면 번호별로 표시 |
| instagram | `caption_stack` | 캡션/해시태그/카드 문구를 구분해서 표시 |

경고 계산은 `getPlatformBodyWarnings()`(순수 함수, 승인 가능 여부에는
관여하지 않는다 — "읽기 좋게 만들면 좋다" 수준의 안내다).

## 4. 자동 검토 리포트 ↔ 수정 탭 연결

각 이슈 항목에 두 링크를 붙였다.

- **[수정하기]** → `?tab=edit#edit-panel`(수정 탭으로 이동, `tabIndex={-1}`
  네이티브 fragment-focus로 포커스 이동. Phase 3-23-4에서 확립한 패턴)
- **[본문 위치 보기]** → `?tab=preview#publish-preview`(정확한 문단 위치
  추적은 아직 지원하지 않아 미리보기 영역 전체로 이동한다)

AI 수정 제안, "문제 아님으로 표시", 안전한 자동 정리는 이번 phase
범위가 아니다(Phase 3-25에서 이미 보류 사유를 기록했다) — 다만 이슈
항목의 액션 버튼 구조는 항목을 추가하기 쉬운 형태로 열어뒀다.

## 5. 수정 후 재검토 흐름

```
수정 저장(editSocialPostAction)
        │  quality_status → not_checked (repository가 자동 처리)
        ▼
게시용 미리보기/최종 승인 패널 → "아직 자동 검토를 실행하지 않았습니다"
        │
        ▼
[자동 재검토 실행] (runSocialPostQualityGateAction 재사용)
        │
        ▼
리포트 갱신 → 승인 가능 여부(getApprovalGateStatus)도 함께 갱신
```

자동 검토 통과만으로 `approval_status`가 `approved`로 바뀌지 않는다 —
최종 승인은 반드시 "최종 승인" 버튼을 사람이 눌러야 한다(서버 액션
`approveSocialPostAction` 자체도 이 정책을 이미 강제하고 있다).

## 6. 최종 승인 패널

`getApprovalGateStatus()`가 버튼을 disabled로 둘지, 그 이유를 무엇으로
보여줄지 계산한다(서버의 `checkApprovable` 정책을 UI에서 미리
보여주는 용도 — 실제 승인 가능 여부의 최종 판단은 여전히 서버 액션이
한다). disabled면 반드시 이유를 문장으로 보여준다("차단 항목이 있어
승인할 수 없습니다.", "본문이 없어 승인할 수 없습니다." 등).

승인 완료 후에는 플랫폼별 다음 작업 링크를 보여준다.

| 플랫폼 | 다음 작업 |
|---|---|
| wordpress_blog | WordPress Draft 반영하기 → (`/articles/[id]/blog`) |
| naver_blog | 수동 export 보기 → (내부 원문 탭) |
| naver_cafe | 복사용 본문 보기 → (게시용 미리보기) |
| x / threads / instagram | 게시 전 미리보기 → (게시용 미리보기) |

"이 승인은 게시 준비를 허용하는 단계입니다. 자동 공개 게시는
실행하지 않습니다." 문구를 항상 표시한다.

## 7. raw 상태값 노출 정리

상단 요약 카드/최종 승인 패널에는 `describeStatusValue`/
`describeAutoReviewNotRunYet`을 거친 문구만 노출한다. raw enum(quality_status
`ready` 등), raw DB 컬럼명, 내부 id는 "내부 원문 보기" 탭 안에만 남아
있다(Phase 3-24에서 이미 확립한 원칙을 그대로 유지).

## 8. 접근성

- 탭은 `<Link role="tab" aria-selected={...}>`로 구현했다(색상만으로
  현재 탭을 구분하지 않고 밑줄 스타일 + `aria-selected`를 함께 쓴다).
- 이슈의 [수정하기]/[본문 위치 보기] 클릭 시 각각 `#edit-panel`/
  `#publish-preview`로 이동하고, 두 요소 모두 `tabIndex={-1}`을 가지고
  있어 브라우저가 자동으로 포커스를 옮긴다(별도 JS 불필요 —
  Phase 3-23-4에서 확립한 패턴 재사용).
- 최종 승인 버튼은 `disabled` + `aria-disabled`를 함께 쓰고, 바로 위에
  비활성 이유를 텍스트로 표시한다.

## 알려진 제한(다음 단계로 미룬 것)

- x의 스레드 항목, instagram의 카드 문구는 수정 탭에서 JSON 배열
  텍스트(그대로 `editSocialPostAction`이 파싱하는 형식)로 편집한다 —
  줄 단위 편집 UI는 아직 만들지 않았다. 새 액션을 만들지 않기 위한
  최소 범위 선택이다.
- 이슈 → 본문 "정확한 위치"(문단 단위) 이동은 여전히 지원하지 않는다
  (Phase 3-25와 동일한 제한).

## 테스트

- `lib/navigation/return-to.test.ts`: `/social-posts/[id]` 허용/하위
  경로 차단 케이스 추가.
- `lib/social/social-post-platform-preview.test.ts`(신규, 9개):
  모드 매핑, 라벨, 경고 계산, 본문 존재 여부.
- `lib/social/social-post-auto-review.test.ts`: `getApprovalGateStatus`,
  `getSocialPostWorkspacePrimaryAction` 케이스 추가.
- `app/social-posts/[id]/page.test.ts`: 탭 구조, 플랫폼별 미리보기,
  이슈-수정 연결, 편집 폼, 최종 승인 패널 disabled 이유, 자동 승인
  금지 등 Phase 3-26 전용 테스트 추가.
- 전체 `npx vitest run`: 216 files / 2721 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류.
- `npm run build`: 성공.

## 관련 문서

- [`phase-3-25-auto-review-editor-workflow.md`](./phase-3-25-auto-review-editor-workflow.md)
- [`phase-3-1-multi-platform-writing-foundation.md`](./phase-3-1-multi-platform-writing-foundation.md)
- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)
- [`ui-review-agent-checklist.md`](./ui-review-agent-checklist.md)
