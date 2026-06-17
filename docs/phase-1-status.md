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

- **AI mode 검증 (Phase 1-7)**: `lib/ai/ai-errors.ts`의 `toAiErrorMessage()`로
  529 과부하·429 레이트 리밋·401 인증 오류 등을 사용자 친화적 메시지로 변환한다.
  `app/dashboard/actions.ts`와 `lib/ai/eval-article.ts`의 catch 블록에 적용해
  AI 오류가 Runtime Error 화면 없이 처리된다. 자세한 내용은
  `docs/phase-1-7-ai-mode-verification.md` 참고.

- **기사 품질 개선 (Phase 1-8)**: 프롬프트를 강화해 7개 섹션 구조(리드문·배경·쟁점·
  비교·독자 의미·전망) 및 표절 방지 규칙(15단어 복사 금지)을 적용했다.
  AI Evals에 `originality`(0.20), `synthesis`(0.20), `source-integration`(0.10),
  `copy-risk`(gate only) 4개 기준을 추가했다. `copy-risk >= 4` 또는
  `synthesis < 2`이면 `passed=false` 강제. 품질 미통과 시 `article_quality_warning`
  로그를 남기고 `/articles/[id]`에 "품질 검토 필요" 배너를 표시한다.
  자세한 내용은 `docs/phase-1-8-article-quality.md` 참고.

- **중복 URL 출처 등록 오류 처리 (Phase 1-8 후속)**: `sources.url` 단독 unique
  제약을 제거하고 `theme_id + url` 복합 unique로 전환했다 (migration 005).
  `DuplicateSourceError`를 도입해 23505 PostgreSQL 오류를 Runtime Error 없이
  처리하며, 대시보드 출처 등록 폼에 "이미 이 테마에 등록된 출처입니다" 메시지를
  표시한다.

## 남은 항목 (Phase 1-8 이후)

- **AI mode 실제 호출 검증**: 로컬 및 Vercel에서 `AI_GENERATION_ENABLED=true` +
  `ANTHROPIC_API_KEY` 설정 후 생성 → 검토 → 승인 end-to-end 시나리오 실행
- **published 전환/게시 흐름**: WordPress 게시 등은 Phase 2 이후 범위
- **중복 URL 출처 등록 시 Runtime Error**: `docs/known-issues.md` 참고,
  사용자 친화적 메시지로 개선 필요

## 참고

- 이미지 생성, 영상 생성, Hermes Agent는 이번 MVP 범위에 포함하지 않는다.
