# UX-05B: Publish Execution & Completion UX

- 작성일: 2026-09-18
- 범위: UX-05A에서 확정된 사실(어떤 플랫폼에도 실제 "즉시 API 게시"가
  구현되어 있지 않다)을 전제로, 실제 존재하는 capability(draft/
  manual/copy)만 사용해 게시 실행과 완료 UX를 연결했다. 조사 결과
  대부분의 안전장치(승인 무효화, 게시 완료 글 수정 차단, 수동 게시
  완료 기록 guard)가 이미 저장소 레벨에 완전히 구현되어 있어, 실제
  코드 변경은 대부분 프레젠테이션 계층(라벨/안내 문구/연결)에
  국한됐다. `docs/ux/full-ux-audit.md`, `docs/ux/user-journey-audit.md`,
  `docs/ux/ux-refactor-roadmap.md`, `docs/ux/ux-05a-publish-preparation.md`,
  `docs/ui-ux-governance-rules.md`를 먼저 읽고 작업했다.
- 이번 Phase에서 하지 않은 것: 새 외부 API publish 기능, bulk
  external publish, DB migration, approval/publish guard 우회, 새
  direct-publish capability.

---

## 1. 최종 platform capability 표

UX-05A에서 이미 확정한 표와 동일하다(이번 Phase에서 재확인만 함,
변경 없음):

| capability | 플랫폼 | 실제 행동 |
|---|---|---|
| `draft` | wordpress_blog | WordPress Draft 생성/업데이트/보기(실제 REST API 호출, 공개 게시 아님) |
| `manual` | naver_blog, news_article, opinion_column | 본문 복사 + 수동 export 준비 + (조건 충족 시) 게시 완료로 표시 |
| `copy` | naver_cafe, x, threads, instagram | 본문 복사 + (조건 충족 시) 게시 완료로 표시 |

`[네이버에 게시하기]`/`[X에 게시하기]`/`[Instagram에 게시하기]`/
`[Threads에 게시하기]`/`[카페에 게시하기]` 같은 라벨이 프로젝트
어디에도 없음을 전수 검색으로 재확인했다(0건).

## 2. PublishExecutionState 구현 방식

**별도의 `PublishExecutionState` 타입을 새로 만들지 않았다.** 대신
UX-05A의 `PublishPreparationState`에 `"action_completed"` 값을
추가했다:

```ts
export type PublishPreparationState =
  | "not_approved" | "needs_attention" | "needs_setup" | "ready"
  | "action_completed" // 신규: 시스템 작업(Draft 생성/본문 복사)은 끝났지만 외부 게시는 아직 미확인
  | "in_progress" | "completed" | "failed";
```

별도 타입을 만들지 않은 이유: "게시 준비"와 "게시 실행"은 하나의
플랫폼 카드가 시간에 따라 지나가는 연속된 단계이지, 서로 다른 두
개의 병렬 판단 축이 아니다. 두 번째 ViewModel 타입을 만들면 같은
카드에 "이 카드의 진짜 상태가 뭔지" 판단하는 로직이 두 개 생기는
셈이라(governance: "한 화면에는 primary action 판단 로직이 하나만"),
기존 `PublishPreparationState`를 확장하는 쪽을 선택했다.

**중요**: `"action_completed"`는 타입/집계(`MultiPlatformPublishPreparationSummary`)/
요약 카드(`PublishPreparationSummaryCard`, "작업 완료(외부 게시 확인
필요)" 줄)에는 전부 반영했지만, **실제로 이 state를 만드는 어댑터
로직은 없다** — WordPress Draft 보기(`view_draft`)와 copy_body는
여전히 `"ready"`로 분류된다(UX-05A의 기존 결정 유지, 아래 3/4절 참고).
타입은 앞으로 이 구분이 실제로 필요해질 때(예: "Draft 생성됨"과
"Draft 조회 가능"을 구분해야 하는 요구가 생기면) 쓸 수 있도록
미리 준비해 뒀다 — 다음 Phase 후보로 명시적으로 남긴다.

## 3. WordPress Draft 실행 UX

**조사 결과 코드 변경이 필요하지 않았다.** `create_draft`/
`update_draft` primaryAction은 `app/articles/[id]/actions.ts`의
`prepareWordPressBlogPostForPublishingAction`으로 이어지는데, 이
action은 이미:

- 실패 시 자연어 에러 메시지 + `redirectToSafeTarget`으로 안전하게
  복귀(크래시하지 않음)
- `jobRunId`를 반환해 `JobProgressCard`로 진행 상태 표시 가능
- 같은 버튼을 다시 누르면 재시도되는 멱등적 구조

를 갖추고 있었다. "Draft 생성 완료 ≠ 공개 게시 완료"는 이미
`fromWordPressPublishPrepStateToPublishPreparation`(UX-05A)가
`view_draft` action을 `"ready"`로만 표시하고 `"completed"`로는
표시하지 않는 것으로 이미 지켜지고 있었다(`"completed"`는
`publishStatus === "published"`일 때만 나온다 — WordPress는 이
프로젝트에서 공개 게시 자동화 대상이 아니므로 이 경로를 실제로 타는
경우가 없다).

## 4. copy 플랫폼 실행 UX

`components/social/copy-post-body-button.tsx`(`CopyPostBodyButton`)는
순수 client-side 컴포넌트(`navigator.clipboard`, 서버 호출 없음)임을
재확인했다. "게시 준비" 섹션의 복사 버튼에 새 optional prop
`manualResultAnchorId`를 추가해, 복사 성공 시 클라이언트 로컬
state(`useState`)만으로 한 줄 안내를 보여준다: "외부 플랫폼에서
게시한 뒤 게시 완료로 표시할 수 있습니다" + `#social-post-manual-result-{id}`
앵커 링크. **DB에는 아무것도 쓰지 않는다** — "복사했다"는 사실을
영구 저장할 필요가 없다는 spec의 명시적 지침을 따랐다. 다른 3곳의
`CopyPostBodyButton` 사용처는 이 prop을 전달하지 않아 기존 동작
그대로다.

## 5. manual 플랫폼 실행 UX

naver_blog/news_article/opinion_column은 copy 플랫폼과 동일한 패턴
(`fromPostApprovalNextActionsToPublishPreparation`이 이미 공통으로
처리)을 따른다 — 별도 구현 불필요.

## 6. 본문 복사와 게시 완료 분리 방식

`copy_body` 성공(클라이언트 이벤트)과 `manual_post_status`/
`publish_status` 변경(서버 상태)은 코드 경로가 완전히 분리되어 있다
— 복사 버튼은 애초에 서버를 호출하지 않으므로, "복사 성공 → 자동
posted 처리" 같은 코드가 존재할 수 없는 구조다(존재하지 않음을
정적 검사로도 확인).

## 7. 게시 완료 기록 action 재사용/신설 여부

**전부 재사용했다. 신규 action을 만들지 않았다.** 조사 결과
`recordManualPostingResultAction`(`app/articles/[id]/actions.ts`) →
`recordManualPostingResult`(`lib/social/platform-manual-posting-result-service.ts`)가
이미 완전한 형태로 존재했다:

- 사용자의 명시적 클릭(폼 제출) 필요
- `checkRecordable()` guard: qualityStatus/approvalStatus/exportStatus/
  platformPublishGuardStatus/platformPublishReady/
  platformPublishDryRunStatus/handoffStatus/publishStatus 전부 확인
  (승인된 글만이 아니라 게시 준비 체크리스트 전체가 끝나야 기록 가능
  — 기존 설계를 그대로 유지, 약화하지 않았다)
- 성공 시 `manual_post_status='posted'`이자 동시에
  `publish_status='published'`로 전환(사람이 직접 게시했다는 기록 —
  자동 게시 아님, 함수 주석에 이미 명시)
- 이 Phase에서 수정한 것은 `checkRecordable()`의 **메시지 텍스트만**
  (raw DB 필드명 제거) — 판단 조건은 전혀 바꾸지 않았다.

이 기존 폼(페이지에 이미 "게시 결과 기록 / Metrics 입력" 접힘
섹션으로 존재, `id={buildAnchorId("social-post-manual-result", post.id)}`)을
새 `PlatformPublishPreparationCard`의 secondaryAction("게시 완료로
표시")에서 anchor 링크로 연결했을 뿐이다.

## 8. 게시 URL 지원 여부

지원된다(이미 존재) — `recordManualPostingResult`는
`manualPostUrl`을 **필수** 입력으로 받는다(spec은 선택 사항을
제안했지만, 기존 코드가 이미 필수로 강제하고 있었고, 이는 "게시
완료"를 주장하려면 실제 게시 URL이 있어야 한다는 안전한 기존 설계라
판단해 약화하지 않았다). 성공하면 `postUrl`에 저장되고, "게시글
보기" 링크(`renderPublishAction`의 `view_detail`/completed 분기,
이미 UX-05A에서 구현)로 노출된다. DB migration은 필요 없었다.

## 9. bulk approval 후 [게시 준비 보기] 구현

`app/articles/[id]/social/page.tsx`의 "게시 준비" 섹션에
`id="publish-preparation"`을 부여했다. `bulkApproveSocialPostsAction`의
성공/부분성공 메시지(둘 다 "승인 완료" 문자열을 포함하도록 UX-04B
때부터 이미 설계되어 있음)를 감지해, 해당 배너 옆에 `#publish-preparation`으로
스크롤 이동하는 "[게시 준비 보기]" 링크를 추가했다. 새 route는
만들지 않았다.

## 10. publish preparation → execution 연결 방식

`PublishPreparationViewModel`(UX-05A)의 `secondaryActions` 배열에
페이지 렌더링 시점에서 "게시 완료로 표시" action을 추가하는 방식으로
연결했다 — 공유 어댑터(`lib/ui/publish-preparation-view-model.ts`)
자체는 건드리지 않고, 페이지 코드(`app/articles/[id]/social/page.tsx`)에서만
조건부로 덧붙였다(플랫폼별 guard 조건은 여전히 서버의
`checkRecordable()`이 최종 판단 — 페이지는 링크만 보여줄 뿐 권한을
부여하지 않는다).

## 11. 실패/재시도 처리

WordPress: 3절 참고(이미 충분). copy/manual 플랫폼: 클라이언트 측
클립보드 실패는 `CopyPostBodyButton`이 이미 fallback(임시 textarea +
execCommand)과 실패 메시지를 갖추고 있었다(기존 구현, 변경 없음).
없는 backend retry는 새로 만들지 않았다 — spec의 명시적 지침을
따랐다.

## 12. partial completion 처리

`MultiPlatformPublishPreparationSummary`(UX-05A)가 이미 상태별
개수를 전부 보여준다("게시 준비 완료 N개"/"작업 완료(외부 게시 확인
필요) N개"/"완료 N개" 등, 0개 행은 생략) — 플랫폼 전체가 완료라고
주장하지 않고 상태별로 정확히 나눠서 보여주는 기존 설계가 이미 이
Phase의 요구사항을 만족했다.

## 13. 완료 카드 compact 처리

`PlatformPublishPreparationCard`(UX-05A)는 이미 compact 1카드
디자인이었다 — 완료 상태여도 카드 하나 크기가 커지지 않는다(추가
변경 없음). `action_completed` 상태의 톤 클래스만 새로 추가했다.

## 14. 승인 후 본문 수정 정책 조사 결과

**이미 완전히 구현되어 있었다.** `lib/social/social-post-service.ts`의
`editSocialPostContent` → `lib/repositories/social-posts-repository.ts`의
`saveSocialPostRevision`이 수정 시마다 `quality_status`를
`not_checked`로, `approval_status`를 `not_requested`로,
`publish_status`를 `not_published`로 **자동 초기화**한다(이미 저장소
레벨에 구현되어 있었음, 코드 주석에도 명시). 승인된 글을 수정하면
승인이 자동으로 무효화되는 것이 이미 기존 정책이었다 — 새 정책을
만들지 않았다.

## 15. 이미 게시 완료된 글 수정 정책

**이것도 이미 완전히 구현되어 있었다.** `saveSocialPostRevision`은
`existing.publishStatus === "published"`이면 저장 자체를 거부하고
`"이미 게시된 social post는 수정할 수 없습니다."`를 던진다(하드
가드, 우회 불가). 다만 **프레젠테이션 갭**이 있었다 —
`[본문 수정]` 버튼이 이 경우에도 여전히 활성 상태로 보여서, 클릭하면
폼 제출 → 서버 guard가 막음 → 에러 메시지로 리다이렉트라는 불필요한
왕복이 발생했다. `app/articles/[id]/social/page.tsx`와
`app/articles/[id]/blog/page.tsx`의 3개 `SocialPostBodyPanel`
호출부에서 `publishStatus === "published"`일 때 `editable`(및 X의
`threadItems`/`saveThreadAction`)을 강제로 끄고, "이미 게시 완료로
표시된 글입니다. 본문 수정은 외부 게시물에 자동 반영되지 않습니다."
안내로 대체했다 — **저장소 레벨 가드는 전혀 건드리지 않았다.**

## 16. naver_cafe bold residue 수정

UX-05A에서 발견한 비대칭(naver_cafe가 escape된 markdown/HTML
entity만 검사하고 unescaped `**bold**`는 놓침)을 해소했다.
`social-quality-gate.ts`의 `naver_cafe_no_markdown_escape` 검사
조건에 `MARKUP_RESIDUE_BOLD_PATTERN`(x/threads/instagram의
`platform_markup_residue` 검사에서 이미 쓰던 정규식)을 추가했다.
자동 수정기(`naver-cafe-plain-text-sanitizer.ts`의
`stripBoldMarkers`)는 이미 이 케이스를 처리하도록 구현되어 있어서
(이전에는 트리거되지 않았을 뿐), 검사 조건만 추가하면 됐다 — 새
sanitizer/새 checklist key를 만들지 않았다.

## 17. 자동 외부 게시 방지 검증

- `[네이버에 게시하기]` 등 5종 라벨 프로젝트 전체 검색 결과 0건.
- `[5개 모두 게시]`/`[전체 플랫폼 게시]`/`[한 번에 외부 게시]` 같은
  bulk external publish 버튼도 어디에도 없음(정적 검사로 확인).
- "게시 완료로 표시"는 여전히 사용자의 명시적 폼 제출로만 실행되며,
  `approval`/`bulk approval`/`page render`가 이 action을 자동 호출하는
  코드는 없음(정적 검사로 확인).
- copy 성공이 `manual_post_status`/`publish_status`를 자동으로 바꾸는
  코드 경로 없음(4/6절 참고).

## 18. 적용 route

`app/articles/[id]/social/page.tsx`(게시 완료로 표시 연결, 복사 후
안내, bulk approval 후속 링크, 편집 가드), `app/articles/[id]/blog/page.tsx`(편집
가드만 — 새 컴포넌트 없음, UX-05A 결정 유지), `lib/social/platform-manual-posting-result-service.ts`(메시지만),
`lib/social/social-quality-gate.ts`(naver_cafe bold 검사).

---

## 19. 수정한 파일 목록

**신규**: `docs/ux/ux-05b-publish-execution-completion.md`(이 문서)

**수정**:
- `lib/ui/publish-preparation-view-model.ts`, `lib/ui/multi-platform-publish-preparation-summary.ts`, `components/publish/publish-preparation-summary-card.tsx`, `components/publish/platform-publish-preparation-card.tsx` — `"action_completed"` state 추가
- `lib/social/platform-manual-posting-result-service.ts`, `.test.ts` — `checkRecordable()` 메시지 자연어화
- `lib/social/social-quality-gate.ts`, `.test.ts` — naver_cafe bold 검사 추가
- `app/articles/[id]/social/page.tsx`, `.test.ts` — 게시 완료로 표시 연결, 복사 후 안내, bulk approval 후속 링크, 편집 가드
- `app/articles/[id]/blog/page.tsx`, `.test.ts` — 편집 가드
- `components/social/copy-post-body-button.tsx`, `.test.tsx` — 복사 후 안내(옵트인 prop)
- `docs/ux/full-ux-audit.md`, `docs/ux/user-journey-audit.md`, `docs/ux/ux-refactor-roadmap.md`, `docs/ux/ux-05a-publish-preparation.md`, `docs/ui-ux-governance-rules.md`(업데이트)

## 20. 추가/수정 테스트

- `lib/social/platform-manual-posting-result-service.test.ts`: 16개(기존 15개 + raw 필드명 제거 회귀 1개)
- `lib/social/social-quality-gate.test.ts`: 79개(기존 78개 + naver_cafe bold 검사 1개)
- `app/articles/[id]/social/page.test.ts`: 73개(기존 66개 + 7개 신규)
- `app/articles/[id]/blog/page.test.ts`: 220개(기존 217개 + 3개 신규)
- `components/social/copy-post-body-button.test.tsx`: 10개(기존 7개 + 3개 신규)

## 21. lint 결과

`npm run lint` — 오류 없음(출력 없음).

## 22. test 결과

전체 스위트: **276 files / 3632 tests passed**, 실패 없음.

## 23. build 결과

`npm run build` 성공(`next build`, Turbopack, TypeScript 통과, 19개 route 모두 정상 생성).

## 24. 최신 Critical/High/Medium/Low

| 등급 | 총 항목 | 해결 | 부분 해결 | 미해결 |
|---|---|---|---|---|
| Critical | 7 (C1-C7) | 7 | 0 | 0 |
| High | 10 (H1-H10) | 8 | 2 (H5, H6) | 0 |
| Medium | 11 | 3 | 1 | 7 |
| Low | 5 | 1 | 0 | 4 |

UX-01 원자료의 개별 항목 수는 UX-05A와 동일하다(이번 Phase가 해결한
게시 실행 dead-end/bold marker 비대칭/편집 가드 프레젠테이션 갭은
UX-01 체크리스트 밖에서 UX-04B/UX-05A 진행 중 새로 발견되어 별도
추적된 문제였기 때문). **UX-06 이전에 반드시 해결해야 할 신규
blocker는 없다** — 이번 Phase에서 발견한 모든 안전 관련 항목(승인
무효화, 게시 완료 글 수정 차단, 수동 게시 완료 guard)은 조사 결과
이미 안전하게 구현되어 있었다.

## 25. UX-06 핵심 사용자 여정 테스트 대상

1. Journey 1(WordPress): 테마→자료→마스터 원고→WordPress 블로그→자동 검토→수정→승인→WordPress Draft→**게시 완료로 표시**(신규 연결 확인)
2. Journey 2(Naver Cafe): 승인→**본문 복사→게시 완료로 표시**(신규 연결, bold marker 검사 포함)
3. Journey 3(다중 플랫폼): **bulk approval→게시 준비 보기 anchor**(신규) → 플랫폼별 게시 완료 표시
4. 편집 가드 회귀: 승인된 글 수정 시 승인 무효화, 게시 완료 표시된 글은 수정 버튼 비활성화
5. `docs/ux/ux-refactor-roadmap.md`에 남아 있는 조사 공백(rewrite 카드, `/dashboard/rewrite`, `/dashboard/social-performance`, `/trends` 일부) 실사용 기준 재확인

---

**UX-05B에서는 실제 구현된 capability만 사용하여 게시 실행과 완료
UX를 연결했으며, 본문 복사·Draft 생성·수동 게시 완료를 서로 다른
상태로 명확히 구분했습니다. 다음 Phase에서는 전체 사용자 여정을
자동 검증합니다.**
