# Phase 1 진행 현황

> 이 문서는 Phase 1(Supabase 연동 MVP) 완료 항목과 Phase 1-3(실제 AI 연동 준비)
> 이후 남은 작업을 추적한다. `docs/phase-1-plan.md`의 체크리스트를 보완하는
> 현재 상태 스냅샷이다.

## 완료된 항목

- **Next.js 개발 환경**: Next.js 16 (Turbopack) + TypeScript strict 모드 + Tailwind CSS
- **GitHub 연동**: 저장소 초기화 및 커밋/푸시 흐름 구성
- **dashboard mock flow**: `/dashboard`에서 테마 생성 → 출처 등록 → 기사 초안 생성(mock)까지
  end-to-end 동작
- **Supabase persistence**: `themes`, `sources`, `articles`, `article_sources`,
  `pipeline_logs`, `contract_runs` 테이블에 실제 저장/조회 연동 완료
  (`lib/repositories/*`)
- **migration SQL 정리**: `db/schema.sql`(신규 설치용 전체 스키마)과
  `db/migrations/001_align_dashboard_schema.sql`(기존 DB를 코드 사용 구조에
  맞추는 비파괴적 migration) 정리 완료
- **contract check**: `contracts/source.contract.yaml`,
  `contracts/article.contract.yaml`을 `lib/harness/contract-runner.ts`로 검사하고
  결과를 `contract_runs`에 기록
- **pipeline logs**: 테마 생성, 출처 등록, 계약 검사, 기사 초안 생성 등 주요
  이벤트를 `pipeline_logs`에 기록 (`lib/repositories/log-repository.ts`)
- **eval runs**: `eval_runs` 테이블 스키마/타입 정의 완료 (저장 로직은 Phase 1-3에서 연결)

- **AI 기사 생성 연동 (Phase 1-4)**: `AI_GENERATION_ENABLED`/`AI_PROVIDER`/
  `ANTHROPIC_API_KEY` feature flag로 mock/AI generator를 전환.
  `summarizeSourcesWithAi`, `generateAiArticleDraft`, `evaluateArticleWithAi`를
  Anthropic API 기반으로 구현하고, `app/dashboard/actions.ts`의
  `generateArticleDraft`에 source summary → article draft → article eval →
  `eval_runs` 저장 흐름을 연결. 자세한 내용은
  `docs/phase-1-4-ai-generation.md` 참고.

- **기사 검토·수정·승인 흐름 (Phase 1-5)**: `/articles`(목록), `/articles/[id]`
  (상세) 페이지를 추가하고, draft 기사 수정(`updateDraftArticle`) 및 승인
  (`approveArticle`)을 서버 액션으로만 처리한다. 승인 시
  `articles.status='reviewed'`, `reviewed_at`/`reviewed_by`를 갱신하고
  `approval_logs`에 기록한다. reviewed 기사는 수정 불가. 자세한 내용은
  `docs/phase-1-5-review-approval.md` 참고.

- **Vercel 배포 준비 (Phase 1-6)**: `next.config.ts`에
  `outputFileTracingIncludes`를 추가해 `evals/`, `contracts/`, `prompts/`
  디렉터리가 서버리스 번들에 포함되도록 했다. 환경변수 목록, migration 적용
  순서, 배포 후 확인 시나리오는 `docs/phase-1-6-vercel-deploy.md` 참고.

## 남은 항목 (Phase 1-6 이후)

- **Vercel 실제 배포**: 환경변수 등록 후 배포 → 배포 후 시나리오 검증
- **AI mode 실제 호출 검증**: `AI_GENERATION_ENABLED=true` +
  `ANTHROPIC_API_KEY` 설정 후 생성 → 검토 → 승인 end-to-end 확인
- **published 전환/게시 흐름**: WordPress 게시 등은 Phase 2 이후 범위
- **중복 URL 출처 등록 시 Runtime Error**: `docs/known-issues.md` 참고,
  사용자 친화적 메시지로 개선 필요

## 참고

- 이미지 생성, 영상 생성, Hermes Agent는 이번 MVP 범위에 포함하지 않는다.
