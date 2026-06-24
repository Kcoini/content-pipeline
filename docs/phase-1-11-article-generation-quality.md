# Phase 1-11: 기사 생성 품질 최종 조정

## 1. 목적

Phase 1-10에서 source summary 자동 생성이 완료된 이후, 기사 초안 생성과 품질 평가
전 과정을 개선해 "단순 출처 요약 모음"이 아닌 실제 블로그 기사가 생성되도록 한다.

주요 목표:
- AI article writer가 출처 요약을 paraphrase하지 않고 자체 논지로 재구성하도록 유도
- eval 과정이 JSON 파싱 오류 없이 안정적으로 동작하도록 tool_use로 교체
- mock article도 7섹션 구조를 갖춰 로컬 개발·테스트에서 품질 흐름을 확인할 수 있게 함
- article detail UI에서 source summary / key_points 미리보기 제공

---

## 2. Phase 1-10 이후 입력 구조 변화

Phase 1-10부터 `sources.summary`와 `sources.key_points`가 source 등록 시 자동 생성된다.

기사 생성 시 `SourceSummary[]`에 담겨 article writer로 전달되는 정보:

| 필드 | 출처 | 설명 |
|------|------|------|
| `sourceId` | sources.id | 출처 식별자 |
| `title` | sources.title | 출처 제목 (extracted_title fallback 포함) |
| `publisher` | sources.author | 출판사 |
| `publishedAt` | sources.published_at | 발행일 |
| `summary` | sources.summary | AI 자동 요약 (300~600자) |
| `keyPoints` | sources.key_points | 핵심 사실 배열 (3~7개) |
| `sourceAngle` | source-auto-summarizer 결과 | 출처 관점 (DB 미저장, 빈 문자열) |

**핵심 변화**: article writer는 `summary` 전문(600자) 대신 **`key_points` 불릿만** 전달받는다.
요약문을 보면 paraphrase 경향이 생기므로, 사실 추출물(불릿)만 전달해 모델이 원고를 구성하도록 유도한다.

---

## 3. Article Draft Prompt 구조 (tool_use 방식)

### 시스템 프롬프트 핵심 원칙

- **Persona**: "15년 경력 전문 저널리스트"
- **작업 순서 강제**: `synthesis_notes` → `thesis` → `title` → `content`
- **금지**: key_points 직접 인용, 출처 순차 나열(A 출처에 따르면... B 출처에 따르면...), hallucination

### tool 출력 스키마 (write_article)

```json
{
  "synthesis_notes": "출처 분석 메모 (3~5문장, 독자 비공개)",
  "thesis": "기사 핵심 주장 (1~2문장)",
  "title": "기사 제목 (40자 이내)",
  "content": "기사 본문 (markdown, 800자 이상, 7개 섹션)",
  "citedSourceIds": ["source-id-1", "source-id-2", "source-id-3"]
}
```

### 7개 섹션 구조

1. 리드문 — thesis 반영, 독자가 계속 읽을 이유 제시
2. 배경 — 이 주제가 왜 지금 중요한지
3. 핵심 쟁점 — 출처들이 공통으로 짚는 문제
4. 다각도 분석 — 공통점과 차이점·긴장관계 통합 해석
5. 사실과 데이터 — key_points에 명시된 구체적 수치·사례
6. 독자에게 주는 의미 — 일반 독자에게 왜 중요한지
7. 향후 전망 또는 과제 — 출처 근거 있는 전망

---

## 4. Eval 기준 (10가지)

`evals/article-quality.v1.eval.yaml` 기준. tool_use 방식(`score_article` 도구)으로 교체.

| 기준 ID | 가중치 | Gate 조건 |
|---------|--------|-----------|
| factual-grounding | 0.10 | — |
| fact-opinion-separation | 0.05 | — |
| exaggeration-check | 0.05 | — |
| unsourced-numbers-check | 0.10 | — |
| structure | 0.15 | — |
| readability | 0.05 | — |
| originality | 0.20 | — |
| synthesis | 0.20 | score < 2 → passed=false |
| source-integration | 0.10 | — |
| copy-risk | 0.00 | score ≥ 4 → passed=false |

**pass_threshold**: aggregate_score ≥ 3.0

---

## 5. Copy Risk 방지 전략

| 단계 | 전략 |
|------|------|
| Source 요약 생성 | raw_content를 AI가 재구성 (source-auto-summarizer, tool_use) |
| Article 생성 입력 | summary 전문 제거, key_points(불릿 사실)만 전달 |
| Article 생성 프롬프트 | synthesis_notes → thesis 순서로 논지 먼저 수립 후 작성 |
| Article 생성 금지 규칙 | key_points 직접 인용, 출처 순차 나열 금지 명시 |
| Eval | copy-risk score ≥ 4이면 passed=false 강제 |

---

## 6. Mock Mode 동작 (AI_GENERATION_ENABLED=false)

**기사 생성**: `generateMockArticleDraft` → 7섹션 구조(리드문, 배경, 핵심쟁점, 비교, 의미, 전망)로 개선.
출처 단순 나열 대신 key_points를 활용한 섹션별 구조로 구성.

**Source 요약**: `generateSourceSummaryMock` → 기존 summary/rawContent에서 keyPoints 추출.

**Eval**: `evaluateArticleMock` → 고정 점수(originality=4, synthesis=5, copy-risk=1). 항상 passed=true.

---

## 7. 품질 경고 처리

```
eval passed=false
  ↓
pipeline_logs: article_quality_warning (status=failed)
  ↓
article.status = "draft" 유지 (자동 차단 없음)
  ↓
/articles/[id]: "품질 검토 필요" 배너 표시 (amber)
  ↓
사용자가 내용 확인 후 직접 승인 또는 수정
```

승인은 사람이 최종 판단한다 (`lib/harness/approval-gate.ts`의 `assertApproved` 경유).

---

## 8. Article Detail UI 개선 (/articles/[id])

- 인용 출처 목록에 **summary 미리보기** (150자) 추가
- 인용 출처 목록에 **key_points 불릿** (최대 3개) 추가
- 출처 제목이 URL로 링크됨
- 품질 경고 배너: eval passed=false 시 상단에 amber 박스 표시
- eval 결과: 10개 기준별 score + reason 목록

---

## 9. 남은 한계

- `sourceAngle`은 AI 자동 요약 시 생성되지만 DB에 저장하지 않아 article 생성 시 빈 문자열
- `entities`, `risksOrUncertainties`도 DB 미저장 (article prompt에 미전달)
- mock eval은 항상 고정 점수이므로 실제 품질 측정 불가 (AI mode에서만 의미 있음)
- article 생성 시 copy-risk를 사전에 예방하지 않으므로 eval에서만 사후 검출 가능

---

## 참고 파일

- `lib/ai/article-writer.ts` — 기사 초안 생성 (tool_use, 7섹션 mock)
- `lib/ai/eval-article.ts` — 품질 평가 (tool_use)
- `prompts/article-draft.v1.md` — 기사 생성 프롬프트 정의
- `prompts/article-eval.v1.md` — 평가 프롬프트 정의
- `evals/article-quality.v1.eval.yaml` — 평가 기준 YAML
- `app/articles/[id]/page.tsx` — 기사 상세 UI
