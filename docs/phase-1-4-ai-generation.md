# Phase 1-4: AI 기사 생성 연동

> Phase 1-3에서 준비한 mock/AI 인터페이스 분리를 바탕으로, mock article
> generator를 실제 Anthropic Claude API 기반 generator로 연결한다.
> mock mode와 AI mode는 환경 변수 기반 feature flag로 전환한다.

## AI generation flow

`app/dashboard/actions.ts`의 `generateArticleDraft`는 다음 순서로 동작한다.

1. 테마 + 출처 조회
2. `source.contract.yaml` 검사 (출처 3개 미만이면 여기서 중단, AI 호출 없음)
3. AI mode 여부 확인 (`shouldUseAnthropic()`) → `pipeline_logs(event_name='ai_mode_selected')`
4. **AI mode**
   - 출처 요약: `summarizeSourcesWithAi(theme, sources)` (AI 호출 1회)
     → `source_summary_started` / `source_summary_completed`
   - 기사 초안 생성: `generateAiArticleDraft(theme, sourceSummaries)` (AI 호출 1회)
     → `article_generation_started` / `article_generation_completed`
   - 위 두 단계 중 하나라도 실패하면 `ai_generation_failed`를 기록하고
     **mock 생성으로 전환**한다 (파이프라인은 중단되지 않는다)
5. **mock mode**: `summarizeSourcesMock` + `generateMockArticleDraft` 사용
   (AI 호출 없음)
6. `article.contract.yaml` 검사 (실패 시 저장하지 않고 중단)
7. `articles(status='draft')` + `article_sources` 저장 → `article_draft_created`
8. AI Evals: AI mode이면 `evaluateArticleWithAi` (AI 호출 1회), mock mode이면
   `evaluateArticleMock` 사용 → `eval_runs` 저장
   → `article_eval_started` / `article_eval_completed`

## mock mode / AI mode 전환 방식

`lib/ai/ai-config.ts`:

- `isAiGenerationEnabled()`: `AI_GENERATION_ENABLED === "true"`
- `getAiProvider()`: `AI_PROVIDER` (기본값 `"anthropic"`)
- `shouldUseAnthropic()`: 위 두 조건과 `ANTHROPIC_API_KEY` 존재 여부를 모두
  만족해야 `true`. 하나라도 만족하지 않으면 mock generator를 사용한다.

## 필요한 환경 변수

`.env.example` 참고:

```
ANTHROPIC_API_KEY=
AI_PROVIDER=anthropic
AI_GENERATION_ENABLED=false
```

- `ANTHROPIC_API_KEY`: `lib/ai/anthropic-client.ts`에서만 읽으며, 서버 코드
  (Server Action)에서만 사용한다. client component에 노출되지 않는다.
- `.env.local`은 `.gitignore`에 의해 커밋되지 않는다.

## 실패 시 처리 방식

- `summarizeSourcesWithAi` / `generateAiArticleDraft`: API 호출 실패 또는
  JSON parse 실패 시 예외를 던진다. `generateArticleDraft`가 이를 잡아
  `ai_generation_failed`를 기록하고 mock 생성으로 대체한다 (앱이
  Runtime Error로 깨지지 않음).
- `evaluateArticleWithAi`: API 호출 실패 또는 JSON parse 실패 시 예외를
  던지지 않고 `{ criteriaScores: {}, aggregateScore: 0, passed: false,
  notes: "..." }`를 반환한다. 이 결과도 `eval_runs`에 그대로 저장되고
  사용자에게 표시된다.

## 비용 관리 원칙

- 기사 생성 버튼 1회 클릭당 AI 호출은 최대 3회로 제한한다
  (출처 요약 1회 + 기사 초안 1회 + 품질 평가 1회).
- 출처가 3개 미만이면 `source.contract.yaml` 검사 단계에서 중단되어
  AI 호출이 발생하지 않는다.
- AI 호출 실패 시 자동 재시도 루프를 만들지 않는다 (mock으로 1회 대체 후 계속).

## known issue

- 동일 URL 출처 중복 등록 시 Runtime Error가 발생하는 문제는 이번
  Phase에서 다루지 않는다 (`docs/known-issues.md` 참고, 추후 UX 개선
  단계에서 사용자 친화적 메시지로 처리할 예정).

## articles 본문 컬럼

- `articles` 테이블의 기사 본문은 `content` 컬럼 기준이다.
  `lib/repositories/article-repository.ts`의 `saveDraftArticle()`은
  `content`에만 본문을 저장한다.
- 일부 기존 DB에 과거 schema의 `draft_body not null` 컬럼이 남아 있어
  insert 시 `null value in column "draft_body"` 오류가 발생할 수 있다.
  `db/migrations/002_articles_content_column.sql`을 적용하면 `content`
  컬럼을 보장하고 `draft_body`의 not null 제약을 제거한다(컬럼 자체는
  호환성을 위해 남겨두되 더 이상 사용하지 않음).

## eval_runs 평가 점수 컬럼

- `eval_runs`의 평가 점수는 `aggregate_score`(가중 평균 점수) 기준이다.
  `lib/repositories/eval-repository.ts`의 `saveEvalRun()`은
  `criteria_scores`(jsonb), `aggregate_score`(numeric), `passed`(boolean),
  `notes`(text)를 저장한다.
- 일부 기존 DB에 과거 schema의 `score not null` 컬럼이 남아 있어 insert 시
  `null value in column "score"` 오류가 발생할 수 있다.
  `db/migrations/003_eval_runs_score_column.sql`을 적용하면 `aggregate_score`,
  `score` 컬럼 모두 default 0을 갖도록 보장하고 `score`의 not null 제약을
  제거한다. 코드는 `aggregate_score`와 `score`에 항상 같은 값을 저장해
  호환성을 유지한다(`score`는 호환용, `aggregate_score`가 canonical).
