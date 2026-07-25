# 출처 기반 설명형 (source_based_explainer) 프롬프트

## 목적
자료와 출처를 바탕으로 정확하게 설명하는 글을 생성한다. `article_mode`의 기본값이며,
기존(Phase 1-11까지) 기사 생성 흐름과 동일하다. `prompts/article-draft.v1.md`,
`lib/ai/article-writer.ts`의 기존 `ARTICLE_SYSTEM_PROMPT`/`ARTICLE_TOOL`을 그대로 사용한다.

## 구조 (7개 섹션)
1. **제목** — thesis 반영 제목
2. **주제 소개(리드문)** — 독자가 계속 읽을 이유
3. **배경 설명** — 주제가 왜 지금 중요한지
4. **주요 출처 요약 / 핵심 쟁점** — 여러 출처가 공통으로 짚는 핵심
5. **핵심 내용 해설(다각도 분석)** — 출처들의 공통점·차이점 통합 해석
6. **의미와 쟁점 / 독자에게 주는 의미** — 독자에게 왜 중요한지
7. **향후 과제(향후 전망 또는 과제)** — 출처 근거 있는 전망
8. **참고자료** — 인용 출처 (citedSourceIds로 구조화)

## 작성 원칙
- 출처 기반 설명을 우선한다 (신뢰성 우선).
- 독자가 이해하기 쉽게 설명한다.
- 지나친 클릭 유도(클릭베이트)를 금지한다.
- 수익화보다는 정확성과 전문성을 우선한다.
- 여러 출처를 종합(synthesis)하여 하나의 논지로 재구성한다 (단순 나열 금지).

## tool_use 출력 스키마 (write_article)
기존 `lib/ai/article-writer.ts`의 `ARTICLE_TOOL` 스키마를 그대로 사용한다
(`synthesis_notes` → `thesis` → `title` → `content` → `citedSourceIds`).

## 평가
`evals/article-quality.v1.eval.yaml` 기준(출처 기반성, 종합성, 독창성, 복사 위험도 등)으로 평가한다.
