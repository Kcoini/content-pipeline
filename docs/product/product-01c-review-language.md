# PRODUCT-01C: Review Language & Navigation Clarity

- 작성일: 2026-09-24
- 목적: "대시보드"처럼 의미가 모호한 navigation 문구를 정리하고,
  review/grounding/approval 관련 사용자 언어를 전수 조사해 실제
  문제를 찾아 고친다. **DB schema/enum/status machine/approval
  semantics/source integrity/fact-grounding/auto-fix/WordPress Draft/
  publish capability/guard/repository/server action/외부 side
  effect는 전혀 건드리지 않았다** — presentation/language만 수정.

## 1. 기존 문제

- 상단 navigation 트리거가 "대시보드"라고 표시되어, 실제로는
  콘텐츠 관리+성과 분석+관리자 메뉴 전체를 담고 있음에도 "대시보드로
  이동하는 버튼"처럼 보였다.
- (조사 전 가설) fact-grounding/review/approval 관련 용어가 화면마다
  다르게 쓰이고 있을 가능성.

## 2. 조사 결과 — 상태 의미 분리(이미 잘 되어 있었음)

지시서가 나열한 컴포넌트(`HumanReviewPanel`, `AutoReviewSummaryCard`,
`MultiPlatformReviewSummaryCard`, `WorkflowStatusCard`,
`NextActionPanel`, `PublishPreparationSummaryCard`)와 그 뒤의 helper
(`lib/social/social-post-auto-review.ts`,
`lib/social/social-post-user-facing-status.ts`,
`lib/social/status-labels.ts`, `lib/ui/workflow-status-view-model.ts`,
`lib/ui/next-action-view-model.ts`)를 전수 확인한 결과, **이미
Phase UX-03A/UX-03B1/UX-04A에서 정확히 지시서가 요구하는 구조로
구현되어 있었다**:

- `summarizeUserFacingReview()`(UX-04A)가 정확히 지시서가 예로 든
  `ReviewUserViewModel` 역할을 이미 수행 중이다 — `state`("checking"/
  "ready"/"needs_confirmation"/"blocked"/"failed"), `stateLabel`,
  `stateMessage`, `confirmationCount`를 반환하는 **derived
  presentation-only** 함수이며 DB에 아무것도 쓰지 않는다. → **새
  view model을 만들지 않았다**(섹션 4 지시 그대로).
- Evidence(출처 검증)와 Human workflow(승인 절차)와 Publish
  preparation(게시 준비)은 이미 서로 다른 파일이 계산한다(아래
  섹션 5 표 참고) — 하나의 enum으로 합쳐져 있지 않았다.
- `WorkflowStatusCard`/`NextActionPanel`은 이미 "현재 상태 + 완료
  항목 + 남은 작업" / "다음 작업 + primary 1개 + secondary"
  포맷으로 통일되어 있다(섹션 8 요구사항 기존 충족).

**결론**: 이번 Phase에서 review language 자체를 대규모로 다시 쓰지
않았다 — 이미 있는 좋은 구조를 재확인하고, 실제로 발견한 문제
(navigation 트리거)만 고쳤다.

## 3. Evidence language

변경 없음(이미 올바름):

| 내부 개념 | 사용자 문구 | 위치 |
|---|---|---|
| fact_grounding checklist warning | "확인할 사항 N건" / "출처 확인" | `AutoReviewSummaryCard`, `summarizeUserFacingReview` |
| `needs_review`(axis="source") | "확인 필요" | `HumanReviewPanel`의 severity 배지 |
| unsupported claim | (checklist message로 문장 형태 노출, 별도 라벨 없음) | `lib/social/fact-grounding-validator.ts` → checklist message |

`unsupported`/`conflicting`에 대한 고정 라벨("출처에서 확인되지
않음"/"출처 간 내용이 다름")은 이번 Phase에서 신규로 만들지
않았다 — 현재 코드에서 이 두 값이 **checklist item 레벨의 독립
라벨로 노출되는 지점이 없고**(fact-grounding은 항목 하나로 뭉쳐진
message 문장만 노출), 새 라벨을 도입하면 실제로 쓰이지 않는
dictionary 항목만 늘어나 오히려 혼란을 줄 수 있어 보류했다
(PRODUCT-01D 이후, source-evidence-integrity-validator의 4개 상태를
UI에 직접 노출하는 화면이 생길 때 다시 판단).

## 4. Human action language

변경 없음(이미 올바름) — `HumanReviewPanel`의 severity 배지:

```
info     → 참고
warning  → 확인 필요
blocking → 승인 불가
```

`auto_fixable` 항목은 이미 기본 화면에 노출되지 않는다
(`summarizeUserFacingReview`가 `visibleIssues`에서 제외) — 대신
"자동으로 정리할 수 있는 항목 N개를 발견했습니다" 안내 배너로만
간접 노출된다(`app/articles/[id]/social/page.tsx`).

## 5. Approval/Review language

| 축 | 예시 문구 | 계산 위치 |
|---|---|---|
| Evidence(출처 검증) | "확인할 사항 2건" | `summarizeUserFacingReview` |
| Human workflow(승인 절차) | "현재 검토가 필요합니다" / "승인 완료" | `getUserFacingStatus` |
| Publish preparation(게시 준비) | "내보내기 완료" / "수동 게시 준비 완료" | `platform-manual-posting-result-service.ts` |
| 실제 게시 | (이 앱에는 "실제 게시 완료" 문구 자체가 없다 — capability가 draft/manual/copy뿐이라 항상 "Draft"/"복사 준비"까지만) | `docs/ops/production-operation-policy.md` 섹션 4 |

상세 매핑/"must not be confused with"는
`docs/product/product-language-dictionary.md`의 "PRODUCT-01C" 절
참고.

## 6. Navigation 변경

`components/navigation/dashboard-top-nav.tsx`: 트리거 라벨
"대시보드"(desktop) / "메뉴"(mobile, 기존)를 **"메뉴"로 통일**.
route는 전혀 바꾸지 않았다.

## 7. Examples(수정 전/후)

```
[수정 전] 상단 버튼: "대시보드 ▾"
[수정 후] 상단 버튼: "메뉴 ▾"
```

review/approval/publish 언어는 예시를 들 만한 실제 수정이
없었다(이미 올바른 상태를 재확인).

## 8. Remaining limitations

- `needs_review`(공용 status-labels.ts 값, "검토 필요")와
  fact-grounding의 "확인 필요"가 서로 다른 화면(성과/비교 대시보드 vs
  글 검토 화면)에서 비슷한 단어를 쓴다 — 지시서 섹션 10의 예외
  조항("workflow 의미가 다른 것은 억지로 합치지 않는다")에 따라
  의도적으로 유지했다.
- `unsupported`/`conflicting`(Layer 1 source integrity)의 전용
  사용자 라벨은 아직 없다(섹션 3 참고) — 이 두 상태를 직접 노출하는
  화면이 생기면 그때 확정한다.
- Dashboard 생성 버튼 문구("선택한 플랫폼 글 생성" 등, 지시서 섹션
  12)는 이번 Phase에서 변경하지 않았다 — PRODUCT-01B에서 이미 안내
  문구로 기능 차이를 설명했고, "글 생성" vs "콘텐츠 만들기" 같은
  표현 교체는 이 프로젝트 전반의 "글" 용어 관례(예: "글 검토하기",
  "글 목록")와 맞대어 볼 때 이번 Phase 범위에서 확신을 갖고 바꿀
  근거가 부족했다(재검토는 PRODUCT-01D 후보).
- `/dashboard` 자체가 홈+콘텐츠 만들기+진행 확인을 겸하는 문제는
  Wizard/IA 재구성이 필요해 PRODUCT-01A부터 계속 이월되고 있다.
