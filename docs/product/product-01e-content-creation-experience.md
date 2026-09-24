# PRODUCT-01E: Content Creation Experience

- 작성일: 2026-09-24
- 관련 문서: `docs/product/product-01d-first-use-settings.md`,
  `docs/product/product-information-architecture.md`,
  `docs/product/product-language-dictionary.md`.

## 1. 실제 기존 creation flow(조사 결과)

`app/dashboard/page.tsx`(단일 페이지)가 전체 흐름을 담당한다. 각 단계는
`resolveDashboardWorkflowState()`(`lib/dashboard/source-display.ts`)가
**기존 DB 조회 결과만으로** 계산하는 `DashboardWorkflowState` 하나로
결정된다 — 이 프로젝트는 이미 "단일 상태 판단 기준" 원칙(Phase
3-23-2)을 갖고 있었다.

| 사용자 입력 | server action | 다음 상태로 여는 조건 | 현재 primary button |
|---|---|---|---|
| 테마(주제) 제목/설명/키워드/언어 | `createTheme` | `themes.length > 0` | "주제 만들기" |
| 출처(참고자료) URL(+선택 필드) | `addSource` | `sources.length >= 3`(MIN_SOURCE_COUNT) | "참고자료 추가" |
| 원고 생성 방향(자동 추천 기본) | `generateArticleDraft` | `article` row 존재 | "마스터 원고 만들기" |
| 플랫폼 선택(체크박스, 카드별 개별) | `generateSelectedPlatformPostsAction` / `generateAllPlatformPostsAction` | `social_posts` row 존재 | "글 생성하기"(카드) / "선택한 플랫폼 글 생성"(선택 폼) |
| (검토/승인은 `/articles/[id]/social`에서) | (해당 페이지) | `approvalStatus === "approved"`인 post 존재 | "글 검토하기" |
| (게시 준비는 `/articles/[id]/blog` 등에서) | (해당 페이지) | — | "WordPress Draft 반영" / "수동 export 보기" |

`DashboardWorkflowState` 6개 값: `needs_theme` → `needs_source` →
`ready_to_generate` → `needs_platform_posts` → `needs_review` →
`ready_for_publish_prep`. 각 상태의 문구/색상/CTA는
`getDashboardStatusSummary()`/`getWorkflowStateTone()`
(`lib/dashboard/dashboard-workflow-presentation.ts`) 하나로만 계산되고,
어느 관리 영역(출처/원고/플랫폼)을 상단에 펼칠지는
`getDashboardCurrentStepArea()`가 같은 상태에서 파생한다. **이 구조
자체가 이미 이번 Phase가 요구하는 "기존 상태에서 단계를 derive"
원칙을 정확히 구현하고 있었다.**

## 2. ContentProgressSteps 조사 결과

`components/articles/content-progress-steps.tsx`가 이미 정확히 이
용도로 존재했다 — `workflowState`에서 파생한 5개 키(`theme`/`sources`/
`generate`/`review`/`publish_ready`)를 받아 사용자 단계 stepper를
렌더링한다. **새 컴포넌트를 만들지 않고 그대로 재사용했다.** 이번
Phase에서는 라벨 문구만 사용자 언어로 다듬었다(4절 참고) — key/파생
로직/props 구조는 전혀 바꾸지 않았다.

## 3. Wizard 필요 여부 판단 — 결론: A(기존 Dashboard 안에서 guided step 개선)

`app/dashboard/page.tsx`는 이미:
- 상단에 `ContentProgressSteps`(현재 단계 stepper),
- "현재 상태 / 다음 작업" 카드(3-part 요약: 현재 상태/다음 작업/primary
  action),
- `getDashboardCurrentStepArea()`로 "현재 단계 관리 영역만 크게, 나머지는
  접힘"(Progressive Disclosure)

을 전부 갖추고 있었다 — 이것이 사실상 이미 "guided step section"
패턴이다. 별도 `/dashboard/create` route나 새 wizard state machine을
만들 필요가 없다고 판단했다(**A안 채택, C안은 애초에 금지**). 이번
Phase는 이 기존 구조 위에 **용어/설명/readiness 연결**만 추가했다.

## 4. Step 완료 상태 derive 방식 / 사용자-facing Step 모델

새 DB 컬럼(`creation_step`/`wizard_step`/`onboarding_step` 등)을
추가하지 않았다 — `resolveDashboardWorkflowState()`의 기존 6개 상태를
그대로 쓴다. `ContentProgressSteps`의 5개 key와의 매핑(기존 그대로,
`app/dashboard/page.tsx`에 이미 있던 조건식):

| workflowState | ContentProgressStep | 라벨(이번 Phase에서 변경) |
|---|---|---|
| `needs_theme` | `theme` | "주제 선택"(이전: "테마 선택") |
| `needs_source` | `sources` | "참고자료 확인"(이전: "출처 입력") |
| `ready_to_generate`, `needs_platform_posts` | `generate` | "콘텐츠 만들기"(이전: "글 생성") |
| `needs_review` | `review` | "결과 확인"(이전: "검토/승인") |
| `ready_for_publish_prep` | `publish_ready` | "게시 준비"(변경 없음) |

지시서 권장 5단계("주제 정하기/참고자료 확인/사용할 곳 선택/콘텐츠
만들기/결과 확인")와 달리, "사용할 곳 선택"(플랫폼 선택)을 별도
progress-step으로 분리하지 않았다 — 실제 파이프라인 순서상 플랫폼
선택은 마스터 원고 생성 **이후**, 플랫폼별 글 생성 폼 **안에서**
이뤄지는 단일 UI 동작이라(플랫폼 카드 + 체크박스 폼이 이미 "콘텐츠
만들기" 섹션 하나에 통합되어 있다), 이를 상단 stepper의 별도 5번째
key로 분리하려면 `ContentProgressSteps`에 새 key를 추가하거나
workflowState를 세분화해야 했다 — 섹션 0의 "새 state machine을 만들지
않는다" 원칙과 충돌할 위험이 있어 하지 않았다. 대신 플랫폼 선택은
"콘텐츠 만들기" 섹션 내부에서 카드/체크박스 UI로 이미 명확히 노출된다
(10~13절 참고).

## 5. Step 1 — 주제

사용자 언어를 "테마"에서 "주제"로 통일했다(내부 코드/DB/타입은 `theme`
그대로 유지 — `Theme`/`themes` 테이블/`themeId` 등 전혀 변경 없음).
변경한 화면 텍스트: 새 주제 입력 폼 트리거("+ 새 주제"), 제출 버튼
("주제 만들기"), 목록 섹션 제목("주제 목록"), 검색 input
placeholder/aria-label("주제 검색"), 빈 목록 문구("아직 등록된 주제가
없습니다."), 삭제 확인 모달("이 주제를 삭제하시겠습니까?"), "현재 상태
/ 다음 작업" 카드의 needs_theme 문구, 삭제 성공/실패 redirect 메시지
(`app/dashboard/actions.ts`, `archiveThemeAction`/`addSourceRecord`
duplicate 처리 부분만). "테마 ID"/raw status 같은 기술 값은 원래도
노출되지 않았다(재확인 완료).

## 6. Step 2 — 참고자료

동일하게 "출처"를 "참고자료"로 통일했다(내부 코드/DB는 `source`/
`sources` 그대로). 참고자료 관리 섹션 제목, 추가 폼 트리거/버튼/
placeholder, 목록 요약 문구("참고자료 N개 등록됨"), 빈 상태 문구,
"전체 참고자료 보기" 토글, 마스터 원고 갱신 배너 문구, "현재 상태 /
다음 작업" 카드의 needs_source/ready_to_generate 문구, 원고 갱신 확인
배너("이미 이 주제로 생성된 마스터 원고가 있습니다.") 전부 반영했다.
`candidateFacts`/`verifiedFacts`/`rejectedFacts` 같은 raw fact-grounding
값은 원래도 이 페이지에 노출되지 않았다(재확인 완료, 정적 테스트로
회귀 방지).

## 7. Source Integrity 표현(섹션 9)

참고자료 관리 섹션에 신뢰 안내 문장 한 줄을 추가했다:

> 참고자료에서 확인되지 않은 내용은 최종 콘텐츠의 근거로 사용하지 않습니다.

Layer 1(Source Evidence Integrity) 검증 로직 자체는 전혀 건드리지
않았다 — 이 문장은 이미 존재하는 검증 동작을 사용자 언어로 설명만
할 뿐이다.

## 8. Step 3 — 플랫폼 선택 / capability 표현

`PLATFORM_LABELS`/`PLATFORM_COST_LEVELS`(기존, `lib/social/
platform-generation-recommendations.ts`)를 그대로 재사용한다.
WordPress=초안 저장, Copy 플랫폼(네이버 카페/뉴스/칼럼 등)=복사,
Manual 플랫폼=수동 준비라는 기존 구분은 카드의 `nextActionLabel`
("WordPress Draft 반영"/"수동 export"/"글 검토하기")이 이미 정확히
표현하고 있었다(재확인 완료, 변경 없음) — Draft/Copy/Manual 의미를
흐릴 수 있는 변경은 하지 않았다.

## 9. 플랫폼 카드 purpose 설명(섹션 11)

플랫폼 카드에 어댑터/기술 이름 대신 한 줄 목적 설명을 새로 추가했다.
기존 `PLATFORM_SHORT_DESCRIPTIONS`는 "HTML 변환"/"plain text"/"수동
export" 같은 기술적 부연이 섞여 있어(이미 `PlatformSelectionCheckboxes`
쪽에서 재사용 중이라 그대로 두었다) 카드에는 재사용하지 않고, 별도
`PLATFORM_PURPOSE_LABELS`(`lib/social/platform-generation-
recommendations.ts`, 신규 export)를 만들어 카드에서만 썼다:

| 플랫폼 | 카드 목적 설명 |
|---|---|
| WordPress 블로그 | 블로그용 긴 글 |
| 네이버 블로그 | 네이버 블로그용 글 |
| 네이버 카페 | 네이버 카페용 글 |
| X | 짧은 게시물 |
| Threads | 짧은 대화형 게시물 |
| Instagram | 캡션용 콘텐츠 |

## 10. Primary action hierarchy(섹션 12)

기존 구조가 이미 지시서 원칙과 일치한다(재확인, 변경 없음):
- Primary: 플랫폼 카드마다 "글 생성하기"(현재 선택 범위 = 그 카드 1개).
- Secondary: "여러 플랫폼 한 번에 선택해 생성"(고급, 기본 접힘) 안의
  "선택한 플랫폼 글 생성".
- Danger/cost-sensitive: 그 안의 또 다른 고급 옵션 "전체 플랫폼 글
  생성" — `ConfirmSubmitButton`으로 API 비용 경고 confirm을 유지한다.

PRODUCT-01B에서 이미 이 계층을 "카드=1개, 고급=여러 개, 더 깊은
고급=전체+confirm"으로 검토·확정했었다 — 이번 Phase에서도 재확인만
하고 순서를 바꾸지 않았다.

## 11. 생성 중 UX / fake progress 여부(섹션 14/15)

Dashboard의 마스터 원고 생성/플랫폼 글 생성은 **동기 form submit +
redirect** 방식이라(비동기 job 큐를 거치지 않는다), 임의 progress
바(80%/90% 등)를 표시할 실제 상태 자체가 없다 — 애초에 fake progress를
넣을 여지가 없는 구조였다(섹션 15 위반 없음, 확인만 함).

실제 비동기 진행 상태를 표시하는 기존 시스템은 `lib/job-progress/*` +
`components/job-progress/*`(다른 화면, 예: `/articles/[id]/blog`에서
이미 사용 중)이며, 상태 라벨은 전부 실제 state 기반이다("완료"/"진행
중"/"대기"/"재시도 중" 등, `getJobStatusLabel()`) — 임의 퍼센트가
아니다. 이번 Phase는 이 기존 라벨 체계를 그대로 재사용해 QA fixture
(`e2e/content-creation-experience.pw.ts`의 "생성 중" 상태)를 만들었다.

## 12. 결과 도착 후 / Review로 연결(섹션 17/18)

"현재 상태 / 다음 작업" 카드가 `needs_review` 상태에서 이미 "생성된
글이 있습니다(검토 대기 N개)." + "글 내용을 검토하세요." + "검토할 글
보기"(→ `/articles/[id]/social`) 링크를 제공한다 — 별도의 중복 안내를
새로 만들지 않았다(기존 구조 재확인, 변경 없음).

## 13. First-use CTA 연결(섹션 26)

PRODUCT-01D의 welcome CTA("첫 콘텐츠 만들기", `href="#theme-list"`)는
이 페이지의 실제 "주제 목록" 섹션(`id="theme-list"`)으로 정확히
연결된다 — dead link/ambiguous scroll 없음(재확인 완료, 앵커 대상
자체를 이번 Phase에서 옮기지 않았다).

## 14. Settings readiness 연결(섹션 25)

Dashboard에 새 배너를 추가했다: `getContentServiceReadiness()`(기존
PRODUCT-01D 함수, 재계산 없이 그대로 호출)의 `canCreateContent.status`가
`"available"`이 아니면, "콘텐츠 생성 준비 상태를 확인해 주세요." +
"설정에서 확인하기"(`/dashboard/settings`) 링크만 보여준다. 사용자가
고칠 수 없는 기술 설정(env var 등)을 직접 요구하지 않는다 — 그리고
기존 생성 폼/버튼(`action={createTheme}` 등)은 readiness 상태와 무관하게
항상 그대로 렌더링된다(막지 않는다, 실제로 실패하면 기존
`generationError` 배너가 이유를 알려준다).

## 15. 기존 콘텐츠 재진입(섹션 19)

`resolveDashboardWorkflowState()`가 매 요청마다 실제 DB 상태(테마/
출처/원고/플랫폼 글/승인 개수)에서 다시 계산되므로, 이미 진행 중이거나
완료된 테마를 다시 열어도 Step 1부터 다시 시작하지 않는다 — 이 동작은
원래부터 있었다(새로 만든 로직 없음, 재확인만 함).

## 16. 비용 보호(섹션 20/30)

전체 플랫폼 생성의 `ConfirmSubmitButton` + 경고 문구, 이미 생성된
플랫폼 재생성 시 "이미 생성된 플랫폼은 자동으로 건너뜁니다" 안내 —
전부 변경 없이 유지했다(정적 테스트로 회귀 방지).

## 17. Empty state(섹션 27)

참고자료가 없을 때의 문구를 통보형("아직 등록된 출처가 없습니다.")에서
행동 중심("콘텐츠의 근거로 사용할 참고자료를 추가해 주세요.")으로
바꿨다(참고자료 목록의 두 위치 모두).

## 18. 별도 create route 판단(섹션 24) — 결론: A(Dashboard 개선만으로 충분)

이번 Phase에서 확인한 바로는 `/dashboard/create`나 `/create` 같은 별도
route가 지금 당장 usability를 개선한다고 보기 어렵다 — 이미
`/dashboard`가 workflowState 기반으로 "현재 필요한 것만 보여주는" 단일
화면을 구현하고 있고, 여러 섹션(참고자료/원고/플랫폼)이 실제로는 같은
테마 컨텍스트를 공유해야 해서 분리된 route로 나누면 오히려 컨텍스트
전환 비용이 늘어난다. 향후 필요해질 수 있는 경우: (1) 참고자료 등록이
매우 많아져 페이지가 지나치게 길어질 때, (2) 여러 테마를 동시에
병렬로 작업하는 워크플로가 생길 때. 지금은 B(신설)가 불필요하다고
판단한다.

## 19. 알려진 한계

- ContentProgressSteps의 "생성"(generate) 단계가 마스터 원고 생성과
  플랫폼별 글 생성 두 실제 작업을 하나의 stepper key로 묶는다(4절
  참고) — 두 작업을 상단 stepper에서 시각적으로 구분하고 싶다면
  `ContentProgressSteps`에 새 key를 추가하는 후속 논의가 필요하다(이번
  Phase 범위 아님, state machine 추가 금지 원칙과 상충하지 않는 설계가
  먼저 필요).
- "테마"/"출처" 용어 통일은 `app/dashboard/page.tsx`, `app/dashboard/
  actions.ts`(사용자에게 실제로 보이는 redirect 메시지만),
  `components/dashboard/theme-search-list.tsx`,
  `lib/dashboard/dashboard-workflow-presentation.ts`,
  `components/articles/content-progress-steps.tsx`로 범위를 한정했다 —
  `/themes/[themeId]` 페이지, 상단 nav의 "자동 테마 찾기"(별도 기능
  이름, `/trends`), `pipeline_logs`에 남는 내부 log 메시지는 이번
  Phase에서 바꾸지 않았다(범위 밖, 사용자에게 직접 노출되지 않거나
  독립된 기능 이름이라 위험 대비 이득이 낮다고 판단).
- "생성 중" 상태는 실제 동기 form-submit 구조상 페이지에 상시
  존재하지 않는다(11절) — fixture는 `NextActionPanel`의
  `state="in_progress"` 표현을 그대로 재사용해 만든 QA용 재현이며,
  실제 화면에 상시 노출되는 요소는 아니다.
