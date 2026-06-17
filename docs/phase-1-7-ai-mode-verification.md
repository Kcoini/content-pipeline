# Phase 1-7: 실제 Anthropic AI mode 검증

> Phase 1-6에서 Vercel 배포(mock mode)가 완료되었다. 이 단계에서는
> `AI_GENERATION_ENABLED=true`로 전환해 실제 Anthropic API 기반 기사 생성,
> 평가, 저장, 검토, 승인 흐름이 정상 작동하는지 검증한다.

---

## 1. AI mode 검증 목적

- mock generator 대신 실제 Claude API가 호출되는지 확인한다.
- 529 과부하·429 레이트 리밋·401 인증 오류 등이 Runtime Error 화면 없이
  처리되는지 확인한다.
- AI로 생성된 기사가 `/articles`에서 검토·수정·승인까지 정상 연결되는지
  확인한다.

---

## 2. 필요한 환경변수

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `AI_GENERATION_ENABLED` | `true` | AI mode 활성화 |
| `AI_PROVIDER` | `anthropic` | Anthropic 사용 |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | 서버 전용, NEXT_PUBLIC_* 금지 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | 기존과 동일 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | 기존과 동일 |
| `SUPABASE_SECRET_KEY` | Supabase service_role key | 기존과 동일 |

> `ANTHROPIC_API_KEY`는 반드시 서버 전용이다.  
> 절대 `NEXT_PUBLIC_ANTHROPIC_API_KEY`로 설정하지 않는다.  
> `.env.local`은 `.gitignore`에 의해 커밋되지 않는다.

---

## 3. 로컬 테스트 순서

`.env.local`에 다음을 추가한 뒤 `npm run dev`로 실행한다:

```
AI_GENERATION_ENABLED=true
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

### 검증 시나리오

1. `/dashboard`에서 새 테마를 생성한다.
2. 출처를 3개 이상 등록한다 (URL, 제목, 출판사, 요약 포함).
3. "기사 초안 생성" 버튼을 클릭한다.
4. 파이프라인 로그에서 다음 이벤트가 순서대로 나타나는지 확인한다.
   - `ai_mode_selected` (status: info)
   - `source_summary_started` → `source_summary_completed`
   - `article_generation_started` → `article_generation_completed`
   - `contract_checked` (article, 통과)
   - `article_draft_created`
   - `article_eval_started` → `article_eval_completed`
5. `/articles`에서 새 기사가 목록에 표시되는지 확인한다.
6. `/articles/[id]`에서 본문, 출처, 평가 점수가 표시되는지 확인한다.
7. 제목/본문을 수정하고 저장한다.
8. "승인하기" 버튼을 클릭해 status가 `reviewed`로 변경되는지 확인한다.

---

## 4. Vercel 테스트 순서

Vercel 대시보드 → Settings → Environment Variables에서 다음을 추가/수정한다:

```
AI_GENERATION_ENABLED = true
ANTHROPIC_API_KEY = sk-ant-...
```

변경 후 **Redeploy**를 실행한다. 이후 로컬 테스트 시나리오(3항)와 동일하게
검증한다.

---

## 5. AI 호출 흐름 (1회 기사 생성 = 최대 3 API calls)

```
기사 초안 생성 클릭
  ↓
source.contract.yaml 검사 (AI 호출 없음, 실패 시 중단)
  ↓
[AI call 1] summarizeSourcesWithAi()  → source_summary_started/completed
  ↓
[AI call 2] generateAiArticleDraft()  → article_generation_started/completed
  ↓
article.contract.yaml 검사 (AI 호출 없음, 실패 시 저장하지 않고 중단)
  ↓
articles 저장 (status='draft')
  ↓
[AI call 3] evaluateArticleWithAi()   → article_eval_started/completed
  ↓
eval_runs 저장
```

출처가 3개 미만이면 `source.contract.yaml` 단계에서 중단되므로 AI가 호출되지
않는다.

---

## 6. 오류 처리 방식

모든 AI 호출 오류는 `lib/ai/ai-errors.ts`의 `toAiErrorMessage()`로 변환된다.

| HTTP 상태 | 원인 | 처리 방식 |
|-----------|------|-----------|
| 529 | Anthropic 서버 과부하 | `ai_generation_failed` 로그 후 mock 생성으로 대체 |
| 429 | API 요청 한도 초과 | 동일 |
| 401 | 잘못된 API key | 동일 (ANTHROPIC_API_KEY 확인 안내) |
| 403 | API key 권한 부족 | 동일 |
| 5xx | Anthropic 서버 오류 | 동일 |
| 네트워크/타임아웃 | 연결 오류 | 동일 |
| JSON parse 실패 | AI 응답 형식 불일치 | 동일 |

**source_summary / article_generation 실패 시**: `ai_generation_failed`를
기록하고 mock 생성으로 대체한다. 앱이 Runtime Error 화면으로 터지지 않는다.

**evaluateArticleWithAi 실패 시**: `aggregate_score=0, passed=false`를 반환하고
`eval_runs`에 저장한다. 평가 실패도 Runtime Error 없이 처리된다.

실패 로그는 `/dashboard`의 파이프라인 로그 목록과 `/articles/[id]`의
관련 로그 섹션에서 확인할 수 있다.

---

## 7. 비용 방지 정책

- 출처가 3개 미만이면 `source.contract.yaml` 단계에서 중단 → AI 호출 0회
- 기사 생성 1회당 AI 호출 최대 3회 (출처 요약 1 + 기사 생성 1 + 평가 1)
- AI 호출 실패 시 자동 재시도하지 않는다 (mock으로 1회 대체 후 계속)
- `AI_GENERATION_ENABLED=false`이면 `shouldUseAnthropic()=false`이므로
  `getAnthropicClient()`가 전혀 호출되지 않는다

---

## 8. 저장 확인 항목

AI mode 기사 생성 후 Supabase에 다음이 저장되어야 한다:

| 테이블 | 컬럼 | 기대값 |
|--------|------|--------|
| `articles` | `status` | `draft` |
| `articles` | `content` | AI가 생성한 본문 (500자 이상) |
| `article_sources` | `article_id / source_id` | 인용 출처 연결 |
| `eval_runs` | `aggregate_score` | AI 평가 점수 (1~5 사이) |
| `eval_runs` | `passed` | `true` 또는 `false` |
| `eval_runs` | `criteria_scores` | 기준별 점수 JSON |
| `pipeline_logs` | `event_name` | `ai_mode_selected`, `source_summary_*`, `article_generation_*`, `article_eval_*` |
| `approval_logs` | `action` | `approve_article` (승인 후) |
| `approval_logs` | `target_type` | `article` |

---

## 9. 검토/승인 흐름 연결

AI로 생성된 기사도 mock 기사와 동일한 흐름을 거친다:

- `/articles`에서 목록 확인
- `/articles/[id]`에서 본문 수정(draft 상태만)
- "승인하기" 클릭 → `status='reviewed'`, `approval_logs` 저장
- 승인 후 수정 불가

---

## 10. 아직 구현하지 않는 기능

- `published` 상태 전환 및 WordPress 게시
- 이미지 생성, 영상 생성
- Hermes Agent
- 사용자 인증/권한 관리 (현재 `reviewed_by='local-user'` 고정)
- AI 호출 실패 시 자동 재시도 (무한 루프 방지를 위해 의도적으로 미구현)

---

## 참고

- `lib/ai/ai-errors.ts` — `toAiErrorMessage()` 오류 메시지 변환 유틸
- `lib/ai/ai-config.ts` — `shouldUseAnthropic()` feature flag
- `app/dashboard/actions.ts` — `generateArticleDraft()` AI 파이프라인 오케스트레이터
- `docs/phase-1-6-vercel-deploy.md` — Vercel 환경변수 등록 방법
