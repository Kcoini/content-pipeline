# UX-03C: Remaining Route Adoption + Platform Label Unification

- 작성일: 2026-09-18
- 범위: 아직 공통 UX가 적용되지 않은 우선순위 2 route에 "현재 상태/다음
  작업" 원칙을 필요한 곳에만 확대 적용하고, 여러 페이지에 중복
  구현된 PlatformBadge/platform label을 통합하고,
  `app/articles/[id]/rewrite/page.tsx`의 카드 단위 UX를 전수 감사했다.
  `docs/ux/full-ux-audit.md`, `docs/ux/user-journey-audit.md`,
  `docs/ux/ui-information-levels.md`, `docs/ux/ux-refactor-roadmap.md`,
  `docs/ux/ux-03a-common-ux-foundation.md`,
  `docs/ux/ux-03b1-workflow-next-action.md`,
  `docs/ux/ux-03b2-interaction-consistency.md`, `docs/ui-ux-governance-rules.md`를
  먼저 읽고 작업했다.
- 작업 방식: 파일 범위가 겹치지 않는 3개 그룹으로 나눠 병렬 작업했다 —
  (1) 좌표 담당(coordinator, 이 문서 작성자)이 PlatformBadge 공통화
  (`components/common/platform-badge.tsx` + `lib/ui/platform-badge.ts`,
  `app/trends/page.tsx`, `app/themes/[themeId]/page.tsx`,
  `components/social-performance-dashboard/charts/platform-performance-chart.tsx`),
  (2) `app/articles/[id]/rewrite/page.tsx` 카드 단위 감사 +
  `app/dashboard/rewrite/page.tsx`, (3) `app/articles/[id]/page.tsx`
  간소화, (4) `app/dashboard/page.tsx`/`app/dashboard/blog/page.tsx`/
  `app/dashboard/social-performance/page.tsx` 재확인. 이번 Phase에서
  하지 않은 것: DB migration, publish logic 변경, approval logic 변경,
  AI prompt 대규모 변경, 전체 CSS redesign, 전역 navigation redesign,
  새로운 자동화 기능/게시 플랫폼 추가, 성과 analytics logic 변경.

---

## 1. 공통 UX를 확대 적용한 route

| Route | 적용 내용 |
|---|---|
| `app/articles/[id]/page.tsx` | 기본 화면을 "현재 상태 / 다음 작업(WordPress 블로그 글 관리 버튼) / 보조(SNS 글 관리 링크)"로 재구성. 관리자 대형 접힘 요약 제목을 "관리자 기능"으로 정리(AdvancedDetails 명명 규칙과 통일) |
| `app/articles/[id]/rewrite/page.tsx` | 카드 단위 전수 감사 + 발견된 버그 수정(아래 8절), 페이지 로컬 `<details>`를 `AdvancedDetails`로 교체 |
| `app/dashboard/rewrite/page.tsx` | rewrite 용어를 UX-03B2 라벨과 통일(공용 헬퍼 수정으로 자동 반영) |
| `app/trends/page.tsx` | 공통 `PlatformBadge` 적용, "Mock 모드"/"Real API 모드" 영문 배지를 한국어로 교체 |
| `app/themes/[themeId]/page.tsx` | 공통 `PlatformBadge` 적용, `ARTICLE_SEARCH_ENABLED=false` env 변수명 노출 제거 |
| `components/social-performance-dashboard/charts/platform-performance-chart.tsx` | 자체 영문 platform 라벨 매핑 제거, 공통 helper로 교체 |
| `components/social-performance-dashboard/dashboard-filter-controls.tsx`, `charts/low-performance-chart.tsx`, `charts/tone-performance-chart.tsx` | raw status/enum 노출 다수 발견해 기존 헬퍼(`PLATFORM_LABELS`/`TONE_STYLE_CONFIGS`/`describeStatusField`/`describeStatusValue`)로 교체 |

## 2. 적용하지 않은 route와 이유

| Route | 이유 |
|---|---|
| `app/dashboard/page.tsx` | 재확인 결과 이미 `resolveDashboardWorkflowState` 단일 판단 로직 + "현재 상태/다음 작업" 카드가 명확하고 raw 노출/중복 primary action이 없음을 코드로 확인. 지시대로 "과도하게 바꾸지 않는다" 원칙에 따라 변경하지 않음 |
| `app/dashboard/blog/page.tsx` | 재확인 결과 필터/테이블 모두 이미 `describeStatusField`/`describeStatusValue`/`PLATFORM_LABELS`로 번역되어 있고, 각 행의 유일한 액션("열기")이 실제 다음 작업 판단을 상세 페이지에 위임하는 구조라 중복 business logic이 아님을 확인. 변경하지 않음 |
| `app/dashboard/social-performance/page.tsx` | 페이지 자체 구조(상태 → 결과 → 해석, NextActionPanel 미적용)는 이미 적절해 손대지 않음. 단, 이 페이지가 가져다 쓰는 하위 컴포넌트 3개에서 문제를 발견해 그쪽만 수정(1절 참고) |
| `components/platform-api/api-readiness-badge.tsx` 등 `/dashboard/platform-api` | 이번 Phase 대상 route 목록 밖(H2). 다음 Phase 후보로 `full-ux-audit.md`에 남김 |
| `components/social-ab-tests/ab-test-card.tsx` (`/articles/[id]/ab-tests`) | 이번 Phase 대상 route 목록 밖(H3). 다음 Phase 후보로 남김 |
| `app/articles/[id]/page.tsx`의 대형 관리자 접힘 블록 내부(WordPress Metadata/SEO/이미지 등, 약 1900줄) | 기본 화면 재구성은 완료했으나, 이미 한 번 접혀 있는 블록을 세부 `AdvancedDetails` 여러 개로 다시 쪼개는 작업은 이미 안전한 상태(기본 노출 아님) 대비 회귀 위험이 커 보류. `full-ux-audit.md` H5에 "부분 해결"로 기록 |

## 3. PlatformBadge source of truth

이 프로젝트에는 실제로 서로 다른 두 "platform" 개념이 있었다:

1. **콘텐츠 플랫폼**(`SocialPlatform`: wordpress_blog/naver_blog/naver_cafe/x/threads/instagram/news_article/opinion_column) — 기존 source of truth는 `lib/social/platform-generation-recommendations.ts`의 `PLATFORM_LABELS`(이미 한국어로 잘 되어 있었음).
2. **트렌드 검색 출처**(naver/daum/mock) — `app/trends/page.tsx`, `app/themes/[themeId]/page.tsx`에 거의 동일한 로컬 `PlatformBadge` 함수가 각각 구현되어 있었고, **라벨 변환 없이 raw 문자열("naver"/"daum"/"mock")을 그대로 배지 텍스트로 렌더링**하고 있었다.

두 개념을 하나로 합치지 않고, `lib/ui/platform-badge.ts`에 "platform 문자열 하나를 받아 라벨/배지 색상을 반환"하는 계산 로직만 통합했다:

```ts
export function describePlatformBadge(platform: string): string {
  if (isSocialPlatform(platform)) return PLATFORM_LABELS[platform]; // 기존 source of truth 재사용
  if (isTrendSourcePlatform(platform)) return TREND_SOURCE_PLATFORM_LABELS[platform]; // naver→네이버, daum→다음, mock→테스트 데이터
  return platform; // 알 수 없는 값은 원문 유지(화면이 비지 않게)
}
export function getPlatformBadgeClassName(platform: string): string { /* naver=초록/daum=파랑/mock=zinc(기존 색상 유지), 콘텐츠 플랫폼=인디고 */ }
```

`components/common/platform-badge.tsx`(`PlatformBadge`)는 이 두 함수에 렌더링만 위임하는 얇은 컴포넌트다 — label/색상 계산 로직을 컴포넌트 안에 직접 두지 않는다(governance 규칙 "페이지마다 별도 switch/색상 매핑 금지" 준수).

## 4. 제거한 중복 platform mapping

- `app/trends/page.tsx`의 로컬 `function PlatformBadge` + `colorMap`(naver/daum/mock 3개 항목, raw 텍스트 렌더링) — 제거, 공통 컴포넌트로 교체
- `app/themes/[themeId]/page.tsx`의 동일한 로컬 `function PlatformBadge` + `map`(내용 100% 동일, 완전 중복) — 제거
- `components/social-performance-dashboard/charts/platform-performance-chart.tsx`의 자체 `PLATFORM_LABELS`(영문: "Naver Blog"/"Naver Cafe" 등, 프로젝트 전체 한국어 기준과 불일치) — 제거, `describePlatformBadge` 재사용

새로 만든 label map은 트렌드 검색 출처(naver/daum/mock) 3개뿐이다 — 콘텐츠 플랫폼은 여전히 `PLATFORM_LABELS` 하나만 source of truth다.

## 5. rewrite 카드 단위 감사 결과

`app/articles/[id]/rewrite/page.tsx`의 각 카드 유형을 전수 점검했다(UX-01에서 조사 공백으로 남아 있던 부분).

1. **개선 제안 생성 form**: 단일 action, primary-action 모호성 없음. 변경 없음.
2. **개선 제안 카드**:
   - **버그 발견/수정**: "개선안 선택" 버튼에 `disabled`/이유 로직이 전혀 없었다 — 페이지의 다른 모든 버튼(재검토 요청/최종 승인/재내보내기 등)은 상태에 따라 disabled + 이유를 보여주는데, 이 버튼만 예외였다. 즉 **이미 선택/적용된 제안에도 "개선안 선택" 버튼이 계속 클릭 가능한 상태로 남아**, governance 규칙 "완료된 action은 반복 표시하지 않는다"를 위반하고 있었다. `describeSelectSuggestionDisabledReason`(기존 `describe*DisabledReason` 패밀리와 동일한 패턴)을 신설해 수정.
   - **버그 발견/수정**: "대상 원본 글" select의 `<option>`에 raw platform key(`{p.platform}`)가 그대로 노출 — `PLATFORM_LABELS[p.platform]`로 교체.
   - 상태 텍스트는 이미 UX-03B2의 `describeRewriteSuggestionStatus`를 쓰고 있었음(정상, 변경 없음).
   - "반려" 버튼은 의도적으로 disabled 커플링이 없음(항상 가능한 보조 action) — 정상.
3. **재작성 버전 카드**: `getRewriteVersionNextAction`으로 primary action 1개 확인(정상), 5개 액션 버튼 모두 이미 disabled+이유 보유(정상) — 변경 없음. 페이지 로컬 "내부 상태값 보기" `<details>`를 공통 `AdvancedDetails`로 교체(섹션 14 요건).
4. **dead-end**: "다음 작업: ..." 문구가 모두 실제 action 버튼과 짝지어져 있음을 확인 — 발견된 dead-end 없음.
5. **관련 링크(`RelatedPostLinks`)**: primary/secondary action과 이미 시각적으로 분리되어 있음 — 변경 없음.

### 서비스 레이어에서 함께 발견한 raw 상태 노출

disabled 조건의 근거를 서비스 레이어까지 추적하는 과정에서, 실패 시 사용자에게 보이는 오류 메시지(`{error}` 배너)에 `field_name='value'(actual)` 형태의 raw 필드명이 섞여 있는 것을 발견했다(UX-02B가 WordPress 패널에서 제거한 것과 동일한 패턴이지만 rewrite 서비스 쪽에는 적용되지 않았었다). `rewrite-suggestion-review-service.ts`/`rewrite-application-service.ts`/`rewrite-reapproval-service.ts`/`rewrite-reexport-service.ts` 4개 파일에서 수정했다(문자열만 수정, state machine/함수 시그니처 불변). 같은 김에 "재export"(콩글리시) → "재내보내기", "재승인" 문구를 UX-03B2 용어("재검토 요청"/"최종 승인")와 통일했다.

## 6. trends/themes 적용 결과

- 두 페이지 모두 공통 `PlatformBadge`로 통일 — 이제 "naver"/"daum"/"mock" raw 텍스트가 아니라 "네이버"/"다음"/"테스트 데이터"로 표시된다.
- `themes/[themeId]`의 "Mock 모드" 배너에서 `ARTICLE_SEARCH_ENABLED=false` env 변수명을 제거하고 "테스트 데이터 모드"로 교체(H1 해결).
- `trends`의 모드 배지도 "Mock 모드"/"Real API 모드" 영문 → "테스트 데이터 모드"/"실제 API 연동 모드"로 교체.

## 7. raw status 추가 제거 내용

이번 Phase에서 새로 발견해 제거한 raw status/enum 노출 (섹션 5의 rewrite 관련 항목 제외):

- `components/social-performance-dashboard/dashboard-filter-controls.tsx`: 필드 라벨("content group"/"platform"/"tone_style"/"performance_status"/"manual_post_status" 영문), platform/toneStyle select의 raw enum key 옵션, performance_status/manual_post_status select의 raw enum 옵션, 정렬 옵션 라벨("performance score"/"engagement_rate"/"rewrite score delta" 등 영문 혼재), 체크박스 라벨("rewrite version"/"metrics" 영문) — 전부 기존 헬퍼(`PLATFORM_LABELS`/`TONE_STYLE_CONFIGS`/`describeStatusField`/`describeStatusValue`)와 한국어 문구로 교체
- `components/social-performance-dashboard/charts/low-performance-chart.tsx`: 범례가 raw `performance_status` enum(`excellent`, `needs_review` 등)을 그대로 표시 — `describeStatusValue`로 교체
- `components/social-performance-dashboard/charts/tone-performance-chart.tsx`: 막대 라벨이 raw `toneStyle` enum(`informational` 등)을 그대로 표시 — `TONE_STYLE_CONFIGS[...].label`로 교체
- `app/themes/[themeId]/page.tsx`: env 변수명 노출(위 6절)
- `app/articles/[id]/rewrite/page.tsx` + rewrite 서비스 4개 파일: raw platform key, `field_name='value'` 형태 오류 메시지(위 5절)

## 8. AdvancedDetails 추가 적용 위치

- `app/articles/[id]/rewrite/page.tsx`: 재작성 버전 카드의 페이지 로컬 `<details>`("내부 상태값 보기")를 공통 `AdvancedDetails`로 교체
- `app/articles/[id]/page.tsx`: 기존 대형 관리자 전용 접힘의 요약 제목을 "관리자 기능"으로 정리해 `AdvancedDetails` 명명 규칙과 통일(컴포넌트 자체 치환은 하지 않음 — 2절 참고)

## 9. 제거한 중복 primary action

- `app/articles/[id]/rewrite/page.tsx`의 "개선안 선택" 버튼에 disabled 로직을 추가해, 완료 후에도 primary action처럼 계속 클릭 가능하던 반복 노출을 제거(5절 참고). 이 Phase에서 발견한 유일한 실제 "완료된 action 반복 표시" 사례다 — 나머지 대상 route는 이미 governance 규칙을 지키고 있었다.

## 10. 발견/해결한 dead-end

- 대상 route 전체에서 "다음 작업"/"다음 단계"/"계속 진행"/"아래에서"/"진행하세요"/"완료 후" 패턴을 전수 검색했다. 모두 실제 action(버튼/링크)과 짝지어져 있었고, 새로 발견된 dead-end는 없었다.

## 11. 수정한 파일 목록

**신규**:
- `lib/ui/platform-badge.ts`, `.test.ts`
- `components/common/platform-badge.tsx`, `.test.tsx`
- `components/social-performance-dashboard/dashboard-filter-controls.test.tsx`
- `docs/ux/ux-03c-route-adoption-platform-labels.md`(이 문서)

**수정**:
- `app/trends/page.tsx`, `.test.ts` — PlatformBadge 공통화, Mock 모드 배지 한국어화
- `app/themes/[themeId]/page.tsx`, `.test.ts` — PlatformBadge 공통화, env 변수 노출 제거
- `components/social-performance-dashboard/charts/platform-performance-chart.tsx`, `.test.tsx` — 자체 라벨 매핑 제거
- `components/social-performance-dashboard/charts/low-performance-chart.tsx`, `.test.tsx` — raw status 노출 제거
- `components/social-performance-dashboard/charts/tone-performance-chart.tsx`, `.test.tsx` — raw enum 노출 제거
- `components/social-performance-dashboard/dashboard-filter-controls.tsx` — raw enum/영문 라벨 다수 제거
- `app/articles/[id]/page.tsx`, `.test.ts` — 기본 화면 재구성(현재 상태/다음 작업/보조)
- `app/articles/[id]/rewrite/page.tsx`, `.test.ts` — 카드별 버그 수정, AdvancedDetails 적용
- `app/dashboard/rewrite/page.tsx`, `.test.ts` — 용어 통일
- `lib/social/status-labels.ts` — `rewrite_reapproval_status` 필드 라벨 수정
- `lib/social/rewrite-suggestion-review-service.ts`, `rewrite-application-service.ts`, `rewrite-reapproval-service.ts`(`.test.ts`), `rewrite-reexport-service.ts`(`.test.ts`) — 오류 메시지 raw 필드명 제거, 용어 통일
- `lib/social/rewrite-version-user-facing-status.ts`, `.test.ts` — `describeSelectSuggestionDisabledReason` 신설
- `docs/ux/full-ux-audit.md`, `docs/ux/user-journey-audit.md`, `docs/ux/ux-refactor-roadmap.md`, `docs/ui-ux-governance-rules.md`(업데이트)

## 12. 테스트 추가/수정 내역

- `lib/ui/platform-badge.test.ts`: 5개(SocialPlatform 라벨/trend 출처 라벨/알 수 없는 값/색상 구분)
- `components/common/platform-badge.test.tsx`: 2개(정적 소스 검사 — helper 위임 확인, raw 텍스트 미노출)
- `app/trends/page.test.ts`: 47개(기존 45개 + PlatformBadge 공통화 검증 1개 + Mock 모드 한국어화 검증 1개)
- `app/themes/[themeId]/page.test.ts`: 11개(기존 9개 + PlatformBadge/env 노출 검증 2개)
- `components/social-performance-dashboard/charts/platform-performance-chart.test.tsx`: 3개(기존 2개 + 한국어 라벨 검증 1개)
- `components/social-performance-dashboard/dashboard-filter-controls.test.tsx`: 4개(신규)
- `components/social-performance-dashboard/charts/low-performance-chart.test.tsx`: 3개(기존 2개 + raw status 미노출 검증 1개)
- `components/social-performance-dashboard/charts/tone-performance-chart.test.tsx`: 3개(기존 2개 + raw enum 미노출 검증 1개)
- `app/articles/[id]/page.test.ts`: 72개(기존 68개, 3개 문구 갱신 + 4개 신규)
- `app/articles/[id]/rewrite/page.test.ts`: 30개(기존 28개 + 2개 신규 — disabled 로직/raw platform 검증)
- `app/dashboard/rewrite/page.test.ts`: 8개(기존 6개 + 2개 신규)
- `lib/social/rewrite-version-user-facing-status.test.ts`: 18개(기존 16개 + 2개 신규)
- `lib/social/rewrite-reapproval-service.test.ts`: 12개(2개 수정, 3개 강화)
- `lib/social/rewrite-reexport-service.test.ts`: 7개(2개 강화)

## 13. lint 결과

`npm run lint` — 오류 없음(출력 없음).

## 14. test 결과

전체 스위트: **267 files / 3470 tests passed**, 실패 없음.

## 15. build 결과

`npm run build` 성공(`next build`, Turbopack, TypeScript 통과, 19개 route 모두 정상 생성).

## 16. 최신 UX 감사 기준 Critical/High/Medium/Low 개수

`docs/ux/full-ux-audit.md`를 현재 코드 기준으로 다시 계산했다(UX-01 원자료를 그대로 쓰지 않고 이번 Phase 및 이전 Phase들의 실제 코드 변경을 반영):

| 등급 | 총 항목 | 해결 | 부분 해결 | 미해결 |
|---|---|---|---|---|
| Critical | 7 (C1-C7) | 7 | 0 | 0 |
| High | 10 (H1-H10) | 6 | 2 (H5, H6) | 2 (H2, H3) |
| Medium | 11 | 2 | 0 | 9 |
| Low | 5 | 1 | 0 | 4 |

Critical은 UX-02A/UX-02B에서 이미 전부 해결되어 있었다(이번 Phase에서
새로 발견된 Critical 항목 없음). High의 미해결 2건(H2 dry-run 용어,
H3 raw enum 버튼 라벨)은 모두 이번 Phase 대상 route 목록 밖의 파일이라
범위에서 제외했다. 부분 해결 2건(H5 `/articles/[id]` 관리자 블록 내부
미세분화, H6 `/social-posts/[id]` "수정하기" 탭 통합)은 위험도 대비
효과가 낮다고 판단해 의도적으로 보류했다.

## 17. 아직 남은 주요 UX 문제

- H2: `components/platform-api/api-readiness-badge.tsx` 등의 "dry-run 준비됨" 류 기술 용어
- H3: `components/social-ab-tests/ab-test-card.tsx`의 raw enum 버튼 라벨
- H5: `/articles/[id]` 관리자 접힘 블록 내부(~1900줄)가 여전히 하나의 큰 접힘 — 세부 `AdvancedDetails` 분리는 보류
- H6: `/social-posts/[id]` "수정하기" 탭과 `InlinePostBodyEditor`의 구조적 중복(범위 밖 확인은 UX-03A에서 이미 완료, 실제 통합은 미착수)
- Medium 9건(상태 라벨 4가지 방식 혼재, Level 3 접힘 이름 불일치, `tab=raw` URL 직접 접근, 자동화 안전 점검 버튼 4개 중복 등) — 모두 이번 Phase 대상 route 밖이거나 위험도 대비 효과가 낮아 보류

## 18. UX-04에서 처리해야 할 항목

1. 자동 검토/자동 수정(`post-auto-fix-service.ts`) 사용자 노출 방식 개선
2. 플랫폼 다건 처리 시 반복 판단 부담 축소
3. (선택) H2/H3처럼 이번 Phase 범위 밖에 남은 raw 용어 노출 정리
4. (선택) `/social-posts/[id]` "수정하기" 탭 구조 통합 여부 결정

---

**UX-03C에서는 남은 주요 화면에 공통 UX 규칙을 확대 적용하고 플랫폼
표시를 통합했으며, 다음 Phase에서는 자동검토와 사람 확인 UX를
단순화합니다.**
