# 마스터 원고 생성 계약(prompt)

이 문서는 "마스터 원고"를 만들 때 반드시 지켜야 할 지시사항을
정의한다. **중요**: 이 프로젝트는 현재 이 계약을 실제 AI 호출이
아니라 `lib/articles/master-manuscript-builder.ts`의 결정적(순수
함수) 로직으로 구현하고 있다(Phase 4-2에서 내린 설계 결정 — 아래
"왜 AI 호출이 아닌가" 참고). 이 문서는 (1) 지금의 결정적 구현이
지켜야 할 계약이자, (2) 나중에 실제 AI 기반 생성으로 고도화할 때
그대로 시스템 프롬프트로 쓸 수 있는 명세다.

## 절대 하지 말 것

- **완성된 게시글을 쓰지 않는다.** 마스터 원고는 최종 게시글이
  아니라 언론 기사/WordPress 블로그/네이버 블로그/네이버 카페/X/
  Threads/Instagram 글을 만들기 위한 출처 기반 편집 자료다.
- 출처에 없는 내용을 단정하지 않는다.
- 확인 필요 사항이나 전망을 사실처럼 쓰지 않는다(`verifiedFacts`에
  넣지 않고 `verificationNeeded`/`factInterpretationSplit.interpretation`
  으로 분리한다).
- 모든 항목을 억지로 길게 채우지 않는다 — 출처가 부족하면 부족하다고
  명시한다(`longFormSupport.sourceSufficiency`).
- 근거 없는 예시를 지어내지 않는다(`longFormSupport.examplesAndAnalogies`는
  실제 출처 기반 재료가 없으면 빈 배열로 둔다).

## 반드시 할 것

1. 출처를 분석해 각 출처가 "무엇을 말할 수 있는지" 정리한다
   (`sourceSummaries[].supports`/`verifiedFacts`/`cautions`/`reliabilityNote`).
2. 확인된 사실을 추출하고, 각 사실에 근거 출처(`sourceIds`)를 반드시
   연결한다(`verifiedFacts`).
3. 사실과 해석을 분리한다(`factInterpretationSplit`) — 해석은 항상
   "이것은 해석이다"라는 사실을 드러내야 한다.
4. 핵심 메시지(`mainMessage` 1개 + `supportingMessages` 2~3개),
   배경 설명(`background`), 확인 필요 사항(`verificationNeeded`),
   금지/주의 표현(`prohibitedOrCarefulExpressions`)을 정리한다.
5. 플랫폼별 제목 후보(`titleCandidates` — neutral/explainer/seo/
   socialHook/cafeQuestion/newsArticle)를 만든다.
6. 장문 글 설계도(`longFormSupport`)를 만든다 — `sectionPlan`(H2/H3
   또는 기사 문단 구성)과 `evidenceMap`(어떤 주장에 어떤 출처를
   쓸지)은 필수다. 언론 기사는 `newsArticleExpansion`, 수익형
   블로그/WordPress는 `monetizedBlogExpansion`을 채운다.
7. 플랫폼별 brief(`platformBriefs.newsArticle`/`wordpressBlog`/
   `naverBlog`/`naverCafe`/`shortSocial`/`instagram`)를 만든다 —
   **짧고 재사용 가능하게** 만든다(플랫폼 하나가 다른 플랫폼의
   brief까지 읽지 않아도 되게).
8. EEAT/SEO/AEO/GEO/AGENT 대응 재료를 `optimizationSupport`에
   구조화해서 넣는다(`eeatNotes`/`seoSupport`/`aeoSupport`/
   `geoSupport`/`agentReadiness`) — 각각을 장황한 글로 만들지 않는다.
9. 마스터 원고 자체의 자동 검토 기준(`autoReviewCriteria`)을 만든다.

## 비용 원칙(플랫폼별 글 생성 시 지킬 것)

- 플랫폼별 글 생성 prompt에 마스터 원고 전체를 반복 투입하지 않는다.
- 짧은 SNS(x/threads/instagram) 생성에는 `platformBriefs.shortSocial`/
  `platformBriefs.instagram` + `mainMessage`/`supportingMessages` +
  `prohibitedOrCarefulExpressions`만 전달한다 — 긴 WordPress
  expansion(`longFormSupport.monetizedBlogExpansion`)을 넣지 않는다.
- 긴 글(언론 기사/WordPress 블로그)에만 `longFormSupport`의 해당
  expansion을 전달한다.
- `getPlatformBrief(master, platform)`(`lib/articles/master-manuscript-builder.ts`)
  가 플랫폼별로 필요한 조각만 골라주는 유일한 진입점이다 — 다른
  플랫폼의 brief나 마스터 원고 전체를 직접 참조하지 않는다.

## 출력 구조

`lib/articles/master-manuscript-types.ts`의 `MasterManuscript`
타입이 이 계약의 실제 스키마다. 핵심 필드:

```
theme, sourceSummaries, verifiedFacts, factInterpretationSplit,
mainMessage, supportingMessages, background, verificationNeeded,
prohibitedOrCarefulExpressions, titleCandidates, platformBriefs,
longFormSupport, optimizationSupport, autoReviewCriteria,
generatedFromMode, builtAt
```

## 왜 AI 호출이 아닌가 (현재 구현 방식)

`buildMasterManuscript(article, sources)`는 이미 생성된 article과
저장된 출처(summary/keyPoints)만으로 위 계약을 **결정적으로**
계산한다 — 새 AI 호출을 추가하지 않는다.

- 비용이 추가되지 않는다(Phase 4-4의 비용 최적화 원칙과 일치).
- `lib/ai/article-writer.ts`의 기존 article 생성 로직을 전혀 건드리지
  않는다.
- article/source가 바뀌면 항상 최신 데이터로 다시 계산되는 파생
  데이터라서 별도 동기화 문제가 없다.

대신 이 결정적 구현은 "해석"이나 "예시" 같은 항목에서는 실제로
통찰력 있는 문장을 만들어내지 못한다(사람이 다듬어 써야 하는
초안 수준이다) — 이 한계를 각 항목의 문구/주석에 명시했다. 나중에
품질을 더 높이려면, 이 문서를 시스템 프롬프트로 삼아 실제 AI 호출
(`lib/ai/article-writer.ts`의 `generateAiArticleDraft`와 같은 tool-use
패턴)로 `buildMasterManuscript`를 대체하거나 보강할 수 있다 — 그때도
"완성된 게시글을 쓰지 말 것"이라는 첫 번째 원칙은 반드시 유지해야
한다.
