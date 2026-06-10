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

## 남은 항목 (Phase 1-3 이후)

- **실제 AI source summary**: `lib/ai/source-summarizer.ts`의
  `summarizeSourcesWithAi`를 실제 LLM 호출로 구현
- **실제 AI article generation**: `lib/ai/article-writer.ts`의
  `generateAiArticleDraft`를 `prompts/article-draft.v1.md` 기준으로 실제 LLM 호출로 구현
- **article quality eval 강화**: `lib/ai/eval-article.ts`의
  `evaluateArticleWithAi`를 `prompts/article-eval.v1.md` 기준으로 실제 LLM 호출로
  구현하고, 결과를 `eval_runs`에 저장
- **approval flow 개선**: `lib/harness/approval-gate.ts`와 `approval_logs` 연결,
  대시보드 UI에서 평가 결과를 확인한 뒤 승인하는 흐름 구현
- **Vercel 배포**: 환경변수(`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, AI API Key) 설정 후
  배포

## 참고

- 실제 AI API 키 추가 및 호출은 이번 단계(Phase 1-3)에서 진행하지 않는다.
  프롬프트 구조(`prompts/*.v1.md`)와 mock/AI 인터페이스 분리만 준비한다.
- 이미지 생성, 영상 생성, Hermes Agent는 이번 MVP 범위에 포함하지 않는다.
