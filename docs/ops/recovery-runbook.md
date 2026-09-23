# 복구 Runbook

- 작성일: 2026-09-23 (OPS-02B)
- 이 문서는 **실제 production DB를 대상으로 파괴적 테스트를 하지
  않는다** — 절차 문서화만 한다. Supabase provider 플랜별 실제 백업
  기능(PITR 등)은 이 프로젝트가 추측하지 않는다 — 운영자가 실제
  Supabase 프로젝트 설정에서 직접 확인해야 한다.

## 1. 이 프로젝트가 자체적으로 책임져야 하는 것

- **Migration 파일 관리**: `db/migrations/`에 46개 migration 파일이
  순서대로 존재한다(`db/schema.sql`이 최종 스키마 기준 문서). 새
  migration을 추가할 때는 항상 다음 번호를 이어서 쓰고, 기존 파일을
  수정하지 않는다.
- **Schema version 추적**: 이 프로젝트에는 별도 schema_version
  테이블이 없다 — `db/migrations/` 디렉터리의 파일 목록 자체가 적용된
  migration의 근거다. 운영 DB에 실제로 어느 migration까지 적용됐는지는
  Supabase 대시보드의 migration 이력 또는 수동 확인이 필요하다.
- **Seed/test data**: 이 프로젝트는 별도 seed 스크립트를 갖고 있지
  않다(OPS-01/OPS-02A 파일럿이 실제 데이터를 실제 DB에 직접
  생성했다 — `scripts/ops-01/`, `scripts/ops-02a/` 참고). 테스트는
  전부 repository 경계 mock을 쓰고 실제 DB에 의존하지 않는다.
- **데이터 export 방법**: Supabase 대시보드의 테이블 export(CSV/SQL)
  기능을 사용하거나, `psql`/Supabase CLI로 직접 dump한다(이 프로젝트
  코드에는 export 스크립트가 없다 — 필요하면 OPS-03 이후 추가 검토).

## 2. Provider(Supabase) 책임 범위는 추측하지 않는다

Supabase의 실제 백업/PITR(Point-in-Time Recovery) 가용 여부는
프로젝트 plan(Free/Pro/Team 등)에 따라 다르다 — 이 문서는 그 기능이
"있다/없다"를 단정하지 않는다. **배포 전 체크리스트(`deployment-checklist.md`)의
"백업 확인" 항목에서, 운영자가 실제 Supabase 프로젝트 설정 화면에서
백업 주기/보존 기간을 직접 확인하도록 요구한다.**

## 3. Application-level 분류: 재생성 가능 vs 보존 중요

실제 `db/schema.sql`을 기준으로 분류했다(추측 없음):

### 재생성 가능(다시 계산/생성할 수 있음)

- `eval_runs`(AI 평가 결과 — article 본문만 있으면 재평가 가능)
- `contract_runs`(계약 검사 결과 — 재실행 가능)
- 각종 `*_status`/`*_summary` 파생 컬럼 중 순수 계산 결과(quality
  checklist 등 — 원본 본문이 있으면 재계산 가능)
- `pipeline_logs`(실행 이력 — 유실돼도 기능은 유지되지만, 운영 추적성이
  떨어지므로 "재생성 가능"이되 "가능하면 보존" 등급)

### 보존이 중요함(유실 시 복구 불가능하거나 큰 손실)

- `themes`, `sources`(원본 출처 URL/수집 콘텐츠 — 외부 URL이 나중에
  사라지면 다시 수집 불가능할 수 있음)
- `articles`(마스터 원고, `format_metadata`의 verifiedFacts/evidenceMap
  포함 — AI 재생성 시 완전히 같은 결과가 나오지 않음)
- `social_posts`(플랫폼별 게시글, 승인 상태, export/manual posting
  기록)
- `approval_logs`(누가 언제 승인했는지 — 감사 추적성, 재생성 불가능)
- `publish_logs`, `eval_runs`의 원본 판정 근거
- `social_posts`의 external URL(`post_url`)/manual posting 기록 —
  **실제로 외부에 게시됐다는 유일한 증거**일 수 있다(재생성 불가능).
- `job_runs`/`job_run_steps`(진행 중이던 작업의 상태 — 복구 시 stalled
  판정에 필요).

## 4. Restore drill (문서화만, 실제 파괴적 테스트 없음)

1. **배포 중지**: 신규 배포/자동화를 멈춰 추가 쓰기를 막는다.
2. **장애 범위 판단**: 전체 DB 손상인지, 특정 테이블/기간만인지 확인.
3. **DB snapshot/export 확인**: Supabase 대시보드에서 사용 가능한
   가장 최근 백업/PITR 시점을 확인한다.
4. **migration 상태 확인**: 복원 대상 snapshot이 어느 migration까지
   반영된 상태인지 확인하고, `db/migrations/`의 그 이후 파일들을 복원
   후 순서대로 재적용해야 하는지 판단한다.
5. **restore**: Supabase provider 기능으로 복원을 실행한다(이 문서는
   구체적인 provider UI 조작을 단정하지 않는다 — 실제 화면을 보고
   진행한다).
6. **preflight**: 복원 직후 `npm run ops:preflight`를 실행해 환경
   설정이 여전히 유효한지 확인한다.
7. **smoke tests**: `npm run test`(unit/integration, DB 접근 없음)와
   `deployment-checklist.md`의 "After deploy" 스모크 항목(Dashboard/
   Review 화면 조회)을 실행한다 — **WordPress Draft 생성 같은 실제
   외부 side effect가 있는 스모크는 포함하지 않는다.**
8. **side effect 기능 재활성화**: 복원 검증이 끝난 뒤에만
   `WORDPRESS_PUBLISH_ENABLED`/`AI_GENERATION_ENABLED` 등을 다시
   켠다 — 복원 직후 바로 실제 외부 API를 호출하는 기능을 켜지 않는다
   (검증 전 side effect 방지).

## 5. 이번 Phase에서 하지 않은 것

- 실제 Supabase 백업/복원을 실행하는 파괴적 테스트(명시적으로 금지됨).
- 자동화된 backup 스크립트 신규 구축(대규모 인프라 변경, OPS-02B
  범위 밖 — 필요하면 별도 Phase에서 검토).
