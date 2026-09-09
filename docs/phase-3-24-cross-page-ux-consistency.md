# Phase 3-24: 페이지 간 UX 일관성 — 이미 있는 좋은 패턴을 다른 페이지로 확산

## 배경

`/dashboard`, `/articles/[id]/blog`, `/trends` 코드를 엄격히 검토한
결과, 이 세 페이지는 이미 다음 원칙을 잘 지키고 있었다.

- raw enum/DB 컬럼명을 그대로 노출하지 않고 한국어 라벨로 바꾼다.
- 내부 상태값/로그는 "내부 상태값 보기" 접힘 영역에 둔다.
- disabled 버튼에는 이유를 표시한다.
- 카드당 주요 버튼 하나만 강조한다.
- 페이지/섹션 제목이 한국어다.

반면 `/articles/[id]/social`, `/articles/[id]/rewrite`,
`/social-posts/[id]`, `/articles/[id]/performance`,
`/articles/[id]/ab-tests`, `/dashboard/*` 서브 대시보드 6개는 같은
원칙이 적용되지 않아 raw enum, DB 컬럼명, 영어 섹션 제목, 이유 없는
disabled 버튼이 곳곳에 남아 있었다. 이 단계는 그 편차를 없애는 작업이다.

## 1. 공통 유틸 정리: `lib/social/status-labels.ts` (신규)

플랫폼/문체 라벨은 이미 `lib/social/platform-generation-recommendations.ts`
의 `PLATFORM_LABELS`와 `lib/social/tone-style-config.ts`의
`TONE_STYLE_CONFIGS[...].label`이 있었으므로 재사용했다(새로 만들지
않았다). 대신 여러 상태 enum(quality_status/approval_status/
export_status/handoff_status/manual_post_status/performance_status/
rewrite 관련 상태 등)에 공통으로 등장하는 raw 값과, "내부 상태값
보기"에서 쓰는 DB 필드명(is_rewrite_version, parent_social_post_id
등)을 한국어로 바꾸는 유틸이 없어서 새로 만들었다.

```ts
describeStatusValue("pending_review") // "검토 대기"
describeStatusValue("not_requested")  // "요청 전"
describeStatusField("is_rewrite_version") // "재작성 버전 여부"
describeStatusField("parent_social_post_id") // "이전 버전 글"
```

알 수 없는 값이 들어와도 예외를 던지지 않고 원본을 그대로 반환한다
(화면이 깨지는 것보다 낫다는 원칙 유지).

## 2. `/articles/[id]/rewrite` (1순위)

- **disabled 버튼 이유 표시**: `lib/social/rewrite-version-user-facing-status.ts`
  (신규)에 `describeRequestReapprovalDisabledReason` 등 버튼별 이유
  함수를 만들고, `title` 속성 + 카드 하단의 항상 보이는 텍스트 목록
  두 곳에 표시한다("재승인 요청: 이미 재승인 요청이 진행 중입니다."
  형태로 어떤 버튼의 이유인지 명시).
- **raw 상태값 노출 제거**: `suggestion_status: not_created` 같은 줄을
  삭제하고, `describeStatusValue`로 변환한 한 줄 요약 + "다음 작업"만
  기본으로 보여준다. 세부 raw 값(버전 비교 점수, rewrite_republish
  _workflow_status 등)은 "내부 상태값 보기" 접힘 안으로 옮겼다.
  플랫폼/문체 배지도 raw enum이 아니라 라벨로 바꿨다.
- **카드당 주요 버튼 하나**: `getRewriteSuggestionNextAction`/
  `getRewriteVersionNextAction`(신규, 같은 파일)이 상태에 따라 정확히
  하나의 버튼을 강조하도록 계산한다(`/articles/[id]/social`의
  `getUserFacingStatus`/`getNextRecommendedAction` 패턴을 그대로
  따랐다).
- **콩글리시 정리**: "재Export" → "재내보내기", "Rewrite Versions" →
  "재작성 버전", "A/B test draft 만들기" → "비교 실험 만들기".

## 3. `/articles/[id]/social` (2순위)

- platform/tone_style `<select>`가 `{platform}`/`{toneStyle}` raw enum을
  그대로 option 텍스트로 쓰던 것을 `PLATFORM_LABELS`/
  `TONE_STYLE_CONFIGS[...].label`로 바꿨다(`value`는 그대로 raw enum —
  서버 액션 동작은 변경 없음).
- "placeholder 초안 생성" 버튼은 일반 사용자에게 의미가 불명확해
  "임시 초안 만들기"로 이름을 바꾸고, `<details>` "고급 옵션: 테스트용
  임시 초안 만들기" 안으로 옮겼다(같은 폼의 값을 `form=` 속성으로
  재사용 — 폼을 중복 생성하지 않는다). 기본 버튼은 "선택한 플랫폼 글
  생성"으로 명확히 하고, 바로 아래에 "선택한 플랫폼과 문체에 맞춰 글을
  생성합니다. 공개 게시는 하지 않습니다." 설명을 추가했다.
- 카드의 플랫폼/문체 배지, "상세 상태 보기" 안의 raw 상태값 나열도
  라벨로 바꿨다. "Manual Export"/"Publishing Guard 실행"/"Dry-run
  생성"/"Handoff 완료" 버튼명을 각각 "복사/export 준비"/"게시 준비
  확인"/"게시 전 미리보기 만들기"/"수동 게시 준비 완료"로 바꿨다.
- `InfoBadge`의 "Metrics 필요"/"Low Performance" 라벨을 "성과 입력
  필요"/"반응 저조"로 바꿨다 — `components/social/content-group-badge.tsx`
  의 공용 컴포넌트라서, 이 라벨을 쓰는 나머지 3개 파일
  (`app/articles/[id]/blog/page.tsx`, `app/dashboard/blog/page.tsx`,
  `app/social-posts/[id]/page.tsx`)과 `app/articles/[id]/page.tsx`의
  같은 문구도 함께 바꿔서 하나의 화면만 고치고 다른 화면은 그대로
  영어로 남는 일이 없게 했다.

## 4. `/social-posts/[id]` (3순위)

- "버전 정보" 카드에서 `is_rewrite_version`/`parent_social_post_id`/
  `root_social_post_id` 같은 DB 컬럼명 라벨과 raw id 문자열을 없애고,
  "재작성 버전입니다 (버전 N)." 한 줄 요약 + "이전 버전 글 보기 →"/
  "원본 글 보기 →" 행동 링크로 바꿨다. raw id 값 자체는 지우지 않고
  "관리 정보 보기"(이미 Phase 3-20에서 만들어진 접힘 영역) 안의
  "메타데이터" 섹션으로 옮겼다.
- 헤더의 `social_post id: ...`, `(article_id: ...)`도 기본 화면에서
  없애고 "관리 정보 보기" 안으로 옮겼다("기사: {링크}" 한 줄만 기본
  노출).
- "콘텐츠 미리보기"의 `post_title`/`excerpt`/`hashtags`/`post_url`/
  `post_body preview`/`caption preview`/`thread_items preview`/
  `card_items preview` 라벨을 전부 한국어로 바꿨다(이 정보 자체는
  게시용 본문이라 계속 기본 화면에 남긴다 — 숨긴 게 아니라 라벨만
  바꿨다).
- "관리 정보 보기" 안의 상태/성과/재작성/A-B 테스트/API/메타데이터
  섹션도 라벨과 값을 모두 `describeStatusField`/`describeStatusValue`로
  바꿨고, 섹션 제목 "API Publishing (준비 단계)" → "API 게시 준비
  상태", "A/B Test" → "글 반응 비교(A/B Test)"로 바꿨다.

## 5. `/articles/[id]/performance` (4순위)

영어 섹션 제목 5개를 한국어로 바꿨다: Chart Overview → 성과 요약,
Platform Performance → 플랫폼별 성과, Tone Performance → 문체별 성과,
Metrics Trend → 성과 추이, Original vs Rewrite Comparison → 원본과
재작성 글 비교. `performance_score는 내부 비교용 참고 지표입니다`라는
raw 필드명 그대로의 설명을 "성과 점수는 조회수, 클릭, 반응 등 여러
지표를 비교하기 쉽게 환산한 참고 점수입니다. 실제 수익이나 검색 순위를
보장하지 않습니다."로 바꿨다. `/dashboard/social-performance`의 같은
차트 섹션들도 동일하게 바꿔서 두 화면의 용어가 어긋나지 않게 했다.

## 6. `/articles/[id]/ab-tests` (5순위)

"A/B test"/"variant"/"winner" 같은 용어를 없애고 "글 반응 비교"/"비교
글"/"더 반응이 좋은 글" 개념으로 안내 문구를 다시 썼다. 상단 배너에
"이 화면은 같은 주제의 글을 서로 비교해 어떤 문체와 플랫폼이 더 반응이
좋은지 확인하는 곳입니다"라는 설명을 추가했다. 섹션 제목은 "A/B test
draft 생성" → "비교 실험 만들기", "A/B test 목록" → "비교 실험 목록"으로
바꿨다. (`CreateAbTestForm`/`OriginalVsRewriteTestForm`/`AbTestList`
컴포넌트 내부 용어는 이번 범위에서 다루지 않았다 — 아래 "반영하지 않은
것" 참고.)

## 7. `/dashboard/*` 서브 대시보드 6개 (6순위)

전부 `<h1>`을 한국어로 바꾸고, 상단에 "이 화면에서 할 수 있는 일"을 한
문장으로 추가했다.

| 페이지 | 이전 제목 | 새 제목 |
|---|---|---|
| `/dashboard/content` | Content Dashboard | 콘텐츠 현황 |
| `/dashboard/blog` | Blog Dashboard | 블로그 현황 |
| `/dashboard/rewrite` | Rewrite Dashboard | 재작성 관리 |
| `/dashboard/social-performance` | Social Performance Dashboard | 소셜 성과 분석 |
| `/dashboard/platform-api` | Platform API Readiness | 플랫폼 API 준비 상태 |
| `/dashboard/automation-safety` | Automation Safety Review | 자동화 안전 점검 |

`DashboardTopNav`/서로 다른 서브 대시보드 사이를 연결하는 링크 라벨도
같은 한국어로 맞췄다(예: "Social Performance Dashboard로" →
"소셜 성과 분석으로"). `/dashboard/blog`, `/dashboard/rewrite`는 필터
select와 테이블 셀의 raw enum/상태값도 `PLATFORM_LABELS`/
`describeStatusValue`/`describeStatusField`로 바꿨다.
`/dashboard/automation-safety`의 카테고리 라벨(Feature Flags 등
10개)도 한국어로 바꿨다.

## 반영하지 않은 것(의도적 범위 제외)

- **차트 하위 컴포넌트**(`components/social-performance-dashboard/*`의
  `PlatformPerformanceTable`, `RecommendationBadge`("Best Platform"
  등 영어 라벨 6개를 가진 별도 타입) 등) 내부는 이번 범위에서 다루지
  않았다 — page.tsx 레벨의 제목/설명/카드 라벨을 우선 정리했고, 표
  컴포넌트 내부의 세부 라벨은 별도 작업으로 남겨뒀다.
- **`/articles/[id]/ab-tests`의 하위 컴포넌트**(`CreateAbTestForm`,
  `OriginalVsRewriteTestForm`, `AbTestList`) 내부 용어는 페이지 레벨
  문구만 바꾸고 손대지 않았다.
- **`/dashboard/automation-safety`의 점검 버튼 라벨**("Safety Review
  실행", "게시 workflow 점검", "feature flag 점검")은 기존 테스트가
  정확히 이 문자열을 검증하고 있어, 이번 범위(제목 한국어화)에 집중하기
  위해 그대로 뒀다 — 필요하면 테스트와 함께 별도 작업으로 정리한다.
- `/dashboard/blog`, `/dashboard/rewrite`에 테스트 파일이 없어서 이번에
  새로 만들었지만, 필터 폼 UX 자체(여러 select를 나열하는 구조)는
  재구성하지 않았다 — 라벨만 한국어로 바꿨다.

## 영향받지 않는 것

- naver_cafe/naver_blog/wordpress_blog/x/threads/instagram의 실제
  생성·검토·승인·export 로직은 전혀 건드리지 않았다. 모든 변경은
  표시 라벨과 disabled 이유 문구뿐이다.
- 자동 public publish 경로는 추가/변경하지 않았다. `getRewriteVersion
  NextAction`이 계산하는 버튼들도 전부 기존 액션(승인/재승인/재export
  준비·생성)을 그대로 가리킬 뿐, 새로운 게시 경로를 만들지 않았다.
- DB schema는 변경하지 않았다 — 모든 매핑은 문자열 표시 계층에서만
  이뤄진다.

## 테스트

- `lib/social/status-labels.test.ts`(신규): `describeStatusValue`/
  `describeStatusField` 전체 케이스.
- `lib/social/rewrite-version-user-facing-status.test.ts`(신규):
  제안/버전 다음 작업 계산, disabled 이유 함수 전체 케이스.
- `app/articles/[id]/rewrite/page.test.ts`,
  `app/articles/[id]/social/page.test.ts`,
  `app/social-posts/[id]/page.test.ts`,
  `app/articles/[id]/performance/page.test.ts`,
  `app/articles/[id]/ab-tests/page.test.ts`: raw enum/DB 컬럼명/영어
  제목이 사라지고 한국어 라벨·설명이 들어갔는지, disabled 이유가
  표시되는지 검증하는 테스트를 추가했다.
- `app/dashboard/content/page.test.ts`,
  `app/dashboard/blog/page.test.ts`,
  `app/dashboard/rewrite/page.test.ts`,
  `app/dashboard/social-performance/page.test.ts`(모두 신규),
  `app/dashboard/platform-api/page.test.ts`,
  `app/dashboard/automation-safety/page.test.ts`(기존 파일에 추가):
  h1 제목이 한국어인지 검증.
- 전체 `npx vitest run`: 214 files / 2666 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류.
- `npm run build`: 성공.

## 관련 문서

- [`docs/ui-ux-governance-rules.md`](./ui-ux-governance-rules.md) —
  "페이지 간 일관성 원칙" 절 추가
- [`docs/ui-review-agent-checklist.md`](./ui-review-agent-checklist.md) —
  raw enum/DB 컬럼명/영어 제목 체크 항목 추가
