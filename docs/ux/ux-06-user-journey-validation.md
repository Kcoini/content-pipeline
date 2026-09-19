# UX-06: Automated End-to-End User Journey Validation

- 작성일: 2026-09-19
- 범위: 새 기능을 추가하지 않고, UX-01~UX-05B에서 구축된 UX를 "처음
  사용하는 사용자가 테마 선택부터 게시 준비/완료까지 길을 잃지 않고
  진행할 수 있는가?" 관점에서 자동 검증했다. `docs/ux/full-ux-audit.md`,
  `docs/ux/user-journey-audit.md`, `docs/ux/ux-refactor-roadmap.md`,
  이전 모든 UX Phase 문서를 먼저 읽고 작업했다.
- 이번 Phase에서 하지 않은 것: 새 주요 기능, DB schema 변경,
  migration, publish engine 재설계, approval state machine 변경,
  전체 UI redesign, 새 플랫폼, AI prompt 대규모 변경, 실제 외부
  public publish 실행. 테스트 중 발견된 명백한 작은 버그(라벨 1건)만
  수정했다 — 구조 변경이 필요한 문제는 UX-07 backlog로 남겼다.

---

## 1. 사용한 test infrastructure

**조사 결과, 이 프로젝트에는 Playwright/Cypress 등 browser E2E
인프라가 전혀 없다.** `package.json`의 script는 `dev`/`build`/`start`/
`lint`/`test`(`vitest run`)뿐이고, `vitest.config.ts`는
`environment: "node"`(jsdom도 없음)다. Supabase test fixture/mock
server/WordPress mock/clipboard mock 전용 인프라도 없다 — 대신
프로젝트 전체가 이미 다음 패턴으로 검증해 왔다:

1. **"정적 소스 검사"**: `readFileSync`로 페이지/컴포넌트 소스를 읽어
   substring/regex로 구조·라벨·wiring을 검증(이 프로젝트의 가장
   지배적인 테스트 방식, 수천 개의 기존 테스트가 이 패턴).
2. **`renderToStaticMarkup`**: 컴포넌트를 실제로 렌더링해 HTML
   문자열을 검사(behavioral 테스트).
3. **repository 경계 mock + 실제 서비스 함수 호출**: `vi.mock`으로
   `lib/repositories/*`/`lib/harness/logger`만 mock하고, 실제
   business logic 함수(승인/검토/저장)는 그대로 호출(예:
   `lib/social/social-post-approval-service.test.ts`).

Phase 지시사항("Playwright/Cypress가 없다면 무조건 새 dependency를
설치하지 않는다")에 따라 **새 테스트 프레임워크를 설치하지 않고**,
위 3가지 기존 패턴만으로 "user journey" 검증을 구성했다 — 패턴 3을
여러 단계에 걸쳐 체이닝하는 방식으로 "여정"을 표현했다(아래 2-6절).

## 2-6. Journey 1-5 결과

상세 내용은 `lib/journeys/*.test.ts` 5개 파일에 직접 문서화되어
있다(각 파일 상단 주석에 click/판단 단계 tally 포함). 요약:

- **Journey 1 (WordPress)**: `getWordPressPublishPrepState`/
  `getApprovalGateStatus`/`fromWordPressPublishPrepStateToPublishPreparation`을
  체이닝 — 승인 전 차단 → 승인 후 Draft 만들기 → Draft 보기까지 9개
  테스트로 확인. **성공 계약**: WordPress는 이 프로젝트 범위에서
  `publishStatus`가 `"published"`에 절대 도달하지 않으므로, 최종
  상태는 항상 `"ready"`(Draft 확인 가능)이지 `"completed"`가 아님을
  명시적으로 확인했다.
- **Journey 2 (Naver Cafe/copy)**: quality gate → sanitizer → 승인
  이후 next action → `recordManualPostingResult` guard까지 6개
  테스트. **성공 계약**: 복사(client 이벤트)만으로는 `manual_post_status`가
  절대 바뀌지 않고, `recordManualPostingResult`(서버, guard 포함)를
  명시적으로 호출해야만 `"posted"`가 됨을 확인.
- **Journey 3 (X thread)**: `saveSocialPostThreadAndProcess` 체이닝 —
  순서 보존/빈 item 필터링/280자 제한/저장+검토+승인 연속 실행/
  게시 완료 글 재수정 차단까지 6개 테스트.
- **Journey 4 (Multi-platform)**: `summarizeMultiPlatformReview` →
  `bulkApproveSocialPosts`(부분 성공) → `summarizeMultiPlatformPublishPreparation`까지
  5개 테스트. **성공 계약**: bulk approval은 `ready`+미승인 post만
  대상으로 하고, 이미 승인/차단된 post는 실패로 남으며(부분 성공),
  이 과정 어디에도 외부 게시 API 호출이 없음을 mock 구성 자체로
  증명(그런 함수를 mock할 필요조차 없었다).
- **Journey 5 (Rewrite)**: `getRewriteSuggestionNextAction`/
  `getRewriteVersionNextAction`/`describeRewriteSuggestionStatus` 체이닝 —
  "승인"이라는 단어가 최종 게이트(`rewriteReapprovalStatus="approved"`)에만
  쓰이고, 그 전 단계는 "선택"/"요청"임을 7개 테스트로 확인.

## 7. Dashboard 진입 (Journey 6)

새 테스트를 추가하지 않고 기존 확인을 재사용했다 — `app/dashboard/page.tsx`는
이미 `resolveDashboardWorkflowState` 단일 판단 로직 + "현재 상태 /
다음 작업" 카드(하나뿐) + "상세 관리" 접힘으로 기술 정보를 분리하고
있음을(Phase 3-23-2/UX-03C에서 검증됨) 코드 재확인으로 확인했다.
`components/navigation/dashboard-top-nav.tsx`도 `automation-safety`/
`platform-api`처럼 위험/운영 성격 메뉴를 드롭다운 안에서만 `danger`
플래그로 옅게 구분하고 있어, 관리자 화면이 일반 작업 흐름을 방해하지
않는다.

## 8. Trends/Theme (Journey 7)

새 테스트를 추가하지 않고 UX-03C의 기존 검증을 재사용했다 —
`PlatformBadge` 공통화, raw `naver`/`daum`/`mock` 노출 제거,
`ARTICLE_SEARCH_ENABLED` env var 노출 제거가 모두 UX-03C에서 이미
완료되어 있음을 코드 재확인(grep)으로 확인했다. `raw-technical-info.test.ts`가
이 두 파일도 스캔 대상에 포함하고 있어 앞으로 회귀가 생기면 자동으로
잡힌다.

## 9. 기존 조사 공백 재확인 결과

UX-01에서 부분 조사였던 4개 화면(`app/articles/[id]/rewrite/page.tsx`,
`app/dashboard/rewrite/page.tsx`, `app/dashboard/social-performance/page.tsx`,
`app/trends/page.tsx`)은 이후 여러 Phase(UX-03B2가 rewrite 용어,
UX-03C가 trends/PlatformBadge, UX-04A/B가 review 단순화)에서 이미
상당 부분 다뤄졌다. 이번 Phase에서는 이 4개를 `lib/ui/ux-invariants.test.ts`/
`lib/ui/raw-technical-info.test.ts`의 스캔 대상에 포함시켜, 개별
재조사 대신 **영구 자동 검사로 커버**하는 방식을 택했다 — 전부
통과했다(새로운 이슈 없음).

## 10. Journey별 click 수/판단 단계 요약

| Journey | 사람이 직접 눌러야 하는 것(최대) | 시스템 자동 단계 | 반복 불필요 click |
|---|---|---|---|
| 1. WordPress | 5 (품질검사/승인/Draft 만들기/남은 항목 처리/반영) | 2 (자동 검토, 필요시 자동 수정) | 0 |
| 2. Naver Cafe | 3 (승인/복사/게시 완료로 표시) | 2 (자동 검토, markdown 자동 정리) | 0 |
| 3. X thread | 4 (본문 수정/저장/최종 승인/재검토) | 1 (저장 후 자동 재검토) | 0 |
| 4. Multi-platform(6건 기준) | 3 (일괄 승인 1 + 개별 처리 2) | 자동 집계 | 0(6개 개별 승인 → 1회로 대체) |
| 5. Rewrite | 5 (선택/적용/비교/재검토 요청/최종 승인) | 0(quality-gate와 무관한 별도 흐름) | 0 |

목표는 "클릭 수 최소화" 자체가 아니라 "불필요한 판단/반복이
없는가"였다 — 5개 Journey 모두 완료된 action이 다시 primary로
나타나지 않음을 개별 테스트로 확인했다(반복 click 0건).

## 11. UX invariant 검사 결과

`lib/ui/ux-invariants.test.ts`(26 tests, 전부 통과) — A~K 중 정적으로
검증 가능한 항목을 구현:

- **B**: "다음 작업" 문구는 11개 핵심 페이지 전부에서 실제 action
  참조(주석 제외)와 함께 등장(dead-end 0건)
- **C**: 승인 완료 상태에서 승인 버튼이 무조건 활성화되지 않음
  (`disabled={!gate.canApprove}`, 폼 제출로만 호출)
- **D**: completed 상태에서 secondaryActions가 비워짐(반복 action 없음)
- **E**: "본문 수정"은 프로젝트 전체에서 `<Link>`/`<a>` 안에 있지
  않고(내비게이션 아님), `post-body-action-row.tsx`는 항상
  `<button type="button" onClick={onEdit}>`(inline edit)
- **I**: 5개 핵심 사용자 페이지에 "공개 게시"/"실제 게시" 버튼이 없고,
  `/articles/[id]`(보조 route)의 실제 공개 게시는 "⚠ 관리자 전용"
  이중 접힘 안에서만 존재
- **J**: `CopyPostBodyButton`은 상태를 바꾸는 서버 action(승인/일괄
  승인/게시 완료 기록)을 전혀 호출하지 않음
- **K**: WordPress "완료" 판정은 `publishStatus==="published"`일
  때만 발생, Draft 조회 자체는 여전히 `"ready"`

A(섹션당 primary 1개), F/G/H(raw 노출)는 10-13절/아래 raw-string
스캐너로 함께 검증했다.

## 12. raw technical text 검사 결과

`lib/ui/raw-technical-info.test.ts`(76 tests, 전부 통과) — 11개
핵심 페이지 + 8개 공유 UI 컴포넌트(`components/review/*`,
`components/publish/*`, `components/workflow/*`,
`components/wordpress/wordpress-publishing-panel.tsx`)를 스캔해
`quality_status`/`approval_status`/`publish_status`/`export_status`/
`manual_post_status`/`suggestion_status`/`rewrite_reapproval_status`/
`publish_guard`, `not_checked`/`needs_revision`/`not_attached`,
`WORDPRESS_`/`SEO_PLUGIN_`/`ARTICLE_SEARCH_ENABLED`, `dry-run`/영문
`handoff`가 JSX 텍스트/label/title 문자열로 노출되는지 확인했다.

**1건의 실제 leak을 발견해 그 자리에서 수정했다**:
`app/social-posts/[id]/page.tsx`의 관리 정보 안내 문구 "복사/export/handoff에는
포함되지 않습니다"를 "복사/내보내기/수동 게시 준비 자료에는
포함되지 않습니다"로 교체(이미 같은 페이지 다른 곳에서 쓰던 한국어
용어와 통일 — 사소한 1줄 수정이라 즉시 반영).

**문서화된 예외 1건**: `app/articles/[id]/page.tsx`의 "⚠ 관리자
전용" 이중 접힘 안에 env 변수 이름/dry-run 안내가 남아 있음(H5,
"부분 해결"로 이미 기록됨) — 스캐너는 이 파일에 한해 그 접힘 영역
이전(일반 사용자가 보는 부분)만 검사하도록 명시적으로 설계했다.

## 13. primary action 충돌 검사 결과

위 11절의 invariant A/C/D 검사로 확인 — 0건. `<WorkflowStatusCard`/
`<NextActionPanel`이 카드당 1회만 렌더링되는지는 UX-04A에서 이미
`app/articles/[id]/social/page.tsx`에 대해 개별 테스트로 고정되어
있고, 이번 Phase의 invariant 검사가 그 원칙을 프로젝트 전체 스캔
대상으로 확장했다.

## 14. dead-end 검사 결과

0건. invariant B(다음 작업 근처 action 존재) + Journey 1-5의 성공
계약(모든 여정이 실제 action이 있는 상태로 종료됨을 확인)으로 이중
검증했다.

## 15. action_completed 상태 최종 결정

UX-05B에서 `PublishPreparationState`에 추가됐지만 어떤 adapter도
실제로 만들지 않던 `"action_completed"` 상태를 **제거했다(옵션 B —
dead state)**. 근거: 클립보드 복사는 클라이언트 로컬 이벤트일 뿐
서버 측 source of truth가 없고, WordPress Draft 조회는 이미
`"ready"`로 의도적으로 분류돼 있어(3단계 문서 참고) 새 중간 상태가
필요 없다. `lib/ui/publish-preparation-view-model.ts`,
`multi-platform-publish-preparation-summary.ts`,
`publish-preparation-summary-card.tsx`,
`platform-publish-preparation-card.tsx`에서 관련 코드를 제거하고
타입에 결정 근거를 주석으로 남겼다 — 나중에 실제 비동기 게시 job
같은 진짜 source of truth가 생기면 그때 다시 추가한다.

## 16. 접근성 기본 검사 결과

새 접근성 프레임워크는 도입하지 않았다. 기존 코드의 spot-check로
확인: `role="tab"`/`aria-selected`(탭 시맨틱, `social-posts/[id]`),
`aria-haspopup`/`aria-expanded`(드롭다운 메뉴, `dashboard-top-nav.tsx`),
disabled 버튼에는 프로젝트 전역적으로 항상 보이는 이유 텍스트가
동반됨(governance 규칙으로 이미 강제, invariant 검사로 재확인).
명백한 접근성 문제는 발견되지 않았다 — 새 이슈 없음.

## 17. narrow viewport 검사 결과

**수행하지 않았다.** browser E2E 인프라가 없어(1절) 실제 렌더링
기반 viewport 검사가 불가능하다. 이 프로젝트의 CSS는 이미
`docs/ui-ux-governance-rules.md`의 반응형 원칙(모바일 400px 폭
기준 sidebar 접힘 등)을 코드 리뷰 기준으로 지켜 왔으나, 실제 좁은
화면 렌더링 검증은 browser 도구가 생기는 다음 기회로 남긴다(UX-07
backlog).

## 18. 외부 side-effect 차단 검증

모든 journey/service 테스트가 `lib/repositories/*`와
`lib/harness/logger`만 mock하고, 실제 외부 HTTP/WordPress API/
소셜 플랫폼 API를 호출하는 코드 경로는 애초에 이 프로젝트에
구현되어 있지 않다(UX-05A/05B에서 이미 확인 — "즉시 API 게시" 기능
자체가 없음). `.env.local` 값은 어떤 테스트 출력에도 나타나지
않는다(테스트가 env 변수를 읽지 않고, 값이 아닌 이름만 다루는
기존 원칙을 그대로 따른다).

## 19. UX-06에서 발견한 새 문제

- `app/social-posts/[id]/page.tsx`의 "복사/export/handoff" 영문 혼용 문구(12절, 즉시 수정)
- `lib/ui/ux-invariants.test.ts`/`raw-technical-info.test.ts` 초안의 정규식이 여러 줄에 걸쳐 무관한 `>...<` 쌍을 오탐하는 버그(테스트 자체의 버그, 프로덕션 코드 문제 아님 — 한 줄 범위로 좁혀 수정)

## 20. UX-06에서 바로 수정한 문제

- 위 19절의 라벨 1건(작은 명백 버그, 즉시 수정 가능 기준에 부합)
- `action_completed` dead state 제거(15절, "사용되지 않는 상태를 남기지 않는다"는 이번 Phase의 명시적 지침에 따른 결정 — 코드 정리이지 새 기능 아님)

## 21. UX-07로 넘긴 문제

- H5: `/articles/[id]` 관리자 접힘 블록 내부 세부 미분리(구조 변경 필요, 회귀 위험 판단 보류 유지)
- H6: `/social-posts/[id]` "수정하기" 탭과 `InlinePostBodyEditor`의 구조적 중복
- Medium 7건(상태 라벨 4가지 방식 혼재, `tab=raw` URL 직접 접근 등)
- naver_cafe/x/threads/instagram 계열 markdown 검사의 남은 세부 비대칭(있다면, 이번 Phase에서는 신규 발견 없음)
- narrow viewport/browser E2E 실측 검증(17절 — browser 도구 도입 여부는 UX-07에서 재검토)
- bulk approval 이후 전용 "게시 준비 보기" 확인 화면 고도화(UX-05B에서 anchor 링크까지만 구현)

## 22. 수정 파일

**신규**: `lib/journeys/wordpress-journey.test.ts`, `naver-cafe-copy-journey.test.ts`, `x-thread-journey.test.ts`, `multi-platform-journey.test.ts`, `rewrite-journey.test.ts`, `lib/ui/ux-invariants.test.ts`, `lib/ui/raw-technical-info.test.ts`, `docs/ux/ux-06-user-journey-validation.md`(이 문서), `docs/ux/ux-06-journey-matrix.md`

**수정**: `lib/ui/publish-preparation-view-model.ts`, `lib/ui/multi-platform-publish-preparation-summary.ts`, `components/publish/publish-preparation-summary-card.tsx`, `components/publish/platform-publish-preparation-card.tsx`(action_completed 제거), `app/social-posts/[id]/page.tsx`(라벨 1건), `docs/ux/full-ux-audit.md`, `docs/ux/user-journey-audit.md`, `docs/ux/ux-refactor-roadmap.md`(업데이트)

## 23. 추가한 테스트

Journey 테스트 5개 파일(33 tests 합계), invariant 검사(26 tests), raw-string 스캐너(76 tests) — 총 135개 신규 테스트.

## 24. lint 결과

`npm run lint` — 오류 없음(출력 없음).

## 25. unit/integration test 결과

전체 스위트: **283 files / 3767 tests passed**, 실패 없음.

## 26. E2E 결과

해당 없음 — 1절에서 설명한 대로 이 프로젝트에는 E2E 인프라가 없고,
이번 Phase에서도 추가하지 않기로 결정했다.

## 27. build 결과

`npm run build` 성공(`next build`, Turbopack, TypeScript 통과, 19개 route 모두 정상 생성).

## 28. 최신 Critical/High/Medium/Low

| 등급 | 총 항목 | 해결 | 부분 해결 | 미해결 |
|---|---|---|---|---|
| Critical | 7 (C1-C7) | 7 | 0 | 0 |
| High | 10 (H1-H10) | 8 | 2 (H5, H6) | 0 |
| Medium | 11 | 3 | 1 | 7 |
| Low | 5 | 1 | 0 | 4 |

추가로:
- **핵심 Journey blocker: 0건**(5개 Journey 전부 성공 계약 충족)
- **dead-end: 0건**
- **사용자에게 노출된 raw technical info: 0건**(1건 발견 즉시 수정, 1건 문서화된 예외)
- **primary action collision: 0건**

## 29. UX-07 진입 기준 충족 여부

- Critical 0건 ✅
- 핵심 Journey blocker 0건 ✅
- 위험한 publish/approval 오해 0건 ✅(copy≠완료, Draft≠공개 게시, 승인≠게시 전부 Journey 테스트로 확인)
- 주요 dead-end 0건 ✅

**UX-07 진입 가능하다.** Medium 7건/Low 4건/부분 해결 High 2건은
남아 있지만, 이들은 진입 조건에 해당하지 않는 항목이다.

---

**UX-06에서는 핵심 사용자 여정을 처음부터 끝까지 자동 검증하고,
기능 단위가 아니라 실제 사용자 흐름 기준으로 dead-end·상태
혼동·primary action 충돌·기술정보 노출을 확인했습니다.**
