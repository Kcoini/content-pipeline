# Phase 3-22: 사용자 플랫폼 UI를 "행동 중심"으로 정리

## 문제

기능은 대부분 구현되어 있었지만, 화면에 내부 상태값(quality_status,
approval_status, export_status, platform_publish_guard_status,
platform_publish_dry_run_status, handoff_status, manual_post_status 등)과
관리용 버튼(Publishing Guard 실행/Dry-run 생성/Handoff 완료/게시
체크리스트 준비 등)이 그대로, 나란히, 항상 펼쳐진 채로 노출되어 있었다.
사용자가 "지금 무엇을 눌러야 하는지" 바로 알기 어려웠다.

## 조치

### 1) 내부 상태값 → 사용자 친화 문구 변환 (`lib/social/social-post-user-facing-status.ts`, 신규)

- `getUserFacingStatus(post)`: quality/approval/export 상태 조합을
  "현재 검토가 필요합니다", "승인 완료 — 복사/export할 수 있습니다" 같은
  한 줄 문구로 바꾼다. raw 값(`pending_review` 등)을 그대로 노출하지
  않는다.
- `getNextRecommendedAction(post)`: 카드당 눌러야 할 버튼 **하나**를
  결정한다(`{kind, label}`). 우선순위: 실패/차단 → 다시 생성하기 →
  반려/취소 → 다시 검토 요청하기 → 내보내기 완료 → 기존 글 보기 →
  승인 완료 → 복사/export 준비하기 → 검토 대기 중 → 승인하기 →
  품질검사 통과/수정 필요 → 글 검토하기 → 그 외 → 품질검사 실행하기.
  `post`가 없으면(아직 생성 전) "글 생성하기"를 반환한다.
- `describeSocialPostStatusFields(post)`: "상세 상태 보기" 접힘
  영역에서 쓸, 원문 값 + 한국어 라벨 쌍(개발자용 정보는 삭제하지 않고
  숨겼을 뿐이다).

### 2) 진행 단계 표시 (`components/articles/content-progress-steps.tsx`, 신규)

5단계(테마 선택 → 출처 입력 → 글 생성 → 검토/승인 → 게시 준비)를
공통 컴포넌트로 만들어 아래 화면 상단에 배치했다:

- `/dashboard`: 테마 미선택→`theme`, 출처 부족→`sources`, 그 외→`generate`.
- `/articles/[id]`: draft 상태→`generate`, 이미 승인된 플랫폼 글이
  있으면→`publish_ready`, 플랫폼 글은 있지만 미승인→`review`, 그 외→`generate`.
- `/articles/[id]/blog`, `/articles/[id]/social`: 글이 없으면→`generate`,
  승인된 글이 있으면→`publish_ready`, 그 외→`review`.

`/articles/[id]/performance`, `/articles/[id]/rewrite`는 요청대로 이
5단계 stepper에 포함하지 않았다(게시 이후 성과 분석/개선 작업은 기본
생성 흐름과 별개로 취급한다 — 기존 `ArticleWorkflowNavigation` 메뉴로
계속 구분된다).

### 3) 카드 재구성 — SNS/커뮤니티 (`/articles/[id]/social`)

- 상단에 `getUserFacingStatus`+`getNextRecommendedAction` 한 줄 요약을
  추가했다("현재 검토가 필요합니다 · 다음 작업: **승인하기**").
- 원문 상태값 나열(`quality: ... · approval: ...`), API readiness,
  performance, Rewrite 링크를 "상세 상태 보기 / 보조 작업" 접힘
  영역으로 옮겼다(삭제하지 않았다 — 계속 그 안에서 확인 가능).
- Publishing Guard 실행/Dry-run 생성/Handoff 완료/게시 체크리스트
  준비 버튼도 같은 접힘 영역으로 옮겼다(보조 작업).
- 품질검사/승인 요청/승인/Manual Export 4개 버튼은 카드에 그대로
  남기고, `getNextRecommendedAction`이 가리키는 버튼 하나만
  `bg-indigo-600`(primary)로 강조하고 나머지는 outline(secondary)
  스타일로 낮췄다.
- **승인(`approveSocialPostAction`) 버튼을 SNS/커뮤니티 카드에도
  추가했다** — 기존에는 이 action이 `/articles/[id]/blog`(wordpress_blog/
  naver_blog)에만 연결돼 있어, naver_cafe/x/threads/instagram에는
  "승인 요청"만 있고 실제 승인 버튼이 없었다(발견된 기능 공백을
  메웠다 — 새 로직이 아니라 기존 action을 한 곳 더 연결한 것뿐이다).

### 4) 카드 상태 요약 — 블로그(`/articles/[id]/blog`)

wordpress_blog는 이미 Step 1~6 단계형 안내가 있어(Phase 2-20 등)
버튼 재배치는 하지 않았다. 대신 카드 상단의 원문 상태값 한 줄만
`getUserFacingStatus`/`getNextRecommendedAction` 요약으로 바꾸고,
원문은 "상세 상태 보기" 접힘 안으로 옮겼다(그대로 유지).

### 5) article context 안내 (변경 없음, Phase 3-21에서 이미 완료)

article을 "출처 기반 원고 context"로 안내하는 문구, `monetized_blog`
(article mode)와 `wordpress_blog`(플랫폼)를 구분하는 원칙은 Phase
3-21에서 이미 반영했다 — 이번에 다시 손대지 않았다.

### 6) 플랫폼별 글 생성 UI / 개별·선택·전체 생성 / 비용 경고 / 추천 플랫폼 / 문체 선택 (변경 없음, Phase 3-21에서 이미 완료)

이번 요청의 5~11번 항목(플랫폼별 글 생성 섹션, 개별/선택/전체 생성
구분, 비용 경고 모달, 추천 플랫폼, 문체/톤 분리, 플랫폼별 추천 문체)은
Phase 3-21에서 이미 구현했다 —
[`phase-3-21-platform-generation-flow.md`](./phase-3-21-platform-generation-flow.md)
참고. 이번 문서는 그 위에 "행동 중심 UI"(진행 단계 + 상태 번역 + 카드
정리)를 추가한 것이다.

### 7) 게시용 본문/관리 정보 분리, naver_cafe plain text, wordpress_blog HTML (변경 없음, Phase 3-20/2-21/2-24에서 이미 완료)

`/social-posts/[id]` 상세 페이지의 "관리 정보 보기" accordion,
`sanitizeNaverCafePlainText`, wordpress_blog Markdown→HTML 변환/필수
구조는 이전 단계에서 이미 완료했다.

## 영향 범위 확인

- **DB schema**: 변경 없음.
- **기존 기능**: 삭제된 버튼/기능 없음 — 모두 접힘 영역으로 이동했을
  뿐이다(Publishing Guard/Dry-run/Handoff/체크리스트/원문 상태값 모두
  여전히 클릭/확인 가능).
- **naver_blog/x/threads/instagram/wordpress_blog 기존 흐름**: action
  이름/서버 로직 변경 없음(순수 표시 방식 변경 + 1개 버튼 추가:
  naver_cafe/x/threads/instagram 카드에 `approveSocialPostAction` 연결).
- **자동 public publish**: 관련 없음(표시 방식 변경만 다룸).

## 테스트

- `lib/social/social-post-user-facing-status.test.ts`: 상태 조합별
  문구/다음 액션/원문+라벨 매핑.
- `components/articles/content-progress-steps.test.ts`: 5단계 라벨,
  개발자용 상태값 미참조, 현재 단계 강조.
- `app/dashboard/page.test.ts`, `app/articles/[id]/page.test.ts`,
  `app/articles/[id]/blog/page.test.ts`, `app/articles/[id]/social/page.test.ts`:
  진행 단계 표시, 원문 상태값이 상세 접힘 안에만 있음, 주요 버튼 강조,
  승인 버튼 추가, 보조 작업 이동 확인.
- 전체 `npm run lint`(0 errors), `npm run test`(2555/2555 통과),
  `npx tsc --noEmit -p .`(기존 baseline 37건 유지, 신규 0건),
  `npm run build`(성공) 확인.

## 이번 범위에서 다루지 않은 것 (명시적 스코프 아웃)

- `/social-posts/[id]` 상세 페이지의 카드별 "주요 버튼 하나 강조"는
  적용하지 않았다(이미 Phase 3-20에서 관리 정보 accordion 분리를
  마쳤고, 이 페이지는 애초에 "읽기 전용 상세 확인" 용도라 액션
  버튼이 거의 없다).
- `getRecommendedPlatformsAction`/`prepareArticleContextAction` 같은
  명시적 action 래퍼는 만들지 않았다 — 현재 순수 함수
  (`getRecommendedPlatforms`, Phase 3-21)를 서버 컴포넌트 렌더링 시
  직접 호출하는 것으로 충분하고, action으로 감쌀 필요가 없었다.
- `naver_cafe_plain_text_sanitized`/`naver_cafe_quality_blocked_markdown`/
  `platform_ui_next_action_rendered`/`platform_ui_management_details_collapsed`
  로그 이벤트는 추가하지 않았다 — 렌더링/변환마다 호출되는 순수 함수에
  로그를 붙이면 노이즈만 커지고, quality gate 체크리스트가 이미 같은
  정보를 더 유용하게 노출한다(Phase 3-20/3-21 문서에도 같은 판단을
  기록해 뒀다).

## 관련 문서

- `docs/phase-3-21-platform-generation-flow.md`
- `docs/phase-3-20-naver-cafe-plain-text-cleanup.md`
- `docs/phase-2-24-monetized-blog-structure-enhancement.md`
- `docs/phase-3-operation-manual.md`
- `docs/ui-ux-governance-rules.md`
