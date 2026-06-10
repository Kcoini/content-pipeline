# Phase 1 구현 계획

> 목표: MVP 핵심 흐름(주제 입력 → 출처 등록 → 계약 검사 → 기사 초안 생성 →
> AI 평가 → 사용자 승인)을 실제로 동작하는 최소 기능으로 구현한다.
> 이미지/영상 생성, Hermes Agent, 복잡한 자동화는 이번 Phase에서 다루지 않는다.

## 0. 사전 준비
- [ ] Supabase 프로젝트 생성, `db/schema.sql` 적용
- [ ] `.env.local` 작성 (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
      AI API Key 등) — `.env*`는 `.gitignore`에 의해 커밋되지 않음
- [ ] 의존성 추가: `@supabase/supabase-js`, `js-yaml`(+ `@types/js-yaml`), `zod`,
      `zustand`, `react-hook-form`, `@hookform/resolvers`, shadcn/ui 초기화

## 1. 데이터 계층
- [ ] `lib/supabase/client.ts` (브라우저용 클라이언트)
- [ ] `lib/supabase/server.ts` (서버/Route Handler용 클라이언트, service role)
- [ ] `lib/types/domain.ts`: `Topic`, `Source`, `Article`, `ArticleStatus`,
      `TopicStatus` 등 도메인 타입 정의 (`any` 금지)

## 2. Harness 마무리
- [ ] `lib/harness/contract-runner.ts`에 YAML 로더(`js-yaml`) 연결
- [ ] `lib/harness/logger.ts`에 `pipeline_logs` 테이블 저장 로직 추가
- [ ] `lib/harness/pipeline.ts` 작성: `approval-gate`, `contract-runner`, `logger`를
      조합하는 오케스트레이터
      (단계: `source_validation` → `article_generation` →
      `article_contract_check` → `article_eval` → `human_review`)

## 3. 주제 & 출처 (FR-1~3, FR-6)
- [ ] `POST /api/topics` - 주제 생성
- [ ] `POST /api/topics/[topicId]/sources` - 출처 등록
      (Zod 검증 + `source.contract.yaml` 검사)
- [ ] `GET /api/topics/[topicId]` - 주제 + 출처 목록 조회
- [ ] UI: `app/(dashboard)/topics/new`, `app/(dashboard)/topics/[topicId]`
      - 주제 정보, 출처 목록/등록 폼
      - 출처 개수 표시, 3개 미만이면 "기사 생성" 버튼 비활성화

## 4. 기사 초안 생성 (FR-4~5, FR-7)
- [ ] `POST /api/topics/[topicId]/generate`
  1. `source.contract.yaml` 검사 (출처 3개 미만 등 실패 시 즉시 중단 + 로그)
  2. `lib/ai/generate-article.ts` - `prompts/generate-article.prompt.md` 기반 LLM 호출
  3. `article.contract.yaml` 검사 (실패 시 저장하지 않고 중단 + 로그)
  4. `articles(status='draft')` + `article_sources` 저장
- [ ] 모든 단계는 `pipeline_logs`에 기록

## 5. AI Evals (FR-8)
- [ ] `lib/ai/eval-article.ts` - `evals/article-quality.eval.yaml` 기준으로 LLM 평가 호출
- [ ] `eval_runs` 저장, `pipeline_logs(stage='article_eval')` 기록
- [ ] UI: 기사 상세 화면에 평가 결과(기준별 점수, `aggregate_score`, `passed`) 표시

## 6. 사용자 승인 (FR-9)
- [ ] `POST /api/articles/[articleId]/approve`
      - `approval-gate.assertApproved` 통과 후에만 `status='reviewed'`,
        `reviewed_at`/`reviewed_by` 기록
      - `pipeline_logs(stage='human_review')` 기록
- [ ] UI: 기사 상세 화면에 "승인" 버튼
      (`draft` 상태이고 평가 결과를 확인한 경우에만 활성화)

## 7. CI/CD
- [ ] `.github/workflows/ci.yml` - `npm ci`, lint, typecheck(`tsc --noEmit`), test

## 8. 테스트 우선순위
- [ ] `lib/harness/contract-runner.test.ts` - 각 rule 타입별 통과/실패 케이스
- [ ] `lib/harness/approval-gate.test.ts` - 승인 없이 reviewed 전환 시 에러 발생 검증
- [ ] `source.contract.yaml` / `article.contract.yaml` 기반 통합 테스트

## Phase 1 완료 정의 (Definition of Done)
`docs/acceptance-criteria.md`의 AC-1 ~ AC-9 항목을 모두 만족하고,
"주제 생성 → 출처 3개 등록 → 기사 생성 → AI 평가 → 승인"이
end-to-end로 동작한다.
