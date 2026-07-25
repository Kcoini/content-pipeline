# 일반 기사형 (general_news) 프롬프트

## 목적
빠른 이슈 전달을 목표로 하는 일반 기사형 초안을 생성한다. `article_mode='general_news'`일 때
`lib/ai/article-writer.ts`의 `generateAiArticleDraft`/`generateMockArticleDraft`가 이 구조를 따른다.

## 구조 (7개 섹션)
1. **제목** — 과장 없는 사실 전달형 제목
2. **리드문** — 무엇이·언제·왜 일어났는지 2~3문장 요약
3. **핵심 내용** — 이슈의 핵심 사실
4. **배경** — 이슈가 발생한 맥락
5. **관련 자료 또는 반응** — 출처가 전하는 관련 사실/반응
6. **향후 전망** — 출처 근거가 있는 전망 (과도한 예측 금지)
7. **참고 출처** — 인용된 출처 목록

## 작성 원칙
- 객관적 서술을 유지한다.
- 과장된 표현이나 클릭베이트성 제목을 사용하지 않는다.
- 출처에 없는 단정적 주장을 하지 않는다.
- 빠른 이슈 전달이 목적이므로 general_news는 source_based_explainer보다 짧고 간결하게 작성한다
  (`defaultLength: short_to_medium`).
- SEO 메타데이터, 광고 슬롯은 사용하지 않는다.

## tool_use 출력 스키마 (write_general_news_article)
```json
{
  "title": "기사 제목 (과장 금지, 40자 이내)",
  "content": "기사 본문 (markdown, 500자 이상, 7개 섹션)",
  "citedSourceIds": ["source-id-1", "source-id-2", "source-id-3"]
}
```

## 평가
`evals/general-news.eval.yaml` 기준(사실성, 중립성, 출처 반영, 과장 표현 여부, 기사 구조 충족)으로
평가한다.
