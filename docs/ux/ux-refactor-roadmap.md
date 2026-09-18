# UX 리팩터 로드맵 (Phase UX-01 산출물 — 계획만, 코드 변경 없음)

- 작성일: 2026-09-18
- 본 문서는 `full-ux-audit.md`, `user-journey-audit.md`, `ui-information-levels.md`의 발견 사항을 바탕으로 이후 Phase의 작업 범위를 계획한다.
- 이 문서 자체는 계획서이며, 이번 Phase에서 실제 코드 변경은 수행하지 않았다.

---

## UX-02: Critical 수정

> **진행 상태 (2026-09-18)**: `app/articles/[id]/page.tsx` 범위는
> **UX-02A로 완료**됨. 나머지(`app/articles/[id]/blog/page.tsx`,
> `components/wordpress/wordpress-publishing-panel.tsx`)는 **UX-02B로
> 분리**해 아직 진행 전이다. 아래는 원래 계획이며, 완료 내역은
> [`docs/ux/ux-02a-critical-safety-cleanup.md`](./ux-02a-critical-safety-cleanup.md) 참고.

### UX-02A (완료): app/articles/[id]/page.tsx 안전 문제 + 기술정보 노출

- "테스트 실행 (실제 공개 게시)" 버튼 라벨에서 "테스트"를 제거하고
  ("WordPress 실제 공개 게시 실행"), 별도 "⚠ 관리자 전용" 접힘으로
  한 번 더 격리했다. 실행 조건(guard)과 확인 모달은 그대로 유지.
- env 변수 노출 지점(`WORDPRESS_BASE_URL` 등)을 실사했고, 전부 이미
  중첩 `<details>` 안에 있어 추가 이동이 필요 없었다.
- SEO plugin provider select를 "SEO plugin 직접 선택 (고급)" 접힘
  안으로 옮기고, 기본 화면에는 현재 provider 이름만 보여준다.
- 중복된 "WordPress 게시 준비" 섹션의 이름 충돌을 해소했다(자동 실행
  섹션을 "WordPress 게시 준비 자동 실행"으로 개명). 완전한 통합은
  UX-03에서 다시 검토.
- 위험도는 낮았다: 버튼 라벨/접힘 위치/dt 라벨만 바꿨고 서버 액션,
  guard, DB 스키마는 전혀 건드리지 않았다. 전체 테스트(3316개)/lint/
  build 모두 통과.

### UX-02B (완료, 2026-09-18): 나머지 Critical 잔여 항목

> 완료 내역은 [`docs/ux/ux-02b-wordpress-blog-cleanup.md`](./ux-02b-wordpress-blog-cleanup.md) 참고.

**목적**: UX-02A가 다루지 않은 나머지 안전/기술정보 문제를 정리한다.

**대상 페이지**: `app/articles/[id]/blog/page.tsx`, `components/wordpress/wordpress-publishing-panel.tsx`

**실제 변경 범위**:
- `quality_status=ready` 같은 raw 필드명이 섞인 안내 문구를 자연어로 교체 (C3), "내부 상태값 보기" 접힘 안 dt/dd도 `describeStatusField`/`describeStatusValue`로 번역
- `article.status` raw enum 노출 지점(`blog/page.tsx:389,1186,1727`)에 신규 `describeArticleStatus()` 적용 (C6) — 기존 프로젝트 컨벤션("reviewed"=article 레벨에서는 "승인됨")과 충돌하지 않도록 공용 `describeStatusValue`와 분리한 전용 헬퍼로 추가
- `WordPressPublishingPanel`의 기본 화면을 5줄 요약(raw enum은 `describeStatusValue`로 번역)으로 압축하고, ID/URL/raw guard/timestamp는 "상세 상태 보기" 접힘으로 이동 (C4) — `app/articles/[id]/page.tsx`(article target)와 `app/articles/[id]/blog/page.tsx`(wordpress_blog target) 양쪽 모두 영향, 두 화면 테스트 전부 통과 확인
- 패널 자체 제목이 wordpress_blog 카드의 children(자체 "WordPress 게시 준비" 다음 작업 카드)과 중복되는 문제도 함께 정리(`isPrimaryWorkflow`일 때 "게시 상태 요약"으로 제목 구분)
- `/dashboard/blog`, `/dashboard/rewrite` 필터는 실사 결과 이미 `describeStatusField`/`describeStatusValue`를 쓰고 있어 추가 조치 없음(UX-01 감사 원자료가 최신 코드를 반영하지 못했던 것으로 확인)

**위험도**: 낮음으로 실현됨 — `WordPressPublishingPanel`은 두 화면에서 쓰이므로
양쪽 모두 정적 소스 검사 테스트를 갱신/추가해 회귀를 방지했다. 전체
테스트(3329개)/lint/build 모두 통과.

**의존성**: UX-02A 완료 후 진행(충족됨)

---

## UX-03: 공통 컴포넌트 통합

**목적**: 중복 구현된 UI 로직을 공통 컴포넌트로 통합해 일관성을 확보한다.

**대상 페이지**: `app/articles/[id]/blog/page.tsx`, `app/articles/[id]/social/page.tsx`, `app/social-posts/[id]/page.tsx`, `components/social/*`, `components/wordpress/*`

**예상 변경 범위**:
- `AdvancedDetails` 공통 컴포넌트 신설 및 기존 4곳의 개별 `&lt;details&gt;` 구현 교체
- `AutoReviewSummaryCard` 추출 — `social/page.tsx`와 `social-posts/[id]/page.tsx`의 중복 인라인 블록 통합
- `NextActionPanel` 인터페이스 통일 — `getPostApprovalNextActions`, `getSocialPostCardActionState`, `getWordPressPublishPrepState`를 공통 렌더러로 연결
- `InlinePostBodyEditor` 통합 — `SocialPostBodyPanel` 내부 편집 UI와 `social-posts/[id]` "수정하기" 탭 편집 UI를 하나로
- status label helper(`describeStatusField`/`describeStatusValue`) 적용 범위를 `/dashboard/blog`, `/dashboard/rewrite`, `/articles/[id]`, `/articles/[id]/blog`, `/trends`, `/themes/[themeId]`까지 확대
- `PlatformBadge` 계열을 공통 컴포넌트로 통합 (현재 `/trends`, `/themes/[themeId]`에 개별 구현)

**위험도**: 중간 — 여러 화면에 걸친 리팩터링이라 회귀 범위가 넓음. 단계적으로(컴포넌트 1개씩) 적용 권장.

**의존성**: UX-02 완료 후 진행 (Critical 수정으로 드러난 패턴을 공통 컴포넌트 설계에 반영)

---

## UX-04: 자동 검토·자동 수정 UX

**목적**: 이미 존재하는 자동 검토/자동 수정 파이프라인(`post-auto-fix-service.ts`)의 사용자 노출 방식을 개선하고, 플랫폼 다건 처리 시 반복 판단 부담을 줄인다.

**대상 페이지**: `app/articles/[id]/social/page.tsx`, `app/articles/[id]/blog/page.tsx`

**예상 변경 범위**:
- 플랫폼 다건 생성 시 일괄 확인/일괄 승인 UI 검토 (Journey 3 대응)
- "확인 필요 사항만" 필터링해서 보여주는 `HumanReviewPanel` 신설
- 자동화 분류표(`user-journey-audit.md`)의 `safe_to_automate` 항목 중 미구현분(markdown/HTML 잔여물 정리 등) 구현 검토
- 자동화 안전 점검 재실행 버튼(`/dashboard/automation-safety`) 4개 → 실질 기능 1개로 정리

**위험도**: 낮음~중간 — UI 레이어 변경 위주. 단, 일괄 승인 기능은 승인 원칙(Human Approval)을 해치지 않도록 설계 필요 (일괄 승인이 "묻지마 승인"이 되지 않게 확인 단계는 유지).

**의존성**: UX-03의 `NextActionPanel`, `HumanReviewPanel` 공통화 이후 진행하면 효율적

---

## UX-05: 게시/승인 흐름 단순화

**목적**: "승인"이라는 단어가 여러 맥락(기사 승인/소셜포스트 승인/rewrite 제안 승인/재승인)에서 혼용되는 문제와 WordPress Draft/공개 게시 구분을 명확히 한다.

**대상 페이지**: `app/articles/[id]/rewrite/page.tsx`, `app/articles/[id]/page.tsx`, `app/social-posts/[id]/page.tsx`

**예상 변경 범위**:
- rewrite 페이지의 "개선 제안 승인" / "재승인 요청" / "재승인 승인하기" 용어 재정의 (문구 확정은 이 Phase에서 사용자와 함께 결정)
- WordPress Draft 생성과 실제 public publish의 문구·동선·경고 수준을 명확히 분리 (UX-02의 "테스트/실게시" 수정과 연계)
- `getApprovalGateStatus`가 모든 케이스에서 비활성 사유(`reason`)를 채우는지 확인 후 누락 케이스 보완

**위험도**: 중간~높음 — 승인/게시라는 핵심 안전장치를 다루므로 문구 변경도 신중해야 하며, 실제 게시 동작 자체는 바꾸지 않고 "이해 가능성"만 개선하는 것이 원칙.

**의존성**: UX-02 완료 필수 (동일 영역을 다룸)

---

## UX-06: 전체 사용자 여정 테스트

**목적**: UX-02~05 적용 후 5개 Journey를 실제로 처음부터 끝까지 실행하며 검증한다.

**대상 페이지**: 전체 (Journey 1~5 관련 모든 route)

**예상 변경 범위**: 코드 변경보다는 검증/버그 수정 위주. 이 Phase 조사에서 남은 "조사 공백"(rewrite 카드, `/dashboard/rewrite`, `/dashboard/social-performance`, `/trends` 일부)도 이 단계에서 실사용 기준으로 재확인.

**위험도**: 낮음 (검증 단계)

**의존성**: UX-02~05 전체 완료 후

---

## UX-07: 최종 polish

**목적**: Low severity 항목(표현, spacing, label 통일, 작은 디자인 일관성) 일괄 정리.

**대상 페이지**: 전체

**예상 변경 범위**: 문구 다듬기, "수정하기"/"본문 수정"/"rewrite" 등 동일 기능의 라벨 통일, 화살표(`→`) 링크 표현 재검토.

**위험도**: 낮음

**의존성**: UX-02~06 완료 후 (기능적 변경이 끝난 뒤 표현 다듬기)

---

## Phase 간 의존성 요약

```
UX-02 (Critical) → UX-05 (게시/승인 흐름, 동일 영역 공유)
UX-02 → UX-03 (공통 컴포넌트, Critical 수정 패턴 반영)
UX-03 → UX-04 (NextActionPanel/HumanReviewPanel 재사용)
UX-02~05 → UX-06 (전체 검증)
UX-02~06 → UX-07 (polish)
```

## 이번 Phase(UX-01)에서 다음 Phase로 넘기는 미해결 조사 항목

- `app/articles/[id]/rewrite/page.tsx`의 카드 단위 세부 조사
- `/dashboard/rewrite`, `/dashboard/social-performance`, `/trends` 일부 화면의 전문 확인
- `getApprovalGateStatus`가 모든 케이스에서 `reason`을 채우는지 여부
- `/dashboard/platform-api`, `/dashboard/automation-safety`가 일반 사용자 네비게이션에 실제로 노출되는지 여부
