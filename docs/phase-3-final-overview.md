# Phase 3 Final Overview

## Phase 3의 목적

Phase 2까지는 "기사(article) 한 편을 만들고 WordPress에 draft로
올리는" 파이프라인이었다. Phase 3는 이 기사를 **여러 플랫폼(블로그/
커뮤니티/SNS)에 맞는 글로 다시 쓰고, 사람이 검수·승인한 뒤, 안전하게
게시 준비까지 하는** 콘텐츠 운영 파이프라인으로 확장한다.

핵심 원칙은 처음부터 끝까지 동일하다: **생성은 자동화하되, 실제
공개 게시는 사람의 승인과 수동 조작을 거친다.** Phase 3 전체에서
외부 플랫폼에 실제로 자동 게시하는 기능은 없다.

## Phase 3에서 구축한 전체 기능

- 플랫폼별/문체별 글쓰기(멀티플랫폼 draft 생성)
- 검수/수정/승인 워크플로우
- 수동 export(복사해서 붙여넣기용 payload)
- 게시 전 안전 가드(publishing guard) + dry-run + handoff
- 수동 게시 결과 기록 + 수동 metrics 입력
- 성과 기반 rewrite 제안 → 적용(버전 생성) → 비교 → 재승인/재export
- rewrite 성과(원본 vs rewrite) 비교
- 대시보드(콘텐츠/블로그/rewrite/social performance)와 차트 시각화
- A/B 테스트 draft 구조
- 플랫폼 API 게시 준비(capability/readiness/eligibility/adapter,
  실제 게시는 비활성화)
- automation safety review(자동화 안전 점검)

## Phase 3-1부터 Phase 3-23까지 단계별 요약

| Phase | 제목 | 핵심 내용 |
| --- | --- | --- |
| 3-1 | Multi-platform Writing Foundation | `social_posts`/`social_post_quality_runs`/`social_post_approvals` 테이블, 플랫폼/문체 타입 정의 |
| 3-2/3-3 | Prompt / Context / Contract Structure | 플랫폼별 프롬프트, 계약(contract) 구조 |
| 3-4 | Social Post Review & Editing Workflow | 검수/수정, quality check |
| 3-5 | Manual Export Copy Workflow | 복사용 export payload 생성 |
| 3-6 | Platform Publishing Guard | 게시 전 규칙 기반 가드(금지 표현 등) |
| 3-7 | Dry-run & Handoff | dry-run payload, 수동 게시 인계(handoff) |
| 3-8 | Manual Posting Result Recording | 실제 게시 후 결과를 사람이 기록 |
| 3-9 | Manual Metrics Input & Performance Tracking | 조회수/좋아요 등 수동 입력, 성과 점수 계산 |
| 3-10 | Performance-based Rewrite Suggestion | 성과가 낮은 글에 대한 rewrite 제안 생성 |
| 3-11 | Rewrite Application & Versioning Workflow | 제안을 적용해 새 버전 row 생성(원본 보존) |
| 3-12 | Rewrite Version Quality Recheck & Comparison | 버전 간 품질 비교 |
| 3-13 | Rewrite Reapproval & Reexport Workflow | 재승인 후에만 재export 허용 |
| 3-14 | Rewrite Performance Comparison | 원본 vs rewrite 성과 비교 |
| 3-15 | Social Performance Dashboard | 플랫폼/문체별 성과 대시보드 |
| 3-16 | Article/Blog/Social/Rewrite/Performance Page Separation | 기사 하위 페이지 분리 및 안정화 |
| 3-17 | Navigation Return Flow & Deep Links | returnTo, deep link 쿼리 파라미터 |
| 3-18 | Social Post Detail Route & Pagination | `/social-posts/[id]`, 페이지네이션 |
| 3-19 | Dashboard Charts & Trend Visualization | 차트 컴포넌트, 대시보드 시각화 |
| 3-20 | A/B Testing Draft Structure | `social_ab_tests`/`social_ab_test_variants`, draft 구조(자동 실행 아님) |
| 3-21 | Platform API Publishing Preparation | capability matrix, readiness checker, adapter, dry-run payload(실제 게시 비활성화) |
| 3-22 | Automation Safety Review | feature flag/publish workflow/로깅/콘텐츠 안전 점검(read-only) |
| 3-23 | Phase 3 Final Documentation & Release | 이 문서를 포함한 전체 문서화 및 릴리즈 정리 |

## 현재 지원 플랫폼

- `wordpress_blog`
- `naver_blog`
- `naver_cafe`
- `x`
- `threads`
- `instagram`

## 현재 지원 문체(tone)

- `explanatory`(설명형)
- `informational`(정보 전달형)
- `persuasive`(설득형)
- `warning`(경고형)
- `loss_aversion`(손실 회피형)
- `curiosity`(호기심 유발형)
- `comparison`(비교형)
- `story`(스토리텔링형)

## 현재 가능한 것

- multi-platform draft generation
- platform-specific writing
- review/edit/approval
- manual export
- publishing guard
- dry-run
- handoff
- manual posting result recording
- manual metrics input
- rewrite suggestion
- rewrite versioning
- rewrite comparison
- reapproval/reexport
- performance dashboard
- chart visualization
- A/B test draft structure
- API publishing preparation
- automation safety review

## 아직 하지 않는 것

- actual X API publish
- actual Threads API publish
- actual Instagram API publish
- actual Naver Blog/Cafe API publish
- automatic metrics collection
- automatic A/B publishing
- fully automated public publishing

(WordPress만 Phase 2-2/2-8부터 이어져 온 실제 **draft 생성** API
연동이 있다 — 이것도 공개 게시가 아니라 draft 상태로만 생성된다.)

## 관련 문서

- 운영 매뉴얼: [`phase-3-operation-manual.md`](./phase-3-operation-manual.md)
- 아키텍처: [`phase-3-architecture.md`](./phase-3-architecture.md)
- 라우트 맵: [`phase-3-route-map.md`](./phase-3-route-map.md)
- DB migration 목록: [`phase-3-database-migrations.md`](./phase-3-database-migrations.md)
- 환경변수 목록: [`phase-3-environment-variables.md`](./phase-3-environment-variables.md)
- 안전 체크리스트: [`phase-3-safety-checklist.md`](./phase-3-safety-checklist.md)
- 릴리즈 노트: [`releases/phase-3-release-notes.md`](./releases/phase-3-release-notes.md)
- 릴리즈 체크리스트: [`phase-3-release-checklist.md`](./phase-3-release-checklist.md)
