# Product Language Dictionary (PRODUCT-01A, PRODUCT-01B 갱신)

- 작성일: 2026-09-23(PRODUCT-01A) / 2026-09-24(PRODUCT-01B 갱신)
- 조사 방법: `docs/ux/ui-information-levels.md`(Phase UX-01, 2026-09-18)를
  1차 근거로 삼되, **현재 코드를 다시 grep/read로 재확인**했다 —
  UX-02A~03C에서 이미 고쳐진 항목과 아직 남아있는 항목을 구분했다.
- 역할 모델: UX-01의 3단계(Level 1/2/3) 대신 **두 역할(INTERNAL_USER /
  ADMIN)**로 재분류한다. 기존 Level 2(펼치면 보이는 정보)는 대부분
  그대로 ADMIN_ONLY로 흡수한다 — "펼치면 누구나 보임"과 "관리자만
  봄"은 같은 것으로 취급한다(실제 접근 제어는 아직 구현하지 않음, UX
  경계로만 나눔).
- **PRODUCT-01B 갱신 내용**: 아래 표의 "PRODUCT-01B" 열에 실제 수정
  여부를 표시했다. 또한 PRODUCT-01A 조사 중 하나(raw enum 필터
  옵션)는 **재확인 결과 이미 `describeStatusValue()`로 올바르게
  변환되고 있었다** — grep만으로 array literal의 `value` 속성과
  실제 렌더 `label`을 구분하지 못해 생긴 오탐이었다. 아래 표에서
  이 정정을 명시했다.

## 분류 기준

- **KEEP**: 일반 사용자(INTERNAL_USER)에게 그대로 보여도 되는 개념.
- **SIMPLIFY**: 사용자에게 필요하지만 표현을 바꿔야 함.
- **ADMIN_ONLY**: 기능은 유지, 기본 화면에서는 숨김(이미 `<details>`/
  `AdvancedDetails`로 접혀 있으면 "구조는 맞지만 라벨이 아직 raw"로
  표시).
- **REMOVE_FROM_UI**: 코드/데이터 삭제가 아니라 표현·중복 제거 후보.
- **사용자 노출 없음**: 코드 주석/변수명/테스트에만 존재.

## 핵심 용어 사전

| Internal term | User-facing 한국어 | 분류 | Admin visibility | PRODUCT-01B | 현재 코드 근거 |
|---|---|---|---|---|---|
| `fact_grounding` | 출처 기반 사실 근거 | KEEP(이미 적용됨) | User | 변경 없음 | `lib/social/social-quality-gate.ts:349`, checklist label로 이미 노출 |
| `verifiedFacts` | 확인된 정보 | ADMIN_ONLY(필드명 자체는 노출 안 됨) | Admin(raw), User(간접) | 변경 없음 | `lib/articles/master-manuscript-types.ts` — UI에는 evidenceMap/checklist 형태로만 간접 노출 |
| `verificationNeeded` | 직접 확인이 필요한 내용 | SIMPLIFY 후보(유지) | User | 이번 Phase에서 미착수 | 통일된 사용자 문구는 아직 없음 — PRODUCT-01C 이후 |
| `needs_review` | 확인 필요 | KEEP(이미 라벨 헬퍼로 변환됨) | User | 변경 없음 | `lib/social/social-post-user-facing-status.ts:90` 등 |
| `unsupported`(fact-grounding reason) | 출처에서 확인되지 않음 | SIMPLIFY 필요(유지) | User | 이번 Phase에서 미착수 | 통일 문구 미정립, backlog |
| `pipeline_logs` | 작업 기록 | **수정 완료** | Admin | **✅ 수정됨** | `components/platform-api/api-dry-run-payload-preview.tsx:54` — "pipeline_logs에 저장" → "작업 기록에 저장"으로 교체 |
| `preflight` | 시스템 점검 | 사용자 노출 없음(웹 UI 없음) | Admin | 변경 없음(신규 개발 필요, 범위 밖) | `npm run ops:preflight` CLI 전용 |
| `job_run` / `job_run_step` | 작업 진행 상황 | KEEP(이미 라벨화됨) | User(진행률만), Admin(상세) | 변경 없음 | `components/job-progress/*` |
| `structured output failure` | 콘텐츠 생성 오류 | SIMPLIFY 필요(유지) | User simplified / Admin detailed | 이번 Phase 범위 아님(섹션 16 — 전체 error UX는 PRODUCT-01G) | `app/dashboard/actions.ts:439-453` |
| `provider`(SEO plugin) | SEO 연동 방식 | **수정 완료** | Admin(details 안) | **✅ 수정됨** | `app/articles/[id]/page.tsx` `<dt>SEO_PLUGIN_PROVIDER</dt>` → `<dt>SEO 연동 방식</dt>` |
| `WORDPRESS_BASE_URL`/`WORDPRESS_PUBLISH_ENABLED`/`SEO_PLUGIN_PROVIDER`(env var 이름 자체) | WordPress 사이트 주소 / WordPress·SEO 게시 기능 상태 / SEO 연동 방식 | **수정 완료** | Admin | **✅ 수정됨(`app/articles/[id]/page.tsx` 6곳)** | env var를 **읽는 코드**(`process.env.X`)는 유지, `<dt>` 라벨/안내 문구만 한국어로 교체 |
| `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED` | Custom Endpoint 기능 상태 | **수정 완료** | Admin | **✅ 수정됨** | `app/articles/[id]/page.tsx` |
| `ARTICLE_SEARCH_ENABLED` | (해당 없음) | ADMIN_ONLY | Admin | 이번 Phase에서 미착수(라인 단위 미검증) | `app/themes/[themeId]/page.tsx:132` |
| `guardScore`/`qualityScore`(raw 숫자) | 게시 준비 점수 / 품질 점수 | ADMIN_ONLY(기존에 이미 양호) | Admin | 변경 없음(이미 "상세 JSON 보기" 기본 닫힘 안에만 존재, e2e로 보장됨) | `app/articles/[id]/blog/page.tsx`, `app/social-posts/[id]/page.tsx` |
| `externalPostId` | WordPress 글 번호 | ADMIN_ONLY | Admin | 변경 없음 | WordPress Draft 링크 생성에 필요한 내부 값 |
| `handoffStatus`/`platformPublishDryRunStatus`/`exportStatus`(raw enum) | (버튼 라벨로만 간접 노출) | ADMIN_ONLY(기존에 이미 양호) | Admin | 변경 없음 | 사용자에게는 "게시용 내보내기 준비"/"게시 준비 확인" 등 버튼 라벨로만 노출 |
| Supabase / Anthropic / Claude / Vercel | (사용자에게 노출할 개념 아님) | 사용자 노출 없음 | Admin | 변경 없음(재확인 완료, 여전히 미노출) | 실제 UI 텍스트에 없음 |
| `preflight`/`ops:report-usage`/AI 사용량(token) | 시스템 점검 / AI 사용량 | 사용자 노출 없음(CLI 전용) | Admin | 변경 없음(신규 개발 필요, 범위 밖) | — |
| ~~`raw enum` 필터 옵션~~(`not_measured` 등) | 성과 없음 / 낮음 / 보통 / 우수 / 확인 필요 등 | **정정: PRODUCT-01A 오탐** | User | **수정 불필요로 판명** | `dashboard/blog`, `dashboard/rewrite`, `dashboard-filter-controls.tsx` — array의 `value` 속성(raw)과 실제 렌더 `label`(`describeStatusValue()` 경유)을 혼동한 grep 오탐이었다. 실제로는 이미 `<option value={raw}>{describeStatusValue(raw)}</option>` 형태로 정확히 구현되어 있었다(재확인 완료) |
| `SEO Plugin update status`(영문 라벨) | SEO 반영 처리 결과 | **수정 완료** | Admin(details 안) | **✅ 수정됨** | `app/articles/[id]/blog/page.tsx` — "현재 provider"→"현재 SEO 연동 방식", "last updated at"→"마지막 반영 시각", "error message"→"오류 메시지"도 함께 수정 |

## "이미 잘 되어 있는" 참고 사례(재확인 완료, 유지 권장)

- `checkRecordable()`/`checkExportable()`의 blocked 사유 문구 — 전부
  자연어 문장(Phase UX-05B 원칙 그대로 유지되고 있음, 이번 대화에서
  실제 버그를 고치면서 직접 재확인).
- `lib/social/social-post-user-facing-status.ts`,
  `lib/ui/status-badge-class.ts` — raw enum → 한국어 라벨 변환이
  일관되게 적용되는 헬퍼 계층이 이미 존재.
- `components/common/advanced-details.tsx`(`AdvancedDetails`) — "기본
  닫힘, raw 값은 여기에만" 원칙이 컴포넌트 레벨로 이미 강제되어 있음
  — PRODUCT-01A의 ADMIN_ONLY 경계를 만들 때 이 컴포넌트를 그대로
  재사용할 수 있다(섹션 13 참고, 신규 컴포넌트 불필요).
- Supabase/Anthropic/Vercel/API key/token 값 — 실제 UI 텍스트에 전혀
  노출되지 않음(재확인 완료).

## 안전 관련 문구(용어만 바꾸고 의미는 유지해야 하는 것 — 섹션 17)

| 현재 raw/기술 표현 | 유지해야 하는 의미 | 비고 |
|---|---|---|
| `exportStatus`/`publishStatus === "exported"` | "복사됨 ≠ 실제 게시됨" | copy/manual 플랫폼에서 절대 삭제하면 안 되는 구분 |
| `manualPostStatus !== "posted"` | "게시 완료로 기록하지 않았다 = 실제로 게시 안 함" | 허위 완료 기록 방지 로직, 용어만 SIMPLIFY 대상 |
| `wordpressStatus: "draft"` | "Draft는 공개 게시가 아니다" | 이번 대화에서 사용자가 직접 헷갈렸던 지점 — 반드시 유지 |
| fact_grounding `warning`(blocked 아님) | "확인 필요 ≠ 차단됨" | 승인 자체는 가능해야 함(현재 동작 유지) |

## PRODUCT-01C: Review/Approval/Publish 언어 — 서로 다른 축을 하나로 합치지 않는다

지시서 섹션 3/7이 요구하는 "must not be confused with" 매핑. 각 축은
**서로 다른 코드/컴포넌트가 계산**하며, 이번 Phase에서도 하나의
enum/state machine으로 합치지 않았다.

| Internal term | User-facing 한국어 | Meaning(축) | Scope(계산 위치) | Must not be confused with |
|---|---|---|---|---|
| `fact_grounding` checklist item, `AutoReviewIssue`(axis="source") | 출처 확인 · 확인할 사항 N건 | Evidence(출처 검증) — Layer 1/2 fact-grounding 결과 | `lib/social/social-post-auto-review.ts`의 `summarizeUserFacingReview` | "검토 완료"(사람의 승인 절차)와 다름 — evidence가 전부 "확인됨"이어도 사람이 아직 승인 버튼을 누르지 않았을 수 있다 |
| `approvalStatus`(pending_review/approved 등) | 검토 대기 중 · 승인 완료 | Human workflow(사람의 승인 절차) | `lib/social/social-post-user-facing-status.ts`의 `getUserFacingStatus`/`getNextRecommendedAction` | "게시 완료"와 다름 — 승인은 게시 준비의 한 단계일 뿐, 실제 외부 게시가 이뤄졌다는 뜻이 아니다 |
| `exportStatus`/`handoffStatus`/`manualPostStatus` | 내보내기 준비 · 수동 게시 준비 완료 · 게시 완료 기록 | Publish preparation(게시 준비 단계) | `lib/social/platform-manual-posting-result-service.ts` 등 | "최종 승인"과 다름 — 승인 이후에만 시작할 수 있는 별도 단계 체인이다 |
| `needs_review`(status-labels.ts 공용 enum 값) | 검토 필요 | 성과 비교/재작성 비교 등 **범용** "사람이 봐야 함" 표시 | `lib/social/status-labels.ts`의 `describeStatusValue` | fact-grounding의 "확인 필요"와 문자열은 비슷해 보이지만 **다른 화면(성과/비교 대시보드)에서 다른 대상**(비교 결과 자체)을 가리킨다 — 강제로 통일하지 않았다(섹션 10 예외 조항) |
| `getNextRecommendedAction`의 `"검토하기"`/`"검토 요청하기"` | 글 검토하기 · 다시 검토 요청하기 | Human workflow의 **버튼 라벨** | `lib/social/social-post-user-facing-status.ts` | 바로 위 `getUserFacingStatus`의 "검토가 필요합니다" 문구와 **의도적으로 같은 단어를 공유**한다 — NextAction과 status 요약이 서로 다른 단어를 쓰면 모순처럼 보이기 때문(섹션 11 원칙 그대로 이미 지켜지고 있었음, 재확인 완료) |

**PRODUCT-01C에서 재확인한 결론**: 이 네 축은 이미 서로 다른 파일/함수가
계산하고 있었고, 같은 화면에 같이 노출될 때도 실제로 모순되는 문구
조합은 발견되지 않았다(아래 "재검토 판단" 참고). 강제로 하나의
표현으로 합치는 리팩터링은 **오히려 의미를 훼손할 위험**이 있어
수행하지 않았다.

## PRODUCT-01D: 서비스 준비 상태(readiness) 용어

`lib/ui/content-service-readiness.ts`가 기존 `runProductionPreflight()`
결과(admin 전용 raw check)를 재계산 없이 그대로 재사용해서 일반
사용자 언어로 번역한 값. `/dashboard/settings`의 "연결 상태" 절에서만
쓰인다 — admin 화면은 여전히 기존 preflight raw 결과를 그대로 쓴다.

| Internal term(`ReadinessStatus`) | User-facing 한국어 | 의미 | Must not be confused with |
|---|---|---|---|
| `"available"` | 사용 가능 / 연결됨 | preflight `pass` | "확인이 필요합니다"(needs_attention)와 구분 — 실제로 정상 동작 확인됨 |
| `"needs_attention"` | 확인이 필요합니다 / WordPress 연결을 확인해 주세요 | preflight `warning`\|`fail` | "상태를 확인할 수 없습니다"(unknown)와 다름 — needs_attention은 설정이 있지만 문제가 있다는 뜻, unknown은 판단 근거 자체가 없다는 뜻(섹션 22, "연결 안 됨"으로 함부로 단정하지 않는다) |
| `"unknown"` | 상태를 확인할 수 없습니다 | preflight check 자체가 없음(찾을 수 없음) | "연결 안 됨"이 아니다 — 모른다는 것과 끊어졌다는 것은 다른 상태다 |
| `requiresHumanApproval: true`(항상 고정) | 출처 확인 · 게시 전 최종 확인 = "사용 중"(toggle 없음) | 구조적으로 항상 강제되는 안전장치(`assertApproved`) | preflight에서 파생되는 값이 아니다 — env 설정과 무관하게 항상 true |

이 3단계 용어는 PRODUCT-01A의 "안전 관련 문구" 원칙(위 표)과 마찬가지로
"모른다 ≠ 끊어졌다 ≠ 연결됐다"를 명시적으로 구분하기 위해 도입했다.

## PRODUCT-01E: Content Creation Experience 용어

| Internal term | User-facing 한국어(이번 Phase에서 통일) | Scope(범위) |
|---|---|---|
| `theme`/`Theme`/`themes` 테이블 | 주제(이전: 테마) | `app/dashboard/page.tsx`, `app/dashboard/actions.ts`(사용자에게 보이는 redirect 메시지만), `components/dashboard/theme-search-list.tsx`, `lib/dashboard/dashboard-workflow-presentation.ts`. 코드/DB 식별자는 `theme` 그대로 — `/themes/[themeId]` 페이지·`자동 테마 찾기`(별도 기능명, `/trends`)는 범위 밖(변경 없음) |
| `source`/`sources` 테이블 | 참고자료(이전: 출처) | 위와 동일 범위. 코드/DB 식별자는 `source` 그대로 |
| `ContentProgressStep`(`theme`/`sources`/`generate`/`review`/`publish_ready`) | 주제 선택 / 참고자료 확인 / 콘텐츠 만들기 / 결과 확인 / 게시 준비 | `components/articles/content-progress-steps.tsx` — key/파생 로직은 변경 없음, 라벨만 사용자 언어로 통일 |

상세 근거와 범위 밖 항목 목록은
`docs/product/product-01e-content-creation-experience.md` 19절("알려진
한계") 참고.

## PRODUCT-01F: Publish & Connection UX 용어

| Internal term | User-facing 한국어 | Must not be confused with |
|---|---|---|
| `PublishCapability: "draft"` | 게시 방식: 초안으로 저장 | "공개 게시"와 다름 — WordPress Draft는 항상 비공개 초안 |
| `PublishCapability: "manual"` | 게시 방식: 외부에서 직접 게시 | "copy"와 다른 메시지(승인 후 안내 문구가 서로 다름, `getPostApprovalNextActions` 참고) |
| `PublishCapability: "copy"` | 게시 방식: 본문 복사 후 직접 게시 | "복사 완료"는 "게시 완료"가 아니다 |
| `manual_post_status='posted'` | 게시 완료 기록 | "앱이 게시했다"가 아니라 "사용자가 외부 게시 결과를 기록했다"는 뜻(`recordManualPostingResult` 메시지에 명시) |
| `manualPostUrl` 입력 필드 | 게시한 주소 | 기술적 "URL field" 표현 대신 |

상세 근거는 `docs/product/product-01f-publish-connection-ux.md` 참고.

## PRODUCT-01G: Friendly Errors & Empty States 용어

| Internal term | User-facing 한국어 | Scope |
|---|---|---|
| raw JS 런타임 에러(`Cannot read properties...`, `TypeError:` 등) | (행동 중심 fallback 문구, 화면마다 다름) | `lib/errors/describe-unexpected-error.ts`(`describeUnexpectedError`) |
| `JobRunStepStatus: "stalled"`(감지값) | 멈춤 가능성 있음 | `job-progress-labels.ts`(기존) — "실패"와 다른 배지 |
| Next.js 기본 404 | 콘텐츠를 찾을 수 없습니다. | `app/not-found.tsx`(신규) |
| Next.js render 예외 | 문제가 발생했습니다. | `app/error.tsx`(신규) |
| `error.digest`(Next.js 자체 진단 참조값) | 문제가 계속되면 관리자에게 전달할 참조 번호 | DB UUID/raw stack이 아님 — 노출 허용 |

상세 근거는 `docs/product/product-01g-friendly-errors-empty-states.md` 참고.
