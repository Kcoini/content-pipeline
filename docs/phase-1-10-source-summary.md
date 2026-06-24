# Phase 1-10: raw_content 기반 source summary 자동 생성

> Phase 1-9에서 수집한 `raw_content`를 바탕으로 AI가 source별 구조화된 요약을
> 자동 생성하여 `sources.summary`와 `sources.key_points`에 저장한다.
> 기사 생성 시 사용자 직접 입력 대신 자동 생성 요약을 우선 사용한다.

---

## 1. 목적

- 사용자가 URL만 등록해도 AI가 본문을 읽고 `summary`, `key_points` 자동 생성
- 기사 초안 생성 품질 향상: 풍부한 요약 + 핵심 포인트 → 출처 복사 위험 감소
- 기사 생성 시 배치 AI 요약 호출 제거 → API 비용 절감

---

## 2. raw_content와 summary의 역할 차이

| 컬럼 | 설명 |
|------|------|
| `raw_content` | URL에서 수집한 원시 HTML 본문 (추출 텍스트, 최대 50,000자) |
| `summary` | AI가 재구성한 핵심 요약 (300~600자). 사용자 직접 입력도 이 컬럼에 저장 |
| `key_points` | AI가 추출한 핵심 포인트 배열 (3~7개 짧은 문장) |

---

## 3. summary_status 흐름

```
출처 등록
  ↓ URL fetch
fetch_status = success AND raw_content 존재
  ↓
AI_GENERATION_ENABLED=true  → generateSourceSummaryWithAi()
AI_GENERATION_ENABLED=false → generateSourceSummaryMock()
  ↓
성공: summary_status = 'success', sources.summary + key_points 저장
실패: summary_status = 'failed', summary_error 저장
  ↓
fetch 성공이나 raw_content 없음: summary_status = 'skipped'
URL 없어 fetch 미실행: summary_status = 'pending' (기본값)
```

---

## 4. 비용 방지 정책

- source 1개당 자동 요약 AI 호출 최대 1회
- `raw_content`가 없으면 AI 호출 없이 `skipped` 처리
- AI mode에서 기사 생성 시 배치 요약 AI 호출 제거 (Phase 1-4 기존 방식 대체)
  → 기사 1회 생성당 AI 호출 3회 → 2회 (기사 생성 1 + 평가 1)
- 실패해도 자동 재시도하지 않음 (source는 유지)

---

## 5. fallback 우선순위 (article generation 입력)

기사 생성 시 `summarizeSourcesMock` / `summarizeSourcesWithAi` 모두 동일 순서:

1. `sources.summary` (자동 생성 또는 사용자 입력, non-empty이면 사용)
2. `sources.raw_content` 앞 400자 (summary가 없을 때)
3. `sources.title + publisher` (raw_content도 없을 때)

`key_points`는 `sources.key_points` (jsonb 배열)에서 읽어 article prompt에 전달.

---

## 6. sources 테이블 신규 컬럼

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `summary_status` | `text` NOT NULL | `'pending'` | 요약 상태 |
| `summary_error` | `text` | NULL | 실패 원인 |
| `summarized_at` | `timestamptz` | NULL | 요약 완료 시각 |
| `key_points` | `jsonb` NOT NULL | `'[]'` | 핵심 포인트 배열 |

migration: `db/migrations/008_sources_summary_columns.sql`

---

## 7. pipeline_logs 이벤트 (신규)

| 이벤트 | 발생 시점 |
|--------|----------|
| `source_summary_started` | 자동 요약 시작 |
| `source_summary_completed` | AI 요약 완료 |
| `source_summary_mocked` | mock 요약 완료 |
| `source_summary_failed` | AI 요약 실패 |
| `source_summary_skipped` | raw_content 없어 건너뜀 |

---

## 8. 아직 남은 한계

- 기존 등록 출처(Phase 1-9 이전)는 소급 요약하지 않는다 (`summary_status='pending'` 유지)
- `entities`, `risksOrUncertainties`, `source_angle` 필드는 현재 DB에 저장하지 않는다
  (기사 생성 시 `keyPoints`와 `sourceAngle`만 article prompt에 전달)
- SPA/JS 렌더링 페이지는 raw_content 수집 자체가 어렵다 (Phase 1-9 한계 동일)
- mock 요약은 실제 분석 없이 기존 텍스트를 재사용하므로 품질이 낮다

---

## 참고

- `lib/ai/source-auto-summarizer.ts` — per-source AI 요약 생성
- `lib/ai/source-summarizer.ts` — 기사 생성용 SourceSummary 포맷터 (Phase 1-10 업데이트)
- `lib/repositories/source-repository.ts` — `updateSourceSummary`, `skipSourceSummary`
- `app/dashboard/actions.ts` — `addSource` → fetch → summary 흐름
- `prompts/source-summary.v1.md` — 자동 요약 프롬프트 정의
- `db/migrations/008_sources_summary_columns.sql` — Supabase 적용 migration
