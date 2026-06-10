@AGENTS.md

# content-pipeline 프로젝트 가이드

## 프로젝트 개요
Next.js + TypeScript + Supabase + GitHub 기반의 블로그/홈페이지용 기사 자동 생성 MVP다.
"주제 입력 → 출처 등록/저장 → 계약 검사 → 기사 초안 생성(draft) → AI Evals →
사용자 승인(reviewed)" 순서로 동작하는 콘텐츠 파이프라인이다.

자세한 요구사항/성공 기준은 `docs/requirements.md`, `docs/acceptance-criteria.md`를,
구현 계획은 `docs/phase-1-plan.md`를 참고한다.

## 핵심 원칙 (반드시 준수)

1. **REG Engineering**: 요구사항/성공 기준은 `docs/requirements.md`,
   `docs/acceptance-criteria.md`에 정의한다. 새 기능을 추가하거나 변경할 때는
   코드보다 먼저 이 두 문서를 갱신한다.
2. **Reins Engineering**: 단계별 계약은 `contracts/*.yaml`에 정의한다.
   `lib/harness/contract-runner.ts`로 검사하며, 계약을 통과하지 못하면
   파이프라인을 즉시 중단해야 한다 (우회/스킵 금지).
3. **Harness Engineering Lite**: `lib/harness/contract-runner.ts`(계약 검사),
   `lib/harness/approval-gate.ts`(승인 게이트), `lib/harness/logger.ts`(실행 로그)를
   조합해 파이프라인을 실행한다.
4. **AI Evals**: 기사 품질은 `evals/*.yaml`에 정의된 기준과 `lib/ai/eval-article.ts`로
   평가한다. 평가 결과는 항상 사용자에게 표시하고 `eval_runs`에 저장한다.
5. **Human Approval**: 기사 `status`를 `reviewed` 또는 `published`로 전환하는 작업은
   사용자의 명시적 승인 없이는 절대 자동 실행하지 않는다
   (`lib/harness/approval-gate.ts`의 `assertApproved`를 거쳐야 한다).
6. **로깅**: 파이프라인 각 단계(`source_validation`, `article_generation`,
   `article_contract_check`, `article_eval`, `human_review`)의 시작/성공/실패는
   `pipeline_logs`에 기록한다.

## 상태 모델
- `topic.status`: `draft → sources_ready → generating → drafted → reviewed`
  (계약/평가 실패 시 `failed`)
- `article.status`: `draft → reviewed → published`
  (`published`은 MVP 이후, DB/타입 구조만 정의)

## 디렉터리 규칙
- `app/`: Next.js App Router (UI + API Route Handlers)
- `lib/harness/`: 계약 검사(contract-runner), 승인 게이트(approval-gate), 로깅(logger)
- `lib/ai/`: 기사 생성/평가 (Phase 1 이후)
- `lib/supabase/`: Supabase 클라이언트 (Phase 1 이후)
- `lib/types/`: 도메인 타입 정의
- `contracts/`: 단계별 계약 정의 (YAML)
- `evals/`: AI 평가 기준 정의 (YAML)
- `prompts/`: LLM 프롬프트 템플릿 (Markdown)
- `db/`: DB 스키마 (`schema.sql`)
- `docs/`: 요구사항, 성공 기준, 구현 계획

## 작업 시 주의사항
- 출처가 3개 미만이면 기사 생성을 시작하지 않는다
  (`contracts/source.contract.yaml`의 `min-source-count` 규칙).
- 새로 생성된 기사는 항상 `status = 'draft'`로 저장한다
  (`contracts/article.contract.yaml`의 `initial-status-draft` 규칙).
- 이미지/영상 생성, Hermes Agent, 복잡한 자동화는 이번 MVP 범위에 포함하지 않는다.
- API 응답은 `{ success: true, data }` 또는 `{ success: false, error }` 형식을 따른다.
- `any` 타입을 사용하지 않는다.
- Next.js 16 기준 변경 사항은 `node_modules/next/dist/docs/`를 참고한다
  (`AGENTS.md` 참조).
