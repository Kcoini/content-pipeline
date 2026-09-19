# UX 개선 프로젝트 최종 상태 보고 (Phase UX-01 ~ UX-07)

- 작성일: 2026-09-19
- 범위: UX-01(감사)부터 UX-07(최종 polish)까지 전체 UX 개선 프로젝트의
  종료 보고서다.

## 1. 프로젝트 시작 시 문제 (UX-01 기준)

- Critical 7건: 실제로는 "테스트"라는 이름의 버튼이 진짜 WordPress
  공개 게시를 실행하는 등, 라벨과 실제 동작이 다른 위험한 UI가 존재.
- High 10건: env 변수명 노출, dry-run/handoff 등 개발자 용어 노출,
  raw enum 버튼 라벨, 동일 기능의 중복 구현, "승인"이라는 단어의
  3가지 다른 의미 공존 등.
- Medium 11건/Low 5건: 상태 라벨 변환 방식 불일치, 접힘 영역 이름
  불일치, disclaimer 과다, primary action 중복 등.
- 핵심 원인: "기능이 없어서"가 아니라 **좋은 패턴(details 접힘, 라벨
  변환 헬퍼, next-action 계산 로직)이 일부 화면에만 적용되고 전체에
  퍼지지 않아 일관성이 깨진 것**이었다.

## 2. 해결한 Critical/High

- Critical 7/7 해결(UX-02A) — 위험한 라벨-동작 불일치 제거, 공개
  게시를 "⚠ 관리자 전용" 이중 접힘으로 격리.
- High 10건 중 8건 완전 해결(UX-02B~UX-04B), 나머지 2건(H5/H6)은
  **UX-07에서 최종 해결**:
  - H5: `/articles/[id]` 관리자 접힘 내부를 4개 카테고리 accordion으로
    그룹핑.
  - H6: "수정하기"(다중 필드 편집)와 "본문 수정"(inline 편집)의
    라벨 충돌을 "글 정보 편집"으로 재명명해 해소.

## 3. 현재 핵심 사용자 workflow

`docs/ux/final-user-workflow.md` 참고 — 테마 선택 → 자료 수집 → 글
만들기 → 필요한 내용만 확인 → 승인 → 게시 준비 → WordPress Draft/
본문 복사 → 수동 게시 완료 기록. 어떤 플랫폼도 버튼 한 번으로 외부에
즉시 공개 게시되지 않는다.

## 4. 구축한 공통 components/helpers

- `components/review/*`(AutoReviewSummaryCard, MultiPlatformReviewSummaryCard,
  HumanReviewPanel)
- `components/publish/*`(PublishPreparationSummaryCard,
  PlatformPublishPreparationCard)
- `components/workflow/*`(NextActionPanel, WorkflowStatusCard)
- `components/social/inline-post-body-editor.tsx`,
  `post-body-action-row.tsx`, `copy-post-body-button.tsx`
- `components/common/platform-badge.tsx` + `lib/ui/platform-badge.ts`
- `lib/social/status-labels.ts`(raw 상태값 → 한국어 라벨 단일 변환)
- `lib/social/social-post-auto-review.ts`,
  `lib/social/post-approval-next-actions.ts`,
  `lib/ui/publish-preparation-view-model.ts`,
  `lib/ui/multi-platform-review-summary.ts`

## 5. 자동화된 사용자 작업

- 자동 검토 후 안전하게 고칠 수 있는 문제(auto_fixable)는 사람 확인
  없이 자동 수정 + 재검토(`post-auto-fix-service.ts`).
- WordPress 게시 준비 자동 실행(Metadata/SEO/대표 이미지/Quality
  Gate 일괄).
- naver_cafe 등 plain text 전용 플랫폼의 markdown 잔여물 자동 정리
  (`naver-cafe-plain-text-sanitizer.ts`, `plain-text-markup-residue-sanitizer.ts`).
- Multi-platform bulk 승인(대상 필터링 자동 계산, 부분 성공 지원).

## 6. 남은 Accepted/Deferred 항목

**Accepted(의도적 유지)**:
- `article.status`/`post.status` raw↔라벨 변환 방식이 페이지 성격별로
  다름(4가지) — 페이지 목적이 서로 달라 강제 통일의 이득이 적음.
- Level 3 접힘 영역 이름이 페이지마다 다름(관리자 기능/상세 상태
  보기/내부 원문 보기/상세 관리) — 각 맥락에서 담는 내용의 성격이
  달라 이름도 다른 것이 자연스럽다고 재확인.
- `RelatedPostLinks`의 "→" 화살표, automation-safety의 `publish_guards`
  라벨, dashboard 로그 영문 표기 — 영향 범위가 작고 이미 접힘/저노출
  상태.

**Deferred(향후 QA/기능 Phase)**:
- `/social-posts/[id]`의 `tab=raw` URL 직접 접근 — route 분리가
  필요한 구조 변경.
- 실제 browser 기반 narrow viewport 검증(아래 9절).

## 7. Browser QA 권고

이 프로젝트는 UX-06/UX-07 모두에서 Playwright/Cypress 도입 여부를
재검토했다. 정적 소스 검사 + repository-mock 기반 서비스 체이닝으로
"raw info 노출 없음/dead-end 없음/primary action 충돌 없음/성공
계약 충족"까지는 검증했지만, **실제 렌더링된 화면의 반응형 레이아웃/
실제 클릭 인터랙션은 검증하지 못했다.**

**권고**: 운영 단계로 넘어가기 전, 별도 QA Phase에서 Playwright를
최소 구성(스모크 테스트 수준: 핵심 5개 Journey를 1개 브라우저·2개
viewport에서 왕복)으로 도입할 것을 권장한다. 이번 UX 프로젝트
범위에서는 설치하지 않았다(불필요한 dependency 추가를 피하라는
Phase 지시에 따름).

## 8. 향후 기능 개발 시 지켜야 할 규칙

`docs/ui-ux-governance-rules.md`의 "UX Governance 최종 원칙(16개)"과
`docs/ux/ux-regression-checklist.md`를 항상 먼저 확인한다. 핵심만
요약하면:

1. 현재 상태/본문/확인사항/다음 작업 순서를 기본으로 한다.
2. primary action은 하나만 강조한다.
3. AI가 처리할 수 있는 일을 사람에게 시키지 않는다.
4. raw enum/DB 필드명/env 변수명을 사용자 화면에 노출하지 않는다.
5. 승인≠게시, 복사≠게시, Draft≠공개 게시 — 항상 구분한다.
6. 완료된 action을 반복 노출하지 않는다.
7. 동일한 의미에는 항상 동일한 라벨을 쓴다.
8. 외부 공개 게시 같은 되돌리기 어려운 action은 항상 사람이 직접
   클릭해야 한다 — 자동화/일괄 처리 대상에 포함하지 않는다.

## 9. 최종 감사 숫자

| 등급 | 총 항목 | resolved | accepted | deferred | open |
|---|---|---|---|---|---|
| Critical | 7 | 7 | 0 | 0 | **0** |
| High | 10 | 10 | 0 | 0 | **0** |
| Medium | 11 | 6 | 4 | 1 | **0** |
| Low | 5 | 1 | 4 | 0 | **0** |

- 핵심 Journey blocker: **0건**
- dead-end: **0건**
- 위험한 publish/approval 오해: **0건**

## 10. UX 프로젝트 종료 판정

- Critical open 0 ✅
- High open 0 ✅
- Journey blocker 0 ✅
- dead-end 0 ✅
- 위험한 publish/approval 오해 0 ✅

**UX 개선 프로젝트 완료.** Medium 4건/Low 4건은 accepted(의도적
유지), Medium 1건은 deferred(향후 QA/기능 Phase)로 남아 있으나 종료
조건에는 해당하지 않는다.

## 11. 종료 후 다음 개발 단계 권고

- 기능 개발 재개 시 `docs/ux/ux-regression-checklist.md`를 새 화면/
  기존 화면 수정마다 적용한다.
- Deferred 항목(`tab=raw` route 분리, browser QA)은 별도 QA/기능
  Phase에서 다시 다룬다.
- 이번 프로젝트가 구축한 공통 컴포넌트/헬퍼(4절)를 재사용하는 것을
  새 기능의 기본값으로 한다 — 페이지별 개별 구현을 다시 늘리지 않는다.
