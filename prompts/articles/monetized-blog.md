# 수익형 블로그형 (monetized_blog) 프롬프트

## 목적
검색 유입, 체류시간, 광고 배치, 내부 링크 전환을 고려한 수익형 블로그 글을 생성한다.
`article_mode='monetized_blog'`일 때 `lib/ai/article-writer.ts`의 전용 system prompt/tool
schema(`MONETIZED_BLOG_TOOL`)를 사용한다.

## 구조
1. SEO 제목 (`seoTitle`)
2. 메타 설명 (`metaDescription`, 최대 160자)
3. 도입부
4. 핵심 요약 박스
5. 목차
6. 문제 설명
7. 핵심 정보
8. 비교표
9. 체크리스트
10. 주의점
11. FAQ
12. 결론
13. 관련 글 추천 (`internalLinkSuggestions`)
14. 광고 슬롯 marker (`AD_SLOT_MARKERS` 참고, 본문 중간에 삽입)
15. 참고자료

## 광고 슬롯 marker
실제 AdSense 코드는 절대 삽입하지 않는다. 아래 HTML 주석 marker만 본문에 삽입한다
(`lib/articles/article-modes.ts`의 `AD_SLOT_MARKERS`와 동일):

```
<!-- AD_SLOT: after_summary -->
<!-- AD_SLOT: after_intro -->
<!-- AD_SLOT: mid_content_1 -->
<!-- AD_SLOT: mid_content_2 -->
<!-- AD_SLOT: before_faq -->
<!-- AD_SLOT: before_conclusion -->
```

## 작성 원칙
- 검색 의도(search intent) 중심으로 작성한다.
- 독자의 문제 해결을 최우선한다.
- 과장된 클릭베이트, 허위 수익 약속을 금지한다.
- AdSense 정책을 위반할 수 있는 광고 클릭 유도 문구를 사용하지 않는다.
- 출처 기반으로 사실을 확인한다 (근거 없는 단정 금지).
- 의료·금융·법률 등 고위험 주제에서 단정적 조언을 하지 않는다.

## tool_use 출력 스키마 (write_monetized_blog_article)
```json
{
  "seoTitle": "SEO 제목 (60자 이내, 타깃 키워드 포함)",
  "metaDescription": "메타 설명 (160자 이내)",
  "targetKeyword": "타깃 키워드",
  "secondaryKeywords": ["보조 키워드1", "보조 키워드2"],
  "searchIntent": "informational | commercial | transactional 등",
  "readerPersona": "독자 페르소나 설명",
  "title": "본문에 표시할 제목",
  "content": "기사 본문 (markdown, AD_SLOT marker 포함, 목차/비교표/체크리스트/FAQ 포함)",
  "citedSourceIds": ["source-id-1", "source-id-2", "source-id-3"],
  "adSlots": [{ "position": "after_summary", "marker": "<!-- AD_SLOT: after_summary -->" }],
  "internalLinkSuggestions": [{ "title": "관련 글 제목", "reason": "추천 이유" }],
  "monetizationScore": 0,
  "policyRiskScore": 0
}
```

## monetization_score (0~100)
검색 수요 가능성, 문제 해결성, 비교/신청/구매 의도, 콘텐츠 확장성, 광고 적합성,
장기 검색 가능성, 경쟁 강도, 정책 위험도를 종합해 모델이 직접 산출한다.

## policy_risk_score (0~100, 높을수록 위험)
허위/과장 수익 약속, 광고 클릭 유도 문구, 선정적 제목, 의료/금융/법률 고위험 단정,
출처 없는 주장, 원문 복사 위험, 저작권 위험을 종합해 모델이 직접 산출한다.

## 평가
`evals/monetized-blog.eval.yaml` 기준(검색 의도 적합성, 제목의 클릭 가능성, 과장/허위 여부,
체류시간 구조, 요약 박스, 비교표/체크리스트, FAQ, 내부 링크 제안, 광고 슬롯 위치 적절성,
AdSense 정책 위험도)으로 별도 평가한다.
