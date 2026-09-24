# PRODUCT-01H: Consumer-style Usability QA

- 작성일: 2026-09-24
- 방법: novice user persona(2절) 기준 blind-task 검토(코드 지식으로
  의미를 보완하지 않고, 화면에 실제로 렌더링된 텍스트만으로 다음
  행동을 판단) + 기존/신규 fixture의 정적·Playwright 검증 +
  전체 코드베이스 raw-term sweep. 점수화하지 않고 PASS/ISSUE/N/A만
  기록한다(지시서 3절 원칙 그대로).

## 시작 기준선

`npm run lint` / `npm run test`(3941 passed) / `npm run build` /
`npm run test:e2e`(176 passed, 신규 30개 포함) / `npm run ops:preflight`
(Overall: PASS) — 전부 QA 착수 전에 그린 확인.

## Journey A — 첫 접속

Fixture: `dashboard-welcome-empty-state`.

| 항목 | 판정 | 비고 |
|---|---|---|
| A. Discoverability | PASS | "환영합니다." 아래 한 문장으로 서비스 목적 설명, CTA 1개만 존재 |
| B. Comprehension | PASS | 5단계 리스트(주제 선택/참고자료 확인/콘텐츠 생성/확인이 필요한 내용 검토/게시 준비)가 전체 흐름을 미리 보여줌 |
| C. Action clarity | PASS | "첫 콘텐츠 만들기" 단일 버튼, `#theme-list`(실제 주제 목록)로 정확히 연결(실제 코드 확인) |
| D. Safety comprehension | N/A | 이 화면에는 게시 관련 행동이 없음 |
| E. Recovery | N/A | 오류 상태 아님 |
| F. Technical abstraction | PASS | Supabase/Anthropic/DB 관련 단어 전혀 없음 |

**Blind-task 검증**: "이 화면에서 다음에 무엇을 할 것인가?" → "첫 콘텐츠 만들기 버튼을 누른다" — 실제 의도된 행동(주제 목록/생성 폼으로 스크롤)과 일치. Mismatch 없음.

## Journey B — 주제와 참고자료

Fixture: `creation-step-sources`(참고자료 0건), `error-source-fetch-partial-failure`(부분 실패).

| 항목 | 판정 | 비고 |
|---|---|---|
| A. Discoverability | PASS | "참고자료 추가하기" 버튼이 상태 카드에 바로 노출 |
| B. Comprehension | PASS | "아직 참고자료가 없습니다." + "3개 더 필요" 로 정확한 수량까지 안내 |
| C. Action clarity | PASS | primary action 1개("참고자료 추가하기") |
| D. Safety comprehension | N/A | 게시 관련 없음 |
| E. Recovery | PASS | 부분 실패 fixture: "본문 수집 완료 1개 · 실패 1개"로 성공/실패 구분, "수집 오류: 이 참고자료를 불러오지 못했습니다."(raw fetch 에러 없음) |
| F. Technical abstraction | PASS | source/fetch/summary/integrity라는 단어가 화면에 없음(내부 함수명일 뿐) |

## Journey C — 콘텐츠 만들기

Fixture: `creation-step-sources-ready`, `creation-step-generate-ready`, `creation-step-generating`.

| 항목 | 판정 | 비고 |
|---|---|---|
| A. Discoverability | PASS | Stepper가 상단에 항상 노출, 현재 단계가 진한 색으로 강조 |
| B. Comprehension | PASS | "참고자료가 준비되었습니다 (3개)." → "마스터 원고가 준비되었습니다." 순서로 현재 상태가 계속 갱신됨 |
| C. Action clarity | PASS | 각 단계 primary action 1개("마스터 원고 만들기" → "선택한 플랫폼 글 생성") |
| D. Safety comprehension | N/A | 이 단계에는 게시 행동 없음 |
| E. Recovery | N/A | 오류 상태 아님 |
| F. Technical abstraction | **ISSUE(경미, 수정 안 함)** | "마스터 원고"라는 용어가 stepper의 "콘텐츠 만들기"와 다른 단어로 처음 등장 — 실제 `/dashboard` 전체 페이지에서는 바로 옆에 "출처를 바탕으로 모든 플랫폼 글의 기준이 되는 마스터 원고를 만듭니다..." 설명이 함께 있어(코드 확인) 전체 페이지 맥락에서는 이해 가능. 이 상태-카드만 분리해서 볼 때만 약간의 낯섦이 있음 — P3로 기록(아래 27절), 수정하지 않음. |

**Fake progress 확인**: `creation-step-generating` fixture — "참고자료 확인: 완료 / 본문 작성: 진행 중 / 플랫폼별 콘텐츠 준비: 시작 전" (실제 state 기반, %없음). PASS.

**비용 보호 confirm**: `app/dashboard/page.tsx`의 "전체 플랫폼 글 생성" 버튼이 `ConfirmSubmitButton` + 4문단 경고 메시지를 그대로 유지하고 있음(정적 테스트로 이미 회귀 방지 중, 재확인). PASS.

**PRODUCT-01E generate-step P3 재판정**: 이번 journey 검증에서 "마스터 원고 생성"과 "플랫폼 글 생성"이 하나의 stepper key("콘텐츠 만들기")로 묶여 있어도, 각 단계의 "현재 상태/다음 작업" 카드가 항상 정확한 개별 지시를 주므로 실제 혼란 증거를 발견하지 못했다 — **수정하지 않음**(지시서 원칙: 혼란 증거가 없으면 수정하지 않는다).

## Journey D — 생성 완료 후 검토

Fixture: `creation-step-generated` + 기존 `AutoReviewSummaryCard`/`HumanReviewPanel` 단위 테스트(이미 clean/confirmation-required/blocking 구분을 회귀 테스트 중, `components/review/auto-review-summary-card.test.tsx`).

| 항목 | 판정 | 비고 |
|---|---|---|
| A. Discoverability | PASS | "검토할 글 보기" 버튼이 상태 카드에 직접 노출 |
| B. Comprehension | PASS | "생성된 글이 있습니다 (검토 대기 2개)." |
| C. Action clarity | PASS | primary action 1개 |
| D. Safety comprehension | PASS | 최종 승인과 출처 확인이 서로 다른 함수/문구로 계산됨(PRODUCT-01C에서 이미 확정, `auto-review-summary-card.test.tsx:100` "내부 fixability enum을 화면에 노출하지 않는다"로 회귀 방지 중) |
| E. Recovery | N/A | |
| F. Technical abstraction | PASS | `auto_fixable`/`user_confirmation_required`/`blocking` 등 내부 enum이 전부 코드 주석에만 있고 렌더링 텍스트에 없음(grep 재확인, 21절) |

## Journey E — 게시 준비

Fixture: `publish-wordpress-ready`, `publish-wordpress-draft-complete`, `publish-copy-ready`, `publish-manual-ready`, `publish-approval-required`, `publish-blocked`.

**A. WordPress**: "게시 방식: 초안으로 저장" → "WordPress Draft 만들기" → "✓ WordPress 초안이 저장되었습니다. 공개 게시는 하지 않았습니다 — WordPress 관리자 화면에서 직접 게시해야 공개됩니다." → "WordPress에서 초안 보기". 최종 승인 전에는 `publish-approval-required`(버튼 자체가 없음)로 차단. **PASS(전부)**.

**B. Copy**: "게시 방식: 본문 복사 후 직접 게시" → "본문 복사" → (`CopyPostBodyButton`, 기존) "본문을 복사했습니다." 텍스트만 표시, "게시 완료"라는 단어 없음. **PASS**.

**C. Manual**: "게시 방식: 외부에서 직접 게시" → "본문 복사"/"수동 export 준비" → (기존 URL 기록 폼) "게시한 주소" 라벨 + "외부 게시 후 게시물 주소를 입력해 주세요." 안내 + "게시 완료 기록" 버튼(반환 메시지: "실제 API 게시가 아닌 수동 게시 기록입니다", 코드 확인). **PASS**.

## Journey F — 오류 복구

Fixture: `error-source-fetch-partial-failure`, `error-generation-failure`, `error-structured-output-failure`, `error-wordpress-draft-failure`, `error-job-stalled`, `error-not-found`.

| 상태 | 무엇이 실패했는가 | 다음 행동 | 데이터 안전 | 관리자 문의 | raw term |
|---|---|---|---|---|---|
| 참고자료 부분 실패 | "실패 1개"로 명시 | (별도 action 없음 — 실제로 재시도 UI가 없어 제공하지 않음, 정당) | N/A | 불필요 | 없음 |
| generation failure | "콘텐츠를 만드는 중 문제가 발생했습니다." | (재시도는 기존 폼 재제출) | "작성되지 않은 콘텐츠는 저장되지 않았으며, 기존 자료와 콘텐츠는 그대로 유지됩니다." | 불필요 | 없음 |
| structured-output failure | "콘텐츠 생성 결과를 정상적으로 처리하지 못했습니다." | 동일 | (문구에 미포함, N/A) | 불필요 | 없음(JSON 단어 제거 확인) |
| WordPress Draft failure | "WordPress에 초안을 저장하지 못했습니다." | [다시 시도] [설정에서 상태 확인] | "앱에 그대로 저장되어 있습니다... 공개되지 않았습니다." | 있음(연결 문제 시) | 없음 |
| job stalled | "멈춤 가능성 있음" | "잠시 후 다시 확인해 주세요." | (진행 중 job이라 N/A) | 불필요 | 없음, "실패"로 오표시 안 됨 |
| not-found | "콘텐츠를 찾을 수 없습니다." | "내 콘텐츠로 돌아가기" | N/A | 불필요 | 없음 |

전부 **PASS**(raw technical term 없음, Playwright 42개 테스트로 재확인).

## Journey G — Settings

Fixture: `settings-ready`, `settings-partial`.

콘텐츠 생성 ✓ 사용 가능 / 자료 검색 ✓ 사용 가능 / WordPress ✓ 연결됨(또는 "⚠ WordPress 연결을 확인해 주세요.") / "WordPress는 항상 초안(Draft)으로 저장됩니다" / 출처 확인 ✓ 사용 중 / 게시 전 최종 확인 ✓ 사용 중 — 전부 개발 지식 없이 이해 가능. Supabase/Anthropic/Vercel/env/provider/API key/preflight/raw feature flag **전부 미노출**(grep 재확인). **PASS**.

## Journey H — Admin Boundary

`components/navigation/dashboard-top-nav.tsx` 재확인: 상단 항상 노출 버튼은 "자동 테마 찾기"/"기사 목록"/"메뉴" 3개뿐. 드롭다운 안 "관리자 / 고급" 그룹은 구분선 + "아래는 콘텐츠 작업에는 필요 없는 운영자/관리자 전용 화면입니다" 안내 문구 + 옅은 글자색으로 분리(기존 테스트로 회귀 방지 중). Admin 화면 자체는 삭제되지 않음(라우트 유지 확인). **PASS**.

## Blind-task mismatch

전체 journey(A~H)에서 화면 텍스트로 추론한 다음 행동과 실제 코드가 의도한 다음 행동이 어긋난 사례: **0건**.

## Primary action collision

First-use/Source empty/Generation ready/Review/Approval/Publish preparation/Error state 각 화면에서 강조 스타일(bg-zinc-900 등)을 가진 액션이 2개 이상 동시에 존재하는 사례를 fixture별로 확인(`product-user-journey.pw.ts`의 `.bg-zinc-900` count 검증 포함): **0건**.

## Terminology consistency

전체 journey fixture에서 "테마"/"출처"라는 구용어가 섞여 있지 않은지 확인(Playwright 테스트로 자동화): **PASS**. 예외로 기록한 것은 "마스터 원고"(Journey C에서 이미 P3로 기록, 4-1 단계부터 있던 기존 명명— 이번 Phase 범위에서 변경하지 않음)뿐.

## Safety Understanding Test(19절, 4문항)

1. WordPress 버튼 → 공개되는가? **아니오**로 화면만 보고 답 가능(PASS).
2. X 본문 복사 → 게시되는가? **아니오**로 화면만 보고 답 가능(PASS).
3. 최종 승인 → 게시되는가? **아니오** — 승인/게시 준비/실제 전달 행동이 서로 다른 화면·문구로 분리되어 있어 화면만으로 답 가능(PASS, PRODUCT-01C/F에서 이미 확정된 구조 재확인).
4. "게시 완료 기록" = 앱이 게시했다는 뜻인가? **아니오** — 반환 메시지에 "실제 API 게시가 아닌 수동 게시 기록입니다"가 명시(PASS).

## Error Understanding Test(20절)

정상 빈 상태/확인 필요/시스템 오류/처리 지연(stalled)/게시 준비 차단 — 5개 상태가 전부 서로 다른 색상 **+** 서로 다른 문구로 구분됨(색상만으로 구분하지 않음, 텍스트 재확인). "전부 문제가 있습니다로 느껴지는" 실패 사례 없음. **PASS**.

## Accessibility Sweep(22절)

- keyboard focus: `dashboard-top-nav.tsx`의 메뉴 트리거에 `aria-haspopup`/`aria-expanded`/`aria-controls`(기존, 재확인).
- button/link accessible name: 모든 fixture에서 버튼/링크 텍스트가 실제 행동을 설명(아이콘 전용 버튼 없음).
- form label: 참고자료 추가 폼, 게시 URL 입력 폼 모두 `<label>` 사용 확인(코드 재확인).
- checkbox label: `PlatformSelectionCheckboxes`가 각 체크박스를 `<label>`로 감쌈(기존, 재확인).
- error/state text: 색상 전용 표시 없음(모든 상태에 텍스트 동반, 위 Error Understanding Test 참고).
- narrow reading order: `product-user-journey.pw.ts`/`friendly-errors-empty-states.pw.ts`/`publish-connection-ux.pw.ts`/`content-creation-experience.pw.ts` narrow(390x844) 전체 통과.

완전한 WCAG 인증은 범위 밖(지시서 22절 명시). **PASS(범위 내)**.

## Technical Language Sweep(21절) — 전체 코드베이스 재확인

`e2e/.generated/*.html` 전체 및 `app/`·`components/` 렌더링 텍스트에서 Supabase/Anthropic/Claude/Vercel/environment/process.env/API key/pipeline_logs/JSON.parse/schema/provider_error/structured_output/user_confirmation_required/auto_fixable/fact_grounding/verifiedFacts/verificationNeeded 16개 용어를 전수 검색했다.

- fixture(사용자에게 실제로 렌더링되는 HTML): **0건**.
- 코드 소스 전체 grep에서 나온 히트는 전부 (a) 코드 주석, (b) `<details>` 안(이미 AdvancedDetails/접힘 패턴), 또는 (c) 발견 즉시 수정한 2건 —
  `app/articles/[id]/page.tsx`의 "근거 연결(evidenceMap)"(라벨 + `<summary>` 트리거 텍스트, 접힘 여부와 무관하게 항상 보이는 위치) — **PRODUCT-01H에서 수정**(evidenceMap 텍스트 제거, 라벨은 "근거 연결"로 유지).

## 이번 Phase 수정 사항

1. `app/articles/[id]/page.tsx`: "근거 연결(evidenceMap)" → "근거 연결"(라벨 2곳: `<dt>`, `<summary>`). raw 필드명 노출 제거. **P2**.
2. `e2e/generate-fixtures.setup.tsx`: QA fixture 전용 placeholder 제목 문구를 PRODUCT-01E 용어(주제/참고자료/콘텐츠 만들기)로 통일(프로덕션 코드 아님, QA 아티팩트 정합성). **P2/cosmetic**.
3. `e2e/product-user-journey.pw.ts` 신규(섹션 25 요구, 기존 fixture 재사용, 새 fixture 없음).

이 두 건 모두 label/helper/fixture 범주 안(24절 허용 범위)이며, pipeline/DB/backend/publish semantics는 전혀 건드리지 않았다.
