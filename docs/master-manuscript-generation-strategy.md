# 마스터 원고 생성 전략 고도화 (재요청 Phase 3-27, 1차+2차)

## 배경과 범위

[Phase 4-1](./phase-4-1-master-manuscript-terminology.md)~
[Phase 4-4](./phase-4-4-master-manuscript-cost-and-rollout.md)로
"마스터 원고 중심" 구조 전환을 완료한 뒤, 마스터 원고 자체의 깊이를
높여달라는 요청이 다시 들어왔다("Phase 3-27: 마스터 원고 생성 전략
고도화"). 마스터 원고가 얕으면 하위 플랫폼 글의 품질도 낮아진다는
문제의식에서, 마스터 원고를 "단순 요약"이 아니라 사실/해석 분리 +
장문 대응 + EEAT/SEO/AEO/GEO/AGENT 재료를 갖춘 "고품질 편집
설계서"로 확장하는 작업이다.

요청 문서 자체의 "18. 작업 범위 조절"이 4단계(1차 prompt 고도화/
출력 구조/UI 용어, 2차 longFormSupport/optimizationSupport/검토
기준, 3차 platformBrief 우선 사용/비용 최적화, 4차 news_article)로
나누고 "가능하면 1차와 2차를 우선 완료한다"고 명시했다. 이번
작업은 **1차와 2차만** 구현한다. 3차(플랫폼 생성에 longFormSupport/
optimizationSupport까지 연결)와 4차(news_article)는 이미 이전
[Phase 4-2](./phase-4-2-platform-brief-structuring.md)/
[Phase 4-3](./phase-4-3-news-article-platform.md)에서 상당 부분
구현돼 있다(아래 "이미 되어 있던 것" 참고) — 남은 심화 연결은
다음 단계로 미룬다.

## 핵심 설계 결정: 이번에도 AI를 새로 호출하지 않는다

Phase 4-2에서 내린 결정(`buildMasterManuscript`는 이미 생성된
article/source로부터 결정적으로 계산한다 — AI 재호출 없음)을 이번
확장에도 그대로 적용했다. 새로 추가한 모든 필드(`factInterpretationSplit`,
`longFormSupport`, `optimizationSupport`)는 기존 `verifiedFacts`/
`sourceSummaries`/article 필드로부터 순수 함수로 계산된다.

- **비용이 전혀 추가되지 않는다**(요청 문서 "15. 비용 최적화 원칙"을
  1차 단계에서 이미 지키는 셈이다).
- 대신 "해석"이나 "예시" 같은 항목은 결정적 로직이 실제로
  통찰력 있는 문장을 만들 수 없다는 한계가 있다 — 이 한계를
  `prompts/master-manuscript.md`(신규)와 코드 주석에 명시했다.
  이 문서는 나중에 실제 AI 기반 생성으로 고도화할 때 그대로 시스템
  프롬프트로 쓸 수 있는 계약이기도 하다.

## 1. 마스터 원고 생성 prompt 고도화

`prompts/master-manuscript.md`(신규)를 만들었다. 요청 문서 "10.
마스터 원고 prompt 작성"이 요구한 지시사항(최종 게시글 금지, 사실/
해석 분리, sourceId 연결, 확인 필요 사항 분리, longFormSupport/
platformBriefs/optimizationSupport 생성, 비용 원칙)을 모두 담았다.
동시에 "현재는 AI 호출이 아니라 결정적 로직으로 이 계약을
구현한다"는 것과 그 이유를 문서 안에 명시했다 — 계약 문서와 실제
구현 방식이 다르다는 사실을 숨기지 않는다.

## 2. 마스터 원고 출력 구조 확장

`lib/articles/master-manuscript-types.ts`에 요청 문서 "9. 마스터
원고 출력 구조"의 스키마를 반영했다. 기존 필드(Phase 4-2)는 전혀
바꾸지 않고 다음을 추가했다.

| 추가 필드 | 설명 |
|---|---|
| `MasterManuscriptSourceSummary.verifiedFacts`/`cautions`/`reliabilityNote` | 출처별로 "확인된 사실"과 "주의할 점"을 명시적으로 분리(발행처/발행일 존재 여부로 기계적으로 판단 — 주관적 신뢰도 평가 아님) |
| `factInterpretationSplit` | `verifiedFacts` 각각에 대응하는 해석 자리(항상 "해석"임을 명시하는 문구, 없는 통찰을 지어내지 않는다) |
| `theme.region`/`theme.topicType` | 지역/국가 범위(확인 정보 없으면 "확인 필요"), 주제 유형(article 생성 방향 라벨 재사용) |
| `titleCandidates.newsArticle` | 언론 기사형 제목 후보 |
| `longFormSupport` | 장문 설계도(아래 3번) |
| `optimizationSupport` | EEAT/SEO/AEO/GEO/AGENT 재료(아래 4번) |

## 3. 장문 대응 구조 — `longFormSupport`

`recommendedLength`/`sourceSufficiency`는 출처 개수 기준으로
계산한다(5건 이상 "장문 권장", 3~4건 "중간 분량", 그 미만 "단문
권장, 무리하게 늘리지 말 것"). `sectionPlan`은 배경 설명 +
`supportingMessages` + (확인 필요 사항이 있으면 그 섹션) + 결론으로
구성한 문단/섹션 목록이다. `evidenceMap`은 `verifiedFacts`를
`{claim, sourceIds}` 형태로 그대로 매핑한다(마스터 원고 안에서
같은 사실을 두 번 다른 이름으로 만들지 않는다). `examplesAndAnalogies`
는 출처 기반 재료가 없으면 항상 빈 배열이다 — 근거 없는 예시를
지어내지 않는다는 원칙을 코드로 강제했다.

- **`newsArticleExpansion`**: `angle`/`fiveWOneH`(육하원칙 자리)/
  `bodyStructure`/`sourcesToUse`/`expressionsToAvoid` 등을 담는다.
  `fiveWOneH`의 각 항목은 실제로 확인되지 않으면 "확인 필요"로
  채운다(빈 문자열이나 지어낸 답을 넣지 않는다).
- **`monetizedBlogExpansion`**: `primaryKeyword`/`secondaryKeywords`는
  article의 SEO 필드를 재사용하고, `comparisonTableCandidates`/
  `faqCandidates`/`checklistCandidates`는 기존 `platformBriefs.wordpressBlog`
  계산 로직과 같은 재료(`verifiedFacts`/`verificationNeeded`)를
  공유한다 — 같은 사실을 다른 이름으로 두 번 계산하지 않는다.

## 4. EEAT/SEO/AEO/GEO/AGENT 대응 — `optimizationSupport`

각각을 장황한 글이 아니라 재료로만 구조화했다.

- **`eeatNotes`**: `hasOfficialSource`는 발행처 이름에 "정부/청/부/
  공식/위원회/협회/공단" 같은 키워드가 있을 때만 true다(주관적
  판단이 아니라 문자열 패턴 검사). `sourceGaps`는 출처가 3건 미만일
  때만 채워진다.
- **`seoSupport`**: `primaryKeyword`/`secondaryKeywords`/`searchIntent`는
  article의 기존 SEO 필드를 그대로 재사용한다(새로 추정하지 않는다).
- **`aeoSupport`**: `mainQuestion`/`shortAnswer`/`faqCandidates`를
  담아 "짧은 직접 답변" 형태의 질의응답 재료를 만든다.
- **`geoSupport`**: `keyFacts`는 `verifiedFacts`와 동일한 사실
  목록이고, `sourceBackedClaims`는 그중 confidence가 "high"(교차
  확인된 것)만 추린다 — AI 검색 요약에 넣을 때 더 신뢰도 높은
  사실만 우선하도록.
- **`agentReadiness`**: `sourceMap`은 `{sourceId, title, url}`만
  담고 출처 요약 원문은 포함하지 않는다(AI Agent가 구조만 읽고
  필요하면 원문은 별도로 조회하게 하기 위함 — 프롬프트 크기를
  키우지 않는다).

## 5. 마스터 원고 검토 기준 확장

`autoReviewCriteria`(마스터 원고 자체의 자동 검토 기준, Phase 4-2에서
8개였던 것)를 요청 문서 "11. 마스터 원고 검토 기준"에 맞춰 13개로
확장했다 — sourceId 연결 여부, longFormSupport/evidenceMap 존재
여부, optimizationSupport 존재 여부, 확인 필요 사항이 사실로
처리되지 않았는지 등을 추가했다. 이 배열은 여전히 "사람이 읽는
문장 목록"이며, 각 항목을 실제로 자동 판정하는 평가기(evaluator)는
이번 phase에 만들지 않았다(아래 "다음 단계" 참고) — Phase 4-2와
같은 최소 범위를 유지했다.

## 6. 안전 원칙 재확인

- **확인 필요 사항이 확인된 사실로 섞이지 않는다**: `verificationNeeded`
  는 `verifiedFacts`에서 파생된 별도 배열이지, `verifiedFacts` 자체를
  수정하거나 거기 다시 채워 넣지 않는다 — 테스트로 이 분리를
  명시적으로 검증했다.
- 금지/주의 표현(`prohibitedOrCarefulExpressions`)은 항상 채워진다
  (`BASE_PROHIBITED_PATTERNS` 재사용, 새로 정의하지 않는다).
- 자동 검토는 여전히 사람의 최종 승인을 대체하지 않는다, 승인 전
  export/Draft는 차단된다, 자동 public publish는 실행되지 않는다 —
  이 원칙들을 강제하는 기존 코드(`social-post-approval-service.ts`
  등)는 이번 phase에서 전혀 건드리지 않았다.

## 이미 되어 있던 것(재확인, 이번에 새로 만들지 않음)

- **UI 용어("마스터 원고 만들기" 등)**: Phase 4-1에서 이미 완료.
- **3종류 article mode를 고급 옵션으로**: Phase 4-1에서 이미 완료.
- **플랫폼별 brief 우선 사용(`getPlatformBrief`)**: Phase 4-2에서
  이미 완료 — `platformBriefs`는 여전히 플랫폼별 글 생성이 참조하는
  유일한 진입점이다.
- **news_article 플랫폼**: Phase 4-3에서 이미 완료.
- **비용 최적화 상한선**(`MAX_SOURCE_SUMMARIES_IN_MASTER_MANUSCRIPT`
  등): Phase 4-4에서 이미 완료 — 이번에 추가한 새 필드들도 모두 이미
  상한이 걸린 `sourceSummaries`/`verifiedFacts`로부터 계산되므로
  같은 상한을 자동으로 물려받는다(추가 상한 설정이 필요 없었다).

## 다음 단계(이번 phase에 포함하지 않음)

원 요청의 "18. 작업 범위 조절"에 따라 다음은 후속 작업으로 미룬다.

- **3차 — 플랫폼별 생성에 `longFormSupport`/`optimizationSupport`
  깊이 연결**: 현재 `SocialWritingContext.platformBrief`(Phase 4-2)는
  `platformBriefs`만 전달하고, 새로 추가한 `longFormSupport.newsArticleExpansion`/
  `monetizedBlogExpansion`이나 `optimizationSupport`의 세부 항목은
  아직 플랫폼별 생성 prompt에 연결하지 않았다. 요청 문서 "12.
  플랫폼별 글 생성과의 연결"이 제시한 세부 입력 조합(예: wordpress_blog는
  `evidenceMap` + `optimizationSupport.seoSupport`/`aeoSupport`/
  `geoSupport`/`agentReadiness` 일부까지)은 각 플랫폼 prompt(`prompts/social/*.md`)와
  `assembleSocialWritingPrompt`를 함께 재검토해야 하는 더 큰 작업이라
  분리했다.
- **마스터 원고 자동 검토 평가기**: `autoReviewCriteria`는 여전히
  "문장 목록"이다. 각 기준을 실제로 pass/fail 판정하는 rule-based
  evaluator(`lib/social/social-quality-gate.ts`와 비슷한 구조)는
  만들지 않았다.
- **`/articles/[id]`의 "마스터 원고 정보" 섹션에 새 필드 노출**:
  Phase 4-4에서 만든 섹션은 여전히 `sourceSummaries`/`verifiedFacts`/
  `verificationNeeded` 개수만 보여준다 — `factInterpretationSplit`/
  `longFormSupport`/`optimizationSupport`를 화면에 추가로 보여주는
  것은 이번 범위에 포함하지 않았다(내부 데이터 구조 확장이 이번
  phase의 핵심이었고, UI 노출 확장은 실제 활용도를 본 뒤 판단하는
  것이 안전하다고 봤다).

## 영향받지 않는 것

- 기존 `platformBriefs` 6개 그룹의 필드/계산 로직은 전혀 바꾸지
  않았다.
- `SocialWritingContext`/`assembleSocialWritingPrompt`(Phase 4-2/4-4)는
  전혀 건드리지 않았다 — 여전히 `platformBriefs`만 프롬프트에
  전달한다.
- DB schema는 전혀 바꾸지 않았다(`format_metadata.master_manuscript`
  jsonb에 필드가 늘어났을 뿐이다).
- 기존 6개 플랫폼 + news_article의 생성/검토/승인/export 흐름은
  전혀 건드리지 않았다.
- 자동 public publish는 추가하지 않았다.

## 테스트

- `lib/articles/master-manuscript-builder.test.ts`: 19개 테스트
  추가(기존 13개 → 32개) — `factInterpretationSplit`(사실 대응/
  caution/사실 그대로 복제하지 않음), `longFormSupport`(sectionPlan/
  evidenceMap/faqBank/newsArticleExpansion/monetizedBlogExpansion/
  출처 충분도/예시 미조작), `optimizationSupport`(5개 하위 구조 존재,
  SEO 키워드 재사용, GEO keyFacts 일치, AGENT sourceMap이 원문을
  포함하지 않음, EEAT 공식출처 판정), `theme.region`/`topicType`/
  `titleCandidates.newsArticle`, 확장된 `autoReviewCriteria`, 확인
  필요 사항과 확인된 사실의 분리 안전성.
- 전체 `npx vitest run`: 221 files / 2822 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류.
- `npm run build`: 성공.

## 관련 문서

- [`phase-4-1-master-manuscript-terminology.md`](./phase-4-1-master-manuscript-terminology.md)
- [`phase-4-2-platform-brief-structuring.md`](./phase-4-2-platform-brief-structuring.md)
- [`phase-4-3-news-article-platform.md`](./phase-4-3-news-article-platform.md)
- [`phase-4-4-master-manuscript-cost-and-rollout.md`](./phase-4-4-master-manuscript-cost-and-rollout.md)
- [`../prompts/master-manuscript.md`](../prompts/master-manuscript.md) — 마스터 원고 생성 계약
