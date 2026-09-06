# 수익형 블로그형 (monetized_blog) 프롬프트 — "문제 해결형 수익 블로그"

## 목적
검색 유입, 독자 만족도, 체류시간, 광고 배치, 내부 링크 전환을
고려하되 **최우선 목표는 독자의 문제 해결과 신뢰성**인 수익형 블로그
글을 생성한다. `article_mode='monetized_blog'`일 때
`lib/ai/article-writer.ts`의 전용 system prompt/tool schema
(`MONETIZED_BLOG_TOOL`)를 사용한다. SEO는 사람에게 유용한 콘텐츠를
더 잘 발견되게 하기 위한 보조 수단으로만 사용한다.

자세한 배경/설계 원칙은
[`docs/article-generation-monetized-blog.md`](../../docs/article-generation-monetized-blog.md)
참고.

## 구조 — 도입부가 먼저, 핵심 답변은 그 뒤에 (하이브리드 구조)
1. SEO 제목 (`seoTitle`)
2. 메타 설명 (`metaDescription`, 120~160자 내외)
3. 도입부
4. 짧은 핵심 답변 (`answerSummary`를 자연스럽게 풀어서 반영)
5. 핵심 요약 박스 → `AD_SLOT: after_summary`
6. 목차
7. 문제 설명
8. 핵심 정보 → `AD_SLOT: mid_content_1`
9. 비교표 → `AD_SLOT: mid_content_2`
10. 선택 기준
11. 체크리스트
12. 주의점/한계
13. FAQ → `AD_SLOT: before_faq`
14. 결론 → `AD_SLOT: before_conclusion`
15. 관련 글 추천 (`internalLinkSuggestions`)
16. 참고자료

`answerSummary`는 tool 필드로 계속 유지하며 AEO/GEO 평가와 내부
검증에 그대로 쓰이지만, **본문(content)을 그 값으로 곧바로 시작하지
않는다.** 일반 블로그 독자가 보고서식·AI 답변식으로 느끼지 않도록
도입부를 먼저 배치하고, 그 직후에 answerSummary 내용을 자연스러운
"짧은 핵심 답변" 섹션으로 풀어서 제시한다 — 독자 친화성과 AEO/GEO
이점(직접 답변, 결론 우선 제시)을 동시에 살리는 하이브리드 구조다.

heading은 위 순서를 참고용 뼈대로만 삼고, 실제 heading 문구는 주제에
맞게 자연스럽게 작성한다(모든 글에서 같은 제목을 기계적으로 반복하지
않는다).

### 도입부 작성 기준
- 독자의 상황이나 문제의식에서 시작한다.
- 왜 이 주제가 중요한지 설명한다.
- 이 글에서 무엇을 정리할지 안내한다.
- 과장, 클릭베이트, 광고성 표현은 사용하지 않는다.
- targetKeyword는 자연스럽게 포함하되 억지로 반복하지 않는다.

### 짧은 핵심 답변 섹션 작성 기준
- 도입부 바로 뒤에 배치한다.
- `answerSummary`의 내용을 바탕으로 2~4문장으로 작성하되, 그대로
  복사하지 말고 자연스럽게 풀어 쓴다. `answerSummary`와 본문 결론이
  서로 충돌하지 않아야 한다.
- heading은 주제에 맞게 자연스럽게 선택한다. **허용 heading 예**:
  "## 먼저 결론부터 보면", "## 핵심만 정리하면", "## 이 글의 핵심",
  "## 짧게 정리하면", "## 결론부터 말하면".
- **금지 heading 예**: "## 무조건 이것만 보세요", "## 이거 모르면
  손해입니다", "## 충격적인 결론", "## 반드시 수익 나는 방법" —
  클릭베이트/과장 표현이 섞인 heading은 쓰지 않는다.

모델이 위 허용 heading 중 하나로 이미 자연스럽게 반영했다면
`ensureCoreAnswerInContent()`가 이를 인식해 추가 삽입을 생략한다.
반영하지 않았다면 도입부 섹션이 끝나는 지점에 기본 heading
("## 핵심만 정리하면")과 `answerSummary` 원문으로 fallback 섹션을
삽입한다(안전망일 뿐 — 프롬프트는 항상 자연스러운 문장으로 풀어
쓰도록 지시한다).

## E-E-A-T 기준
- 최우선 목표는 광고 수익이 아니라 독자의 문제 해결과 신뢰성이다.
- 실제 경험, 사용 후기, 전문가 자격, 조사 결과를 출처 없이 지어내지
  않는다.
- 사실과 작성자의 해석을 구분한다.
- 의료/금융/법률/안전/공공정책(YMYL) 주제는 단정적 조언을 피하고,
  확인이 필요한 사항과 일반적 판단 기준을 제시한다.
- 비교 기준·주의점·한계·확인 방법을 함께 제공해 독자가 스스로
  판단할 수 있게 한다.

## SEO 기준
- targetKeyword는 seoTitle/도입부/주요 heading 일부에 자연스럽게
  포함하되 반복(keyword stuffing)하지 않는다.
- metaDescription은 120~160자 내외.
- 제목은 클릭 유도력은 있되 과장·낚시·허위 기대를 만들지 않는다.

## AEO(직접 답변) 기준
- `answerSummary`(2~4문장)로 독자의 핵심 질문에 결론부터 답한다 —
  단, 이 값은 tool 필드로 별도 유지되며 본문 맨 앞에 그대로 노출되지
  않는다(위 "짧은 핵심 답변 섹션" 참고).
- FAQ는 본문 내용을 보완하는 실제 질문·답변만 담고, 본문에 없는
  내용을 새로 지어 답하지 않는다.

## GEO(생성형 AI 검색 이해성) 기준
- 각 섹션이 독립적으로 읽혀도 의미가 통하게 작성한다.
- 결론을 먼저 제시하고 근거·예외를 뒤에 설명한다.
- `geoSummary.keyFacts`는 출처 기반 사실만, `geoSummary.caveats`는
  주의점/한계/예외를 담는다.
- **검색/AI 노출을 보장하는 표현("AI Overview에 노출", "검색 1위
  보장", "AI가 반드시 인용")은 절대 사용하지 않는다.**

## 광고 슬롯 marker
실제 AdSense 코드는 절대 삽입하지 않는다. 아래 HTML 주석 marker만
각 위치에 **정확히 1회씩** 삽입한다(`lib/articles/article-modes.ts`의
`AD_SLOT_MARKERS`와 동일):

```
<!-- AD_SLOT: after_summary -->
<!-- AD_SLOT: after_intro -->
<!-- AD_SLOT: mid_content_1 -->
<!-- AD_SLOT: mid_content_2 -->
<!-- AD_SLOT: before_faq -->
<!-- AD_SLOT: before_conclusion -->
```

모델이 marker를 빠뜨리면 `ensureAdSlotMarkers()`가 heading을 단서로
삼아 의미 있는 위치(예: "비교" heading 뒤, "FAQ" heading 앞)에
채워 넣는다. anchor를 못 찾으면 본문 내 대략적인 위치 비율로
분산 배치하며, 본문 끝에 6개를 몰아넣지 않는다.

새 구조(도입부 → 짧은 핵심 답변 → 핵심 요약 박스 순)에 맞춰 두
marker의 anchor 기준을 조정했다:
- `after_intro`는 **도입부**와 **짧은 핵심 답변** 섹션 사이에
  배치한다(도입부 heading 바로 뒤).
- `after_summary`는 짧은 핵심 답변이 아니라 그 뒤에 오는 **핵심 요약
  박스** heading 뒤에 배치한다.

## 작성 원칙
- 검색 의도(search intent)보다 독자의 문제 해결을 우선한다.
- 과장된 클릭베이트, 허위 수익 약속을 금지한다.
- AdSense 정책을 위반할 수 있는 광고 클릭 유도 문구를 사용하지 않는다.
- 출처 기반으로 사실을 확인한다(근거 없는 단정 금지).
- 고위험(YMYL) 주제에서 단정적 조언을 하지 않는다.
- 허위 경험담·허위 전문가 검토·출처 없는 통계·본문과 불일치하는
  FAQ를 금지한다.

## tool_use 출력 스키마 (write_monetized_blog_article)
```json
{
  "seoTitle": "SEO 제목 (60자 이내, 타깃 키워드 포함)",
  "metaDescription": "메타 설명 (120~160자 내외)",
  "targetKeyword": "타깃 키워드",
  "secondaryKeywords": ["보조 키워드1", "보조 키워드2"],
  "searchIntent": "informational | commercial | transactional 등",
  "readerPersona": "독자 페르소나 설명",
  "title": "본문에 표시할 제목",
  "answerSummary": "독자의 핵심 질문에 대한 2~4문장 직접 답변",
  "content": "기사 본문 (markdown, AD_SLOT marker 각 1회, answerSummary 반영, 목차/비교표/체크리스트/FAQ 포함)",
  "citedSourceIds": ["source-id-1", "source-id-2", "source-id-3"],
  "adSlots": [{ "position": "after_summary", "marker": "<!-- AD_SLOT: after_summary -->" }],
  "internalLinkSuggestions": [{ "title": "관련 글 제목", "reason": "추천 이유" }],
  "monetizationScore": 0,
  "policyRiskScore": 0,
  "eeatNotes": {
    "experience": "실제 근거가 있을 때만 채움",
    "expertise": "실제 근거가 있을 때만 채움",
    "authoritativeness": "실제 근거가 있을 때만 채움",
    "trustworthiness": "실제 근거가 있을 때만 채움"
  },
  "readerQuestions": [{ "question": "...", "shortAnswer": "..." }],
  "geoSummary": {
    "directAnswer": "핵심 결론 1~2문장",
    "keyFacts": ["출처 기반 사실 1", "출처 기반 사실 2"],
    "caveats": ["주의점/한계 1"]
  },
  "structuredDataSuggestions": [{ "type": "FAQPage", "reason": "본문에 실제 FAQ가 있고 내용이 일치함" }]
}
```

`eeatNotes`의 각 항목은 실제 근거가 있을 때만 채우며, 없으면 비워둔다
(지어내지 않는다). `structuredDataSuggestions`는 실제 schema markup
자동 삽입이 아니라 후보 제안일 뿐이며 실제 JSON-LD 코드는 생성하지
않는다. 두 필드 모두 DB에는 저장하지 않는다(결과 객체에만 포함).

## monetization_score (0~100)
검색 수요 가능성, 문제 해결성, 비교/신청/구매 의도, 콘텐츠 확장성,
광고 적합성, 장기 검색 가능성, 경쟁 강도, 정책 위험도를 종합해
모델이 직접 산출한다. **높은 monetizationScore가 과장 표현이나
허위 수익 약속을 써도 된다는 의미가 아니다.**

## policy_risk_score (0~100, 높을수록 위험)
허위/과장 수익 약속, 광고 클릭 유도 문구, 선정적 제목, 의료/금융/
법률/안전/공공정책 고위험 단정, 출처 없는 주장, 원문 복사 위험,
저작권 위험, **허위 E-E-A-T 표현, AI 검색 노출 보장 표현, 본문과
불일치하는 FAQ, 키워드 반복, 실제 광고 코드**를 종합해 모델이 직접
산출한다. 코드는 이 점수가 70 이상이면 `qualityWarnings`에
`policy_risk_high` 경고를 남긴다(자동 차단은 하지 않으며, 최종 판단은
사람이 한다).

## 평가
`evals/monetized-blog.eval.yaml` 기준(검색 의도 적합성, 제목의 클릭
가능성, 과장/허위 여부, 체류시간 구조, 요약 박스, 비교표/체크리스트,
FAQ, 내부 링크 제안, 광고 슬롯 위치 적절성, AdSense 정책 위험도,
**E-E-A-T 신뢰성, 직접 답변 품질, GEO 명확성, 키워드 자연스러움,
YMYL 위험도**)으로 별도 평가한다. `adsense-policy-risk`,
`eeat-trustworthiness`, `ymyl-risk`는 gate로도 쓰여, 위험/신뢰성
기준을 벗어나면 가중 평균과 무관하게 `passed=false`가 된다.
