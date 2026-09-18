# UX-02B: WordPress Blog Critical UX Cleanup

- 작성일: 2026-09-18
- 범위: UX-01 감사에서 남은 Critical 문제 중 `app/articles/[id]/blog/page.tsx`(C3, C6)와
  `components/wordpress/wordpress-publishing-panel.tsx`(C4)를 처리한다.
  UX-02A(`app/articles/[id]/page.tsx`)는 이미 완료되어 있으며, 이번 Phase는
  그 후속이다. `docs/ux/full-ux-audit.md`, `docs/ux/user-journey-audit.md`,
  `docs/ux/ui-information-levels.md`, `docs/ux/ux-refactor-roadmap.md`,
  `docs/ux/ux-02a-critical-safety-cleanup.md`, `docs/ui-ux-governance-rules.md`를
  먼저 읽고 작업했다.
- 이번 Phase에서 하지 않은 것: `AdvancedDetails` 공통 컴포넌트 정식 신설,
  `HumanReviewPanel`/`WorkflowStatusCard` 신설, `AutoReviewSummaryCard`/
  `InlinePostBodyEditor` 전면 공통화, `NextActionPanel` 전면 인터페이스
  통합, `PlatformBadge` 전체 통합, 전체 route UI 재구성 — 모두 UX-03으로
  남긴다.

---

## 1. C3 — quality_status raw 문구 처리 방식

- `app/articles/[id]/blog/page.tsx`에서 `disabled` 버튼의 `title` 안내
  문구 `"먼저 품질검사를 통과해야 합니다(quality_status=ready 필요)."`에서
  `(quality_status=ready 필요)` 부분을 제거해 `"먼저 품질검사를 통과해야
  합니다."`로 정리했다. 조건 자체(`post.qualityStatus !== "ready"`)는
  이미 disabled 여부를 결정하고 있어 raw 값을 굳이 문구에 병기할
  필요가 없었다.
- "내부 상태값 보기"(`&lt;details&gt;`, WordPress 반영 탭 안, 이미
  기본 접힘 상태였음) 영역의 dt 라벨 6개(`quality_status`,
  `approval_status`, `publish_status`, `export_status`,
  `manual_post_status`, `updatedAt`)를 전부 기존 헬퍼로 교체했다:
  dt는 `describeStatusField(...)`, dd는 `describeStatusValue(...)`.
  새 mapping을 페이지에 만들지 않고 `lib/social/status-labels.ts`를
  그대로 재사용했다(이미 필요한 필드 라벨이 모두 있었다).
- `updatedAt`은 `STATUS_FIELD_LABELS`에 camelCase 키가 없어 이 파일의
  다른 곳에서 이미 쓰던 표현("마지막 업데이트")을 그대로 사용했다
  (새 헬퍼 엔트리를 추가하지 않고 기존 표현과 통일).

## 2. C4 — WordPressPublishingPanel 단순화 내용

`components/wordpress/wordpress-publishing-panel.tsx`(`/articles/[id]`와
`/articles/[id]/blog` 양쪽에서 재사용하는 공통 컴포넌트)를 다음과 같이
재구성했다:

- **기본 화면(Level 1)**: 5줄 요약 목록만 남긴다 — 품질검사/승인/
  WordPress Draft/SEO 정보/대표 이미지. `qualityStatus`/
  `approvalStatus`/`seoMetadataStatus`/`featuredImageStatus`는 모두
  `describeStatusValue()`로 번역해서 보여준다(`draftStatus`는 호출부에서
  이미 "생성됨"/"아직 생성되지 않음" 같은 친화적 문자열로 넘어오므로
  그대로 사용). 이미지 오류 메시지, wordpress_blog의 "metadata
  재생성 필요" 안내는 기존처럼 기본 화면에 남겨 실제로 필요한 경고는
  숨기지 않았다.
- **children(다음 작업 버튼)**: 요약 바로 아래, 예전과 같은 위치를
  유지한다 — 각 페이지가 상태별로 계산한 primary/secondary 버튼이
  그대로 노출된다(변경 없음).
- **상세 상태 보기(Level 3, 기본 접힘)**: WordPress Post/Draft ID(+열기
  링크), seoTitle/metaDescription/targetKeyword/secondaryKeywords,
  WordPress media ID, Media URL, 연결 상태(`describeStatusValue`로
  번역), 대표 이미지 생략 여부/사유, 게시 준비 상태(`publishGuardStatus`,
  `describeStatusValue`로 번역, 라벨에서 영문 "Publish Guard" 제거해
  "게시 준비 상태"로만 표기), 마지막 갱신 시각, 마지막 실행 결과를
  전부 이 안으로 옮겼다. 10개 이상의 dt/dd가 기본 화면에 펼쳐져 있던
  문제(섹션 F "실패 기준")를 해소했다.
- **섹션 K(패널 중첩) 처리**: wordpress_blog 카드에서는 이 패널의
  children이 이미 자체 "WordPress 게시 준비"라는 다음 작업 카드를
  렌더링하고 있어, 패널 자신도 같은 제목("WordPress 게시 준비")을 쓰면
  화면에 같은 이름의 섹션이 바로 이어서 두 번 나온다. 이를 위해
  `isPrimaryWorkflow`(=wordpress_blog)일 때는 패널 제목을 "게시 상태
  요약"으로 바꿔 구분했다. `isPrimaryWorkflow=false`(article, children
  없이 단독 사용)는 원래 제목 "WordPress 게시 준비"를 유지했다 — 이
  경우엔 중복이 없다.
- 공통 컴포넌트를 공유하는 두 화면(`/articles/[id]`의 `WordPressPublishingPanel
  targetType="article"`, `/articles/[id]/blog`의 `targetType="wordpress_blog"`)
  모두에서 정적 소스 검사 테스트를 실행해 회귀가 없음을 확인했다.

## 3. C6 — article.status 처리 방식

- `app/articles/[id]/blog/page.tsx:389`의 `"article status: {article.status}"`
  (raw enum이 페이지 최상단에 그대로 노출)를 `"원본 기사 상태:
  {describeArticleStatus(article.status)}"`로 교체했다. 완전히 삭제하지
  않은 이유: 이 문구는 바로 아래 "원본 기사가 아직 승인되지
  않았습니다" 경고들과 관련된 실제 컨텍스트 정보라 사용자에게 여전히
  유용하다고 판단했다(단순 중복이 아니라 유일한 표시 위치).
- `describeArticleStatus`를 `lib/social/status-labels.ts`에 새로
  추가했다(`draft`→"초안", `reviewed`→"승인됨", `published`→"게시됨").
  기존 `describeStatusValue`의 `"reviewed"`→"검토 완료" 매핑을
  재사용하지 않은 이유: `docs/ui-ux-governance-rules.md`가 이미 경고하는
  문제("같은 값을 필드마다 다르게 번역하면 사용자가 다른 승인 단계로
  오해") 그 자체를 피하기 위해서다 — `article.status`의 `"reviewed"`는
  프로젝트 전체에서 이미 "승인됨"으로 통일되어 있으므로(`/articles`,
  `/articles/[id]`의 기존 `STATUS_LABEL`), 그 관례를 따르는 전용
  헬퍼를 분리해서 추가했다.
- 승인 안내 문구 2곳(각각 blog 카드 요약, WordPress Draft 전송 섹션)의
  `"...아직 승인되지 않았습니다(article status: {article.status})."`에서
  괄호 안 raw 값을 제거했다 — 이 조건은 항상 `article.status !==
  "reviewed"`일 때만 보이므로 값을 보여줘도 정보가 없었다(항상
  "draft"만 나옴).

## 4. 기본 화면에서 숨긴 Level 3 정보 목록

- WordPress Post/Draft ID, Media ID, Media URL (`WordPressPublishingPanel`)
- SEO 내부 필드(seoTitle/metaDescription/targetKeyword/secondaryKeywords) 원문
- 대표 이미지 연결 상태 raw 값, 생략 사유
- Publish Guard(게시 준비 상태) raw 값
- 마지막 갱신 시각, 마지막 실행 결과

## 5. 상세 상태 보기로 이동한 정보

위 4번과 동일 — `WordPressPublishingPanel`의 새 `<details>` "상세 상태
보기" 섹션 안에 그대로 유지했다(기능 삭제 없음, 위치만 이동).

## 6. 완료된 작업 버튼 숨김/next action 개선 내용

**코드 조사 결과, 이 부분은 이미 완전히 구현되어 있어 변경하지
않았다.** `lib/social/wordpress-blog-publish-prep-state.ts`의
`getWordPressPublishPrepState`가 이미:
- 품질검사 완료(`qualityStatus === "ready"`)면 품질검사를 primary로
  다시 보여주지 않는다.
- 승인 완료(`approvalStatus === "approved"`)면 승인 버튼을 primary로
  다시 보여주지 않는다.
- `draftExists`가 true면 상황에 따라 "WordPress Draft 최종 반영" 또는
  "WordPress Draft 보기"를 primary/secondary로 전환한다.
- `completedItems`/`remainingItems`를 모두 계산해 "완료됨: ... / 남은
  작업: ..." 형태로 카드에 표시한다(blog/page.tsx:1170-1200의 "WordPress
  게시 준비" 카드가 이 값을 그대로 사용).

이미 `lib/social/wordpress-blog-publish-prep-state.test.ts`에 각
시나리오(품질검사 미통과/승인 필요/대표 이미지 필요/Draft 없음/SEO
없음/모두 완료 등)에 대한 테스트가 충실히 존재함을 확인했다. 이번
Phase에서 새로 만들 필요가 없었다.

## 7. /dashboard/blog raw filter 처리 여부

**처리 불필요 — 실사 결과 이미 완료되어 있었다.** `app/dashboard/blog/page.tsx`의
필터 5개(플랫폼/품질검사/승인/게시/성과) 모두 `describeStatusField`로
label을, `describeStatusValue`로 옵션 텍스트를 이미 변환하고 있었다
(코드 주석에 "Phase 3-24: 필터 select도 raw enum이 아니라 한국어
라벨을 보여준다"로 명시). UX-01 감사 원자료가 이 사실을 놓쳤던 것으로
보인다 — 이번 Phase에서 실제 코드를 다시 확인해 바로잡았다.

## 8. /dashboard/rewrite raw filter 처리 여부

**처리 불필요 — 동일하게 이미 완료되어 있었다.** `app/dashboard/rewrite/page.tsx`의
필터 5개(플랫폼/버전 비교/재승인/재내보내기/성과)도 모두
`describeStatusField`/`describeStatusValue`를 쓰고 있었다.

## 9. 수정한 파일 목록

- `app/articles/[id]/blog/page.tsx` — C3/C6 수정, `describeStatusField` import 추가
- `app/articles/[id]/blog/page.test.ts` — 새 테스트 4개 describe 블록 추가
- `components/wordpress/wordpress-publishing-panel.tsx` — C4 재구성(요약/상세 분리, 헤딩 중복 제거)
- `components/wordpress/wordpress-publishing-panel.test.ts` — 기존 테스트 라벨 갱신 + 새 테스트 4개 추가
- `lib/social/status-labels.ts` — `describeArticleStatus` 신규 추가, `STATUS_VALUE_LABELS`에 누락되어 있던 `reviewed`/`generated`/`prepared`/`uploaded`/`ready_to_publish`/`not_attached`/`attached`/`skipped_no_media_id` 추가
- `lib/social/wordpress-blog-workflow-steps.ts` — `publishGuard` 요약값의 raw `"ready"`를 `"준비 완료"`로 교체(타입/구현)
- `lib/social/wordpress-blog-workflow-steps.test.ts` — 위 변경에 맞춰 테스트 값 수정
- `lib/social/wordpress-blog-card-tabs.ts` — 동일한 raw `"ready"` 리크를 이 파일에서도 발견해 함께 수정(타입/구현)
- `lib/social/wordpress-blog-card-tabs.test.ts` — 위 변경에 맞춰 테스트 값 수정
- `docs/ui-ux-governance-rules.md` — raw DB 필드명/내부 ID 노출 금지, disabled 이유 자연어 원칙 섹션 추가
- `docs/ux/full-ux-audit.md`, `docs/ux/ux-refactor-roadmap.md` — UX-02B 진행 결과 반영
- `docs/ux/ux-02b-wordpress-blog-cleanup.md` — 이 문서(신규)

## 10. 추가/수정한 테스트

`app/articles/[id]/blog/page.test.ts`에 추가한 describe 4개:
- `Phase UX-02B (C3): 비활성 사유/안내 문구에 raw DB 필드명을 노출하지 않는다` — `field=value` 패턴 부재, disabled 사유 자연어 확인, "내부 상태값 보기" 안 dt/dd가 헬퍼를 거치는지 검사
- `Phase UX-02B (C6): article.status raw enum을 기본 화면에 그대로 노출하지 않는다` — raw 표시 부재, `describeArticleStatus` 사용, 승인 안내 문구에 raw 병기 없음, 기존 비교 로직(`article.status === "reviewed"`) 불변 확인
- `Phase UX-02B (C4): WordPress 게시 상태 badge에 영어 raw 값이 남지 않는다`

`components/wordpress/wordpress-publishing-panel.test.ts`에 추가:
- raw enum이 `describeStatusValue`로 번역되는지
- Post/Media ID·URL·raw guard·갱신 시각이 "상세 상태 보기" 접힘 안에만 있는지
- `isPrimaryWorkflow`에 따라 헤딩 텍스트가 다른지(패널 중복 방지)
- 요약 목록이 children(다음 작업)보다 먼저 나오는지

기존 테스트 수정: `wordpress-publishing-panel.test.ts`(라벨 텍스트 변경
반영), `wordpress-blog-workflow-steps.test.ts` / `wordpress-blog-card-tabs.test.ts`
(raw `"ready"` → `"준비 완료"` 값 변경 반영), `app/articles/[id]/blog/page.test.ts`
(disabled 사유 문구/import 문 변경 반영).

## 11. lint 결과

`npm run lint` — 오류 없음(출력 없음).

## 12. test 결과

- `app/articles/[id]/blog/page.test.ts`: 209 passed (기존 200 + 신규 9)
- `components/wordpress/wordpress-publishing-panel.test.ts`: 15 passed (기존 11 + 신규 4)
- 전체 스위트: **255 files / 3329 tests passed**, 실패 없음

## 13. build 결과

`npm run build` 성공(`next build`, Turbopack, TypeScript 통과, 19개 route
모두 정상 생성). 처음 빌드 시 `wordpress-blog-card-tabs.ts`에 남아있던
동일한 raw `"ready"` 타입 리터럴 때문에 타입 에러가 발생했으나(다른
소비처였음), 같은 방식으로 수정해 해결했다 — 최종 빌드는 오류 없이
통과한다.

## 14. 남아 있는 Critical 문제

UX-01 감사의 Critical 7개(C1~C7) 중 이번 UX-02A/UX-02B로 전부 해결됨.
남은 것은 High 이하 항목뿐이다(`docs/ux/full-ux-audit.md` 4장 참고):
- `app/articles/[id]/blog/page.tsx:149-157` 로그 필터 라벨의 "Handoff" 영문 표기
- X 플랫폼 카드의 inline 수정 불가(상세 페이지 이동 필요)
- `AutoReviewSummaryCard`/`InlinePostBodyEditor` 중복 구현
- `/articles/[id]/rewrite`의 "승인" 계열 용어 3종 혼용

## 15. UX-03에서 공통화해야 할 컴포넌트 목록

- `AdvancedDetails` — "상세 상태 보기"/"내부 상태값 보기"/"고급 기능" 등
  이름이 제각각인 접힘 패턴을 하나의 공통 컴포넌트로 통합(이번 Phase는
  기존 `<details>` 패턴을 재사용만 하고 새로 만들지 않았다)
- `NextActionPanel` — `getWordPressPublishPrepState`,
  `getPostApprovalNextActions`, `getSocialPostCardActionState`가 유사한
  "current status + completed + remaining + primary/secondary action"
  구조를 각각 독립 구현 중 — 인터페이스 통일 검토
- `AutoReviewSummaryCard`, `InlinePostBodyEditor` — 여러 화면에 중복 구현
- `HumanReviewPanel`, `WorkflowStatusCard` — 아직 신설되지 않음
- `WordPressPublishingPanel`의 children(다음 작업 카드)과 패널 자체의
  역할을 완전히 하나로 합칠지 여부 — 이번 Phase는 제목 중복만 제거했고
  구조 통합은 UX-03에서 재검토

---

**UX-02B에서는 WordPress 블로그의 Critical UX 문제와 핵심 raw 상태
노출을 정리했으며, 공통 컴포넌트 대규모 통합은 UX-03으로 남겼습니다.**
