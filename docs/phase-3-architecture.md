# Phase 3 Architecture

## 전체 architecture

```
app routes (Server Components + Server Actions)
        │  읽기/쓰기 요청
        ▼
lib/social/*-service.ts  (비즈니스 로직, 로깅, 상태 전이 규칙)
        │
        ▼
lib/repositories/*.ts    (Supabase 접근, DB row ↔ 도메인 타입 매핑)
        │
        ▼
Supabase (PostgreSQL) — db/migrations/*.sql로 스키마 관리
```

- `app/`: Next.js App Router. 각 route의 `page.tsx`는 서버
  컴포넌트로 repository/service를 호출해 데이터를 조회하고,
  `actions.ts`의 서버 액션(`"use server"`)이 폼 제출을 처리한다.
- `components/`: UI 조각(뱃지, 카드, 차트, 네비게이션 등). 대부분
  순수 렌더링만 담당하고 데이터 fetch는 하지 않는다.
- `lib/social/`: Phase 3의 핵심 비즈니스 로직 — 글쓰기, 품질 검사,
  가드, dry-run/handoff, rewrite, A/B 테스트, 플랫폼 API 준비,
  automation safety review.
- `lib/repositories/`: Supabase 테이블별 CRUD/조회 함수와 DB row →
  도메인 타입 매핑(`mapXxxRow`).
- `prompts/`: LLM 프롬프트 템플릿(Markdown).
- `contracts/`: 단계별 계약(YAML) — `lib/harness/contract-runner.ts`가
  검사한다.
- `db/migrations/`: 스키마 변경 이력(SQL, 순번 파일명).
- `docs/`: 요구사항, phase별 구현 문서, 이 최종 문서 세트.

## article 중심 구조

`themes` → `sources` → `articles` (Phase 1~2)가 기본 뼈대다.
Phase 3는 이 `article` 하나에 여러 플랫폼용 `social_posts`를
연결하는 구조를 얹는다. article 자체의 상태 모델(`draft → reviewed
→ published`)은 Phase 3에서 바꾸지 않는다.

## social_posts 중심 구조

`social_posts`는 Phase 3 대부분 기능의 중심 테이블이다. 하나의
article에 플랫폼(`platform`) × 문체(`tone`) 조합만큼 row가 생길 수
있다. Phase 3-4~3-21에 걸쳐 이 테이블에 상태 컬럼이 계속
추가됐다(quality/approval/export/guard/dry-run/handoff/manual
post/metrics 요약/rewrite 버전/AB test/API publish 준비 상태 등).
자세한 컬럼 목록은 [`phase-3-database-migrations.md`](./phase-3-database-migrations.md)
참고.

## platform adapters

`lib/social/platform-adapters/*.ts` (Phase 3-21) — 플랫폼별 실제
게시 로직이 들어갈 자리를 미리 인터페이스로 정의해둔 skeleton이다.
현재는 어떤 adapter도 실제 외부 API를 호출하지 않으며, 항상
disabled/not implemented 결과만 반환한다.

## approval gate

`social_post_approvals` + `social_posts.approval_status`
(Phase 3-1/3-4). `approved`가 아니면 export/guard 이후 단계로
진행할 수 없다는 규칙을 여러 서비스가 공유한다. rewrite version은
별도의 `rewrite_reapproval_status` 트랙을 가진다(Phase 3-13).

## publishing guard

`lib/social/platform-publishing-guard-service.ts` +
`platform-publishing-rules.ts` (Phase 3-6). 공통 규칙(품질/승인/
export/금지 표현)과 플랫폼별 규칙(글자수, 해시태그, 미디어 요구
등)을 체크리스트로 계산해 `platform_publish_ready`를 결정한다.

## manual export

`lib/social/social-export-*.ts` (Phase 3-5). 실제 게시 API 대신,
사람이 복사해서 각 플랫폼에 붙여넣을 수 있는 payload를 만든다.
Phase 3-21 이후에도 이 경로는 그대로 유지된다.

## handoff

`platform_publish_dry_run_status` + `handoff_status`
(Phase 3-7). dry-run이 준비된 뒤에만 handoff를 완료할 수 있다는
정합성을 `automation-safety-review`가 감사한다.

## metrics

`social_post_metrics` + `social_posts.latest_*` 요약 컬럼
(Phase 3-9). 모든 수치는 사람이 입력한다. 자동 수집 로직은 없다.

## rewrite versioning

`social_post_versions` + `social_posts.parent_social_post_id` /
`root_social_post_id` / `is_rewrite_version` (Phase 3-11). rewrite를
적용하면 원본 row를 덮어쓰지 않고 **새 row**를 만든다 — 이 원칙은
data_integrity 관점에서 automation safety review가 계속 확인한다.

## A/B test draft

`social_ab_tests` + `social_ab_test_variants` (Phase 3-20). 초안
구조만 있으며, 실제 게시나 승자 자동 판정을 자동 실행하지 않는다.
비교 로직(`social-ab-test-comparison-service.ts`)은 사람이 입력한
metrics를 기반으로 계산만 한다.

## dashboard

`/dashboard/content`, `/dashboard/blog`, `/dashboard/rewrite`,
`/dashboard/social-performance`, `/dashboard/platform-api`가 각각
다른 관점(콘텐츠 전체/블로그/rewrite/성과/API 준비)에서 같은
`social_posts` 데이터를 모아 보여준다.

## safety review

`lib/social/automation-safety-review-service.ts` (Phase 3-22)가
위 모든 구조를 대상으로 read-only 감사를 실행한다. DB에 결과를
저장하지 않고, 매 실행마다 최신 상태를 계산해 반환한다.

## 주요 설계 원칙

- **자동 생성은 가능, 자동 게시는 제한**: 글 초안 생성, rewrite
  제안, 품질 검사, 가드 계산은 자동으로 실행할 수 있지만, 어떤
  플랫폼에도 실제로 게시하는 코드 경로는 없다(WordPress draft
  생성만 예외 — 이것도 공개 게시가 아니다).
- **human approval 필수**: `approval_status`/`rewrite_reapproval_status`가
  승인 상태가 아니면 다음 단계(export/guard/게시)로 진행할 수 없다.
- **manual export 우선**: API 게시 준비(Phase 3-21)가 생긴 이후에도
  manual export/handoff/manual posting은 계속 유지되는 기본
  경로다.
- **API publish는 preparation 단계**: capability/readiness/
  eligibility만 계산하고, 실제 호출은 feature flag와 무관하게
  구현되어 있지 않다.
- **민감정보 로그 금지**: API key, access token, refresh token,
  Authorization header, Application Password, 전체 콘텐츠 원문을
  `pipeline_logs`에 남기지 않는다.
- **원본 social_post overwrite 금지**: rewrite는 항상 새 row로
  생성된다.
- **rewrite는 version row로 생성**: `social_post_versions` +
  `parent_social_post_id` 체인으로 이력을 추적한다.
- **metrics는 manual input 기반**: 자동 수집 API 연동이 없다.

## 관련 문서

- 전체 개요: [`phase-3-final-overview.md`](./phase-3-final-overview.md)
- 라우트 맵: [`phase-3-route-map.md`](./phase-3-route-map.md)
- DB migration 목록: [`phase-3-database-migrations.md`](./phase-3-database-migrations.md)
- 안전 체크리스트: [`phase-3-safety-checklist.md`](./phase-3-safety-checklist.md)
